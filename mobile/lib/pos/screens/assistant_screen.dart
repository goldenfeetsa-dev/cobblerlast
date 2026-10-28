import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/api_client.dart';
import '../../core/rest.dart';
import '../../state/auth_controller.dart';
import '../../state/order_service.dart';
import '../assistant_nlu.dart';
import '../pos_ui.dart';

const _suggest = ['افتح الشركات', 'وش التسليمات المتأخرة؟', 'كم إيراد اليوم؟', 'مين الشركات اللي عليها مبالغ؟', 'مساعدة'];
const _help = '''أقدر أسوي لك:
• «افتح الشركات / الفواتير / الطلبات …» — أفتح الصفحة
• «ORD-01002 جاهز» أو «سلمت طلب 1002» — أغيّر حالة الطلب (بعد تأكيدك)
• «دور على أحمد» أو «وين طلب 1002» — أبحث عن طلب
• «كم طلب اليوم؟» · «وش التسليمات المتأخرة؟» · «كم إيراد اليوم/الأسبوع/الشهر؟» · «مين الشركات اللي عليها مبالغ؟»''';

final _advisory = RegExp(
    r'(قترح|رايك|رايكم|نصيح|تنصح|انصح|استشير|ناقش|نناقش|كيف ازيد|كيف اطور|كيف احسن|كيف اقلل|كيف اتعامل|ليش|ليه|لماذا|افضل|ايش الحل|وش الحل|حل لمشكل|حلول|مشكله|تتوقع|تحليل|حلل|قارن|خطه|فكره|افكار|ساعدني افكر|وش اسوي|ايش اسوي|شو اعمل|اسوي ايش|ايش رايك|وش رايك|ممكن اسوي|تفكر)');
const _mutating = {'set_status', 'set_delivery', 'add_note', 'set_shelf', 'book', 'new_order'};

String _money(Object? n) {
  final v = (n is num ? n : num.tryParse('$n') ?? 0).toDouble();
  final s = v.toStringAsFixed(v.truncateToDouble() == v ? 0 : 2);
  return '${s.replaceAllMapped(RegExp(r'(\d)(?=(\d{3})+(?!\d))'), (m) => '${m[1]},')} ر.س';
}

class _Msg {
  _Msg(this.role, this.content, {this.error = false, this.relogin = false});
  final String role, content;
  final bool error, relogin;
}

/// المساعد الذكي — نفس /assistant: أوامر بالكتابة، يجيب من بيانات النظام
/// (قراءة فقط) وأي تعديل يحتاج زر «تأكيد». الذكاء الصناعي عبر نفس بوابة الموقع.
class AssistantScreen extends StatefulWidget {
  const AssistantScreen({super.key, required this.onNavigate});
  final ValueChanged<String> onNavigate;
  @override
  State<AssistantScreen> createState() => _AssistantScreenState();
}

class _AssistantScreenState extends State<AssistantScreen> {
  final _msgs = <_Msg>[_Msg('assistant', 'هلا! أنا مساعد إبرة وخيط. أنفّذ أوامرك بالكتابة: أفتح الصفحات، أغيّر حالة الطلب، وأجيب الأرقام. اكتب «مساعدة» لأوريك الأوامر.')];
  final _input = TextEditingController();
  final _scroll = ScrollController();
  bool _busy = false;
  List<Map<String, dynamic>>? _pending;
  String? _after;

  ApiClient get _api => context.read<ApiClient>();

  @override
  void dispose() {
    _input.dispose();
    _scroll.dispose();
    super.dispose();
  }

  void _say(String content, {bool error = false}) {
    if (!mounted) return;
    setState(() => _msgs.add(_Msg('assistant', content, error: error, relogin: content.contains('انتهت الجلسة'))));
    _toBottom();
  }

  void _toBottom() => WidgetsBinding.instance.addPostFrameCallback((_) {
        if (_scroll.hasClients) _scroll.animateTo(_scroll.position.maxScrollExtent, duration: const Duration(milliseconds: 250), curve: Curves.easeOut);
      });

  Future<dynamic> _post(Map<String, dynamic> body) => _api.request('POST', '/api/secure/data', query: {'resource': 'assistant'}, data: body);

  Future<dynamic> _tool(String tool, Map<String, dynamic> input) async {
    try {
      final r = await _post({'tool': tool, 'input': input});
      return r is Map ? r['data'] : null;
    } on ApiException catch (e) {
      throw Exception(e.status == 401 ? 'انتهت الجلسة — سجّل دخول من جديد.' : 'تعذّر جلب البيانات الحين.');
    }
  }

  String _format(String tool, dynamic d) {
    if (tool == 'find_orders') {
      final l = d is List ? d : const [];
      if (l.isEmpty) return 'ما لقيت طلبات مطابقة.';
      return l.take(8).map((o) {
        final m = o as Map;
        return '• ${m['order_number']} — ${m['customer_name'] ?? 'بدون اسم'} — ${assistantStatusAr[m['status']] ?? m['status']}${m['delivery_date'] != null ? ' — تسليم ${m['delivery_date']}' : ''}${m['total_price'] != null ? ' — ${_money(m['total_price'])}' : ''}';
      }).join('\n');
    }
    if (tool == 'deliveries') {
      final l = (d is Map ? d['orders'] as List? : null) ?? const [];
      if (l.isEmpty) return 'ما فيه تسليمات متأخرة ولا قريبة. الله يعطيك العافية 👌';
      return 'عندك ${l.length} طلب لازم يتسلم:\n${l.take(10).map((o) => '• ${(o as Map)['order_number']} — ${o['customer_name'] ?? ''} — ${o['timing']} (${o['delivery_date']})').join('\n')}';
    }
    if (tool == 'counts_today') {
      final c = (d is Map ? d['by_status'] as Map? : null) ?? const {};
      final parts = c.entries.map((e) => '${assistantStatusAr[e.key] ?? e.key}: ${e.value}').join('، ');
      return 'اليوم تسجّل ${d is Map ? d['registered_today'] ?? 0 : 0} طلب${parts.isNotEmpty ? ' — $parts' : ''}.';
    }
    if (tool == 'revenue' && d is Map) {
      final p = {'today': 'اليوم', 'week': 'آخر 7 أيام', 'month': 'آخر 30 يوم'}[d['period']] ?? '';
      return 'إيراد $p (شامل الضريبة): ${_money(d['grand_total'])}\n• إصلاح: ${_money(d['repair_orders_total'])}\n• مبيعات منتجات: ${_money(d['product_sales_total'])}';
    }
    if (tool == 'partners_due') {
      final l = d is List ? d : const [];
      if (l.isEmpty) return 'ما فيه شركات مسجلة.';
      return l.map((p) {
        final m = p as Map;
        final soon = num.tryParse('${m['due_soon_total'] ?? 0}') ?? 0;
        return '• ${m['name']}: غير مسدد ${_money(m['unpaid_total'])} — مستحق الآن ${_money(m['due_now_total'])}${soon != 0 ? ' — قريب ${_money(soon)}' : ''}';
      }).join('\n');
    }
    return 'تم.';
  }

  Future<({String? reply, List<Map<String, dynamic>> actions, String? code, String? msg})> _askAI(String text) async {
    final history = [
      for (final m in _msgs.skip(1).toList().reversed.take(10).toList().reversed) {'role': m.role, 'content': m.content},
    ];
    try {
      final r = await _post({'text': text, 'history': history});
      if (r is Map && r['reply'] != null) {
        final list = <Map<String, dynamic>>[
          if (r['actions'] is List) ...(r['actions'] as List).whereType<Map>().map((m) => m.map((k, v) => MapEntry('$k', v))),
          if (r['actions'] is! List && r['action'] is Map) (r['action'] as Map).map((k, v) => MapEntry('$k', v)),
        ];
        return (reply: '${r['reply']}', actions: list, code: null, msg: null);
      }
      return (reply: null, actions: const <Map<String, dynamic>>[], code: 'ai_failed', msg: 'تعذّر الاتصال بالعقل الذكي الحين.');
    } on ApiException catch (e) {
      if (e.message.contains('ai_not_configured')) {
        return (
          reply: null,
          actions: const <Map<String, dynamic>>[],
          code: 'ai_not_configured',
          msg: 'للنقاش والاستشارة أحتاج «العقل الذكي» مفعّلاً من إعدادات الموقع (مفتاح الذكاء في Vercel). الأوامر والأرقام تشتغل بدونه.'
        );
      }
      if (e.status == 401) return (reply: null, actions: const <Map<String, dynamic>>[], code: 'auth', msg: 'انتهت الجلسة — سجّل دخول من جديد.');
      final d = e.message;
      final hint = RegExp(r'_http_(401|403)').hasMatch(d)
          ? 'المفتاح مرفوض (غير صالح أو غير مفعّل للخدمة).'
          : RegExp('_http_429').hasMatch(d)
              ? 'تجاوزت حد الاستخدام المجاني مؤقتاً — جرّب بعد دقيقة.'
              : 'تعذّر الاتصال بالعقل الذكي الحين.';
      return (reply: null, actions: const <Map<String, dynamic>>[], code: 'ai_failed', msg: hint);
    }
  }

  String _describe(Map<String, dynamic> a) {
    final no = a['customer'] != null ? '${a['customer']} (${a['order_number']})' : '${a['order_number']}';
    return switch (a['type']) {
      'set_status' => 'تغيير حالة الطلب $no إلى «${a['label']}»',
      'set_delivery' => 'تغيير موعد تسليم الطلب $no إلى ${a['delivery_date']}',
      'add_note' => 'إضافة ملاحظة على الطلب $no: «${a['note']}»',
      'set_shelf' => 'وضع الطلب $no على الرف ${a['shelf']}',
      'book' => 'حجز موعد لـ${a['customer_name']} (${a['customer_phone']}) يوم ${a['date']} الساعة ${a['time']}${a['service_name'] != null ? ' — ${a['service_name']}' : ''} مع تأكيد واتساب',
      'new_order' => 'إنشاء طلب جديد للعميل ${(a['draft'] as Map?)?['customer_name'] ?? ''}',
      _ => 'تنفيذ الأمر',
    };
  }

  Future<Map<String, dynamic>?> _findOrder(String no) async {
    final r = await context.read<Rest>().select('orders', filters: {'order_number': 'eq.$no'}, order: 'created_at.desc', limit: 1);
    return r.isEmpty ? null : r.first;
  }

  Future<void> _applyOrderChange(Map<String, dynamic> a) async {
    final me = context.read<AuthController>().employee!;
    final rest = context.read<Rest>();
    final audit = context.read<OrderService>();
    try {
      final o = await _findOrder('${a['order_number']}');
      if (o == null) return _say('ما لقيت الطلب ${a['order_number']}.', error: true);
      Map<String, dynamic> changes;
      String done;
      if (a['type'] == 'set_status') {
        if (o['status'] == 'completed' || o['status'] == 'cancelled') {
          return _say('الطلب ${o['order_number']} حالته الحالية «${assistantStatusAr[o['status']]}» ولا يتغيّر.');
        }
        changes = {'status': a['status'], if (me.role == 'staff') ...{'worker_id': me.id, 'worker_name': me.name}};
        done = 'تمام ✅ الطلب ${o['order_number']} صار «${a['label']}».';
      } else if (a['type'] == 'add_note') {
        changes = {'notes': [if ((o['notes'] ?? '').toString().isNotEmpty) o['notes'], '[المساعد] ${a['note']}'].join('\n')};
        done = 'تمام ✅ سجلت الملاحظة على الطلب ${o['order_number']}.';
      } else if (a['type'] == 'set_shelf') {
        changes = {'shelf_location': a['shelf']};
        done = 'تمام ✅ حطيت الطلب ${o['order_number']} على الرف ${a['shelf']}.';
      } else {
        changes = {'delivery_date': a['delivery_date']};
        done = 'تمام ✅ غيّرت موعد التسليم للطلب ${o['order_number']}.';
      }
      await rest.update('orders', '${o['id']}', changes, select: 'id');
      audit.audit(me, action: 'update', page: 'المساعد الذكي', entity: 'order', entityId: '${o['id']}', details: {'order_number': o['order_number'], 'changes': changes});
      _say(done);
    } on ApiException catch (e) {
      _say('ما قدرت أنفّذ: ${e.status == 403 ? 'ليس لديك صلاحية' : e.message}', error: true);
    }
  }

  Future<void> _book(Map<String, dynamic> a) async {
    try {
      final r = await _post({'book': a});
      if (r is Map && r['ok'] == true) {
        return _say('تمام ✅ تم الحجز (${r['booking_number']}).${r['whatsapp_sent'] == true ? ' وأرسلت للعميل تأكيد واتساب.' : ' (ما انرسل واتساب — راجع إعدادات الواتساب).'}');
      }
      _say('ما قدرت أحجز.', error: true);
    } on ApiException catch (e) {
      _say(e.message.contains('slot_taken') ? 'الوقت هذا مو متاح، جرّب وقت ثاني.' : 'ما قدرت أحجز: ${e.message}', error: true);
    }
  }

  Future<void> _runPending(List<Map<String, dynamic>> list, String? after) async {
    for (final a in list) {
      if (a['type'] == 'book') {
        await _book(a);
      } else if (a['type'] == 'new_order') {
        _say('أفتح لك صفحة الطلب الجديد…');
        Future.delayed(const Duration(milliseconds: 700), () => widget.onNavigate('new-order'));
        return;
      } else {
        await _applyOrderChange(a);
      }
    }
    final sec = after == null ? null : pathToSection(after);
    if (sec != null) Future.delayed(const Duration(milliseconds: 700), () => widget.onNavigate(sec));
  }

  Future<void> _confirm() async {
    final p = _pending;
    if (p == null || _busy) return;
    final after = _after;
    setState(() {
      _pending = null;
      _busy = true;
    });
    try {
      await _runPending(p, after);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  void _cancel() {
    setState(() => _pending = null);
    _say('تمام، لغيتها.');
  }

  void _sayAI(String reply, List<Map<String, dynamic>> list) {
    final mut = list.where((a) => _mutating.contains(a['type'])).toList();
    final nav = list.reversed.where((a) => a['type'] == 'navigate').firstOrNull;
    if (mut.isEmpty) {
      _say(reply);
      final sec = nav == null ? null : pathToSection('${nav['path']}');
      if (sec != null) Future.delayed(const Duration(milliseconds: 900), () => widget.onNavigate(sec));
      return;
    }
    setState(() {
      _pending = mut;
      _after = nav?['path']?.toString();
    });
    _say('$reply\nبنفّذ:\n${[for (var k = 0; k < mut.length; k++) '${k + 1}) ${_describe(mut[k])}'].join('\n')}\nأأكّد؟ اضغط «تأكيد» أو «إلغاء» (أو اكتب تمام / لا).');
  }

  Future<void> _handle(String text) async {
    if (RegExp(r'^(خروج|انهاء|إنهاء|مع السلامه|مع السلامة|سلام)$').hasMatch(text.trim())) return _say('مع السلامة! 👋');
    if (_pending != null) {
      final t = normalizeAr(text);
      const yesW = ['ايوه', 'ايوا', 'نعم', 'اكيد', 'تمام', 'ايه', 'اي', 'ماشي', 'اوكي', 'ok', 'yes', 'نفذ', 'اوافق', 'طيب', 'يلا', 'ايوة'];
      const noW = ['لا', 'لأ', 'الغ', 'الغي', 'لا تنفذ', 'كنسل', 'cancel', 'no', 'مو'];
      bool match(List<String> ws) => ws.any((w) => t == normalizeAr(w) || t.startsWith('${normalizeAr(w)} '));
      if (match(yesW)) {
        final p = _pending!, after = _after;
        setState(() => _pending = null);
        return _runPending(p, after);
      }
      if (match(noW)) return _cancel();
      setState(() => _pending = null);
    }
    final norm = normalizeAr(text);
    final words = norm.split(' ').length;
    final advisory = _advisory.hasMatch(norm);
    final cmd = parseCommand(text);
    final type = cmd['type'];
    final aiFirst = advisory || type == 'unknown' || ((type == 'tool' || type == 'find_orders') && words > 3);
    if (aiFirst) {
      final r = await _askAI(text);
      if (r.reply != null) return _sayAI(r.reply!, r.actions);
      if (advisory || type == 'unknown') return _say(r.msg ?? 'تعذّر الرد.', error: true);
    }
    try {
      switch (type) {
        case 'greet':
          return _say('هلا والله! وش تبي أسوي لك؟ اكتب «مساعدة» وأقولك وش أقدر.');
        case 'help':
          return _say(_help);
        case 'navigate':
          _say('تمام، أفتح «${cmd['label']}».');
          Future.delayed(const Duration(milliseconds: 600), () => widget.onNavigate('${cmd['section']}'));
          return;
        case 'set_status':
          setState(() {
            _pending = [cmd];
            _after = null;
          });
          return _say('أغيّر حالة الطلب ${cmd['order_number']} إلى «${cmd['label']}»؟ اضغط «تأكيد» أو «إلغاء» (أو اكتب تمام / لا).');
        case 'tool':
        case 'find_orders':
          final tool = type == 'find_orders' ? 'find_orders' : '${cmd['tool']}';
          final input = type == 'find_orders' ? {'query': cmd['query'], 'limit': 8} : Map<String, dynamic>.from(cmd['input'] as Map);
          return _say(_format(tool, await _tool(tool, input)));
      }
      final r = await _askAI(text);
      if (r.reply != null) return _sayAI(r.reply!, r.actions);
      if (r.code != 'ai_not_configured') return _say(r.msg ?? 'تعذّر الرد.', error: true);
      _say('ما فهمت قصدك 🙏 جرّب صيغة ثانية، أو اكتب «مساعدة» وأوريك الأوامر.\n\n$_help');
    } catch (e) {
      _say(e.toString().replaceFirst('Exception: ', ''), error: true);
    }
  }

  Future<void> _send([String? raw]) async {
    final text = (raw ?? _input.text).trim();
    if (text.isEmpty || _busy) return;
    _input.clear();
    setState(() {
      _msgs.add(_Msg('user', text));
      _busy = true;
    });
    _toBottom();
    try {
      await _handle(text);
    } finally {
      if (mounted) setState(() => _busy = false);
      _toBottom();
    }
  }

  @override
  Widget build(BuildContext context) {
    final last = _msgs.reversed.where((m) => m.role == 'assistant' && !m.error).firstOrNull;
    return Align(
      alignment: Alignment.topCenter,
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 860),
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 12),
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            const PageHeader(title: 'المساعد الذكي', subtitle: 'متصل بالبيانات الحيّة · قراءة فقط · أي تعديل يحتاج تأكيدك', icon: Icons.auto_awesome_rounded, tone: Tone.purple),
            Expanded(
              child: GlassCard(
                padding: const EdgeInsets.all(10),
                child: ListView(controller: _scroll, children: [
                  for (final m in _msgs) _bubble(m),
                  if (_busy)
                    const Padding(
                      padding: EdgeInsets.all(8),
                      child: Row(children: [
                        SizedBox(width: 14, height: 14, child: CircularProgressIndicator(strokeWidth: 2)),
                        SizedBox(width: 8),
                        Text('أقرأ بيانات النظام وأحلّلها…', style: TextStyle(fontSize: 12, color: Pos.muted)),
                      ]),
                    ),
                ]),
              ),
            ),
            if (_msgs.length <= 2)
              Padding(
                padding: const EdgeInsets.only(top: 8),
                child: Wrap(spacing: 6, runSpacing: 6, children: [for (final s in _suggest) PillChip(label: s, selected: false, onTap: () => _send(s))]),
              ),
            if (last != null && _msgs.length > 1)
              Padding(
                padding: const EdgeInsets.only(top: 8),
                child: Wrap(spacing: 6, children: [
                  OutlineSmall(
                    label: 'نسخ الرد',
                    icon: Icons.copy_rounded,
                    onPressed: () {
                      Clipboard.setData(ClipboardData(text: last.content));
                      toast(context, 'تم النسخ');
                    },
                  ),
                  OutlineSmall(
                    label: 'إرسال الرد واتساب',
                    icon: Icons.chat_rounded,
                    onPressed: () => launchUrl(Uri.parse('https://wa.me/?text=${Uri.encodeComponent(last.content)}'), mode: LaunchMode.externalApplication),
                  ),
                ]),
              ),
            if (_pending != null)
              Container(
                margin: const EdgeInsets.only(top: 10),
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(color: Colors.white, border: Border.all(color: Pos.fg), borderRadius: BorderRadius.circular(14)),
                child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                  const Text('يحتاج تأكيدك قبل التنفيذ', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: Color(0xFF9A6700))),
                  const SizedBox(height: 6),
                  for (final a in _pending!) Text('• ${_describe(a)}', style: const TextStyle(fontSize: 13)),
                  const SizedBox(height: 10),
                  Row(children: [
                    Expanded(child: PrimaryButton(label: 'تأكيد التنفيذ', expand: true, busy: _busy, onPressed: _confirm)),
                    const SizedBox(width: 8),
                    Expanded(child: OutlineSmall(label: 'إلغاء', onPressed: _busy ? null : _cancel)),
                  ]),
                ]),
              ),
            const SizedBox(height: 10),
            Row(children: [
              Expanded(
                child: TextField(
                  controller: _input,
                  onSubmitted: (_) => _send(),
                  textInputAction: TextInputAction.send,
                  onChanged: (_) => setState(() {}),
                  decoration: const InputDecoration(hintText: 'اكتب أمرك أو سؤالك…'),
                ),
              ),
              const SizedBox(width: 8),
              IconButton.filled(onPressed: _busy || _input.text.trim().isEmpty ? null : _send, icon: const Icon(Icons.send_rounded)),
            ]),
          ]),
        ),
      ),
    );
  }

  Widget _bubble(_Msg m) {
    final user = m.role == 'user';
    return Align(
      alignment: user ? AlignmentDirectional.centerStart : AlignmentDirectional.centerEnd,
      child: Container(
        constraints: const BoxConstraints(maxWidth: 620),
        margin: const EdgeInsets.symmetric(vertical: 5),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        decoration: BoxDecoration(
          color: user ? Pos.primary : (m.error ? const Color(0xFFFEF2F2) : Colors.white),
          borderRadius: BorderRadius.circular(14),
          border: user ? null : Border.all(color: m.error ? Pos.red.withValues(alpha: .4) : Pos.border),
        ),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
          SelectableText(m.content, style: TextStyle(fontSize: 14, height: 1.6, color: user ? Colors.white : (m.error ? Pos.red : Pos.fg))),
          if (m.relogin)
            Padding(
              padding: const EdgeInsets.only(top: 8),
              child: PrimaryButton(label: 'تسجيل دخول من جديد', onPressed: () => context.read<AuthController>().logout()),
            ),
        ]),
      ),
    );
  }
}
