import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/api_client.dart';
import '../../core/rest.dart';
import '../../state/auth_controller.dart';
import '../../state/order_service.dart';
import '../pos_ui.dart';

const _settingsCols =
    'id,shop_name,vat_number,cr_number,city,address,phone,logo_url,vat_enabled,vat_rate,currency,zatca_enabled,zatca_sandbox,zatca_connected,moyasar_publishable_key,updated_at,social_instagram,social_whatsapp,social_twitter,social_snapchat,social_tiktok,google_maps_url,b2b_invoicing_enabled';

Future<bool> confirmDelete(BuildContext context, String title, [String body = 'لا يمكن التراجع عن الحذف.']) async =>
    await showDialog<bool>(
      context: context,
      builder: (c) => AlertDialog(
        title: Text(title),
        content: Text(body),
        actions: [
          TextButton(onPressed: () => Navigator.pop(c, false), child: const Text('إلغاء')),
          FilledButton(style: FilledButton.styleFrom(backgroundColor: Pos.destructive), onPressed: () => Navigator.pop(c, true), child: const Text('حذف')),
        ],
      ),
    ) ==
    true;

String _err(ApiException e) => e.status == 403 ? 'ليس لديك صلاحية لهذا الإجراء' : e.message;

// ───────────────────────── إعدادات المتجر ─────────────────────────

/// إعدادات المتجر — نفس /settings: بيانات المنشأة، الرقم الضريبي مع التحقق،
/// فواتير الشركات B2B، الشعار، ومفتاح الدفع الإلكتروني. الضريبة مفعّلة دائماً.
class SettingsScreen extends StatefulWidget {
  const SettingsScreen({super.key});

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  Map<String, dynamic>? _s;
  final _c = <String, TextEditingController>{};
  bool _saving = false, _uploading = false;
  String? _error;

  static const _fields = [
    ('shop_name', 'اسم المتجر'),
    ('phone', 'الجوال'),
    ('city', 'المدينة'),
    ('address', 'العنوان'),
    ('vat_number', 'الرقم الضريبي'),
    ('cr_number', 'السجل التجاري'),
  ];

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    for (final c in _c.values) {
      c.dispose();
    }
    super.dispose();
  }

  TextEditingController _ctl(String k) => _c.putIfAbsent(k, () => TextEditingController(text: '${_s?[k] ?? ''}'));

  Future<void> _load() async {
    try {
      final r = await context.read<Rest>().select('app_settings', select: _settingsCols, limit: 1);
      if (!mounted) return;
      setState(() {
        _s = r.isEmpty ? <String, dynamic>{} : r.first;
        for (final c in _c.values) {
          c.dispose();
        }
        _c.clear();
        _error = null;
      });
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    }
  }

  Future<void> _pickLogo() async {
    final rest = context.read<Rest>();
    final x = await ImagePicker().pickImage(source: ImageSource.gallery, maxWidth: 1200, maxHeight: 1200, imageQuality: 85);
    if (x == null) return;
    setState(() => _uploading = true);
    try {
      final url = await rest.upload('branding', 'logo-${DateTime.now().millisecondsSinceEpoch}.jpg', await x.readAsBytes());
      if (mounted) setState(() => _s!['logo_url'] = url);
    } on ApiException catch (e) {
      if (mounted) toast(context, 'تعذّر رفع الشعار: ${e.message}', error: true);
    } finally {
      if (mounted) setState(() => _uploading = false);
    }
  }

  Future<void> _save() async {
    final rest = context.read<Rest>();
    final row = <String, dynamic>{
      for (final f in _fields) f.$1: _ctl(f.$1).text.trim(),
      'moyasar_publishable_key': _ctl('moyasar_publishable_key').text.trim(),
      'b2b_invoicing_enabled': _s!['b2b_invoicing_enabled'] != false,
      'logo_url': _s!['logo_url'],
      'vat_enabled': true, // الضريبة لا تُعطَّل
    };
    setState(() => _saving = true);
    try {
      final id = _s!['id'];
      final r = id != null ? await rest.update('app_settings', '$id', row, select: _settingsCols) : await rest.insert('app_settings', row, select: _settingsCols);
      if (!mounted) return;
      if (r != null) setState(() => _s = r);
      toast(context, '✅ تم حفظ الإعدادات');
    } on ApiException catch (e) {
      if (mounted) toast(context, 'فشل الحفظ: ${_err(e)}', error: true);
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_s == null) {
      return ListView(padding: const EdgeInsets.all(16), children: [
        if (_error != null) LoadError(message: _error!, onRetry: _load) else const Padding(padding: EdgeInsets.all(60), child: Center(child: CircularProgressIndicator())),
      ]);
    }
    final vat = _ctl('vat_number').text;
    final vatValid = RegExp(r'^3\d{13}3$').hasMatch(vat);
    return Align(
      alignment: Alignment.topCenter,
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 720),
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 40),
          children: [
            const PageHeader(title: 'إعدادات المتجر', icon: Icons.settings_rounded, tone: Tone.gray),
            GlassCard(
              child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                const Text('بيانات المنشأة', style: TextStyle(fontWeight: FontWeight.w700)),
                const SizedBox(height: 12),
                LayoutBuilder(builder: (context, c) {
                  final w = c.maxWidth >= 520 ? (c.maxWidth - 12) / 2 : c.maxWidth;
                  return Wrap(spacing: 12, runSpacing: 12, children: [
                    for (final f in _fields)
                      SizedBox(
                        width: w,
                        child: TextField(
                          controller: _ctl(f.$1),
                          textDirection: f.$1 == 'vat_number' || f.$1 == 'cr_number' ? TextDirection.ltr : null,
                          onChanged: f.$1 == 'vat_number' ? (_) => setState(() {}) : null,
                          decoration: InputDecoration(
                            labelText: f.$2,
                            hintText: f.$1 == 'vat_number' ? '314151483700003' : null,
                            errorMaxLines: 3,
                            helperMaxLines: 3,
                            errorText: f.$1 == 'vat_number' && vat.isNotEmpty && !vatValid
                                ? 'الرقم الضريبي غير صحيح — يجب أن يكون 15 رقماً ويبدأ وينتهي بالرقم 3. سيظهر داخل رمز QR بشكل خاطئ وتُرفض الفاتورة من زاتكا.'
                                : null,
                            helperText: f.$1 == 'vat_number' && vat.isEmpty ? 'لم تُدخل رقماً ضريبياً بعد — بدونه سيظهر في رمز QR كـ 000000000000000 وتُرفض الفاتورة من زاتكا.' : null,
                            helperStyle: const TextStyle(color: Pos.amber),
                          ),
                        ),
                      ),
                  ]);
                }),
              ]),
            ),
            const SizedBox(height: 12),
            GlassCard(
              child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                const Text('الفواتير والضريبة', style: TextStyle(fontWeight: FontWeight.w700)),
                const SizedBox(height: 12),
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(color: const Color(0xFFECFDF5), border: Border.all(color: const Color(0xFF6EE7B7)), borderRadius: BorderRadius.circular(10)),
                  child: const Row(children: [
                    Expanded(
                      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Text('ضريبة القيمة المضافة (15%)', style: TextStyle(fontWeight: FontWeight.w600)),
                        Text('مفعّلة دائماً — إصدار الفواتير الضريبية إلزامي نظامياً ولا يمكن إيقافه من الإعدادات.', style: TextStyle(fontSize: 12, color: Pos.muted)),
                      ]),
                    ),
                    Text('إلزامي', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: Color(0xFF047857))),
                  ]),
                ),
                const SizedBox(height: 6),
                SwitchListTile(
                  contentPadding: EdgeInsets.zero,
                  value: _s!['b2b_invoicing_enabled'] != false,
                  onChanged: (v) => setState(() => _s!['b2b_invoicing_enabled'] = v),
                  title: const Text('إصدار فواتير ضريبية لشركات (B2B)', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
                  subtitle: const Text('إيقافها يخفي خيار "فاتورة لشركة" من صفحات إنشاء الطلب فوراً — يمكن إعادة تفعيلها بنفس الزر متى ما رغبت، بدون فقدان أي بيانات سابقة.',
                      style: TextStyle(fontSize: 12)),
                ),
                const SizedBox(height: 8),
                const Text('شعار المتجر', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
                const SizedBox(height: 6),
                Row(children: [
                  Container(
                    width: 72,
                    height: 72,
                    decoration: BoxDecoration(borderRadius: BorderRadius.circular(12), border: Border.all(color: Pos.border), color: Colors.white),
                    clipBehavior: Clip.antiAlias,
                    child: (_s!['logo_url'] ?? '').toString().isEmpty
                        ? const Icon(Icons.image_outlined, color: Pos.muted)
                        : Image.network('${_s!['logo_url']}', fit: BoxFit.contain, errorBuilder: (_, __, ___) => const Icon(Icons.broken_image_outlined)),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      OutlineSmall(label: _uploading ? 'جارٍ الرفع…' : 'رفع شعار', icon: Icons.upload_rounded, onPressed: _uploading ? null : _pickLogo),
                      const SizedBox(height: 4),
                      const Text('يُرفع الشعار مباشرة إلى التخزين — لا حاجة لأي رابط خارجي', style: TextStyle(fontSize: 11.5, color: Pos.muted)),
                    ]),
                  ),
                ]),
                const SizedBox(height: 12),
                TextField(
                  controller: _ctl('moyasar_publishable_key'),
                  textDirection: TextDirection.ltr,
                  decoration: const InputDecoration(labelText: 'مفتاح Moyasar (للدفع الإلكتروني)', hintText: 'pk_live_...'),
                ),
              ]),
            ),
            const SizedBox(height: 14),
            PrimaryButton(label: 'حفظ الإعدادات', icon: Icons.save_rounded, expand: true, busy: _saving, onPressed: _save),
          ],
        ),
      ),
    );
  }
}

// ───────────────────────── الفروع ─────────────────────────

/// إدارة الفروع — نفس /admin/branches.
class BranchesScreen extends StatefulWidget {
  const BranchesScreen({super.key});

  @override
  State<BranchesScreen> createState() => _BranchesScreenState();
}

class _BranchesScreenState extends State<BranchesScreen> {
  List<Map<String, dynamic>>? _rows;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final r = await context.read<Rest>().select('branches', order: 'sort_order.asc', limit: 200);
      if (mounted) {
        setState(() {
          _rows = r;
          _error = null;
        });
      }
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    }
  }

  Future<void> _edit([Map<String, dynamic>? b]) async {
    final ok = await showDialog<bool>(context: context, builder: (_) => _BranchDialog(branch: b));
    if (ok == true) _load();
  }

  Future<void> _patch(Map<String, dynamic> b, Map<String, dynamic> patch) async {
    try {
      await context.read<Rest>().update('branches', '${b['id']}', patch, select: 'id');
      _load();
    } on ApiException catch (e) {
      if (mounted) toast(context, _err(e), error: true);
    }
  }

  Future<void> _delete(Map<String, dynamic> b) async {
    if (!await confirmDelete(context, 'حذف فرع ${b['name']}؟')) return;
    if (!mounted) return;
    try {
      await context.read<Rest>().delete('branches', '${b['id']}');
      if (mounted) toast(context, 'تم حذف الفرع');
      _load();
    } on ApiException catch (e) {
      if (mounted) toast(context, _err(e), error: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    final rows = _rows ?? const [];
    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 40),
        physics: const AlwaysScrollableScrollPhysics(),
        children: [
          PageHeader(
            title: 'إدارة الفروع',
            subtitle: '${rows.length} فرع',
            icon: Icons.location_on_rounded,
            tone: Tone.red,
            trailing: PrimaryButton(label: 'إضافة فرع', icon: Icons.add_rounded, onPressed: () => _edit()),
          ),
          if (_error != null) LoadError(message: _error!, onRetry: _load),
          if (_rows == null && _error == null)
            const Padding(padding: EdgeInsets.all(60), child: Center(child: CircularProgressIndicator()))
          else if (rows.isEmpty)
            EmptyState(icon: Icons.location_off_outlined, text: 'لا توجد فروع بعد', sub: 'اضغط "إضافة فرع" لإضافة أول فرع')
          else
            LayoutBuilder(builder: (context, c) {
              final w = c.maxWidth >= 760 ? (c.maxWidth - 12) / 2 : c.maxWidth;
              return Wrap(spacing: 12, runSpacing: 12, children: [
                for (final b in rows)
                  SizedBox(
                    width: w,
                    child: Opacity(
                      opacity: b['is_active'] == false ? .6 : 1,
                      child: GlassCard(
                        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                          Row(children: [
                            Expanded(
                              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                                Text('${b['name']}', style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16)),
                                const SizedBox(height: 4),
                                SoftBadge(b['is_active'] == false ? 'غير نشط' : 'نشط', b['is_active'] == false ? Pos.muted : Pos.green),
                              ]),
                            ),
                            Switch(value: b['is_active'] != false, onChanged: (v) => _patch(b, {'is_active': v})),
                            IconButton(onPressed: () => _edit(b), icon: const Icon(Icons.edit_outlined, size: 19)),
                            IconButton(onPressed: () => _delete(b), icon: const Icon(Icons.delete_outline_rounded, size: 19, color: Pos.destructive)),
                          ]),
                          const SizedBox(height: 8),
                          Text('📍 ${b['address'] ?? ''}', style: const TextStyle(fontSize: 13)),
                          if ((b['phone'] ?? '').toString().isNotEmpty) Text('📞 ${b['phone']}', textDirection: TextDirection.ltr, style: const TextStyle(fontSize: 13)),
                          if ((b['working_hours'] ?? '').toString().isNotEmpty) Text('${b['working_hours']}', style: const TextStyle(fontSize: 12, color: Pos.muted)),
                          if ((b['maps_url'] ?? '').toString().isNotEmpty)
                            TextButton.icon(
                              style: TextButton.styleFrom(padding: EdgeInsets.zero, visualDensity: VisualDensity.compact),
                              onPressed: () => launchUrl(Uri.parse('${b['maps_url']}'), mode: LaunchMode.externalApplication),
                              icon: const Icon(Icons.open_in_new_rounded, size: 14),
                              label: const Text('عرض على الخريطة', style: TextStyle(fontSize: 12)),
                            ),
                        ]),
                      ),
                    ),
                  ),
              ]);
            }),
        ],
      ),
    );
  }
}

class _BranchDialog extends StatefulWidget {
  const _BranchDialog({this.branch});
  final Map<String, dynamic>? branch;
  @override
  State<_BranchDialog> createState() => _BranchDialogState();
}

class _BranchDialogState extends State<_BranchDialog> {
  late final _f = {
    for (final k in const ['name', 'address', 'phone', 'whatsapp', 'working_hours', 'maps_url', 'maps_embed', 'sort_order'])
      k: TextEditingController(text: '${widget.branch?[k] ?? (k == 'sort_order' ? 0 : '')}'),
  };
  late bool _active = widget.branch?['is_active'] != false;
  bool _saving = false;

  @override
  void dispose() {
    for (final c in _f.values) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _save() async {
    if (_f['name']!.text.trim().isEmpty || _f['address']!.text.trim().isEmpty) {
      toast(context, 'اسم الفرع والعنوان مطلوبان', error: true);
      return;
    }
    final row = <String, dynamic>{
      for (final e in _f.entries)
        if (e.key != 'sort_order') e.key: e.value.text.trim(),
      'sort_order': int.tryParse(_f['sort_order']!.text) ?? 0,
      'is_active': _active,
    };
    final rest = context.read<Rest>();
    setState(() => _saving = true);
    try {
      if (widget.branch == null) {
        await rest.insert('branches', row, select: 'id');
      } else {
        await rest.update('branches', '${widget.branch!['id']}', row, select: 'id');
      }
      if (!mounted) return;
      toast(context, widget.branch == null ? 'تم إضافة الفرع' : 'تم تحديث الفرع');
      Navigator.pop(context, true);
    } on ApiException catch (e) {
      if (mounted) {
        toast(context, _err(e), error: true);
        setState(() => _saving = false);
      }
    }
  }

  Widget _tf(String k, String label, {String? hint, bool ltr = false, int lines = 1, TextInputType? kb}) => Padding(
        padding: const EdgeInsets.only(bottom: 10),
        child: TextField(
          controller: _f[k],
          maxLines: lines,
          keyboardType: kb,
          textDirection: ltr ? TextDirection.ltr : null,
          decoration: InputDecoration(labelText: label, hintText: hint),
        ),
      );

  @override
  Widget build(BuildContext context) => AlertDialog(
        title: Text(widget.branch == null ? 'إضافة فرع جديد' : 'تعديل الفرع'),
        content: SizedBox(
          width: 460,
          child: SingleChildScrollView(
            child: Column(mainAxisSize: MainAxisSize.min, children: [
              _tf('name', 'اسم الفرع *', hint: 'مثال: فرع العزيزية'),
              _tf('address', 'العنوان *', hint: 'حي العزيزية، شارع الشباب...'),
              Row(children: [
                Expanded(child: _tf('phone', 'رقم الهاتف', hint: '05XXXXXXXX', ltr: true, kb: TextInputType.phone)),
                const SizedBox(width: 10),
                Expanded(child: _tf('whatsapp', 'رقم واتساب', hint: '+96654...', ltr: true, kb: TextInputType.phone)),
              ]),
              _tf('working_hours', 'ساعات العمل', hint: 'السبت-الخميس 11:30ص-11:30م'),
              _tf('maps_url', 'رابط خرائط Google', hint: 'https://maps.google.com/...', ltr: true),
              _tf('maps_embed', 'رابط iframe للخريطة (للعرض في الموقع)', hint: 'https://www.google.com/maps/embed?pb=...', ltr: true, lines: 3),
              const Align(
                alignment: AlignmentDirectional.centerStart,
                child: Text('من Google Maps: اضغط Share ← Embed a map ← انسخ رابط src فقط', style: TextStyle(fontSize: 11.5, color: Pos.muted)),
              ),
              const SizedBox(height: 10),
              Row(children: [
                SizedBox(width: 110, child: _tf('sort_order', 'ترتيب العرض', kb: TextInputType.number)),
                const SizedBox(width: 12),
                Switch(value: _active, onChanged: (v) => setState(() => _active = v)),
                const Text('فرع نشط'),
              ]),
            ]),
          ),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('إلغاء')),
          PrimaryButton(label: 'حفظ', busy: _saving, onPressed: _save),
        ],
      );
}

// ───────────────────────── الخدمات ─────────────────────────

/// إدارة الخدمات — نفس /admin/services (أحذية / شنط).
class ServicesAdminScreen extends StatefulWidget {
  const ServicesAdminScreen({super.key});
  @override
  State<ServicesAdminScreen> createState() => _ServicesAdminScreenState();
}

class _ServicesAdminScreenState extends State<ServicesAdminScreen> {
  List<Map<String, dynamic>>? _rows;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final r = await context.read<Rest>().select('services', order: 'created_at.desc', limit: 500);
      if (mounted) {
        setState(() {
          _rows = r;
          _error = null;
        });
      }
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    }
  }

  Future<void> _edit([Map<String, dynamic>? s]) async {
    final ok = await showDialog<bool>(context: context, builder: (_) => _ServiceDialog(service: s));
    if (ok == true) _load();
  }

  Future<void> _delete(Map<String, dynamic> s) async {
    if (!await confirmDelete(context, 'تأكيد الحذف', 'هل تريد حذف "${s['name_ar'] ?? s['name']}"؟')) return;
    if (!mounted) return;
    try {
      await context.read<Rest>().delete('services', '${s['id']}');
      if (mounted) toast(context, 'تم الحذف');
      _load();
    } on ApiException catch (e) {
      if (mounted) toast(context, _err(e), error: true);
    }
  }

  Widget _group(String label, IconData icon, List<Map<String, dynamic>> items) => Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Row(children: [
          Icon(icon, size: 18, color: Pos.muted),
          const SizedBox(width: 6),
          Text(label, style: const TextStyle(fontWeight: FontWeight.w700)),
          const SizedBox(width: 6),
          SoftBadge('${items.length}', Pos.muted),
        ]),
        const SizedBox(height: 8),
        if (items.isEmpty)
          const GlassCard(child: Text('لا توجد خدمات — أضف أولى خدماتك', textAlign: TextAlign.center, style: TextStyle(color: Pos.muted, fontSize: 13)))
        else
          LayoutBuilder(builder: (context, c) {
            final w = c.maxWidth >= 640 ? (c.maxWidth - 10) / 2 : c.maxWidth;
            return Wrap(spacing: 10, runSpacing: 10, children: [
              for (final s in items)
                SizedBox(
                  width: w,
                  child: Opacity(
                    opacity: s['is_active'] == false ? .6 : 1,
                    child: GlassCard(
                      padding: const EdgeInsets.all(12),
                      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Expanded(
                          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                            Row(children: [
                              Flexible(child: Text('${s['name_ar'] ?? s['name']}', style: const TextStyle(fontWeight: FontWeight.w700), overflow: TextOverflow.ellipsis)),
                              if (s['is_active'] == false) ...[const SizedBox(width: 6), const SoftBadge('مخفي', Pos.muted)],
                            ]),
                            if ((s['description'] ?? '').toString().isNotEmpty) Text('${s['description']}', style: const TextStyle(fontSize: 12, color: Pos.muted)),
                            const SizedBox(height: 6),
                            Row(children: [
                              PosMoney(((s['price'] as num?) ?? 0).toDouble(), weight: FontWeight.w800, color: const Color(0xFFD97706), decimals: 0),
                              const SizedBox(width: 12),
                              Text('⏱ ${s['duration_minutes'] ?? 0} د', style: const TextStyle(fontSize: 12, color: Pos.muted)),
                            ]),
                          ]),
                        ),
                        IconButton(onPressed: () => _edit(s), icon: const Icon(Icons.edit_outlined, size: 18)),
                        IconButton(onPressed: () => _delete(s), icon: const Icon(Icons.delete_outline_rounded, size: 18, color: Pos.destructive)),
                      ]),
                    ),
                  ),
                ),
            ]);
          }),
        const SizedBox(height: 20),
      ]);

  @override
  Widget build(BuildContext context) {
    final rows = _rows ?? const <Map<String, dynamic>>[];
    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 40),
        physics: const AlwaysScrollableScrollPhysics(),
        children: [
          PageHeader(
            title: 'إدارة الخدمات',
            subtitle: 'أضف وعدّل خدمات إصلاح الأحذية والشنط',
            icon: Icons.build_rounded,
            tone: Tone.orange,
            trailing: PrimaryButton(label: 'إضافة خدمة', icon: Icons.add_rounded, onPressed: () => _edit()),
          ),
          if (_error != null) LoadError(message: _error!, onRetry: _load),
          if (_rows == null && _error == null)
            const Padding(padding: EdgeInsets.all(60), child: Center(child: CircularProgressIndicator()))
          else ...[
            _group('إصلاح الأحذية', Icons.content_cut_rounded, rows.where((s) => s['category'] == 'shoes').toList()),
            _group('إصلاح الشنط', Icons.shopping_bag_outlined, rows.where((s) => s['category'] == 'bags').toList()),
          ],
        ],
      ),
    );
  }
}

class _ServiceDialog extends StatefulWidget {
  const _ServiceDialog({this.service});
  final Map<String, dynamic>? service;
  @override
  State<_ServiceDialog> createState() => _ServiceDialogState();
}

class _ServiceDialogState extends State<_ServiceDialog> {
  late final _name = TextEditingController(text: '${widget.service?['name_ar'] ?? ''}');
  late final _desc = TextEditingController(text: '${widget.service?['description'] ?? ''}');
  late final _price = TextEditingController(text: widget.service?['price'] == null ? '' : '${widget.service!['price']}');
  late final _dur = TextEditingController(text: '${widget.service?['duration_minutes'] ?? 30}');
  late String _cat = '${widget.service?['category'] ?? 'shoes'}';
  late bool _active = widget.service?['is_active'] != false;
  bool _saving = false;

  Future<void> _save() async {
    final price = double.tryParse(_price.text);
    if (_name.text.trim().isEmpty || price == null) {
      toast(context, 'اسم الخدمة والسعر مطلوبان', error: true);
      return;
    }
    final row = {
      'name': _name.text.trim(),
      'name_ar': _name.text.trim(),
      'category': _cat,
      'description': _desc.text.trim(),
      'price': price,
      'duration_minutes': int.tryParse(_dur.text) ?? 30,
      'is_active': _active,
    };
    final rest = context.read<Rest>();
    setState(() => _saving = true);
    try {
      if (widget.service == null) {
        await rest.insert('services', row, select: 'id');
      } else {
        await rest.update('services', '${widget.service!['id']}', row, select: 'id');
      }
      if (!mounted) return;
      toast(context, widget.service == null ? 'تمت إضافة الخدمة' : 'تم تحديث الخدمة');
      Navigator.pop(context, true);
    } on ApiException catch (e) {
      if (mounted) {
        toast(context, _err(e), error: true);
        setState(() => _saving = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) => AlertDialog(
        title: Text(widget.service == null ? 'إضافة خدمة جديدة' : 'تعديل الخدمة'),
        content: SizedBox(
          width: 420,
          child: SingleChildScrollView(
            child: Column(mainAxisSize: MainAxisSize.min, children: [
              TextField(controller: _name, decoration: const InputDecoration(labelText: 'اسم الخدمة بالعربية *', hintText: 'مثال: تغيير نعل الحذاء')),
              const SizedBox(height: 10),
              DropdownButtonFormField<String>(
                value: _cat,
                decoration: const InputDecoration(labelText: 'الفئة'),
                items: const [DropdownMenuItem(value: 'shoes', child: Text('أحذية')), DropdownMenuItem(value: 'bags', child: Text('شنط'))],
                onChanged: (v) => setState(() => _cat = v ?? 'shoes'),
              ),
              const SizedBox(height: 10),
              TextField(controller: _desc, decoration: const InputDecoration(labelText: 'الوصف', hintText: 'وصف مختصر للخدمة')),
              const SizedBox(height: 10),
              Row(children: [
                Expanded(child: TextField(controller: _price, keyboardType: const TextInputType.numberWithOptions(decimal: true), decoration: const InputDecoration(labelText: 'السعر (ر.س) *', hintText: '50'))),
                const SizedBox(width: 10),
                Expanded(child: TextField(controller: _dur, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: 'المدة (دقائق)'))),
              ]),
              SwitchListTile(
                contentPadding: EdgeInsets.zero,
                value: _active,
                onChanged: (v) => setState(() => _active = v),
                title: Text(_active ? 'ظاهرة للعملاء' : 'مخفية'),
              ),
            ]),
          ),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('إلغاء')),
          PrimaryButton(label: 'حفظ', busy: _saving, onPressed: _save),
        ],
      );
}

// ───────────────────────── أوقات العمل ─────────────────────────

const _days = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

/// أوقات العمل — نفس /admin/working-hours: يحفظ كل الأيام ويبلغ بالأيام اللي فشلت.
class WorkingHoursScreen extends StatefulWidget {
  const WorkingHoursScreen({super.key});
  @override
  State<WorkingHoursScreen> createState() => _WorkingHoursScreenState();
}

class _WorkingHoursScreenState extends State<WorkingHoursScreen> {
  List<Map<String, dynamic>> _existing = const [];
  late List<Map<String, dynamic>> _hours = [
    for (var d = 0; d < 7; d++) {'day_of_week': d, 'day_name_ar': _days[d], 'is_open': d != 5, 'open_time': '09:00', 'close_time': '18:00', 'slot_duration': 30},
  ];
  bool _loading = true, _saving = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  static String _hm(Object? t) {
    final s = '${t ?? ''}';
    return s.length >= 5 ? s.substring(0, 5) : s;
  }

  Future<void> _load() async {
    try {
      final r = await context.read<Rest>().select('working_hours', order: 'day_of_week.asc', limit: 20);
      if (!mounted) return;
      setState(() {
        _existing = r;
        if (r.isNotEmpty) {
          _hours = [
            for (var d = 0; d < 7; d++)
              () {
                final e = r.where((w) => w['day_of_week'] == d).firstOrNull;
                return e == null
                    ? {'day_of_week': d, 'day_name_ar': _days[d], 'is_open': true, 'open_time': '09:00', 'close_time': '18:00', 'slot_duration': 30}
                    : {...e, 'open_time': _hm(e['open_time']), 'close_time': _hm(e['close_time'])};
              }(),
          ];
        }
        _loading = false;
        _error = null;
      });
    } on ApiException catch (e) {
      if (mounted) {
        setState(() {
          _error = e.message;
          _loading = false;
        });
      }
    }
  }

  Future<void> _pickTime(int i, String field) async {
    final parts = '${_hours[i][field]}'.split(':');
    final t = await showTimePicker(
      context: context,
      initialTime: TimeOfDay(hour: int.tryParse(parts.first) ?? 9, minute: parts.length > 1 ? int.tryParse(parts[1]) ?? 0 : 0),
    );
    if (t != null) setState(() => _hours[i][field] = '${t.hour.toString().padLeft(2, '0')}:${t.minute.toString().padLeft(2, '0')}');
  }

  Future<void> _save() async {
    final bad = _hours.where((h) => h['is_open'] == true && '${h['open_time']}'.compareTo('${h['close_time']}') >= 0).firstOrNull;
    if (bad != null) {
      toast(context, 'وقت الإغلاق ليوم ${bad['day_name_ar']} يجب أن يكون بعد وقت الفتح', error: true);
      return;
    }
    final rest = context.read<Rest>();
    final me = context.read<AuthController>().employee!;
    final audit = context.read<OrderService>();
    setState(() => _saving = true);
    final failed = <String>[];
    String? firstError;
    await Future.wait([
      for (final h in _hours)
        () async {
          final row = {
            'day_of_week': h['day_of_week'],
            'day_name_ar': h['day_name_ar'],
            'is_open': h['is_open'],
            'open_time': h['open_time'],
            'close_time': h['close_time'],
            'slot_duration': h['slot_duration'],
          };
          final ex = _existing.where((w) => w['day_of_week'] == h['day_of_week']).firstOrNull;
          try {
            if (ex != null) {
              await rest.update('working_hours', '${ex['id']}', row, select: 'id');
            } else {
              await rest.insert('working_hours', row, select: 'id');
            }
          } on ApiException catch (e) {
            failed.add('${h['day_name_ar']}');
            firstError ??= _err(e);
          }
        }(),
    ]);
    audit.audit(me, action: 'update', page: 'أوقات العمل', entity: 'working_hours', details: {'hours': _hours});
    if (!mounted) return;
    setState(() => _saving = false);
    if (failed.isEmpty) {
      toast(context, 'تم حفظ أوقات العمل بنجاح — كل الأيام');
    } else if (failed.length == _hours.length) {
      toast(context, 'فشل حفظ أوقات العمل بالكامل: ${firstError ?? 'حاول مرة أخرى'}', error: true);
    } else {
      toast(context, 'تم حفظ ${_hours.length - failed.length} من ${_hours.length} أيام — فشل: ${failed.join('، ')}', error: true);
    }
    _load();
  }

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 40),
      children: [
        PageHeader(
          title: 'أوقات العمل',
          subtitle: 'حدد أيام وساعات العمل لمنع التضارب في الحجوزات',
          icon: Icons.schedule_rounded,
          tone: Tone.teal,
          trailing: PrimaryButton(label: 'حفظ التغييرات', icon: Icons.save_rounded, busy: _saving, onPressed: _loading ? null : _save),
        ),
        if (_error != null) LoadError(message: _error!, onRetry: _load),
        if (_loading)
          const Padding(padding: EdgeInsets.all(60), child: Center(child: CircularProgressIndicator()))
        else
          GlassCard(
            padding: EdgeInsets.zero,
            child: Column(children: [
              for (var i = 0; i < _hours.length; i++) ...[
                if (i > 0) const Divider(height: 1),
                Opacity(
                  opacity: _hours[i]['is_open'] == true ? 1 : .7,
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                    child: Wrap(spacing: 12, runSpacing: 8, crossAxisAlignment: WrapCrossAlignment.center, children: [
                      Switch(value: _hours[i]['is_open'] == true, onChanged: (v) => setState(() => _hours[i]['is_open'] = v)),
                      SizedBox(width: 72, child: Text('${_hours[i]['day_name_ar']}', style: const TextStyle(fontWeight: FontWeight.w700))),
                      if (_hours[i]['is_open'] == true) ...[
                        OutlineSmall(label: 'من ${_hours[i]['open_time']}', icon: Icons.wb_sunny_outlined, onPressed: () => _pickTime(i, 'open_time')),
                        OutlineSmall(label: 'إلى ${_hours[i]['close_time']}', icon: Icons.nightlight_outlined, onPressed: () => _pickTime(i, 'close_time')),
                        DropdownButton<int>(
                          value: [15, 30, 45, 60].contains(_hours[i]['slot_duration']) ? _hours[i]['slot_duration'] as int : 30,
                          underline: const SizedBox.shrink(),
                          items: const [
                            DropdownMenuItem(value: 15, child: Text('فترة 15 دقيقة')),
                            DropdownMenuItem(value: 30, child: Text('فترة 30 دقيقة')),
                            DropdownMenuItem(value: 45, child: Text('فترة 45 دقيقة')),
                            DropdownMenuItem(value: 60, child: Text('فترة ساعة')),
                          ],
                          onChanged: (v) => setState(() => _hours[i]['slot_duration'] = v ?? 30),
                        ),
                      ] else
                        const Text('مغلق', style: TextStyle(color: Pos.muted)),
                    ]),
                  ),
                ),
              ],
            ]),
          ),
      ],
    );
  }
}

// ───────────────────────── التقييمات ─────────────────────────

/// إدارة التقييمات — نفس /admin/reviews: موافقة وحذف.
class ReviewsAdminScreen extends StatefulWidget {
  const ReviewsAdminScreen({super.key});
  @override
  State<ReviewsAdminScreen> createState() => _ReviewsAdminScreenState();
}

class _ReviewsAdminScreenState extends State<ReviewsAdminScreen> {
  List<Map<String, dynamic>>? _rows;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final r = await context.read<Rest>().select('reviews', order: 'created_at.desc', limit: 500);
      if (mounted) {
        setState(() {
          _rows = r;
          _error = null;
        });
      }
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    }
  }

  Future<void> _approve(Map<String, dynamic> r) async {
    try {
      await context.read<Rest>().update('reviews', '${r['id']}', {'is_approved': true}, select: 'id');
      _load();
    } on ApiException catch (e) {
      if (mounted) toast(context, _err(e), error: true);
    }
  }

  Future<void> _delete(Map<String, dynamic> r) async {
    if (!await confirmDelete(context, 'حذف تقييم ${r['customer_name'] ?? ''}؟')) return;
    if (!mounted) return;
    try {
      await context.read<Rest>().delete('reviews', '${r['id']}');
      _load();
    } on ApiException catch (e) {
      if (mounted) toast(context, _err(e), error: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    final rows = _rows ?? const <Map<String, dynamic>>[];
    final pending = rows.where((r) => r['is_approved'] != true).length;
    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 40),
        physics: const AlwaysScrollableScrollPhysics(),
        children: [
          const PageHeader(title: 'إدارة التقييمات', icon: Icons.star_rounded, tone: Tone.orange),
          Row(children: [
            Expanded(child: _count('$pending', 'في انتظار الموافقة', const Color(0xFFEAB308))),
            const SizedBox(width: 10),
            Expanded(child: _count('${rows.length - pending}', 'منشور', Pos.green)),
          ]),
          const SizedBox(height: 14),
          if (_error != null) LoadError(message: _error!, onRetry: _load),
          if (_rows == null && _error == null)
            const Padding(padding: EdgeInsets.all(60), child: Center(child: CircularProgressIndicator()))
          else if (rows.isEmpty)
            const EmptyState(icon: Icons.star_outline_rounded, text: 'لا توجد تقييمات بعد')
          else
            for (final r in rows)
              Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: GlassCard(
                  child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Expanded(
                      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Wrap(spacing: 8, runSpacing: 4, crossAxisAlignment: WrapCrossAlignment.center, children: [
                          Text('${r['customer_name'] ?? ''}', style: const TextStyle(fontWeight: FontWeight.w700)),
                          if ((r['service'] ?? '').toString().isNotEmpty) Text('${r['service']}', style: const TextStyle(fontSize: 12, color: Pos.muted)),
                          if ((r['order_number'] ?? '').toString().isNotEmpty) Text('#${r['order_number']}', style: const TextStyle(fontSize: 12, color: Pos.muted)),
                          SoftBadge(r['is_approved'] == true ? 'منشور' : 'بانتظار الموافقة', r['is_approved'] == true ? Pos.green : Pos.amber),
                        ]),
                        const SizedBox(height: 4),
                        Row(children: [
                          for (var s = 0; s < 5; s++)
                            Icon(s < ((r['rating'] as num?) ?? 0) ? Icons.star_rounded : Icons.star_outline_rounded, size: 17, color: const Color(0xFFC9A84C)),
                        ]),
                        const SizedBox(height: 4),
                        Text('${r['text'] ?? r['comment'] ?? ''}', style: const TextStyle(fontSize: 13, color: Pos.muted)),
                      ]),
                    ),
                    if (r['is_approved'] != true) OutlineSmall(label: 'موافقة', icon: Icons.check_rounded, color: Pos.green, onPressed: () => _approve(r)),
                    IconButton(onPressed: () => _delete(r), icon: const Icon(Icons.delete_outline_rounded, color: Pos.destructive, size: 19)),
                  ]),
                ),
              ),
        ],
      ),
    );
  }

  Widget _count(String v, String l, Color c) => GlassCard(
        child: Column(children: [
          Text(v, style: TextStyle(fontSize: 26, fontWeight: FontWeight.w900, color: c)),
          Text(l, style: const TextStyle(fontSize: 12, color: Pos.muted)),
        ]),
      );
}
