import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/api_client.dart';
import '../../core/rest.dart';
import '../../models/order.dart';
import '../pos_ui.dart';

String normalizeDigits(String s) => s.replaceAllMapped(RegExp('[٠-٩۰-۹]'), (m) {
      final c = m[0]!.codeUnitAt(0);
      return '${c >= 0x06F0 ? c - 0x06F0 : c - 0x0660}';
    });

bool isValidVat(String? v) => v != null && RegExp(r'^3\d{13}3$').hasMatch(normalizeDigits(v.trim().replaceAll(RegExp(r'\s+'), '')));

const _env = {
  'sandbox': ('🧪 اختبار (Developer Sandbox)', 'بيئة تجريبية بحتة — لا قيمة قانونية للفواتير هنا'),
  'simulation': ('🟡 محاكاة (Simulation)', 'تحاكي الإنتاج بدون أثر قانوني — آخر محطة قبل التشغيل الفعلي'),
  'production': ('🟢 إنتاج (Production)', 'فواتير حقيقية ورسمية تُرفع فعلياً لزاتكا'),
};

/// إعدادات زاتكا — نفس /zatca: بيانات المنشأة، البيئة، فحص جاهزية الخادم، سجل الإرسال.
/// الشهادة والمفتاح الخاص على الخادم فقط ولا تمر بالتطبيق إطلاقاً.
class ZatcaSettingsScreen extends StatefulWidget {
  const ZatcaSettingsScreen({super.key});
  @override
  State<ZatcaSettingsScreen> createState() => _ZatcaSettingsScreenState();
}

class _ZatcaSettingsScreenState extends State<ZatcaSettingsScreen> {
  static const _fields = [
    ('seller_name', 'اسم المنشأة *', 'إبرة وخيط الإسكافي', false),
    ('vat_number', 'الرقم الضريبي (VAT) *', '300000000000003', true),
    ('cr_number', 'رقم السجل التجاري *', '1000000000', true),
    ('city', 'المدينة *', 'الرياض', false),
    ('district', 'الحي', 'العليا', false),
    ('street', 'الشارع', 'شارع الملك فهد', false),
    ('postal_code', 'الرمز البريدي', '11111', true),
    ('building_number', 'رقم المبنى', '0000', true),
  ];

  int _tab = 0;
  Map<String, dynamic>? _s;
  final _c = {for (final f in _fields) f.$1: TextEditingController()};
  Map<String, dynamic>? _health;
  bool _checking = false, _saving = false;
  List<Map<String, dynamic>> _log = const [], _review = const [];

  ApiClient get _api => context.read<ApiClient>();

  @override
  void initState() {
    super.initState();
    _load();
    _checkHealth();
  }

  @override
  void dispose() {
    for (final c in _c.values) {
      c.dispose();
    }
    super.dispose();
  }

  static Map<String, dynamic> _m(Object? v) => v is Map ? v.map((k, x) => MapEntry('$k', x)) : <String, dynamic>{};

  Future<void> _load() async {
    final rest = context.read<Rest>();
    final api = _api;
    Map<String, dynamic> s = {};
    List<Map<String, dynamic>> log = [];
    try {
      s = _m(await api.request('GET', '/api/secure/zatca', query: {'resource': 'settings'}));
    } on ApiException {
      s = {};
    }
    try {
      final r = await api.request('GET', '/api/secure/zatca', query: {'resource': 'log'});
      log = r is List ? r.map(_m).toList() : [];
    } on ApiException {
      log = [];
    }
    final flagged = await Future.wait([
      rest.select('orders', select: 'id,order_number,total_price,zatca_error_category,zatca_retry_count', filters: {'zatca_needs_review': 'eq.true'}, limit: 200).catchError((_) => <Map<String, dynamic>>[]),
      rest.select('sales_invoices', select: 'id,invoice_number,total,zatca_error_category,zatca_retry_count', filters: {'zatca_needs_review': 'eq.true'}, limit: 200).catchError((_) => <Map<String, dynamic>>[]),
    ]);
    if (!mounted) return;
    setState(() {
      _s = s;
      for (final f in _fields) {
        _c[f.$1]!.text = '${s[f.$1] ?? ''}';
      }
      _log = log;
      _review = [
        for (final o in flagged[0]) {...o, 'kind': 'طلب إصلاح', 'number': o['order_number'], 'amount': o['total_price']},
        for (final o in flagged[1]) {...o, 'kind': 'فاتورة بيع', 'number': o['invoice_number'], 'amount': o['total']},
      ];
    });
  }

  Future<void> _checkHealth() async {
    setState(() => _checking = true);
    try {
      final r = await _api.request('GET', '/api/zatca/health');
      if (mounted) setState(() => _health = _m(r));
    } on ApiException {
      if (mounted) setState(() => _health = {'ready': false, 'error': 'تعذر الوصول للخادم'});
    } finally {
      if (mounted) setState(() => _checking = false);
    }
  }

  List<String> get _missing {
    String v(String k) => _c[k]!.text.trim();
    final vat = v('vat_number');
    return [
      if (vat.isEmpty) 'الرقم الضريبي',
      if (v('cr_number').isEmpty) 'السجل التجاري',
      if (v('seller_name').isEmpty) 'اسم المنشأة',
      if (v('city').isEmpty) 'المدينة',
      if (v('district').isEmpty) 'الحي',
      if (v('street').isEmpty) 'الشارع',
      if (v('postal_code').isEmpty) 'الرمز البريدي',
      if (v('building_number').isEmpty) 'رقم المبنى',
      if (vat.isNotEmpty && !isValidVat(vat)) 'صيغة الرقم الضريبي غير صحيحة (لازم يبدأ وينتهي بـ 3 ويكون 15 رقم)',
    ];
  }

  Future<void> _save() async {
    final missing = _missing;
    if (missing.isNotEmpty) {
      toast(context, 'أكمل بيانات المنشأة أولاً — ناقص: ${missing.join('، ')}', error: true);
      return;
    }
    setState(() => _saving = true);
    try {
      await _api.request('POST', '/api/secure/zatca', query: {'resource': 'settings'}, data: {
        for (final f in _fields) f.$1: f.$1 == 'vat_number' ? normalizeDigits(_c[f.$1]!.text.trim()) : _c[f.$1]!.text.trim(),
        'environment': _s?['environment'],
        'egs_uuid': _s?['egs_uuid'],
      });
      if (mounted) toast(context, 'تم حفظ إعدادات زاتكا ✅');
      _checkHealth();
    } on ApiException catch (e) {
      if (mounted) toast(context, 'فشل الحفظ: ${e.status == 403 ? 'ليس لديك صلاحية' : e.message}', error: true);
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_s == null) return const Center(child: CircularProgressIndicator());
    final missing = _missing;
    final ready = _health?['ready'] == true;
    return Align(
      alignment: Alignment.topCenter,
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 760),
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 40),
          children: [
            PageHeader(
              title: 'إعدادات زاتكا ZATCA',
              subtitle: 'فوترة إلكترونية حقيقية — مرحلة 2 (ربط مباشر)',
              icon: Icons.verified_user_rounded,
              tone: Tone.green,
              trailing: SoftBadge(ready ? '✅ الخادم جاهز (${(_env[_health?['environment']]?.$1 ?? '').split(' ').first})' : '⚠️ غير جاهز', ready ? Pos.green : Pos.amber),
            ),
            if (missing.isNotEmpty)
              Container(
                margin: const EdgeInsets.only(bottom: 12),
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(color: const Color(0xFFFFFBEB), border: Border.all(color: const Color(0xFFFCD34D)), borderRadius: BorderRadius.circular(12)),
                child: Text('⚠️ ناقص: ${missing.join('، ')} — زاتكا يرفض الفاتورة لو أي من هالحقول فاضي، خصوصاً بيانات العنوان.', style: const TextStyle(fontSize: 13, color: Color(0xFF92400E))),
              ),
            SegmentedButton<int>(
              segments: const [
                ButtonSegment(value: 0, label: Text('بيانات المنشأة')),
                ButtonSegment(value: 1, label: Text('مفاتيح الخادم')),
                ButtonSegment(value: 2, label: Text('سجل الفواتير')),
              ],
              selected: {_tab},
              showSelectedIcon: false,
              onSelectionChanged: (v) => setState(() => _tab = v.first),
            ),
            const SizedBox(height: 14),
            if (_tab == 0) _settingsTab(missing.isEmpty) else if (_tab == 1) _serverTab() else _logTab(),
          ],
        ),
      ),
    );
  }

  Widget _settingsTab(bool complete) => GlassCard(
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          const Text('بيانات منشأتك (غير سرية)', style: TextStyle(fontWeight: FontWeight.w700)),
          const SizedBox(height: 12),
          LayoutBuilder(builder: (context, c) {
            final w = c.maxWidth >= 520 ? (c.maxWidth - 12) / 2 : c.maxWidth;
            return Wrap(spacing: 12, runSpacing: 12, children: [
              for (final f in _fields)
                SizedBox(
                  width: w,
                  child: TextField(
                    controller: _c[f.$1],
                    textDirection: f.$4 ? TextDirection.ltr : null,
                    onChanged: (_) => setState(() {}),
                    decoration: InputDecoration(
                      labelText: f.$2,
                      hintText: f.$3,
                      errorText: f.$1 == 'vat_number' && _c['vat_number']!.text.trim().isNotEmpty && !isValidVat(_c['vat_number']!.text) ? '15 رقماً — يبدأ وينتهي بـ 3' : null,
                    ),
                  ),
                ),
            ]);
          }),
          const Divider(height: 28),
          const Text('البيئة', style: TextStyle(fontWeight: FontWeight.w600)),
          const SizedBox(height: 8),
          for (final e in _env.entries)
            Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: InkWell(
                borderRadius: BorderRadius.circular(12),
                onTap: () => setState(() => _s!['environment'] = e.key),
                child: Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(12),
                    color: _s!['environment'] == e.key ? const Color(0xFFEFF6FF) : null,
                    border: Border.all(color: _s!['environment'] == e.key ? const Color(0xFF3B82F6) : const Color(0xFFE5E7EB), width: 2),
                  ),
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(e.value.$1, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13.5)),
                    Text(e.value.$2, style: const TextStyle(fontSize: 12, color: Pos.muted)),
                  ]),
                ),
              ),
            ),
          if (_s!['environment'] == 'production')
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(color: const Color(0xFFFEF2F2), border: Border.all(color: const Color(0xFFFECACA)), borderRadius: BorderRadius.circular(10)),
              child: const Text('أي طلب أو فاتورة تُنشأ الآن سترسل لزاتكا فعلياً بأثر قانوني حقيقي. تأكد إنك اختبرت على simulation أولاً.', style: TextStyle(fontSize: 12, color: Color(0xFF991B1B))),
            ),
          const SizedBox(height: 14),
          PrimaryButton(label: 'حفظ الإعدادات', icon: Icons.check_circle_outline_rounded, expand: true, busy: _saving, onPressed: complete ? _save : null),
        ]),
      );

  Widget _serverTab() {
    final checks = _m(_health?['checks']);
    Widget row(bool ok, String l) => Container(
          padding: const EdgeInsets.all(8),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(8),
            color: ok ? const Color(0xFFF0FDF4) : const Color(0xFFF9FAFB),
            border: Border.all(color: ok ? const Color(0xFFBBF7D0) : const Color(0xFFE5E7EB)),
          ),
          child: Row(mainAxisSize: MainAxisSize.min, children: [
            Icon(ok ? Icons.check_circle_rounded : Icons.warning_amber_rounded, size: 15, color: ok ? Pos.green : Pos.muted),
            const SizedBox(width: 6),
            Text(l, style: TextStyle(fontSize: 12, color: ok ? Pos.green : Pos.muted)),
          ]),
        );
    return GlassCard(
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        const Text('الشهادة والمفتاح الخاص — على الخادم فقط', style: TextStyle(fontWeight: FontWeight.w700)),
        const SizedBox(height: 10),
        Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(color: const Color(0xFFEFF6FF), borderRadius: BorderRadius.circular(10)),
          child: const Text(
            'لأسباب أمنية وامتثالية، الشهادة والمفتاح الخاص ما يُرفعان من هنا أبداً. تُضبط كمتغيرات بيئة سرّية في لوحة Vercel للمشروع (Settings → Environment Variables):',
            style: TextStyle(fontSize: 12, color: Color(0xFF1E40AF), height: 1.6),
          ),
        ),
        const SizedBox(height: 10),
        Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(color: const Color(0xFF111827), borderRadius: BorderRadius.circular(10)),
          child: const Directionality(
            textDirection: TextDirection.ltr,
            child: Text(
              'ZATCA_PRIVATE_KEY\nZATCA_CERTIFICATE\nZATCA_API_SECRET\nZATCA_PRODUCTION_CERTIFICATE\nZATCA_PRODUCTION_API_SECRET\nSUPABASE_SERVICE_ROLE_KEY',
              style: TextStyle(fontFamily: 'monospace', fontSize: 12, color: Color(0xFFF3F4F6), height: 1.7),
            ),
          ),
        ),
        const SizedBox(height: 8),
        const Text('بعد إضافتها، أعد نشر المشروع (Redeploy) حتى تُقرأ.', style: TextStyle(fontSize: 12, color: Pos.muted)),
        const Divider(height: 26),
        OutlineSmall(label: _checking ? 'جارٍ الفحص…' : 'فحص جاهزية الخادم الآن', icon: Icons.refresh_rounded, onPressed: _checking ? null : _checkHealth),
        if (_health != null) ...[
          const SizedBox(height: 10),
          Wrap(spacing: 8, runSpacing: 8, children: [
            row(checks['businessInfoComplete'] == true, 'بيانات المنشأة'),
            row(checks['hasPrivateKey'] == true, 'المفتاح الخاص (خادم)'),
            row(checks['hasCert'] == true, 'الشهادة (${(_env[_health?['environment']]?.$1 ?? '').split(' ').first})'),
            row(checks['hasSecret'] == true, 'API secret'),
          ]),
          if (_health?['error'] != null) Padding(padding: const EdgeInsets.only(top: 6), child: Text('${_health!['error']}', style: const TextStyle(fontSize: 12, color: Pos.red))),
        ],
      ]),
    );
  }

  Widget _status(String? s) => switch (s) {
        'REPORTED' => const SoftBadge('✅ تم الإبلاغ', Pos.green),
        'CLEARED' => const SoftBadge('✅ تم التخليص', Pos.blue),
        'REJECTED' => const SoftBadge('❌ مرفوض', Pos.red),
        null => const SoftBadge('غير محدد', Pos.muted),
        final String v => SoftBadge(v, Pos.muted),
      };

  Widget _logTab() => Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        if (_review.isNotEmpty) ...[
          GlassCard(
            color: const Color(0x0FEF4444),
            child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              Text('${_review.length} فاتورة تحتاج مراجعتك يدوياً (النظام ما يقدر يصلحها تلقائياً)', style: const TextStyle(fontWeight: FontWeight.w700, color: Color(0xFFB91C1C))),
              const SizedBox(height: 8),
              for (final r in _review)
                Padding(
                  padding: const EdgeInsets.only(bottom: 6),
                  child: Wrap(spacing: 8, runSpacing: 4, crossAxisAlignment: WrapCrossAlignment.center, children: [
                    SoftBadge('${r['kind']}', Pos.muted),
                    Text('${r['number']}', style: const TextStyle(fontWeight: FontWeight.w700, fontFamily: 'monospace')),
                    PosMoney(((r['amount'] as num?) ?? 0).toDouble(), size: 12.5, color: Pos.muted),
                    SoftBadge('${r['zatca_error_category'] ?? 'غير مصنّف'}', Pos.red),
                    Text('${r['zatca_retry_count'] ?? 0} محاولات', style: const TextStyle(fontSize: 11.5, color: Pos.muted)),
                  ]),
                ),
              const Text('هذي الفئة (بيانات ناقصة/شهادة غير صالحة) عمداً ما تُصلَح تلقائياً — تصحيحها آلياً على بيانات ضريبية رسمية خطر أكبر من تأخيرها يوم.',
                  style: TextStyle(fontSize: 12, color: Pos.muted)),
            ]),
          ),
          const SizedBox(height: 12),
        ],
        const GlassCard(
          child: Text(
            'الإصلاح التلقائي — مهمة مجدولة تفحص الفواتير المرفوضة:\n✅ أخطاء شبكة/خادم مؤقتة من زاتكا → تُعاد المحاولة تلقائياً\n✅ فرق تقريب أو عدم تطابق تسلسل الفواتير → تُصحَّح وتُعاد تلقائياً\n🛑 رقم ضريبي/سجل تجاري خاطئ أو شهادة منتهية → يتوقف ويظهر لك أعلاه فقط',
            style: TextStyle(fontSize: 12.5, height: 1.7),
          ),
        ),
        const SizedBox(height: 12),
        GlassCard(
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            const Text('سجل إرسال الفواتير', style: TextStyle(fontWeight: FontWeight.w700)),
            const SizedBox(height: 8),
            if (_log.isEmpty)
              const Padding(padding: EdgeInsets.all(30), child: Text('لا يوجد سجل إرسال بعد', textAlign: TextAlign.center, style: TextStyle(color: Pos.muted)))
            else
              for (final e in _log)
                Container(
                  margin: const EdgeInsets.only(bottom: 6),
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(border: Border.all(color: Pos.border), borderRadius: BorderRadius.circular(10)),
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Wrap(spacing: 8, runSpacing: 4, crossAxisAlignment: WrapCrossAlignment.center, children: [
                      _status(e['status']?.toString()),
                      Text('${e['invoice_number'] ?? ''}', style: const TextStyle(fontWeight: FontWeight.w700, fontFamily: 'monospace')),
                      Text('ICV #${e['icv'] ?? ''}', style: const TextStyle(fontSize: 11.5, color: Pos.muted)),
                      SoftBadge('${e['environment'] ?? ''}', Pos.muted),
                      if (e['auto_fix_applied'] == true) const SoftBadge('إعادة محاولة تلقائية', Pos.blue),
                      Text(fmtDateTime(DateTime.tryParse('${e['created_at']}')?.toLocal()), style: const TextStyle(fontSize: 11.5, color: Pos.muted)),
                    ]),
                    if (e['error_message'] != null) Text('${e['error_message']}', style: const TextStyle(fontSize: 12, color: Pos.red)),
                  ]),
                ),
          ]),
        ),
      ]);
}
