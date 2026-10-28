import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/api_client.dart';
import '../../core/rest.dart';
import '../../models/order.dart';
import '../../state/auth_controller.dart';
import '../pos_ui.dart';

const _gold = Color(0xFFC9A84C);
const _brown = Color(0xFF1A0F00);

// ───────────────────────── بطاقات الولاء (الختمات) ─────────────────────────

/// بطاقات الولاء — نفس /loyalty: العملاء وختماتهم، إصدار بطاقة، الإعدادات (للإدارة).
class LoyaltyCardsScreen extends StatefulWidget {
  const LoyaltyCardsScreen({super.key});
  @override
  State<LoyaltyCardsScreen> createState() => _LoyaltyCardsScreenState();
}

class _LoyaltyCardsScreenState extends State<LoyaltyCardsScreen> {
  int _tab = 0;
  List<Map<String, dynamic>>? _cards;
  Map<String, dynamic> _settings = {};
  String? _error;
  String _q = '';
  bool _saving = false;
  final _set = <String, TextEditingController>{};

  bool get _admin => {'owner', 'admin', 'manager'}.contains(context.read<AuthController>().employee?.role);

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    for (final c in _set.values) {
      c.dispose();
    }
    super.dispose();
  }

  TextEditingController _sc(String k, [String def = '']) => _set.putIfAbsent(k, () => TextEditingController(text: '${_settings[k] ?? def}'));

  Future<void> _load() async {
    final rest = context.read<Rest>();
    try {
      final r = await Future.wait([
        rest.select('loyalty_cards', order: 'updated_at.desc', limit: 1000),
        rest.select('loyalty_settings', limit: 1).catchError((_) => <Map<String, dynamic>>[]),
      ]);
      if (!mounted) return;
      setState(() {
        _cards = r[0];
        _settings = r[1].isEmpty ? {} : r[1].first;
        for (final c in _set.values) {
          c.dispose();
        }
        _set.clear();
        _error = null;
      });
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    }
  }

  Future<void> _sendNotifs() async {
    try {
      final r = await context.read<ApiClient>().request('POST', '/sb/functions/v1/loyalty-notify', data: {'mode': 'pending'});
      if (mounted) toast(context, '✅ تم إرسال ${r is Map ? r['sent'] ?? 0 : 0} إشعار');
    } on ApiException catch (e) {
      if (mounted) toast(context, 'فشل الإرسال: ${e.message}', error: true);
    }
  }

  Future<void> _saveSettings() async {
    final rest = context.read<Rest>();
    final row = <String, dynamic>{
      'program_name': _sc('program_name').text.trim(),
      'free_after': (int.tryParse(_sc('free_after', '3').text) ?? 3).clamp(1, 20),
      'brand_color': _sc('brand_color', '#1A0F00').text.trim(),
      'brand_logo_url': _sc('brand_logo_url').text.trim(),
      'google_issuer_id': _sc('google_issuer_id').text.trim(),
      'google_class_id': _sc('google_class_id', 'cobblerlast_loyalty').text.trim(),
    };
    setState(() => _saving = true);
    try {
      if (_settings['id'] != null) {
        await rest.update('loyalty_settings', '${_settings['id']}', row, select: 'id');
      } else {
        await rest.insert('loyalty_settings', row, select: 'id');
      }
      if (mounted) toast(context, '✅ تم حفظ الإعدادات');
      _load();
    } on ApiException catch (e) {
      if (mounted) toast(context, 'فشل الحفظ: ${e.message}', error: true);
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final cards = _cards ?? const <Map<String, dynamic>>[];
    bool hasFree(Map<String, dynamic> c) {
      final fa = (c['free_after'] as num?)?.toInt() ?? 3;
      final s = (c['stamps'] as num?)?.toInt() ?? 0;
      return s > 0 && fa > 0 && s % fa == 0;
    }

    final f = cards.where((c) => _q.isEmpty || '${c['customer_name'] ?? ''}'.contains(_q) || '${c['customer_phone'] ?? ''}'.contains(_q)).toList();
    int sum(String k) => cards.fold(0, (a, c) => a + ((c[k] as num?)?.toInt() ?? 0));

    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 40),
        physics: const AlwaysScrollableScrollPhysics(),
        children: [
          PageHeader(
            title: 'نظام الولاء',
            subtitle: 'بطاقات العملاء وGoogle Wallet',
            icon: Icons.star_rounded,
            tone: Tone.orange,
            trailing: OutlineSmall(label: 'تحديث', icon: Icons.refresh_rounded, onPressed: _load),
          ),
          if (_error != null) LoadError(message: _error!, onRetry: _load),
          LayoutBuilder(builder: (context, c) {
            final cols = c.maxWidth >= 700 ? 4 : 2;
            final w = (c.maxWidth - (cols - 1) * 10) / cols;
            Widget tile(IconData i, Color col, int v, String l) => SizedBox(
                  width: w,
                  child: GlassCard(
                    padding: const EdgeInsets.all(12),
                    child: Row(children: [
                      Icon(i, size: 30, color: col),
                      const SizedBox(width: 10),
                      Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Text('$v', style: const TextStyle(fontSize: 21, fontWeight: FontWeight.w900)),
                        Text(l, style: const TextStyle(fontSize: 11.5, color: Pos.muted)),
                      ]),
                    ]),
                  ),
                );
            return Wrap(spacing: 10, runSpacing: 10, children: [
              tile(Icons.groups_rounded, Pos.blue, cards.length, 'إجمالي العملاء'),
              tile(Icons.star_rounded, const Color(0xFFD97706), sum('stamps'), 'إجمالي الختمات'),
              tile(Icons.trending_up_rounded, Pos.green, sum('total_orders'), 'خدمات مكتملة'),
              tile(Icons.card_giftcard_rounded, const Color(0xFF9333EA), cards.where(hasFree).length, 'خدمة مجانية جاهزة'),
            ]);
          }),
          const SizedBox(height: 14),
          SegmentedButton<int>(
            segments: [
              const ButtonSegment(value: 0, label: Text('العملاء')),
              const ButtonSegment(value: 1, label: Text('إصدار بطاقة')),
              if (_admin) const ButtonSegment(value: 2, label: Text('الإعدادات')),
            ],
            selected: {_tab},
            showSelectedIcon: false,
            onSelectionChanged: (v) => setState(() => _tab = v.first),
          ),
          const SizedBox(height: 14),
          if (_tab == 0) ...[
            Row(children: [
              Expanded(child: TextField(decoration: const InputDecoration(hintText: 'ابحث بالاسم أو الجوال...', prefixIcon: Icon(Icons.search_rounded)), onChanged: (v) => setState(() => _q = v.trim()))),
              const SizedBox(width: 8),
              OutlineSmall(label: 'إرسال الإشعارات', icon: Icons.notifications_rounded, onPressed: _sendNotifs),
            ]),
            const SizedBox(height: 12),
            if (_cards == null && _error == null)
              const Padding(padding: EdgeInsets.all(50), child: Center(child: CircularProgressIndicator()))
            else if (f.isEmpty)
              EmptyState(icon: Icons.loyalty_outlined, text: _q.isNotEmpty ? 'لا نتائج' : 'لا يوجد عملاء مسجّلين بعد')
            else
              for (final c in f)
                Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: GlassCard(
                    color: hasFree(c) ? const Color(0x1FFDE047) : null,
                    padding: const EdgeInsets.all(12),
                    child: Row(children: [
                      CircleAvatar(
                        radius: 20,
                        backgroundColor: _brown,
                        child: Text('${c['customer_name'] ?? '؟'}'.characters.firstOrNull ?? '؟', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w900)),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                          Text('${c['customer_name'] ?? ''}', style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13.5)),
                          Text('📞 ${c['customer_phone'] ?? ''}', textDirection: TextDirection.ltr, style: const TextStyle(fontSize: 12, color: Pos.muted)),
                        ]),
                      ),
                      Column(children: [
                        Text('${c['stamps'] ?? 0}/${c['free_after'] ?? 3}', style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 17, color: Color(0xFFB45309))),
                        const Text('ختمات', style: TextStyle(fontSize: 10, color: Pos.muted)),
                      ]),
                      const SizedBox(width: 10),
                      hasFree(c) ? const SoftBadge('🎁 خدمة مجانية', Color(0xFFA16207)) : SoftBadge('${c['total_orders'] ?? 0} خدمة', Pos.muted),
                      if ((c['google_pass_url'] ?? '').toString().isNotEmpty)
                        TextButton(onPressed: () => launchUrl(Uri.parse('${c['google_pass_url']}'), mode: LaunchMode.externalApplication), child: const Text('Wallet')),
                    ]),
                  ),
                ),
          ] else if (_tab == 1)
            const _IssueCard()
          else
            GlassCard(
              child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                const Text('إعدادات نظام الولاء', style: TextStyle(fontWeight: FontWeight.w700)),
                const SizedBox(height: 12),
                TextField(controller: _sc('program_name'), decoration: const InputDecoration(labelText: 'اسم البرنامج', hintText: 'بطاقة ولاء إبرة وخيط')),
                const SizedBox(height: 10),
                TextField(
                    controller: _sc('free_after', '3'),
                    keyboardType: TextInputType.number,
                    inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                    decoration: const InputDecoration(labelText: 'عدد الختمات للحصول على خدمة مجانية')),
                const SizedBox(height: 10),
                TextField(controller: _sc('brand_color', '#1A0F00'), textDirection: TextDirection.ltr, decoration: const InputDecoration(labelText: 'لون البراند', hintText: '#1A0F00')),
                const SizedBox(height: 10),
                TextField(controller: _sc('brand_logo_url'), textDirection: TextDirection.ltr, decoration: const InputDecoration(labelText: 'رابط الشعار', hintText: 'https://...')),
                const Divider(height: 28),
                const Text('Google Wallet API', style: TextStyle(fontWeight: FontWeight.w600)),
                const SizedBox(height: 10),
                TextField(controller: _sc('google_issuer_id'), textDirection: TextDirection.ltr, decoration: const InputDecoration(labelText: 'Issuer ID', hintText: '3388000000XXXXXXXX')),
                const SizedBox(height: 10),
                TextField(controller: _sc('google_class_id', 'cobblerlast_loyalty'), textDirection: TextDirection.ltr, decoration: const InputDecoration(labelText: 'Class Suffix')),
                const SizedBox(height: 10),
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(color: const Color(0xFFEFF6FF), border: Border.all(color: const Color(0xFFDBEAFE)), borderRadius: BorderRadius.circular(10)),
                  child: const Text(
                    'خطوات Google Wallet Console:\n١. افتح pay.google.com/business/console\n٢. أنشئ Issuer account ← احفظ الـ Issuer ID هنا\n٣. أنشئ Service Account في Google Cloud ← حمّل الـ JSON\n٤. أضف بيانات الـ Service Account في Supabase Secrets',
                    style: TextStyle(fontSize: 12, color: Color(0xFF1E40AF), height: 1.6),
                  ),
                ),
                const SizedBox(height: 14),
                PrimaryButton(label: 'حفظ الإعدادات', expand: true, busy: _saving, onPressed: _saveSettings),
              ]),
            ),
        ],
      ),
    );
  }
}

/// إصدار/بحث بطاقة — نفس LoyaltyCardWidget (وضع البحث) عبر دالة loyalty-wallet.
class _IssueCard extends StatefulWidget {
  const _IssueCard();
  @override
  State<_IssueCard> createState() => _IssueCardState();
}

class _IssueCardState extends State<_IssueCard> {
  final _phone = TextEditingController();
  final _name = TextEditingController();
  Map<String, dynamic>? _card;
  bool _busy = false;

  Future<Map<String, dynamic>?> _call(Map<String, dynamic> body) async {
    final r = await context.read<ApiClient>().request('POST', '/sb/functions/v1/loyalty-wallet', data: body);
    return r is Map ? r.map((k, v) => MapEntry('$k', v)) : null;
  }

  String _msg(ApiException e) => e.status == 403 ? 'خدمة بطاقات الولاء غير متاحة عبر البوابة حالياً — تحتاج تفعيل من الإدارة' : e.message;

  Future<void> _run(Future<void> Function() f) async {
    setState(() => _busy = true);
    try {
      await f();
    } on ApiException catch (e) {
      if (mounted) toast(context, _msg(e), error: true);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _lookup() => _run(() async {
        final r = await _call({'action': 'get', 'phone': _phone.text.trim()});
        if (!mounted) return;
        if (r?['card'] == null) toast(context, 'ما فيه بطاقة بهذا الرقم — تقدر تصدر بطاقة جديدة', error: true);
        setState(() => _card = (r?['card'] as Map?)?.map((k, v) => MapEntry('$k', v)));
      });

  Future<void> _issue() => _run(() async {
        final r = await _call({'action': 'issue', 'phone': _phone.text.trim(), 'name': _name.text.trim()});
        if (!mounted) return;
        setState(() => _card = (r?['card'] as Map?)?.map((k, v) => MapEntry('$k', v)));
        toast(context, '✅ تم إصدار بطاقة الولاء');
      });

  Future<void> _redeem() => _run(() async {
        final r = await _call({'action': 'redeem', 'phone': '${_card!['customer_phone']}'});
        if (!mounted) return;
        setState(() => _card = (r?['card'] as Map?)?.map((k, v) => MapEntry('$k', v)) ?? _card);
        toast(context, '🎁 تم استخدام الخدمة المجانية بنجاح');
      });

  @override
  Widget build(BuildContext context) {
    final c = _card;
    if (c != null) return _cardView(c);
    return GlassCard(
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        const Text('إصدار بطاقة ولاء جديدة', style: TextStyle(fontWeight: FontWeight.w700)),
        const SizedBox(height: 12),
        Row(children: [
          Expanded(
            child: TextField(
              controller: _phone,
              keyboardType: TextInputType.phone,
              textAlign: TextAlign.center,
              textDirection: TextDirection.ltr,
              maxLength: 10,
              inputFormatters: [FilteringTextInputFormatter.digitsOnly],
              onChanged: (_) => setState(() {}),
              decoration: const InputDecoration(labelText: 'رقم الجوال', hintText: '05XXXXXXXX', counterText: ''),
            ),
          ),
          const SizedBox(width: 10),
          Expanded(child: TextField(controller: _name, onChanged: (_) => setState(() {}), decoration: const InputDecoration(labelText: 'اسم العميل'))),
        ]),
        const SizedBox(height: 12),
        Row(children: [
          Expanded(child: OutlineSmall(label: 'بحث عن البطاقة', icon: Icons.search_rounded, onPressed: _phone.text.isEmpty || _busy ? null : _lookup)),
          const SizedBox(width: 10),
          Expanded(
            child: PrimaryButton(
              label: 'إصدار بطاقة جديدة',
              icon: Icons.star_rounded,
              color: _brown,
              busy: _busy,
              onPressed: _phone.text.isEmpty || _name.text.trim().isEmpty ? null : _issue,
            ),
          ),
        ]),
      ]),
    );
  }

  Widget _cardView(Map<String, dynamic> c) {
    final fa = (c['free_after'] as num?)?.toInt() ?? 3;
    final s = (c['stamps'] as num?)?.toInt() ?? 0;
    final free = s > 0 && s % fa == 0;
    final remaining = free ? 0 : fa - (s % fa);
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      Container(
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(18),
          gradient: const LinearGradient(colors: [_brown, Color(0xFF2C1A00), _gold], stops: [0, .6, 1], begin: Alignment.topRight, end: Alignment.bottomLeft),
          boxShadow: const [BoxShadow(color: Color(0x33000000), blurRadius: 16, offset: Offset(0, 6))],
        ),
        clipBehavior: Clip.antiAlias,
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(18, 18, 18, 10),
            child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  const Text('بطاقة الولاء', style: TextStyle(fontSize: 11.5, color: Color(0xB3FDE68A))),
                  Text('${c['customer_name'] ?? ''}', style: const TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.w900)),
                  Text('${c['customer_phone'] ?? ''}', style: const TextStyle(fontSize: 12, color: Color(0xCCFCD34D))),
                ]),
              ),
              Column(children: [
                Text('$s', style: const TextStyle(color: Color(0xFFFCD34D), fontWeight: FontWeight.w900, fontSize: 24)),
                const Text('ختمة', style: TextStyle(fontSize: 10, color: Color(0x99FDE68A))),
              ]),
            ]),
          ),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 18),
            child: ClipRRect(
              borderRadius: BorderRadius.circular(4),
              child: LinearProgressIndicator(value: fa == 0 ? 0 : (s % fa) / fa, minHeight: 6, backgroundColor: const Color(0x1AFFFFFF), color: const Color(0xFFFBBF24)),
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(18, 4, 18, 10),
            child: Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
              const Text('٠', style: TextStyle(fontSize: 10, color: Color(0x80FDE68A))),
              Text('$fa ختمات = خدمة مجانية', style: const TextStyle(fontSize: 10, color: Color(0x80FDE68A))),
            ]),
          ),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 18),
            child: Wrap(spacing: 8, runSpacing: 8, children: [
              for (var i = 0; i < fa; i++) _stamp(i < s % fa, false),
              _stamp(free, true),
            ]),
          ),
          Padding(
            padding: const EdgeInsets.all(18),
            child: Row(children: [
              Expanded(
                child: free
                    ? PrimaryButton(label: 'استرداد الخدمة المجانية', icon: Icons.card_giftcard_rounded, color: const Color(0xFFFACC15), busy: _busy, onPressed: _redeem)
                    : Text(remaining == 1 ? 'ختمة واحدة للخدمة المجانية 🎯' : '$remaining ختمات للخدمة المجانية', textAlign: TextAlign.center, style: const TextStyle(fontSize: 12.5, color: Color(0xB3FCD34D))),
              ),
              IconButton(
                onPressed: _busy ? null : () => _run(() async {
                      final r = await _call({'action': 'get', 'phone': '${c['customer_phone']}'});
                      if (mounted) setState(() => _card = (r?['card'] as Map?)?.map((k, v) => MapEntry('$k', v)) ?? _card);
                    }),
                icon: const Icon(Icons.refresh_rounded, color: Colors.white),
              ),
            ]),
          ),
          Container(
            color: const Color(0x33000000),
            padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 10),
            child: Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
              Text('${c['total_orders'] ?? 0} خدمة إجمالاً', style: const TextStyle(fontSize: 11.5, color: Color(0x99FDE68A))),
              PosMoney(((c['total_spent'] as num?) ?? 0).toDouble(), size: 11.5, color: const Color(0x99FDE68A), decimals: 0),
              if (c['last_service_at'] != null)
                Text('آخر زيارة: ${fmtDateTime(DateTime.tryParse('${c['last_service_at']}')?.toLocal()).split(' ').first}', style: const TextStyle(fontSize: 11.5, color: Color(0x99FDE68A))),
            ]),
          ),
        ]),
      ),
      const SizedBox(height: 10),
      OutlineSmall(label: 'بحث عن عميل آخر', icon: Icons.search_rounded, onPressed: () => setState(() => _card = null)),
    ]);
  }

  Widget _stamp(bool filled, bool isFree) => Container(
        width: 38,
        height: 38,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          color: isFree ? const Color(0xFFFEFCE8) : (filled ? const Color(0xFFB45309) : const Color(0xFFF9FAFB)),
          border: Border.all(color: isFree ? const Color(0xFFFACC15) : (filled ? const Color(0xFFB45309) : const Color(0xFFE5E7EB)), width: 2),
        ),
        child: Icon(isFree ? Icons.card_giftcard_rounded : (filled ? Icons.check_circle_rounded : Icons.circle_outlined), size: 19, color: isFree ? const Color(0xFFEAB308) : (filled ? Colors.white : const Color(0xFFD1D5DB))),
      );
}

// ───────────────────────── برنامج النقاط ─────────────────────────

const _levelAr = {'Bronze': 'برونزي', 'Silver': 'فضي', 'Gold': 'ذهبي', 'Platinum': 'بلاتيني'};
const _levelColor = {'Bronze': Color(0xFFB45309), 'Silver': Color(0xFF64748B), 'Gold': Color(0xFFCA8A04), 'Platinum': Color(0xFFC026D3)};

/// برنامج الولاء (النقاط) — نفس /loyalty-members: بحث برقم العضوية، إضافة/خصم
/// نقاط بسبب إلزامي، سجل العمليات، وإنشاء عضوية جديدة. عبر /api/loyalty/*.
class LoyaltyMembersScreen extends StatefulWidget {
  const LoyaltyMembersScreen({super.key});
  @override
  State<LoyaltyMembersScreen> createState() => _LoyaltyMembersScreenState();
}

class _LoyaltyMembersScreenState extends State<LoyaltyMembersScreen> {
  final _q = TextEditingController();
  Map<String, dynamic>? _result;
  bool _searched = false, _busy = false;

  ApiClient get _api => context.read<ApiClient>();

  Future<void> _lookup(String no) async {
    setState(() => _busy = true);
    try {
      final r = await _api.request('GET', '/api/loyalty/lookup', query: {'member_number': no});
      if (mounted) setState(() => _result = r is Map ? r.map((k, v) => MapEntry('$k', v)) : null);
    } on ApiException {
      if (mounted) setState(() => _result = null);
    } finally {
      if (mounted) {
        setState(() {
          _busy = false;
          _searched = true;
        });
      }
    }
  }

  Future<void> _adjust(bool add) async {
    final amount = TextEditingController();
    final reason = TextEditingController();
    final ok = await showDialog<bool>(
      context: context,
      builder: (c) => StatefulBuilder(
        builder: (c, setD) => AlertDialog(
          title: Text(add ? 'إضافة نقاط' : 'خصم نقاط'),
          content: SizedBox(
            width: 380,
            child: Column(mainAxisSize: MainAxisSize.min, children: [
              TextField(
                controller: amount,
                keyboardType: TextInputType.number,
                inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                onChanged: (_) => setD(() {}),
                decoration: const InputDecoration(labelText: 'عدد النقاط', hintText: 'مثال: 100'),
              ),
              const SizedBox(height: 10),
              TextField(
                controller: reason,
                maxLines: 2,
                onChanged: (_) => setD(() {}),
                decoration: const InputDecoration(labelText: 'السبب (إلزامي — يُحفظ في سجل التدقيق)', hintText: 'مثال: مكافأة عملية شراء #1234'),
              ),
            ]),
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(c, false), child: const Text('إلغاء')),
            PrimaryButton(
              label: 'تأكيد',
              color: add ? Pos.green : Pos.destructive,
              onPressed: (int.tryParse(amount.text) ?? 0) <= 0 || reason.text.trim().isEmpty ? null : () => Navigator.pop(c, true),
            ),
          ],
        ),
      ),
    );
    if (ok != true || !mounted) return;
    final n = int.parse(amount.text);
    final m = _result!['member'] as Map;
    setState(() => _busy = true);
    try {
      final r = await _api.request('POST', '/api/loyalty/adjust-points', data: {
        'member_number': m['member_number'],
        'change_amount': add ? n : -n,
        'reason': reason.text.trim(),
      });
      if (!mounted) return;
      final pts = r is Map && r['member'] is Map ? r['member']['points'] : null;
      toast(context, add ? '✅ تمت إضافة $n نقطة — الرصيد الآن ${pts ?? ''}' : '✅ تم خصم $n نقطة — الرصيد الآن ${pts ?? ''}');
      if (r is Map && r['leveledUp'] == true) toast(context, '🎉 تمت ترقية العضو إلى المستوى ${r['member']?['membership_level'] ?? ''}');
      await _lookup('${m['member_number']}');
    } on ApiException catch (e) {
      if (mounted) {
        toast(context, e.status == 403 ? 'تعديل النقاط للإدارة فقط' : e.message, error: true);
        setState(() => _busy = false);
      }
    }
  }

  Future<void> _create() async {
    final name = TextEditingController(), phone = TextEditingController(), email = TextEditingController();
    final ok = await showDialog<bool>(
      context: context,
      builder: (c) => StatefulBuilder(
        builder: (c, setD) => AlertDialog(
          title: const Text('إنشاء عضوية ولاء جديدة'),
          content: SizedBox(
            width: 380,
            child: Column(mainAxisSize: MainAxisSize.min, children: [
              TextField(controller: name, onChanged: (_) => setD(() {}), decoration: const InputDecoration(labelText: 'اسم العميل الكامل')),
              const SizedBox(height: 10),
              TextField(controller: phone, keyboardType: TextInputType.phone, textDirection: TextDirection.ltr, onChanged: (_) => setD(() {}), decoration: const InputDecoration(labelText: 'رقم الجوال', hintText: '05xxxxxxxx')),
              const SizedBox(height: 10),
              TextField(controller: email, keyboardType: TextInputType.emailAddress, textDirection: TextDirection.ltr, decoration: const InputDecoration(labelText: 'البريد الإلكتروني (اختياري)')),
            ]),
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(c, false), child: const Text('إلغاء')),
            PrimaryButton(label: 'إنشاء العضوية', onPressed: name.text.trim().isEmpty || phone.text.trim().isEmpty ? null : () => Navigator.pop(c, true)),
          ],
        ),
      ),
    );
    if (ok != true || !mounted) return;
    setState(() => _busy = true);
    try {
      final r = await _api.request('POST', '/api/loyalty/create-member', data: {
        'full_name': name.text.trim(),
        'phone': phone.text.trim(),
        if (email.text.trim().isNotEmpty) 'email': email.text.trim(),
      });
      if (!mounted) return;
      final m = r is Map ? r['member'] as Map? : null;
      toast(context, r is Map && r['alreadyExists'] == true ? 'العميل لديه عضوية ولاء بالفعل بهذا الرقم' : '✅ تم إنشاء عضوية الولاء برقم ${m?['member_number'] ?? ''}');
      if (m != null) {
        _q.text = '${m['member_number']}';
        await _lookup('${m['member_number']}');
      } else {
        setState(() => _busy = false);
      }
    } on ApiException catch (e) {
      if (mounted) {
        toast(context, e.message, error: true);
        setState(() => _busy = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final m = (_result?['member'] as Map?)?.map((k, v) => MapEntry('$k', v));
    final history = (_result?['history'] as List?) ?? const [];
    Widget info(String l, String v, {bool big = false}) => SizedBox(
          width: 160,
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(l, style: const TextStyle(fontSize: 11.5, color: Pos.muted)),
            Text(v, style: big ? const TextStyle(fontSize: 24, fontWeight: FontWeight.w900, color: Color(0xFFCA8A04)) : const TextStyle(fontWeight: FontWeight.w600)),
          ]),
        );
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 40),
      children: [
        PageHeader(
          title: 'برنامج الولاء — النقاط والعضويات',
          icon: Icons.workspace_premium_rounded,
          tone: Tone.orange,
          trailing: PrimaryButton(label: 'عضوية جديدة', icon: Icons.person_add_alt_1_rounded, onPressed: _busy ? null : _create),
        ),
        GlassCard(
          child: Row(children: [
            Expanded(
              child: TextField(
                controller: _q,
                textDirection: TextDirection.ltr,
                onSubmitted: (v) => v.trim().isEmpty ? null : _lookup(v.trim()),
                decoration: const InputDecoration(hintText: 'ابحث برقم العضوية — مثال: NT-A1B2C3D4'),
              ),
            ),
            const SizedBox(width: 8),
            PrimaryButton(label: 'بحث', icon: Icons.search_rounded, busy: _busy, onPressed: () => _q.text.trim().isEmpty ? null : _lookup(_q.text.trim())),
          ]),
        ),
        const SizedBox(height: 14),
        if (_searched && !_busy && m == null) const GlassCard(child: Text('لم يتم العثور على عضو بهذا الرقم.', textAlign: TextAlign.center, style: TextStyle(color: Pos.muted))),
        if (m != null) ...[
          GlassCard(
            child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              Row(children: [
                Expanded(
                  child: Wrap(spacing: 8, crossAxisAlignment: WrapCrossAlignment.center, children: [
                    Text('${m['full_name'] ?? ''}', style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16)),
                    SoftBadge(_levelAr[m['membership_level']] ?? '${m['membership_level'] ?? ''}', _levelColor[m['membership_level']] ?? Pos.muted),
                  ]),
                ),
                IconButton(onPressed: _busy ? null : () => _lookup('${m['member_number']}'), icon: const Icon(Icons.refresh_rounded)),
              ]),
              const SizedBox(height: 10),
              Wrap(spacing: 12, runSpacing: 12, children: [
                info('رقم العضوية', '${m['member_number'] ?? ''}'),
                info('الجوال', '${m['phone'] ?? ''}'),
                info('النقاط الحالية', '${m['points'] ?? 0}', big: true),
                info('البريد', '${(m['email'] ?? '').toString().isEmpty ? '—' : m['email']}'),
              ]),
              const SizedBox(height: 14),
              Wrap(spacing: 10, children: [
                PrimaryButton(label: 'إضافة نقاط', icon: Icons.add_circle_outline_rounded, color: Pos.green, onPressed: _busy ? null : () => _adjust(true)),
                PrimaryButton(label: 'خصم نقاط', icon: Icons.remove_circle_outline_rounded, color: Pos.destructive, onPressed: _busy ? null : () => _adjust(false)),
              ]),
            ]),
          ),
          const SizedBox(height: 12),
          GlassCard(
            child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              const Text('سجل عمليات النقاط', style: TextStyle(fontWeight: FontWeight.w700)),
              const SizedBox(height: 8),
              if (history.isEmpty)
                const Text('لا توجد عمليات مسجّلة بعد.', style: TextStyle(fontSize: 13, color: Pos.muted))
              else
                for (final tx in history.whereType<Map>())
                  Padding(
                    padding: const EdgeInsets.symmetric(vertical: 7),
                    child: Row(children: [
                      Text(((tx['change_amount'] as num?) ?? 0) > 0 ? '+${tx['change_amount']}' : '${tx['change_amount']}',
                          style: TextStyle(fontWeight: FontWeight.w800, color: ((tx['change_amount'] as num?) ?? 0) > 0 ? Pos.green : Pos.red)),
                      const Text('  •  ', style: TextStyle(color: Pos.muted)),
                      Expanded(child: Text('${(tx['reason'] ?? '').toString().isEmpty ? 'بدون سبب مُحدد' : tx['reason']}', style: const TextStyle(fontSize: 13))),
                      Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
                        Text('${tx['performed_by'] ?? '—'}', style: const TextStyle(fontSize: 11, color: Pos.muted)),
                        Text(fmtDateTime(DateTime.tryParse('${tx['created_at']}')?.toLocal()), style: const TextStyle(fontSize: 11, color: Pos.muted)),
                      ]),
                    ]),
                  ),
            ]),
          ),
        ],
      ],
    );
  }
}
