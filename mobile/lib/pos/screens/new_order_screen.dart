import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:provider/provider.dart';

import '../../core/api_client.dart';
import '../../core/rest.dart';
import '../../models/order.dart';
import '../../state/auth_controller.dart';
import '../../state/new_order_service.dart';
import '../pos_ui.dart';
import 'order_details_screen.dart';

/// طلب جديد — نفس تبويب «الإسكافي» في /new-order:
/// العميل (اقتراحات + عميل معروف + B2B)، القطع بخدماتها وفنيها، الصور،
/// التسليم بتقويم السعة اليومية، والدفع (السعر شامل الضريبة).
class NewOrderScreen extends StatefulWidget {
  const NewOrderScreen({super.key, required this.onCreated});
  final void Function(String orderId) onCreated;

  @override
  State<NewOrderScreen> createState() => _NewOrderScreenState();
}

class _NewOrderScreenState extends State<NewOrderScreen> {
  final _name = TextEditingController();
  final _phone = TextEditingController();
  final _price = TextEditingController();
  final _address = TextEditingController();
  final _company = TextEditingController();
  final _vat = TextEditingController();
  final _cr = TextEditingController();
  final _companyAddr = TextEditingController();

  final _pieces = <Piece>[Piece()];
  final _photos = <String>[];
  bool _uploading = false;
  bool _saving = false;
  bool _b2b = false;
  bool _b2bEnabled = true;
  String _delivery = 'pickup';
  String? _date;
  String _payStatus = 'unpaid';
  String _payMethod = 'cash';
  int _freeAfter = 4;

  List<Map<String, dynamic>> _customers = const [];
  List<Map<String, dynamic>> _techs = const [];

  @override
  void initState() {
    super.initState();
    _loadRefs();
  }

  @override
  void dispose() {
    for (final c in [_name, _phone, _price, _address, _company, _vat, _cr, _companyAddr]) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _loadRefs() async {
    final rest = context.read<Rest>();
    final res = await Future.wait([
      rest.secureList('customers', limit: 2000).catchError((_) => <Map<String, dynamic>>[]),
      rest.select('employees', select: 'id,name,role,is_active', order: 'created_at.desc', limit: 200).catchError((_) => <Map<String, dynamic>>[]),
      rest.select('app_settings', select: 'b2b_invoicing_enabled', limit: 1).catchError((_) => <Map<String, dynamic>>[]),
      rest.select('operations_plans', select: 'loyalty_free_after', limit: 1).catchError((_) => <Map<String, dynamic>>[]),
    ]);
    if (!mounted) return;
    setState(() {
      _customers = res[0];
      _techs = res[1].where((e) => e['is_active'] != false).toList();
      _b2bEnabled = res[2].isEmpty || res[2].first['b2b_invoicing_enabled'] != false;
      _freeAfter = res[3].isEmpty ? 4 : ((res[3].first['loyalty_free_after'] as num?)?.toInt() ?? 4);
    });
  }

  Map<String, dynamic>? get _known {
    if (_phone.text.replaceAll(RegExp(r'\D'), '').length < 9) return null;
    final n = NewOrderService.normalizePhone(_phone.text);
    for (final c in _customers) {
      if (NewOrderService.normalizePhone('${c['phone']}') == n) return c;
    }
    return null;
  }

  double get _priceValue => double.tryParse(_price.text.replaceAllMapped(RegExp('[٠-٩]'), (m) => '٠١٢٣٤٥٦٧٨٩'.indexOf(m[0]!).toString()).replaceAll(',', '.')) ?? 0;

  Future<void> _pickPhoto(ImageSource src) async {
    if (_photos.length >= 5) {
      toast(context, 'الحد الأقصى 5 صور');
      return;
    }
    final rest = context.read<Rest>();
    final x = await ImagePicker().pickImage(source: src, maxWidth: 1600, maxHeight: 1600, imageQuality: 78);
    if (x == null) return;
    setState(() => _uploading = true);
    try {
      final bytes = await x.readAsBytes();
      final path = '${DateTime.now().millisecondsSinceEpoch}-${_pieces.first.key}.jpg';
      final url = await rest.upload('order-photos', path, bytes);
      if (mounted) setState(() => _photos.add(url));
    } on ApiException catch (e) {
      if (mounted) toast(context, 'تعذّر رفع الصورة: ${e.message}', error: true);
    } finally {
      if (mounted) setState(() => _uploading = false);
    }
  }

  Future<void> _submit() async {
    final svc = context.read<NewOrderService>();
    final me = context.read<AuthController>().employee!;
    if (_name.text.trim().isEmpty) {
      toast(context, 'اسم العميل مطلوب', error: true);
      return;
    }
    if (_priceValue <= 0) {
      toast(context, 'أدخل السعر الإجمالي', error: true);
      return;
    }
    if (_date == null) {
      toast(context, 'تاريخ التسليم مطلوب — لازم تحدده قبل حفظ الطلب', error: true);
      return;
    }
    if (_pieces.any((p) => p.description.trim().isEmpty && p.services.isEmpty)) {
      toast(context, 'كل قطعة لازم تحدد لها الخدمة المطلوبة أو وصف — راجع القطع المضافة', error: true);
      return;
    }
    if (_b2b && (_company.text.trim().isEmpty || !RegExp(r'^3\d{13}3$').hasMatch(_vat.text.trim()))) {
      toast(context, 'لفاتورة الشركة: اسم الشركة ورقم ضريبي صحيح (15 رقم يبدأ وينتهي بـ 3)', error: true);
      return;
    }
    setState(() => _saving = true);
    try {
      // إعادة تحقق من سعة اليوم لحظة الحفظ (شبكة أمان كما في الموقع)
      final n = await svc.countForDay(_date!);
      if (n >= dailyCapacity) {
        if (mounted) toast(context, 'هذا اليوم صار ممتلئاً ($dailyCapacity طلبات) — اختر تاريخ تسليم ثاني', error: true);
        return;
      }
      final r = await svc.create(
        me: me,
        customerName: _name.text.trim(),
        customerPhone: _phone.text.trim(),
        pieces: _pieces,
        photos: _photos,
        deliveryMethod: _delivery,
        deliveryAddress: _address.text.trim(),
        deliveryDate: _date!,
        price: _priceValue,
        paymentStatus: _payStatus,
        paymentMethod: _payMethod,
        isB2b: _b2b,
        buyerCompany: _company.text.trim(),
        buyerVat: _vat.text.trim(),
        buyerCr: _cr.text.trim(),
        buyerAddress: _companyAddr.text.trim(),
      );
      if (!mounted) return;
      toast(context, r.warning ?? (r.zatcaStatus == 'REPORTED' ? 'تم إنشاء الطلب وإبلاغه لزاتكا رسمياً ✅' : 'تم إنشاء الطلب ✅'), error: r.warning != null);
      await Navigator.of(context).push(MaterialPageRoute(builder: (_) => OrderDetailsScreen(orderId: r.order.id, justCreated: true)));
      widget.onCreated(r.order.id);
    } on ApiException catch (e) {
      if (mounted) toast(context, 'فشل حفظ الطلب: ${e.message}', error: true);
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  // ═══════════════ الواجهة ═══════════════

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 40),
      children: [
        Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 860),
            child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              const PageHeader(title: 'طلب جديد', subtitle: 'تسجيل قطع العميل للإصلاح', icon: Icons.add_circle_outline_rounded, tone: Tone.green),
              _customerCard(),
              _piecesCard(),
              _deliveryCard(),
              _paymentCard(),
              const SizedBox(height: 6),
              PrimaryButton(label: 'إنشاء الطلب', expand: true, busy: _saving, onPressed: _saving || _uploading ? null : _submit),
            ]),
          ),
        ),
      ],
    );
  }

  Widget _section(String title, Widget child, {Widget? trailing}) => GlassCard(
        margin: const EdgeInsets.only(bottom: 14),
        padding: const EdgeInsets.all(18),
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Row(children: [
            Expanded(child: Text(title, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15.5))),
            if (trailing != null) trailing,
          ]),
          const SizedBox(height: 14),
          child,
        ]),
      );

  Widget _label(String t) => Padding(padding: const EdgeInsets.only(bottom: 6), child: Text(t, style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w600)));

  Widget _customerCard() {
    final known = _known;
    return _section(
      'بيانات العميل',
      Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        LayoutBuilder(builder: (context, c) {
          final nameField = Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            _label('اسم العميل *'),
            Autocomplete<Map<String, dynamic>>(
              optionsBuilder: (v) {
                final q = v.text.trim().toLowerCase();
                if (q.length < 2) return const Iterable.empty();
                return _customers.where((c) => '${c['name'] ?? ''}'.toLowerCase().contains(q)).take(6);
              },
              displayStringForOption: (c) => '${c['name'] ?? ''}',
              onSelected: (c) => setState(() {
                _name.text = '${c['name'] ?? ''}';
                _phone.text = '${c['phone'] ?? ''}';
              }),
              fieldViewBuilder: (ctx, ctl, focus, onSubmit) {
                if (ctl.text != _name.text && !focus.hasFocus) ctl.text = _name.text;
                return TextField(
                  controller: ctl,
                  focusNode: focus,
                  decoration: const InputDecoration(hintText: 'الاسم الكامل'),
                  onChanged: (v) => _name.text = v,
                );
              },
              optionsViewBuilder: (ctx, onSel, opts) => Align(
                alignment: AlignmentDirectional.topStart,
                child: Material(
                  elevation: 6,
                  borderRadius: BorderRadius.circular(12),
                  child: ConstrainedBox(
                    constraints: const BoxConstraints(maxWidth: 360, maxHeight: 260),
                    child: ListView(shrinkWrap: true, padding: EdgeInsets.zero, children: [
                      for (final o in opts)
                        ListTile(
                          dense: true,
                          title: Text('${o['name']}', style: const TextStyle(fontWeight: FontWeight.w700)),
                          trailing: Directionality(textDirection: TextDirection.ltr, child: Text('${o['phone'] ?? ''}', style: const TextStyle(fontSize: 12, color: Pos.muted))),
                          onTap: () => onSel(o),
                        ),
                    ]),
                  ),
                ),
              ),
            ),
          ]);
          final phoneField = Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            _label('رقم الهاتف'),
            TextField(
              controller: _phone,
              keyboardType: TextInputType.phone,
              textDirection: TextDirection.ltr,
              decoration: const InputDecoration(hintText: '05XXXXXXXX'),
              onChanged: (_) => setState(() {
                final k = _known;
                if (k != null && _name.text.trim().isEmpty) _name.text = '${k['name'] ?? ''}';
              }),
            ),
          ]);
          return c.maxWidth >= 520
              ? Row(crossAxisAlignment: CrossAxisAlignment.start, children: [Expanded(child: nameField), const SizedBox(width: 12), Expanded(child: phoneField)])
              : Column(children: [nameField, const SizedBox(height: 12), phoneField]);
        }),
        if (known != null) ...[
          const SizedBox(height: 12),
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(color: Pos.primary.withValues(alpha: .06), borderRadius: BorderRadius.circular(12), border: Border.all(color: Pos.primary.withValues(alpha: .3))),
            child: Row(children: [
              const Icon(Icons.how_to_reg_rounded, color: Pos.primary, size: 20),
              const SizedBox(width: 8),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text('${known['name']} — عميل معروف ✅', style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13.5)),
                  Text('${known['total_orders'] ?? 0} طلب · ${((known['total_spent'] as num?) ?? 0).toStringAsFixed(0)} ر.س',
                      style: const TextStyle(fontSize: 12, color: Pos.muted)),
                ]),
              ),
              ((known['stamps'] as num?)?.toInt() ?? 0) >= _freeAfter - 1
                  ? const SoftBadge('يستحق مجاناً!', Pos.green, icon: Icons.card_giftcard_rounded)
                  : SoftBadge('${known['stamps'] ?? 0}/$_freeAfter طوابع', Pos.primary, icon: Icons.star_rounded),
            ]),
          ),
        ],
        if (_b2bEnabled) ...[
          const SizedBox(height: 12),
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(borderRadius: BorderRadius.circular(12), border: Border.all(color: Pos.border)),
            child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              SwitchListTile(
                contentPadding: EdgeInsets.zero,
                value: _b2b,
                onChanged: (v) => setState(() => _b2b = v),
                title: const Text('فاتورة لشركة (B2B)', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 14)),
                subtitle: const Text('فعّلها إذا العميل منشأة/شركة، لإدراج اسمها ورقمها الضريبي وسجلها التجاري بالفاتورة', style: TextStyle(fontSize: 12)),
              ),
              if (_b2b) ...[
                TextField(controller: _company, decoration: const InputDecoration(hintText: 'اسم الشركة * — الاسم النظامي للمنشأة')),
                const SizedBox(height: 8),
                TextField(
                  controller: _vat,
                  keyboardType: TextInputType.number,
                  onChanged: (_) => setState(() {}),
                  decoration: InputDecoration(
                    hintText: 'الرقم الضريبي للشركة * (15 رقم)',
                    errorText: _vat.text.isNotEmpty && !RegExp(r'^3\d{13}3$').hasMatch(_vat.text.trim()) ? 'لازم 15 رقم ويبدأ وينتهي بـ 3' : null,
                  ),
                ),
                const SizedBox(height: 8),
                TextField(controller: _cr, decoration: const InputDecoration(hintText: 'السجل التجاري (اختياري)')),
                const SizedBox(height: 8),
                TextField(controller: _companyAddr, decoration: const InputDecoration(hintText: 'عنوان الشركة (اختياري)')),
              ],
            ]),
          ),
        ],
      ]),
    );
  }

  Widget _piecesCard() {
    return _section(
      'القطع (${_pieces.length})',
      Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        for (var i = 0; i < _pieces.length; i++) _pieceBox(_pieces[i], i),
        const SizedBox(height: 4),
        _photosBox(),
      ]),
      trailing: OutlineSmall(label: 'إضافة قطعة', icon: Icons.add_rounded, onPressed: () => setState(() => _pieces.add(Piece()))),
    );
  }

  Widget _pieceBox(Piece p, int i) {
    final services = servicesByType[p.itemType];
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(borderRadius: BorderRadius.circular(14), border: Border.all(color: Pos.border), color: const Color(0x66FFFFFF)),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Row(children: [
          Text('قطعة ${i + 1}', style: const TextStyle(fontWeight: FontWeight.w700, color: Pos.muted)),
          const Spacer(),
          if (_pieces.length > 1)
            IconButton(
              tooltip: 'حذف القطعة',
              onPressed: () => setState(() => _pieces.removeAt(i)),
              icon: const Icon(Icons.delete_outline_rounded, color: Pos.destructive, size: 20),
            ),
        ]),
        Row(children: [
          Expanded(
            child: DropdownButtonFormField<String>(
              value: p.itemType,
              decoration: const InputDecoration(labelText: 'نوع القطعة *'),
              borderRadius: BorderRadius.circular(14),
              items: [for (final e in itemLabels.entries) DropdownMenuItem(value: e.key, child: Text(e.value))],
              onChanged: (v) => setState(() {
                p.itemType = v ?? 'shoes';
                p.services.retainWhere((s) => (servicesByType[p.itemType] ?? const []).contains(s));
              }),
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: DropdownButtonFormField<String>(
              value: _techs.any((t) => t['id'] == p.technicianId) ? p.technicianId : null,
              decoration: const InputDecoration(labelText: 'الفني المسؤول'),
              hint: const Text('اختر الفني'),
              borderRadius: BorderRadius.circular(14),
              items: [for (final t in _techs) DropdownMenuItem(value: '${t['id']}', child: Text('${t['name']}'))],
              onChanged: (v) => setState(() {
                p.technicianId = v;
                p.technicianName = '${_techs.firstWhere((t) => t['id'] == v, orElse: () => const {})['name'] ?? ''}';
              }),
            ),
          ),
        ]),
        if (services != null) ...[
          const SizedBox(height: 12),
          _label('نوع الخدمة (يمكن اختيار أكثر من واحدة)'),
          Wrap(spacing: 8, runSpacing: 8, children: [
            for (final s in services)
              FilterChip(
                label: Text(s),
                selected: p.services.contains(s),
                showCheckmark: false,
                selectedColor: Pos.primary,
                labelStyle: TextStyle(color: p.services.contains(s) ? Colors.white : Pos.fg, fontWeight: FontWeight.w600),
                shape: StadiumBorder(side: BorderSide(color: p.services.contains(s) ? Pos.primary : Pos.border, width: 1.5)),
                backgroundColor: Colors.white.withValues(alpha: .6),
                onSelected: (on) => setState(() => on ? p.services.add(s) : p.services.remove(s)),
              ),
          ]),
        ],
        const SizedBox(height: 12),
        TextField(
          minLines: 2,
          maxLines: 3,
          onChanged: (v) => p.description = v,
          decoration: const InputDecoration(labelText: 'وصف إضافي لهذي القطعة (يظهر للفني)', hintText: 'مثال: انتبه للخيط الجانبي، اللون البني الغامق...'),
        ),
      ]),
    );
  }

  Widget _photosBox() {
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      _label('صور القطع (${_photos.length}/5)'),
      Wrap(spacing: 10, runSpacing: 10, children: [
        for (var i = 0; i < _photos.length; i++)
          Stack(children: [
            ClipRRect(borderRadius: BorderRadius.circular(12), child: Image.network(_photos[i], width: 84, height: 84, fit: BoxFit.cover)),
            PositionedDirectional(
              top: 2,
              end: 2,
              child: InkWell(
                onTap: () => setState(() => _photos.removeAt(i)),
                child: const CircleAvatar(radius: 11, backgroundColor: Colors.black54, child: Icon(Icons.close_rounded, size: 14, color: Colors.white)),
              ),
            ),
          ]),
        if (_photos.length < 5) ...[
          _photoBtn(Icons.photo_camera_outlined, 'كاميرا', () => _pickPhoto(ImageSource.camera)),
          _photoBtn(Icons.photo_library_outlined, 'المعرض', () => _pickPhoto(ImageSource.gallery)),
        ],
        if (_uploading) const SizedBox(width: 84, height: 84, child: Center(child: CircularProgressIndicator())),
      ]),
    ]);
  }

  Widget _photoBtn(IconData icon, String label, VoidCallback onTap) => InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: _uploading ? null : onTap,
        child: Container(
          width: 84,
          height: 84,
          decoration: BoxDecoration(borderRadius: BorderRadius.circular(12), border: Border.all(color: Pos.border, width: 1.5), color: const Color(0x66FFFFFF)),
          child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
            Icon(icon, color: Pos.muted),
            const SizedBox(height: 4),
            Text(label, style: const TextStyle(fontSize: 11.5, color: Pos.muted)),
          ]),
        ),
      );

  Widget _deliveryCard() {
    Widget opt(String v, IconData icon, String label) {
      final sel = _delivery == v;
      return Expanded(
        child: InkWell(
          borderRadius: BorderRadius.circular(14),
          onTap: () => setState(() => _delivery = v),
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 16),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(14),
              color: sel ? Pos.primary.withValues(alpha: .06) : null,
              border: Border.all(color: sel ? Pos.primary : Pos.border, width: 2),
            ),
            child: Row(children: [
              Icon(icon, color: sel ? Pos.primary : Pos.muted),
              const SizedBox(width: 8),
              Expanded(child: Text(label, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13.5))),
            ]),
          ),
        ),
      );
    }

    return _section(
      'التسليم',
      Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Row(children: [
          opt('pickup', Icons.storefront_outlined, 'استلام من المحل'),
          const SizedBox(width: 12),
          opt('delivery', Icons.local_shipping_outlined, 'توصيل'),
        ]),
        if (_delivery == 'delivery') ...[
          const SizedBox(height: 12),
          TextField(controller: _address, decoration: const InputDecoration(labelText: 'عنوان التوصيل', hintText: 'العنوان الكامل')),
        ],
        const SizedBox(height: 14),
        _label('تاريخ التسليم *'),
        _DeliveryCalendar(value: _date, onChanged: (d) => setState(() => _date = d)),
        const SizedBox(height: 6),
        const Text('🟢 متاح — 🟡 شبه ممتلئ — 🔴 ممتلئ (8 طلبات فأكثر، ما يُسمح بالإضافة)', style: TextStyle(fontSize: 12, color: Pos.muted)),
      ]),
    );
  }

  Widget _paymentCard() {
    final p = _priceValue;
    return _section(
      'الدفع',
      Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        _label('السعر الإجمالي شامل الضريبة (ر.س) *'),
        TextField(
          controller: _price,
          keyboardType: const TextInputType.numberWithOptions(decimal: true),
          style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w800),
          decoration: const InputDecoration(hintText: '0.00'),
          onChanged: (_) => setState(() {}),
        ),
        if (p > 0)
          Padding(
            padding: const EdgeInsets.only(top: 8),
            child: Text('قبل الضريبة: ${(p / 1.15).toStringAsFixed(2)} ر.س — الإجمالي (شامل 15%): ${p.toStringAsFixed(2)} ر.س',
                style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: Color(0xFF059669))),
          ),
        const SizedBox(height: 14),
        Row(children: [
          Expanded(
            child: DropdownButtonFormField<String>(
              value: _payStatus,
              decoration: const InputDecoration(labelText: 'حالة الدفع'),
              borderRadius: BorderRadius.circular(14),
              items: const [DropdownMenuItem(value: 'paid', child: Text('مدفوع')), DropdownMenuItem(value: 'unpaid', child: Text('غير مدفوع'))],
              onChanged: (v) => setState(() => _payStatus = v ?? 'unpaid'),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: DropdownButtonFormField<String>(
              value: _payMethod,
              decoration: const InputDecoration(labelText: 'طريقة الدفع'),
              borderRadius: BorderRadius.circular(14),
              items: const [DropdownMenuItem(value: 'cash', child: Text('نقداً')), DropdownMenuItem(value: 'network', child: Text('شبكة'))],
              onChanged: (v) => setState(() => _payMethod = v ?? 'cash'),
            ),
          ),
        ]),
      ]),
    );
  }
}

/// تقويم التسليم بألوان السعة اليومية — نفس DeliveryDatePicker.jsx.
class _DeliveryCalendar extends StatefulWidget {
  const _DeliveryCalendar({required this.value, required this.onChanged});
  final String? value;
  final ValueChanged<String> onChanged;

  @override
  State<_DeliveryCalendar> createState() => _DeliveryCalendarState();
}

class _DeliveryCalendarState extends State<_DeliveryCalendar> {
  late DateTime _month;
  Map<String, int> _load = const {};
  bool _loading = false;

  static const _days = ['أحد', 'اثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'];
  static const _months = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];

  @override
  void initState() {
    super.initState();
    final n = DateTime.now();
    _month = DateTime(n.year, n.month, 1);
    _fetch();
  }

  Future<void> _fetch() async {
    setState(() => _loading = true);
    try {
      final m = await context.read<NewOrderService>().dayLoad(_month);
      if (mounted) setState(() => _load = m);
    } on ApiException {
      // التقويم يعمل بدون الألوان لو تعذّر التحميل؛ الحفظ يعيد التحقق من السعة
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  String _key(DateTime d) => '${d.year}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';

  @override
  Widget build(BuildContext context) {
    final today = DateTime.now();
    final t0 = DateTime(today.year, today.month, today.day);
    final count = DateTime(_month.year, _month.month + 1, 0).day;
    final pad = _month.weekday % 7; // الأحد = 0
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(14), border: Border.all(color: Pos.border)),
      child: Column(children: [
        Row(children: [
          IconButton(
            onPressed: () {
              setState(() => _month = DateTime(_month.year, _month.month - 1, 1));
              _fetch();
            },
            icon: const Icon(Icons.chevron_right_rounded),
          ),
          Expanded(child: Center(child: Text('${_months[_month.month - 1]} ${_month.year}', style: const TextStyle(fontWeight: FontWeight.w700)))),
          if (_loading) const SizedBox(width: 14, height: 14, child: CircularProgressIndicator(strokeWidth: 2)),
          IconButton(
            onPressed: () {
              setState(() => _month = DateTime(_month.year, _month.month + 1, 1));
              _fetch();
            },
            icon: const Icon(Icons.chevron_left_rounded),
          ),
        ]),
        GridView.count(
          crossAxisCount: 7,
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          mainAxisSpacing: 4,
          crossAxisSpacing: 4,
          children: [
            for (final d in _days) Center(child: Text(d, style: const TextStyle(fontSize: 10, color: Pos.muted, fontWeight: FontWeight.w700))),
            for (var i = 0; i < pad; i++) const SizedBox.shrink(),
            for (var day = 1; day <= count; day++) _cell(DateTime(_month.year, _month.month, day), t0),
          ],
        ),
      ]),
    );
  }

  Widget _cell(DateTime d, DateTime t0) {
    final k = _key(d);
    final n = _load[k] ?? 0;
    final past = d.isBefore(t0);
    final full = n >= dailyCapacity;
    final (bg, border, text, dot) = full
        ? (const Color(0xFFFEE2E2), const Color(0xFFFCA5A5), const Color(0xFFB91C1C), const Color(0xFFEF4444))
        : n >= (dailyCapacity / 2).ceil()
            ? (const Color(0xFFFEF9C3), const Color(0xFFFDE047), const Color(0xFFA16207), const Color(0xFFEAB308))
            : (const Color(0xFFDCFCE7), const Color(0xFF86EFAC), const Color(0xFF15803D), const Color(0xFF22C55E));
    final selected = widget.value == k;
    final disabled = past || full;
    return Opacity(
      opacity: past ? .35 : 1,
      child: InkWell(
        borderRadius: BorderRadius.circular(8),
        onTap: disabled ? null : () => widget.onChanged(k),
        child: Container(
          decoration: BoxDecoration(
            color: past ? null : bg,
            borderRadius: BorderRadius.circular(8),
            border: Border.all(color: selected ? Pos.primary : (past ? Colors.transparent : border), width: selected ? 2.5 : 1),
          ),
          child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
            Text('${d.day}', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: past ? Pos.muted : text)),
            if (!past) Container(width: 5, height: 5, decoration: BoxDecoration(color: dot, shape: BoxShape.circle)),
          ]),
        ),
      ),
    );
  }
}
