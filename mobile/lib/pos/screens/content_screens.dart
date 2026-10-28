import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/api_client.dart';
import '../../core/rest.dart';
import '../pos_ui.dart';
import 'settings_screens.dart' show confirmDelete;

String _err(ApiException e) => e.status == 403 ? 'ليس لديك صلاحية لهذا الإجراء' : e.message;

/// زر رفع صورة للتخزين يرجع الرابط العام — نفس ImageUploader بالموقع.
class ImageUploadField extends StatefulWidget {
  const ImageUploadField({super.key, required this.bucket, required this.label, required this.url, required this.onChanged, this.hint});
  final String bucket, label;
  final String? url, hint;
  final ValueChanged<String> onChanged;
  @override
  State<ImageUploadField> createState() => _ImageUploadFieldState();
}

class _ImageUploadFieldState extends State<ImageUploadField> {
  bool _busy = false;

  Future<void> _pick() async {
    final rest = context.read<Rest>();
    final x = await ImagePicker().pickImage(source: ImageSource.gallery, maxWidth: 1600, maxHeight: 1600, imageQuality: 82);
    if (x == null) return;
    setState(() => _busy = true);
    try {
      final url = await rest.upload(widget.bucket, '${DateTime.now().millisecondsSinceEpoch}.jpg', await x.readAsBytes());
      widget.onChanged(url);
    } on ApiException catch (e) {
      if (mounted) toast(context, 'تعذّر رفع الصورة: ${e.message}', error: true);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final u = widget.url ?? '';
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Text(widget.label, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
      const SizedBox(height: 6),
      Row(children: [
        Container(
          width: 64,
          height: 64,
          clipBehavior: Clip.antiAlias,
          decoration: BoxDecoration(borderRadius: BorderRadius.circular(12), border: Border.all(color: Pos.border), color: Colors.white),
          child: u.isEmpty ? const Icon(Icons.image_outlined, color: Pos.muted) : Image.network(u, fit: BoxFit.cover, errorBuilder: (_, __, ___) => const Icon(Icons.broken_image_outlined)),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Wrap(spacing: 6, children: [
              OutlineSmall(label: _busy ? 'جارٍ الرفع…' : 'رفع صورة', icon: Icons.upload_rounded, onPressed: _busy ? null : _pick),
              if (u.isNotEmpty) OutlineSmall(label: 'إزالة', icon: Icons.close_rounded, color: Pos.red, onPressed: () => widget.onChanged('')),
            ]),
            if (widget.hint != null) Padding(padding: const EdgeInsets.only(top: 4), child: Text(widget.hint!, style: const TextStyle(fontSize: 11.5, color: Pos.muted))),
          ]),
        ),
      ]),
    ]);
  }
}

// ───────────────────────── الماركات ─────────────────────────

class BrandsScreen extends StatefulWidget {
  const BrandsScreen({super.key});
  @override
  State<BrandsScreen> createState() => _BrandsScreenState();
}

class _BrandsScreenState extends State<BrandsScreen> {
  List<Map<String, dynamic>>? _rows;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final r = await context.read<Rest>().select('brands', order: 'sort_order.asc', limit: 500);
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
    final ok = await showDialog<bool>(context: context, builder: (_) => _BrandDialog(brand: b));
    if (ok == true) _load();
  }

  Future<void> _delete(Map<String, dynamic> b) async {
    if (!await confirmDelete(context, 'حذف ماركة ${b['name_ar'] ?? b['name']}؟')) return;
    if (!mounted) return;
    try {
      await context.read<Rest>().delete('brands', '${b['id']}');
      _load();
    } on ApiException catch (e) {
      if (mounted) toast(context, _err(e), error: true);
    }
  }

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
            title: 'إدارة الماركات',
            subtitle: 'الماركات المعروضة في الموقع',
            icon: Icons.sell_rounded,
            tone: Tone.indigo,
            trailing: PrimaryButton(label: 'إضافة ماركة', icon: Icons.add_rounded, onPressed: () => _edit()),
          ),
          if (_error != null) LoadError(message: _error!, onRetry: _load),
          if (_rows == null && _error == null)
            const Padding(padding: EdgeInsets.all(60), child: Center(child: CircularProgressIndicator()))
          else if (rows.isEmpty)
            const EmptyState(icon: Icons.sell_outlined, text: 'لا توجد ماركات بعد', sub: 'اضغط "إضافة ماركة" لإضافة أول ماركة')
          else
            LayoutBuilder(builder: (context, c) {
              final cols = (c.maxWidth / 170).floor().clamp(2, 6);
              final w = (c.maxWidth - (cols - 1) * 10) / cols;
              return Wrap(spacing: 10, runSpacing: 10, children: [
                for (final b in rows)
                  SizedBox(
                    width: w,
                    child: Opacity(
                      opacity: b['is_active'] == false ? .5 : 1,
                      child: GlassCard(
                        padding: const EdgeInsets.all(10),
                        child: Column(children: [
                          SizedBox(
                            height: 56,
                            child: (b['logo_url'] ?? '').toString().isEmpty
                                ? const Icon(Icons.sell_outlined, size: 30, color: Pos.muted)
                                : Image.network('${b['logo_url']}', fit: BoxFit.contain, errorBuilder: (_, __, ___) => const Icon(Icons.broken_image_outlined)),
                          ),
                          const SizedBox(height: 6),
                          Text('${b['name_ar'] ?? ''}', style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13), overflow: TextOverflow.ellipsis),
                          Text('${b['name'] ?? ''}', style: const TextStyle(fontSize: 11.5, color: Pos.muted), overflow: TextOverflow.ellipsis),
                          Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                            IconButton(visualDensity: VisualDensity.compact, onPressed: () => _edit(b), icon: const Icon(Icons.edit_outlined, size: 17)),
                            IconButton(visualDensity: VisualDensity.compact, onPressed: () => _delete(b), icon: const Icon(Icons.delete_outline_rounded, size: 17, color: Pos.destructive)),
                          ]),
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

class _BrandDialog extends StatefulWidget {
  const _BrandDialog({this.brand});
  final Map<String, dynamic>? brand;
  @override
  State<_BrandDialog> createState() => _BrandDialogState();
}

class _BrandDialogState extends State<_BrandDialog> {
  late final _name = TextEditingController(text: '${widget.brand?['name'] ?? ''}');
  late final _nameAr = TextEditingController(text: '${widget.brand?['name_ar'] ?? ''}');
  late final _sort = TextEditingController(text: '${widget.brand?['sort_order'] ?? 0}');
  late String _logo = '${widget.brand?['logo_url'] ?? ''}';
  late bool _active = widget.brand?['is_active'] != false;
  bool _saving = false;

  Future<void> _save() async {
    if (_name.text.trim().isEmpty || _nameAr.text.trim().isEmpty) {
      toast(context, 'الاسم بالإنجليزية والعربية مطلوبان', error: true);
      return;
    }
    final row = {'name': _name.text.trim(), 'name_ar': _nameAr.text.trim(), 'logo_url': _logo, 'sort_order': int.tryParse(_sort.text) ?? 0, 'is_active': _active};
    final rest = context.read<Rest>();
    setState(() => _saving = true);
    try {
      if (widget.brand == null) {
        await rest.insert('brands', row, select: 'id');
      } else {
        await rest.update('brands', '${widget.brand!['id']}', row, select: 'id');
      }
      if (mounted) Navigator.pop(context, true);
    } on ApiException catch (e) {
      if (mounted) {
        toast(context, _err(e), error: true);
        setState(() => _saving = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) => AlertDialog(
        title: Text(widget.brand == null ? 'إضافة ماركة' : 'تعديل الماركة'),
        content: SizedBox(
          width: 420,
          child: SingleChildScrollView(
            child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              Row(children: [
                Expanded(child: TextField(controller: _name, textDirection: TextDirection.ltr, decoration: const InputDecoration(labelText: 'الاسم بالإنجليزية', hintText: 'Gucci'))),
                const SizedBox(width: 10),
                Expanded(child: TextField(controller: _nameAr, decoration: const InputDecoration(labelText: 'الاسم بالعربي', hintText: 'غوتشي'))),
              ]),
              const SizedBox(height: 12),
              ImageUploadField(bucket: 'brands', label: 'شعار الماركة', url: _logo, onChanged: (u) => setState(() => _logo = u)),
              const SizedBox(height: 12),
              Row(children: [
                SizedBox(width: 120, child: TextField(controller: _sort, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: 'ترتيب العرض'))),
                const SizedBox(width: 12),
                Switch(value: _active, onChanged: (v) => setState(() => _active = v)),
                const Text('مفعّل'),
              ]),
            ]),
          ),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('إلغاء')),
          PrimaryButton(label: widget.brand == null ? 'إضافة' : 'حفظ التعديلات', busy: _saving, onPressed: _save),
        ],
      );
}

// ───────────────────────── المتجر ─────────────────────────

const shopCategories = {
  'soles': 'نعال وأكواع',
  'leather': 'جلود فاخرة',
  'threads': 'خيوط وإبر',
  'zippers': 'سحّابات',
  'care': 'مواد العناية',
  'tools': 'أدوات الورشة',
  'adhesives': 'مواد اللصق',
  'other': 'أخرى',
};

/// إدارة المتجر — نفس /admin/shop: منتجات الموقع (السعر، الخصم، الصورة، التوفر، مميز).
class ShopAdminScreen extends StatefulWidget {
  const ShopAdminScreen({super.key});
  @override
  State<ShopAdminScreen> createState() => _ShopAdminScreenState();
}

class _ShopAdminScreenState extends State<ShopAdminScreen> {
  List<Map<String, dynamic>>? _rows;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final r = await context.read<Rest>().select('products', order: 'sort_order.asc', limit: 1000);
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

  Future<void> _edit([Map<String, dynamic>? p]) async {
    final ok = await showDialog<bool>(context: context, builder: (_) => _ProductDialog(product: p));
    if (ok == true) _load();
  }

  Future<void> _toggle(Map<String, dynamic> p) async {
    try {
      await context.read<Rest>().update('products', '${p['id']}', {'in_stock': p['in_stock'] != true}, select: 'id');
      _load();
    } on ApiException catch (e) {
      if (mounted) toast(context, 'فشل تعديل المنتج: ${_err(e)}', error: true);
    }
  }

  Future<void> _delete(Map<String, dynamic> p) async {
    if (!await confirmDelete(context, 'حذف ${p['name_ar'] ?? 'المنتج'}؟')) return;
    if (!mounted) return;
    try {
      await context.read<Rest>().delete('products', '${p['id']}');
      if (mounted) toast(context, 'تم حذف المنتج');
      _load();
    } on ApiException catch (e) {
      if (mounted) toast(context, 'فشل حذف المنتج: ${_err(e)}', error: true);
    }
  }

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
            title: 'إدارة المتجر',
            subtitle: '${rows.length} منتج',
            icon: Icons.storefront_rounded,
            tone: Tone.pink,
            trailing: PrimaryButton(label: 'إضافة منتج', icon: Icons.add_rounded, onPressed: () => _edit()),
          ),
          if (_error != null) LoadError(message: _error!, onRetry: _load),
          if (_rows == null && _error == null)
            const Padding(padding: EdgeInsets.all(60), child: Center(child: CircularProgressIndicator()))
          else if (rows.isEmpty)
            const EmptyState(icon: Icons.inventory_2_outlined, text: 'لا توجد منتجات بعد')
          else
            for (final p in rows)
              Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: GlassCard(
                  padding: const EdgeInsets.all(12),
                  child: Row(children: [
                    Container(
                      width: 56,
                      height: 56,
                      clipBehavior: Clip.antiAlias,
                      decoration: BoxDecoration(borderRadius: BorderRadius.circular(10), color: Pos.muted.withValues(alpha: .08)),
                      child: (p['image_url'] ?? '').toString().isEmpty
                          ? const Icon(Icons.inventory_2_outlined, color: Pos.muted)
                          : Image.network('${p['image_url']}', fit: BoxFit.cover, errorBuilder: (_, __, ___) => const Icon(Icons.broken_image_outlined)),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Wrap(spacing: 6, runSpacing: 4, crossAxisAlignment: WrapCrossAlignment.center, children: [
                          Text('${p['name_ar'] ?? ''}', style: const TextStyle(fontWeight: FontWeight.w700)),
                          if (p['is_featured'] == true) const Icon(Icons.star_rounded, size: 15, color: Color(0xFFEAB308)),
                          SoftBadge(shopCategories[p['category']] ?? '${p['category'] ?? ''}', Pos.muted),
                          SoftBadge(p['in_stock'] == true ? 'متوفر' : 'نفذ', p['in_stock'] == true ? Pos.green : Pos.red),
                        ]),
                        if ((p['description'] ?? '').toString().isNotEmpty) Text('${p['description']}', maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 12, color: Pos.muted)),
                        Row(children: [
                          PosMoney(((p['price'] as num?) ?? 0).toDouble(), weight: FontWeight.w800, color: Pos.primary),
                          if (p['original_price'] != null) ...[
                            const SizedBox(width: 8),
                            Text('${p['original_price']}', style: const TextStyle(fontSize: 12, color: Pos.muted, decoration: TextDecoration.lineThrough)),
                          ],
                        ]),
                      ]),
                    ),
                    IconButton(
                      tooltip: 'تغيير التوفر',
                      onPressed: () => _toggle(p),
                      icon: Icon(p['in_stock'] == true ? Icons.toggle_on_rounded : Icons.toggle_off_rounded, size: 28, color: p['in_stock'] == true ? Pos.green : Pos.muted),
                    ),
                    IconButton(onPressed: () => _edit(p), icon: const Icon(Icons.edit_outlined, size: 19)),
                    IconButton(onPressed: () => _delete(p), icon: const Icon(Icons.delete_outline_rounded, size: 19, color: Pos.destructive)),
                  ]),
                ),
              ),
        ],
      ),
    );
  }
}

class _ProductDialog extends StatefulWidget {
  const _ProductDialog({this.product});
  final Map<String, dynamic>? product;
  @override
  State<_ProductDialog> createState() => _ProductDialogState();
}

class _ProductDialogState extends State<_ProductDialog> {
  late final _f = {
    for (final k in const ['name_ar', 'name', 'price', 'original_price', 'description']) k: TextEditingController(text: '${widget.product?[k] ?? ''}'),
  };
  late String _cat = shopCategories.containsKey(widget.product?['category']) ? '${widget.product!['category']}' : 'soles';
  late String _img = '${widget.product?['image_url'] ?? ''}';
  late bool _stock = widget.product?['in_stock'] != false;
  late bool _featured = widget.product?['is_featured'] == true;
  bool _saving = false;

  Future<void> _save() async {
    final price = double.tryParse(_f['price']!.text);
    if (_f['name_ar']!.text.trim().isEmpty || price == null) {
      toast(context, 'الاسم بالعربي والسعر مطلوبان', error: true);
      return;
    }
    final row = {
      'name_ar': _f['name_ar']!.text.trim(),
      'name': _f['name']!.text.trim(),
      'category': _cat,
      'price': price,
      'original_price': double.tryParse(_f['original_price']!.text),
      'image_url': _img,
      'description': _f['description']!.text.trim(),
      'in_stock': _stock,
      'is_featured': _featured,
    };
    final rest = context.read<Rest>();
    setState(() => _saving = true);
    try {
      if (widget.product == null) {
        await rest.insert('products', {...row, 'sort_order': 0}, select: 'id');
      } else {
        await rest.update('products', '${widget.product!['id']}', row, select: 'id');
      }
      if (mounted) Navigator.pop(context, true);
    } on ApiException catch (e) {
      if (mounted) {
        toast(context, '${widget.product == null ? 'فشل إضافة المنتج' : 'فشل تعديل المنتج'}: ${_err(e)}', error: true);
        setState(() => _saving = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) => AlertDialog(
        title: Text(widget.product == null ? 'إضافة منتج جديد' : 'تعديل منتج'),
        content: SizedBox(
          width: 480,
          child: SingleChildScrollView(
            child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              Row(children: [
                Expanded(child: TextField(controller: _f['name_ar'], decoration: const InputDecoration(labelText: 'الاسم بالعربي *', hintText: 'كريم تلميع فاخر'))),
                const SizedBox(width: 10),
                Expanded(child: TextField(controller: _f['name'], textDirection: TextDirection.ltr, decoration: const InputDecoration(labelText: 'الاسم بالإنجليزي', hintText: 'Luxury Shoe Polish'))),
              ]),
              const SizedBox(height: 10),
              DropdownButtonFormField<String>(
                value: _cat,
                decoration: const InputDecoration(labelText: 'الفئة *'),
                items: [for (final e in shopCategories.entries) DropdownMenuItem(value: e.key, child: Text(e.value))],
                onChanged: (v) => setState(() => _cat = v ?? 'soles'),
              ),
              const SizedBox(height: 10),
              Row(children: [
                Expanded(child: TextField(controller: _f['price'], keyboardType: const TextInputType.numberWithOptions(decimal: true), decoration: const InputDecoration(labelText: 'السعر (ر.س) *', hintText: '85'))),
                const SizedBox(width: 10),
                Expanded(child: TextField(controller: _f['original_price'], keyboardType: const TextInputType.numberWithOptions(decimal: true), decoration: const InputDecoration(labelText: 'السعر قبل الخصم', hintText: '120'))),
              ]),
              const SizedBox(height: 12),
              ImageUploadField(bucket: 'shop-products', label: 'صورة المنتج', url: _img, onChanged: (u) => setState(() => _img = u)),
              if (_img.isEmpty)
                const Padding(
                  padding: EdgeInsets.only(top: 6),
                  child: Text('⚠️ بدون صورة حقيقية، لن يظهر المنتج في نتائج بحث الصور بجوجل، وسيُستبدل بصورة عامة مؤقتة في المتجر.', style: TextStyle(fontSize: 11.5, color: Pos.amber)),
                ),
              const SizedBox(height: 10),
              TextField(controller: _f['description'], decoration: const InputDecoration(labelText: 'الوصف', hintText: 'وصف مختصر للمنتج...')),
              Row(children: [
                Checkbox(value: _stock, onChanged: (v) => setState(() => _stock = v ?? true)),
                const Text('متوفر'),
                const SizedBox(width: 16),
                Checkbox(value: _featured, onChanged: (v) => setState(() => _featured = v ?? false)),
                const Text('مميز'),
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

// ───────────────────────── التواصل الاجتماعي ─────────────────────────

/// بيانات التواصل الاجتماعي — نفس /social-settings (حقول app_settings).
class SocialSettingsScreen extends StatefulWidget {
  const SocialSettingsScreen({super.key});
  @override
  State<SocialSettingsScreen> createState() => _SocialSettingsScreenState();
}

class _SocialSettingsScreenState extends State<SocialSettingsScreen> {
  static const _fields = [
    ('social_instagram', 'إنستغرام', Icons.camera_alt_outlined, Color(0xFFE1306C), 'https://instagram.com/ebra.kh8', 'رابط حساب الإنستغرام كامل'),
    ('social_whatsapp', 'واتساب', Icons.chat_rounded, Color(0xFF25D366), '966549678191', 'رقم الواتساب بدون + (مثال: 966549678191)'),
    ('social_twitter', 'تويتر / X', Icons.alternate_email_rounded, Color(0xFF1DA1F2), 'https://twitter.com/username', 'رابط حساب تويتر / X'),
    ('social_snapchat', 'سناب شات', Icons.public_rounded, Color(0xFFE6C700), 'https://snapchat.com/add/username', 'رابط حساب سناب شات'),
    ('social_tiktok', 'تيك توك', Icons.public_rounded, Color(0xFFFF0050), 'https://tiktok.com/@username', 'رابط حساب تيك توك'),
    ('phone', 'رقم الهاتف الرئيسي', Icons.phone_rounded, Color(0xFFC9A84C), '0549678191', 'يظهر في الموقع وصفحة الحجز'),
    ('address', 'العنوان', Icons.location_on_outlined, Color(0xFFC9A84C), 'الرياض، حي النرجس', 'يظهر في الخريطة وصفحة الحجز'),
    ('google_maps_url', 'رابط خرائط جوجل', Icons.map_outlined, Color(0xFF4285F4), 'https://maps.google.com/...', 'رابط الموقع على خرائط جوجل'),
  ];

  String? _id;
  final _c = {for (final f in _fields) f.$1: TextEditingController()};
  bool _loading = true, _saving = false;
  String? _error;

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

  Future<void> _load() async {
    try {
      final r = await context.read<Rest>().select('app_settings', select: 'id,${_fields.map((f) => f.$1).join(',')}', limit: 1);
      if (!mounted) return;
      setState(() {
        if (r.isNotEmpty) {
          _id = r.first['id']?.toString();
          for (final f in _fields) {
            _c[f.$1]!.text = '${r.first[f.$1] ?? ''}';
          }
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

  Future<void> _save() async {
    final rest = context.read<Rest>();
    final row = {for (final f in _fields) f.$1: _c[f.$1]!.text.trim()};
    setState(() => _saving = true);
    try {
      if (_id != null) {
        await rest.update('app_settings', _id!, row, select: 'id');
      } else {
        final r = await rest.insert('app_settings', row, select: 'id');
        _id = r?['id']?.toString();
      }
      if (mounted) toast(context, '✅ تم حفظ بيانات التواصل الاجتماعي');
    } on ApiException catch (e) {
      if (mounted) toast(context, 'فشل الحفظ: ${_err(e)}', error: true);
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Align(
      alignment: Alignment.topCenter,
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 720),
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 40),
          children: [
            const PageHeader(title: 'بيانات التواصل الاجتماعي', subtitle: 'تظهر في الصفحة الرئيسية والـ Footer وصفحة الحجز', icon: Icons.share_rounded, tone: Tone.pink),
            if (_error != null) LoadError(message: _error!, onRetry: _load),
            if (_loading)
              const Padding(padding: EdgeInsets.all(60), child: Center(child: CircularProgressIndicator()))
            else ...[
              GlassCard(
                child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                  const Text('روابط التواصل الاجتماعي ومعلومات التواصل', style: TextStyle(fontWeight: FontWeight.w700)),
                  const SizedBox(height: 12),
                  for (final f in _fields)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 12),
                      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Expanded(
                          child: TextField(
                            controller: _c[f.$1],
                            textDirection: f.$1 == 'address' ? null : TextDirection.ltr,
                            onChanged: (_) => setState(() {}),
                            decoration: InputDecoration(labelText: f.$2, hintText: f.$5, helperText: f.$6, prefixIcon: Icon(f.$3, color: f.$4, size: 19)),
                          ),
                        ),
                        if (_c[f.$1]!.text.trim().isNotEmpty && f.$1 != 'address' && f.$1 != 'phone')
                          IconButton(
                            onPressed: () {
                              final v = _c[f.$1]!.text.trim();
                              launchUrl(Uri.parse(f.$1 == 'social_whatsapp' ? 'https://wa.me/$v' : v), mode: LaunchMode.externalApplication);
                            },
                            icon: const Icon(Icons.open_in_new_rounded, size: 18, color: Pos.muted),
                          ),
                      ]),
                    ),
                ]),
              ),
              const SizedBox(height: 12),
              GlassCard(
                color: const Color(0x0DC9A84C),
                child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                  const Text('معاينة — كيف تظهر في الموقع', style: TextStyle(fontWeight: FontWeight.w700, color: Color(0xFF92400E))),
                  const SizedBox(height: 10),
                  Wrap(spacing: 8, runSpacing: 8, children: [
                    if (_c['social_instagram']!.text.trim().isNotEmpty) const SoftBadge('إنستغرام ✅', Color(0xFFE1306C)),
                    if (_c['social_whatsapp']!.text.trim().isNotEmpty) const SoftBadge('واتساب ✅', Color(0xFF16A34A)),
                    if (_c['social_twitter']!.text.trim().isNotEmpty) const SoftBadge('تويتر ✅', Color(0xFF1DA1F2)),
                    if (_c['phone']!.text.trim().isNotEmpty) SoftBadge('${_c['phone']!.text.trim()} ✅', const Color(0xFFB08A2E)),
                  ]),
                  if (_c['social_instagram']!.text.trim().isEmpty && _c['social_whatsapp']!.text.trim().isEmpty && _c['phone']!.text.trim().isEmpty)
                    const Text('أضف البيانات أعلاه لتظهر في الموقع', style: TextStyle(fontSize: 13, color: Pos.muted)),
                ]),
              ),
              const SizedBox(height: 14),
              PrimaryButton(label: 'حفظ بيانات التواصل', icon: Icons.save_rounded, expand: true, busy: _saving, onPressed: _save),
            ],
          ],
        ),
      ),
    );
  }
}
