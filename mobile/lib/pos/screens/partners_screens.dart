import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';

import '../../core/api_client.dart';
import '../../state/auth_controller.dart';
import '../pos_ui.dart';

const _brown = Color(0xFF7C4A1E);
double _d(dynamic v) => v is num ? v.toDouble() : double.tryParse('${v ?? ''}') ?? 0;
String _day(dynamic v) => v == null ? '—' : '$v'.length >= 10 ? '$v'.substring(0, 10) : '$v';
String _m(num v) => v.toStringAsFixed(2).replaceAllMapped(RegExp(r'\B(?=(\d{3})+(?!\d))'), (_) => ',');

/// استدعاء بوابة الشركات /api/secure/data?resource=partners — نفس partnerApi في الموقع.
Future<dynamic> partnerApi(BuildContext context, {String action = '', String? id, String method = 'GET', Map<String, dynamic>? body}) {
  return context.read<ApiClient>().request(method, '/api/secure/data', query: {
    'resource': 'partners',
    if (action.isNotEmpty) 'action': action,
    if (id != null) 'id': id,
  }, data: body);
}

List<Map<String, dynamic>> _list(dynamic v) => v is List ? v.whereType<Map>().map((m) => m.map((k, x) => MapEntry('$k', x))).toList() : const [];
Map<String, dynamic> _map(dynamic v) => v is Map ? v.map((k, x) => MapEntry('$k', x)) : <String, dynamic>{};

// ═══════════════════════════ قائمة الشركات ═══════════════════════════

/// الشركات (حسابات الجملة) — نفس /admin/partners.
class PartnersScreen extends StatefulWidget {
  const PartnersScreen({super.key});

  @override
  State<PartnersScreen> createState() => _PartnersScreenState();
}

class _PartnersScreenState extends State<PartnersScreen> {
  List<Map<String, dynamic>>? _rows;
  String? _error;
  final _f = {for (final k in ['name', 'vat_number', 'cr_number', 'phone', 'address']) k: TextEditingController()};
  bool _creating = false;
  ({String name, String code})? _newCode;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final r = await partnerApi(context);
      if (mounted) {
        setState(() {
          _rows = _list(r);
          _error = null;
        });
      }
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    }
  }

  Future<void> _create() async {
    if (_f['name']!.text.trim().isEmpty) return;
    setState(() => _creating = true);
    try {
      final r = _map(await partnerApi(context, method: 'POST', body: {for (final e in _f.entries) e.key: e.value.text.trim()}));
      if (!mounted) return;
      setState(() => _newCode = (name: _f['name']!.text.trim(), code: '${r['code'] ?? ''}'));
      for (final c in _f.values) {
        c.clear();
      }
      _load();
    } on ApiException catch (e) {
      if (mounted) toast(context, e.message, error: true);
    } finally {
      if (mounted) setState(() => _creating = false);
    }
  }

  Future<void> _toggle(Map<String, dynamic> p) async {
    try {
      await partnerApi(context, id: '${p['id']}', method: 'PATCH', body: {'is_active': p['is_active'] != true});
      _load();
    } on ApiException catch (e) {
      if (mounted) toast(context, e.message, error: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    final me = context.watch<AuthController>().employee!;
    final canEdit = {'owner', 'admin', 'manager'}.contains(me.role);
    final rows = _rows ?? const [];
    final due = rows.fold<double>(0, (s, p) => s + _d(p['due_total']));
    final unpaid = rows.fold<double>(0, (s, p) => s + _d(p['unpaid_total']));
    final soon = rows.where((p) => _d(p['soon_count']) > 0).toList();

    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 40),
        physics: const AlwaysScrollableScrollPhysics(),
        children: [
          Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 780),
              child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                const PageHeader(title: 'الشركات (حسابات الجملة)', subtitle: 'أسعار خاصة لكل شركة، فواتير ضريبية مجمّعة، وسداد بعد استلام الطلب', icon: Icons.business_rounded, tone: Tone.indigo),
                if (soon.isNotEmpty)
                  _alert('⏰ تنبيه: مبالغ يحل سدادها خلال يومين', [for (final p in soon) '${p['name']}: ${p['soon_count']} شنطة — ${_m(_d(p['soon_total']))} ر.س'], const Color(0xFFF59E0B)),
                Row(children: [
                  Expanded(child: _kpi('مستحق السداد الآن', due, Pos.red, const Color(0xFFFEF2F2))),
                  const SizedBox(width: 12),
                  Expanded(child: _kpi('إجمالي غير المسدّد', unpaid, Pos.fg, Colors.white)),
                ]),
                const SizedBox(height: 12),
                if (canEdit)
                  GlassCard(
                    child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                      const Text('إضافة شركة', style: TextStyle(fontWeight: FontWeight.w700)),
                      const SizedBox(height: 8),
                      TextField(controller: _f['name'], maxLength: 80, decoration: const InputDecoration(hintText: 'اسم الشركة *', counterText: '')),
                      const SizedBox(height: 8),
                      Row(children: [
                        Expanded(child: TextField(controller: _f['vat_number'], maxLength: 15, keyboardType: TextInputType.number, decoration: const InputDecoration(hintText: 'الرقم الضريبي (15 رقماً)', counterText: ''))),
                        const SizedBox(width: 8),
                        Expanded(child: TextField(controller: _f['cr_number'], decoration: const InputDecoration(hintText: 'السجل التجاري'))),
                      ]),
                      const SizedBox(height: 8),
                      Row(children: [
                        Expanded(child: TextField(controller: _f['phone'], keyboardType: TextInputType.phone, decoration: const InputDecoration(hintText: 'الجوال'))),
                        const SizedBox(width: 8),
                        Expanded(child: TextField(controller: _f['address'], decoration: const InputDecoration(hintText: 'العنوان'))),
                      ]),
                      const SizedBox(height: 10),
                      PrimaryButton(label: 'إنشاء الشركة', icon: Icons.add_rounded, color: _brown, expand: true, busy: _creating, onPressed: _create),
                      const SizedBox(height: 6),
                      const Text('الرقم الضريبي مطلوب قبل إصدار أول فاتورة ضريبية، ويمكن إضافته لاحقاً من صفحة الشركة.', style: TextStyle(fontSize: 11.5, color: Pos.muted)),
                    ]),
                  ),
                if (_newCode != null)
                  Container(
                    margin: const EdgeInsets.only(top: 12),
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(color: const Color(0xFFFFFBEB), borderRadius: BorderRadius.circular(16), border: Border.all(color: const Color(0xFFF59E0B), width: 2)),
                    child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                      Text('رمز دخول ${_newCode!.name} لبوابة الشركة — يظهر مرة واحدة فقط:', style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13)),
                      const SizedBox(height: 8),
                      Row(children: [
                        Expanded(
                          child: Container(
                            padding: const EdgeInsets.symmetric(vertical: 10),
                            decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(12)),
                            child: Text(_newCode!.code, textAlign: TextAlign.center, textDirection: TextDirection.ltr, style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w900, letterSpacing: 3)),
                          ),
                        ),
                        IconButton(
                          onPressed: () {
                            Clipboard.setData(ClipboardData(text: _newCode!.code));
                            toast(context, 'تم النسخ');
                          },
                          icon: const Icon(Icons.copy_rounded),
                        ),
                      ]),
                      TextButton(onPressed: () => setState(() => _newCode = null), child: const Text('تم النسخ، إخفاء')),
                    ]),
                  ),
                const SizedBox(height: 12),
                if (_error != null) LoadError(message: _error!, onRetry: _load),
                if (_rows == null && _error == null)
                  const Padding(padding: EdgeInsets.all(40), child: Center(child: CircularProgressIndicator()))
                else if (rows.isEmpty && _error == null)
                  const EmptyState(icon: Icons.business_outlined, text: 'لا توجد شركات بعد')
                else
                  for (final p in rows)
                    GlassCard(
                      margin: const EdgeInsets.only(bottom: 10),
                      onTap: () async {
                        await Navigator.of(context).push(MaterialPageRoute(builder: (_) => PartnerAccountScreen(partnerId: '${p['id']}')));
                        _load();
                      },
                      child: Row(children: [
                        Expanded(
                          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                            Text('${p['name']}', style: const TextStyle(fontWeight: FontWeight.w800)),
                            Text('قيد العمل: ${p['open'] ?? 0} · الإجمالي: ${p['total'] ?? 0} · غير مسدّد: ${_m(_d(p['unpaid_total']))} ر.س',
                                style: const TextStyle(fontSize: 12, color: Pos.muted)),
                            if (_d(p['due_total']) > 0)
                              Text('مستحق الآن: ${_m(_d(p['due_total']))} ر.س (${p['due_count']} شنطة)',
                                  style: const TextStyle(fontSize: 12, color: Pos.red, fontWeight: FontWeight.w700)),
                          ]),
                        ),
                        if (canEdit)
                          ActionChip(
                            avatar: Icon(Icons.power_settings_new_rounded, size: 16, color: p['is_active'] == true ? const Color(0xFF047857) : const Color(0xFFB91C1C)),
                            label: Text(p['is_active'] == true ? 'مفعّل' : 'موقوف'),
                            backgroundColor: p['is_active'] == true ? const Color(0xFFD1FAE5) : const Color(0xFFFEE2E2),
                            side: BorderSide.none,
                            onPressed: () => _toggle(p),
                          ),
                        const Icon(Icons.chevron_left_rounded, color: Pos.muted),
                      ]),
                    ),
              ]),
            ),
          ),
        ],
      ),
    );
  }

  Widget _kpi(String l, double v, Color c, Color bg) => Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(16), border: Border.all(color: c == Pos.red ? const Color(0xFFFCA5A5) : Pos.border, width: c == Pos.red ? 2 : 1)),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(l, style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: c == Pos.red ? Pos.red : Pos.muted)),
          const SizedBox(height: 4),
          PosMoney(v, size: 19, weight: FontWeight.w900, color: c),
        ]),
      );
}

Widget _alert(String title, List<String> lines, Color c) => Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(color: c.withValues(alpha: .1), borderRadius: BorderRadius.circular(16), border: Border.all(color: c, width: 2)),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(title, style: TextStyle(fontWeight: FontWeight.w800, color: Color.lerp(c, Colors.black, .45))),
        for (final l in lines) Text(l, style: TextStyle(fontSize: 12, color: Color.lerp(c, Colors.black, .45))),
      ]),
    );

// ═══════════════════════════ حساب شركة ═══════════════════════════

class PartnerAccountScreen extends StatefulWidget {
  const PartnerAccountScreen({super.key, required this.partnerId});
  final String partnerId;

  @override
  State<PartnerAccountScreen> createState() => _PartnerAccountScreenState();
}

class _PartnerAccountScreenState extends State<PartnerAccountScreen> {
  Map<String, dynamic>? _data;
  String? _error;
  String _tab = 'orders';
  String _filter = 'all';
  final _sel = <String>{};
  bool _issuing = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final r = await partnerApi(context, action: 'detail', id: widget.partnerId);
      if (mounted) {
        setState(() {
          _data = _map(r);
          _error = null;
        });
      }
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    }
  }

  bool _paid(Map o) => o['payment_status'] == 'paid';
  bool _delivered(Map o) => o['status'] == 'completed';
  bool _invoiceable(Map o) => _delivered(o) && !_paid(o) && o['partner_invoice_id'] == null && _d(o['total_price']) > 0;
  bool _unpaidPriced(Map o) => !_paid(o) && o['status'] != 'cancelled' && o['partner_invoice_id'] == null && _d(o['total_price']) > 0 && o['payment_due_date'] != null;

  Future<void> _issue(List<String> ids) async {
    setState(() => _issuing = true);
    try {
      final r = _map(await partnerApi(context, action: 'invoice', id: widget.partnerId, method: 'POST', body: {'order_ids': ids, 'payment_method': 'online'}));
      if (!mounted) return;
      _sel.clear();
      toast(context, _map(r['zatca'])['status'] == 'ERROR'
          ? 'تم السداد وإصدار الفاتورة، لكن الإبلاغ لزاتكا تعثّر وسيُعاد تلقائياً'
          : 'تم السداد وإصدار الفاتورة الضريبية');
      _load();
    } on ApiException catch (e) {
      if (mounted) toast(context, e.message, error: true);
    } finally {
      if (mounted) setState(() => _issuing = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final me = context.watch<AuthController>().employee!;
    final canEdit = {'owner', 'admin', 'manager'}.contains(me.role);
    final d = _data;
    return Scaffold(
      backgroundColor: Colors.transparent,
      body: PosBackground(
        child: SafeArea(
          child: _error != null
              ? Padding(padding: const EdgeInsets.all(16), child: LoadError(message: _error!, onRetry: _load))
              : d == null
                  ? const Center(child: CircularProgressIndicator())
                  : _body(d, canEdit),
        ),
      ),
    );
  }

  Widget _body(Map<String, dynamic> d, bool canEdit) {
    final p = _map(d['partner']);
    final orders = _list(d['orders']);
    final services = _list(d['services']);
    final invoices = _list(d['invoices']);
    final today = '${d['today'] ?? DateTime.now().toIso8601String().substring(0, 10)}';
    final soonLimit = DateTime.parse(today).add(const Duration(days: 2)).toIso8601String().substring(0, 10);
    bool isDue(Map o) => _unpaidPriced(o) && _day(o['payment_due_date']).compareTo(today) <= 0;
    bool isSoon(Map o) => _unpaidPriced(o) && _day(o['payment_due_date']).compareTo(today) > 0 && _day(o['payment_due_date']).compareTo(soonLimit) <= 0;
    final due = orders.where(isDue).toList();
    final soon = orders.where(isSoon).toList();
    final filters = <String, (String, bool Function(Map))>{
      'all': ('الكل', (_) => true),
      'unpaid': ('غير مسدّد', (o) => !_paid(o) && o['status'] != 'cancelled'),
      'paid': ('مسدّد', _paid),
      'progress': ('قيد التجهيز', (o) => {'pending', 'in_progress', 'ready'}.contains(o['status'])),
      'delivered': ('تم التسليم', _delivered),
    };
    final shown = orders.where(filters[_filter]!.$2).toList();
    final selected = orders.where((o) => _sel.contains('${o['id']}')).toList();
    final selTotal = selected.fold<double>(0, (s, o) => s + _d(o['total_price']));
    final selOk = selected.isNotEmpty && selected.every(_invoiceable);

    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 40),
      children: [
        Align(
          alignment: AlignmentDirectional.centerStart,
          child: TextButton.icon(onPressed: () => Navigator.pop(context), icon: const Icon(Icons.arrow_forward_rounded, size: 18), label: const Text('كل الشركات')),
        ),
        Text('${p['name']}', style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w900)),
        Text('رقم ضريبي: ${p['vat_number'] ?? 'غير مُدخل'} · التسليم ${p['turnaround_days']} أيام · السداد بعد استلام الطلب بـ ${p['payment_terms_days']} يوم',
            style: const TextStyle(fontSize: 12, color: Pos.muted)),
        const SizedBox(height: 12),
        InkWell(
          borderRadius: BorderRadius.circular(16),
          onTap: () => setState(() {
            _tab = 'orders';
            _filter = 'unpaid';
            _sel
              ..clear()
              ..addAll(due.where(_invoiceable).map((o) => '${o['id']}'));
          }),
          child: Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(color: const Color(0xFFFEF2F2), borderRadius: BorderRadius.circular(16), border: Border.all(color: const Color(0xFFFCA5A5), width: 2)),
            child: Row(children: [
              const Icon(Icons.account_balance_wallet_outlined, color: Pos.red),
              const SizedBox(width: 8),
              Expanded(
                child: Text('مستحق السداد الآن (${due.length} شنطة مرّ عليها ${p['payment_terms_days']} يوم من استلام الطلب)',
                    style: const TextStyle(color: Pos.red, fontWeight: FontWeight.w700, fontSize: 13)),
              ),
              PosMoney(due.fold<double>(0, (s, o) => s + _d(o['total_price'])), size: 17, weight: FontWeight.w900, color: Pos.red),
            ]),
          ),
        ),
        if (soon.isNotEmpty) ...[
          const SizedBox(height: 10),
          _alert('⏰ تنبيه: ${soon.length} شنطة يحل موعد سدادها خلال يومين — إجمالي ${_m(soon.fold<double>(0, (s, o) => s + _d(o['total_price'])))} ر.س', const [], const Color(0xFFF59E0B)),
        ],
        const SizedBox(height: 12),
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          child: Row(children: [
            for (final t in [('orders', 'الطلبات'), ('intake', 'استلام شنط'), ('prices', 'الأسعار'), ('invoices', 'الفواتير (${invoices.length})'), ('info', 'بيانات الشركة')])
              Padding(padding: const EdgeInsetsDirectional.only(end: 8), child: PillChip(label: t.$2, selected: _tab == t.$1, onTap: () => setState(() => _tab = t.$1))),
          ]),
        ),
        const SizedBox(height: 12),
        if (_tab == 'orders') ...[
          Wrap(spacing: 6, runSpacing: 6, children: [
            for (final f in filters.entries)
              ChoiceChip(label: Text(f.value.$1), selected: _filter == f.key, selectedColor: _brown, labelStyle: TextStyle(color: _filter == f.key ? Colors.white : Pos.fg), onSelected: (_) => setState(() => _filter = f.key)),
          ]),
          if (selected.isNotEmpty)
            Container(
              margin: const EdgeInsets.only(top: 10),
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16), border: Border.all(color: const Color(0xFFD97706), width: 2), boxShadow: Pos.shadow),
              child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                Row(children: [
                  Expanded(child: Text('${selected.length} محدد — الإجمالي شامل الضريبة:', style: const TextStyle(fontSize: 13))),
                  PosMoney(selTotal, weight: FontWeight.w900),
                ]),
                const SizedBox(height: 8),
                Row(children: [
                  Expanded(child: PrimaryButton(label: 'إصدار فاتورة وسداد', icon: Icons.receipt_rounded, color: _brown, busy: _issuing, onPressed: selOk ? () => _issue(selected.map((o) => '${o['id']}').toList()) : null)),
                  TextButton(onPressed: () => setState(_sel.clear), child: const Text('إلغاء')),
                ]),
                if (!selOk) const Text('الفوترة تحتاج شنطاً مسلَّمة وغير مسدّدة ومسعّرة فقط.', style: TextStyle(fontSize: 11.5, color: Color(0xFFB45309))),
              ]),
            ),
          const SizedBox(height: 10),
          if (shown.isEmpty)
            const EmptyState(icon: Icons.inventory_2_outlined, text: 'لا توجد طلبات')
          else
            for (final o in shown) _orderRow(o, isDue(o), isSoon(o)),
        ],
        if (_tab == 'intake') _Intake(partnerId: widget.partnerId, services: services, orders: orders, canEdit: canEdit, onDone: _load),
        if (_tab == 'prices') _Prices(partnerId: widget.partnerId, services: services, canEdit: canEdit, onDone: _load),
        if (_tab == 'invoices')
          invoices.isEmpty
              ? const EmptyState(icon: Icons.receipt_long_outlined, text: 'لا توجد فواتير بعد')
              : GlassCard(
                  padding: EdgeInsets.zero,
                  child: Column(children: [
                    for (final i in invoices)
                      ListTile(
                        title: Text('${i['invoice_number']}', textDirection: TextDirection.ltr, style: const TextStyle(fontWeight: FontWeight.w700)),
                        subtitle: Text('${_day(i['created_at'])} · ${i['order_count']} شنطة · ${i['zatca_status'] == 'REPORTED' ? 'مُبلَّغة لزاتكا' : 'بانتظار الإبلاغ'}'),
                        trailing: PosMoney(_d(i['total']), weight: FontWeight.w900),
                      ),
                  ]),
                ),
        if (_tab == 'info') _Info(partner: p, partnerId: widget.partnerId, canEdit: canEdit, onDone: _load),
      ],
    );
  }

  Widget _orderRow(Map<String, dynamic> o, bool due, bool soon) {
    final id = '${o['id']}';
    final (label, color, bg) = o['status'] == 'cancelled'
        ? ('ملغى', const Color(0xFF6B7280), const Color(0xFFF3F4F6))
        : _paid(o)
            ? ('مسدّد', const Color(0xFF047857), const Color(0xFFD1FAE5))
            : _delivered(o)
                ? ('مسلَّم — بانتظار السداد', const Color(0xFFB45309), const Color(0xFFFEF3C7))
                : ('قيد التجهيز', const Color(0xFF1D4ED8), const Color(0xFFDBEAFE));
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16), border: Border.all(color: due ? const Color(0xFFFCA5A5) : Pos.border)),
      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Checkbox(value: _sel.contains(id), onChanged: (_) => setState(() => _sel.contains(id) ? _sel.remove(id) : _sel.add(id))),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Wrap(spacing: 6, runSpacing: 4, crossAxisAlignment: WrapCrossAlignment.center, children: [
              Text('${o['order_number']}', textDirection: TextDirection.ltr, style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 13)),
              if ((o['partner_ref'] ?? '').toString().isNotEmpty) Text('${o['partner_ref']}', style: const TextStyle(fontSize: 12, color: Pos.muted)),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(99)),
                child: Text(label, style: TextStyle(fontSize: 11, color: color, fontWeight: FontWeight.w700)),
              ),
              if (due) const SoftBadge('استحق السداد', Pos.red),
              if (!due && soon) const SoftBadge('يستحق قريباً', Pos.amber),
            ]),
            if ((o['description'] ?? '').toString().isNotEmpty)
              Text('${o['description']}', maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 12, color: Pos.muted)),
            Text(
              'استلام الطلب: ${_day(o['created_at'])} · موعد التسليم للشركة: ${_day(o['delivery_date'])}'
              '${o['delivered_at'] != null ? ' · سُلّمت: ${_day(o['delivered_at'])}' : ''}'
              '${o['payment_due_date'] != null && !_paid(o) ? ' · موعد السداد: ${_day(o['payment_due_date'])}' : ''}',
              style: const TextStyle(fontSize: 11, color: Pos.muted),
            ),
          ]),
        ),
        Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
          _d(o['total_price']) > 0
              ? PosMoney(_d(o['total_price']), weight: FontWeight.w900, size: 13)
              : const Text('بانتظار التسعير', style: TextStyle(fontSize: 11, color: Color(0xFFB45309), fontWeight: FontWeight.w700)),
          if (_invoiceable(o))
            TextButton(
              style: TextButton.styleFrom(backgroundColor: const Color(0xFF047857), foregroundColor: Colors.white, shape: const StadiumBorder(), visualDensity: VisualDensity.compact),
              onPressed: _issuing ? null : () => _issue([id]),
              child: const Text('سداد', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700)),
            ),
        ]),
      ]),
    );
  }
}

class _Intake extends StatefulWidget {
  const _Intake({required this.partnerId, required this.services, required this.orders, required this.canEdit, required this.onDone});
  final String partnerId;
  final List<Map<String, dynamic>> services;
  final List<Map<String, dynamic>> orders;
  final bool canEdit;
  final Future<void> Function() onDone;

  @override
  State<_Intake> createState() => _IntakeState();
}

class _Bag {
  final label = TextEditingController();
  final notes = TextEditingController();
  final picked = <String, int>{};
}

class _IntakeState extends State<_Intake> {
  final _bags = <_Bag>[_Bag()];
  bool _saving = false;

  List<Map<String, dynamic>> get _active => widget.services.where((s) => s['is_active'] == true).toList();
  double _bagTotal(_Bag b) => _active.fold<double>(0, (t, s) => t + (b.picked['${s['id']}'] ?? 0) * _d(s['price'])) * 1.15;

  Future<void> _save() async {
    setState(() => _saving = true);
    try {
      final r = await partnerApi(context, action: 'intake', id: widget.partnerId, method: 'POST', body: {
        'bags': [
          for (final b in _bags)
            {
              'label': b.label.text.trim(),
              'notes': b.notes.text.trim(),
              'services': [for (final e in b.picked.entries.where((e) => e.value > 0)) {'service_id': e.key, 'qty': e.value}],
            }
        ],
      });
      final created = _list(r);
      if (!mounted) return;
      toast(context, 'تم تسجيل ${created.length} شنطة — موعد التسليم ${_day(created.isEmpty ? null : created.first['delivery_date'])}');
      setState(() {
        _bags
          ..clear()
          ..add(_Bag());
      });
      widget.onDone();
    } on ApiException catch (e) {
      if (mounted) toast(context, e.message, error: true);
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (!widget.canEdit) return const Text('الاستلام متاح للإدارة فقط.', style: TextStyle(color: Pos.muted));
    final valid = _bags.every((b) => b.picked.values.any((q) => q > 0));
    final grand = _bags.fold<double>(0, (t, b) => t + _bagTotal(b));
    final unpriced = widget.orders.where((o) => _d(o['total_price']) == 0 && o['partner_invoice_id'] == null && o['status'] != 'cancelled').toList();
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      const Text('كل شنطة = طلب وباركود مستقل. تاريخ التسليم يُحسب تلقائياً (اليوم + مدة الشركة)، والأسعار تُؤخذ من قائمة الشركة على السيرفر.',
          style: TextStyle(fontSize: 12, color: Pos.muted)),
      const SizedBox(height: 10),
      for (var i = 0; i < _bags.length; i++)
        GlassCard(
          margin: const EdgeInsets.only(bottom: 10),
          color: Colors.white,
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Row(children: [
              Expanded(child: TextField(controller: _bags[i].label, maxLength: 100, decoration: const InputDecoration(hintText: 'وصف/رقم الشنطة (مثال: شنطة سوداء #12)', counterText: ''))),
              if (_bags.length > 1) IconButton(onPressed: () => setState(() => _bags.removeAt(i)), icon: const Icon(Icons.delete_outline_rounded, color: Pos.destructive)),
            ]),
            const SizedBox(height: 6),
            for (final s in _active)
              CheckboxListTile(
                dense: true,
                contentPadding: EdgeInsets.zero,
                controlAffinity: ListTileControlAffinity.leading,
                value: (_bags[i].picked['${s['id']}'] ?? 0) > 0,
                onChanged: (v) => setState(() => _bags[i].picked['${s['id']}'] = v == true ? 1 : 0),
                title: Text('${s['name_ar']}'),
                secondary: Row(mainAxisSize: MainAxisSize.min, children: [
                  if ((_bags[i].picked['${s['id']}'] ?? 0) > 0) ...[
                    IconButton(
                      visualDensity: VisualDensity.compact,
                      onPressed: () => setState(() => _bags[i].picked['${s['id']}'] = ((_bags[i].picked['${s['id']}'] ?? 1) - 1).clamp(1, 50)),
                      icon: const Icon(Icons.remove_rounded, size: 18),
                    ),
                    Text('${_bags[i].picked['${s['id']}']}'),
                    IconButton(
                      visualDensity: VisualDensity.compact,
                      onPressed: () => setState(() => _bags[i].picked['${s['id']}'] = ((_bags[i].picked['${s['id']}'] ?? 1) + 1).clamp(1, 50)),
                      icon: const Icon(Icons.add_rounded, size: 18),
                    ),
                  ],
                  Text(_d(s['price']) > 0 ? _m(_d(s['price'])) : 'بدون سعر',
                      style: TextStyle(fontSize: 12, color: _d(s['price']) > 0 ? Pos.muted : Pos.red, fontWeight: _d(s['price']) > 0 ? FontWeight.w400 : FontWeight.w700)),
                ]),
              ),
            TextField(controller: _bags[i].notes, maxLength: 500, decoration: const InputDecoration(hintText: 'ملاحظات', counterText: '')),
            const SizedBox(height: 4),
            Row(children: [const Text('شامل الضريبة (تقديري): ', style: TextStyle(fontSize: 12, color: Pos.muted)), PosMoney(_bagTotal(_bags[i]), size: 12.5, weight: FontWeight.w800)]),
          ]),
        ),
      Row(children: [
        OutlineSmall(label: 'شنطة أخرى', icon: Icons.add_rounded, onPressed: () => setState(() => _bags.add(_Bag()))),
        const Spacer(),
        const Text('الإجمالي: '),
        PosMoney(grand, weight: FontWeight.w900),
      ]),
      const SizedBox(height: 10),
      PrimaryButton(label: 'تسجيل الشنط', icon: Icons.qr_code_2_rounded, color: _brown, expand: true, busy: _saving, onPressed: valid ? _save : null),
      if (unpriced.isNotEmpty) ...[
        const SizedBox(height: 14),
        Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(color: const Color(0xFFFFFBEB), borderRadius: BorderRadius.circular(16), border: Border.all(color: const Color(0xFFF59E0B), width: 2)),
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            const Text('طلبات أرسلتها الشركة من البوابة وتحتاج تحديد الخدمات والتسعير', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13)),
            for (final o in unpriced) _Reprice(order: o, services: _active, partnerId: widget.partnerId, onDone: widget.onDone),
          ]),
        ),
      ],
    ]);
  }
}

class _Reprice extends StatefulWidget {
  const _Reprice({required this.order, required this.services, required this.partnerId, required this.onDone});
  final Map<String, dynamic> order;
  final List<Map<String, dynamic>> services;
  final String partnerId;
  final Future<void> Function() onDone;

  @override
  State<_Reprice> createState() => _RepriceState();
}

class _RepriceState extends State<_Reprice> {
  final _picked = <String>{};
  bool _busy = false;

  Future<void> _go() async {
    setState(() => _busy = true);
    try {
      await partnerApi(context, action: 'reprice', id: widget.partnerId, method: 'POST', body: {
        'order_id': widget.order['id'],
        'services': [for (final s in _picked) {'service_id': s, 'qty': 1}],
      });
      if (!mounted) return;
      toast(context, 'تم التسعير');
      widget.onDone();
    } on ApiException catch (e) {
      if (mounted) toast(context, e.message, error: true);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(top: 8),
      padding: const EdgeInsets.all(8),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(12)),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text('${widget.order['order_number']} — ${widget.order['description'] ?? ''}', style: const TextStyle(fontSize: 12)),
        Wrap(spacing: 6, children: [
          for (final s in widget.services)
            FilterChip(
              label: Text('${s['name_ar']}', style: const TextStyle(fontSize: 12)),
              selected: _picked.contains('${s['id']}'),
              onSelected: (v) => setState(() => v ? _picked.add('${s['id']}') : _picked.remove('${s['id']}')),
            ),
        ]),
        TextButton(onPressed: _busy || _picked.isEmpty ? null : _go, child: const Text('تسعير')),
      ]),
    );
  }
}

class _Prices extends StatefulWidget {
  const _Prices({required this.partnerId, required this.services, required this.canEdit, required this.onDone});
  final String partnerId;
  final List<Map<String, dynamic>> services;
  final bool canEdit;
  final Future<void> Function() onDone;

  @override
  State<_Prices> createState() => _PricesState();
}

class _PricesState extends State<_Prices> {
  late final _custom = {for (final s in widget.services) '${s['id']}': TextEditingController(text: s['custom_price']?.toString() ?? '')};
  late final _base = {for (final s in widget.services) '${s['id']}': TextEditingController(text: s['base_price']?.toString() ?? '')};
  bool _saving = false;

  Future<void> _saveCustom() async {
    setState(() => _saving = true);
    try {
      await partnerApi(context, action: 'set-prices', id: widget.partnerId, method: 'POST', body: {
        'prices': [for (final s in widget.services) {'service_id': s['id'], 'price': _custom['${s['id']}']!.text}],
      });
      if (!mounted) return;
      toast(context, 'تم حفظ أسعار الشركة');
      widget.onDone();
    } on ApiException catch (e) {
      if (mounted) toast(context, e.message, error: true);
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Future<void> _saveBase(Map<String, dynamic> s) async {
    final v = double.tryParse(_base['${s['id']}']!.text);
    if (v == null || v == _d(s['base_price'])) return;
    try {
      await partnerApi(context, action: 'save-service', method: 'POST', body: {'id': s['id'], 'name': s['name_ar'], 'base_price': v, 'is_active': s['is_active']});
      if (mounted) toast(context, 'تم حفظ السعر الأساسي');
      widget.onDone();
    } on ApiException catch (e) {
      if (mounted) toast(context, e.message, error: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      const Text('السعر قبل الضريبة. السعر الخاص بالشركة يلغي السعر الأساسي؛ اتركه فاضياً لاستخدام الأساسي. التعديل للمدير فقط.', style: TextStyle(fontSize: 12, color: Pos.muted)),
      const SizedBox(height: 8),
      GlassCard(
        color: Colors.white,
        child: Column(children: [
          const Row(children: [
            Expanded(child: Text('الخدمة', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: Pos.muted))),
            SizedBox(width: 90, child: Text('أساسي', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: Pos.muted))),
            SizedBox(width: 8),
            SizedBox(width: 90, child: Text('خاص بالشركة', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: Pos.muted))),
          ]),
          for (final s in widget.services)
            Padding(
              padding: const EdgeInsets.only(top: 8),
              child: Row(children: [
                Expanded(child: Text('${s['name_ar']}')),
                SizedBox(
                  width: 90,
                  child: Focus(
                    onFocusChange: (f) => f || !widget.canEdit ? null : _saveBase(s),
                    child: TextField(controller: _base['${s['id']}'], enabled: widget.canEdit, keyboardType: TextInputType.number),
                  ),
                ),
                const SizedBox(width: 8),
                SizedBox(
                  width: 90,
                  child: TextField(controller: _custom['${s['id']}'], enabled: widget.canEdit, keyboardType: TextInputType.number, decoration: const InputDecoration(hintText: '—')),
                ),
              ]),
            ),
        ]),
      ),
      const SizedBox(height: 10),
      if (widget.canEdit) PrimaryButton(label: 'حفظ أسعار الشركة', color: _brown, busy: _saving, onPressed: _saveCustom),
      const SizedBox(height: 6),
      const Text('⚠ السعر الأساسي يُحفظ عند الخروج من الحقل، وأي خدمة سعرها صفر يرفض النظام تسجيل شنطة بها.', style: TextStyle(fontSize: 12, color: Color(0xFFB45309))),
    ]);
  }
}

class _Info extends StatefulWidget {
  const _Info({required this.partner, required this.partnerId, required this.canEdit, required this.onDone});
  final Map<String, dynamic> partner;
  final String partnerId;
  final bool canEdit;
  final Future<void> Function() onDone;

  @override
  State<_Info> createState() => _InfoState();
}

class _InfoState extends State<_Info> {
  late final _f = {
    for (final k in ['name', 'vat_number', 'cr_number', 'phone', 'payment_terms_days', 'turnaround_days', 'address'])
      k: TextEditingController(text: '${widget.partner[k] ?? ''}'),
  };
  bool _saving = false;

  Future<void> _save() async {
    setState(() => _saving = true);
    try {
      await partnerApi(context, action: 'update', id: widget.partnerId, method: 'POST', body: {for (final e in _f.entries) e.key: e.value.text.trim()});
      if (!mounted) return;
      toast(context, 'تم الحفظ');
      widget.onDone();
    } on ApiException catch (e) {
      if (mounted) toast(context, e.message, error: true);
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    Widget fld(String k, String l, {TextInputType? kb}) => Padding(
          padding: const EdgeInsets.only(bottom: 10),
          child: TextField(controller: _f[k], enabled: widget.canEdit, keyboardType: kb, decoration: InputDecoration(labelText: l)),
        );
    return GlassCard(
      color: Colors.white,
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        fld('name', 'اسم الشركة'),
        fld('vat_number', 'الرقم الضريبي', kb: TextInputType.number),
        fld('cr_number', 'السجل التجاري'),
        fld('phone', 'الجوال', kb: TextInputType.phone),
        fld('payment_terms_days', 'أيام السداد بعد استلام الطلب', kb: TextInputType.number),
        fld('turnaround_days', 'أيام التسليم', kb: TextInputType.number),
        fld('address', 'العنوان'),
        if (widget.canEdit) PrimaryButton(label: 'حفظ', color: _brown, busy: _saving, onPressed: _save),
      ]),
    );
  }
}
