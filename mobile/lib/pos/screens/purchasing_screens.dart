import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:provider/provider.dart';

import '../../core/api_client.dart';
import '../../core/rest.dart';
import '../pos_ui.dart';

double _d(dynamic v) => v is num ? v.toDouble() : double.tryParse('${v ?? ''}') ?? 0;
bool validVat(String? v) => RegExp(r'^3\d{13}3$').hasMatch((v ?? '').trim());
const _taxClass = {'raw_material': 'مادة خام خاضعة (15%)', 'expense': 'مصروف آخر'};

String _day(DateTime d) => '${d.year}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';

// ═══════════════════════════ المشتريات ═══════════════════════════

/// المشتريات — نفس /purchasing: فواتير الموردين بحقول الضريبة، بنود المخزون،
/// أرشفة المستند، تنبيه الرقم الضريبي، وحالة السداد.
class PurchasingScreen extends StatefulWidget {
  const PurchasingScreen({super.key});

  @override
  State<PurchasingScreen> createState() => _PurchasingScreenState();
}

class _PurchasingScreenState extends State<PurchasingScreen> {
  List<Map<String, dynamic>>? _inv;
  List<Map<String, dynamic>> _suppliers = const [];
  List<Map<String, dynamic>> _items = const [];
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final rest = context.read<Rest>();
    try {
      final r = await Future.wait([
        rest.select('purchase_invoices', order: 'invoice_date.desc', limit: 300),
        rest.select('suppliers', order: 'name.asc', limit: 200),
        rest.select('inventory_items', select: 'id,name,unit', order: 'created_at.desc', limit: 500),
      ]);
      if (!mounted) return;
      setState(() {
        _inv = r[0];
        _suppliers = r[1];
        _items = r[2];
        _error = null;
      });
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    }
  }

  Future<void> _open([Map<String, dynamic>? inv]) async {
    final saved = await showDialog<bool>(
      context: context,
      builder: (_) => _PurchaseDialog(invoice: inv, suppliers: _suppliers, items: _items),
    );
    if (saved == true) _load();
  }

  Future<void> _togglePaid(Map<String, dynamic> inv) async {
    try {
      await context.read<Rest>().update('purchase_invoices', '${inv['id']}', {'payment_status': inv['payment_status'] == 'paid' ? 'unpaid' : 'paid'}, select: 'id');
      _load();
    } on ApiException catch (e) {
      if (mounted) toast(context, e.message, error: true);
    }
  }

  Future<void> _delete(Map<String, dynamic> inv) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (c) => AlertDialog(
        title: const Text('حذف فاتورة الشراء؟'),
        content: Text('رقم ${inv['invoice_number']} — لا يمكن التراجع.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(c, false), child: const Text('إلغاء')),
          FilledButton(style: FilledButton.styleFrom(backgroundColor: Pos.destructive), onPressed: () => Navigator.pop(c, true), child: const Text('حذف')),
        ],
      ),
    );
    if (ok != true || !mounted) return;
    try {
      await context.read<Rest>().delete('purchase_invoices', '${inv['id']}');
      if (mounted) toast(context, 'تم حذف فاتورة الشراء');
      _load();
    } on ApiException catch (e) {
      if (mounted) toast(context, e.message, error: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    final list = _inv ?? const [];
    final byId = {for (final s in _suppliers) '${s['id']}': s};
    final inputVat = list.fold<double>(0, (s, i) => s + _d(i['vat_amount']));
    final invalid = list.where((i) => i['vat_number_valid_format'] != true).length;

    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 40),
        physics: const AlwaysScrollableScrollPhysics(),
        children: [
          PageHeader(
            title: 'المشتريات',
            subtitle: 'فواتير الموردين — ضريبة المدخلات للإقرار',
            icon: Icons.shopping_bag_outlined,
            tone: Tone.pink,
            trailing: PrimaryButton(label: 'فاتورة شراء', icon: Icons.add_rounded, onPressed: () => _open()),
          ),
          if (_error != null) LoadError(message: _error!, onRetry: _load),
          if (_inv == null && _error == null) const Padding(padding: EdgeInsets.all(60), child: Center(child: CircularProgressIndicator())),
          if (_inv != null) ...[
            Row(children: [
              Expanded(
                child: GlassCard(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    const Text('ضريبة المدخلات المسجّلة', style: TextStyle(fontSize: 12.5, color: Pos.muted)),
                    const SizedBox(height: 4),
                    PosMoney(inputVat, size: 22, weight: FontWeight.w900, color: Pos.green),
                  ]),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: GlassCard(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    const Text('فواتير بلا رقم ضريبي صالح', style: TextStyle(fontSize: 12.5, color: Pos.muted)),
                    const SizedBox(height: 4),
                    Text('$invalid', style: TextStyle(fontSize: 22, fontWeight: FontWeight.w900, color: invalid > 0 ? Pos.red : Pos.fg)),
                  ]),
                ),
              ),
            ]),
            const SizedBox(height: 14),
            if (list.isEmpty)
              const EmptyState(icon: Icons.receipt_outlined, text: 'لا توجد فواتير شراء بعد', sub: 'سجّل فواتير الموردين لتُخصم ضريبتها في الإقرار')
            else
              for (final i in list)
                GlassCard(
                  margin: const EdgeInsets.only(bottom: 10),
                  onTap: () => _open(i),
                  child: Row(children: [
                    Expanded(
                      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Text('${byId['${i['supplier_id']}']?['name'] ?? '—'}', style: const TextStyle(fontWeight: FontWeight.w700)),
                        Text('فاتورة ${i['invoice_number']} · ${i['invoice_date']}', style: const TextStyle(fontSize: 12, color: Pos.muted)),
                        const SizedBox(height: 5),
                        Wrap(spacing: 6, runSpacing: 4, children: [
                          SoftBadge(_taxClass[i['tax_classification']] ?? '${i['tax_classification'] ?? '—'}', Pos.muted),
                          if (i['vat_number_valid_format'] != true) const SoftBadge('رقم ضريبي غير صالح', Pos.red, icon: Icons.shield_outlined),
                        ]),
                      ]),
                    ),
                    Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
                      PosMoney(_d(i['taxable_amount']), weight: FontWeight.w700),
                      PosMoney(_d(i['vat_amount']), size: 12.5, color: Pos.green),
                      const SizedBox(height: 4),
                      InkWell(
                        onTap: () => _togglePaid(i),
                        child: SoftBadge(i['payment_status'] == 'paid' ? 'مسدّدة' : 'غير مسدّدة', i['payment_status'] == 'paid' ? Pos.green : Pos.amber),
                      ),
                    ]),
                    IconButton(onPressed: () => _delete(i), icon: const Icon(Icons.delete_outline_rounded, color: Pos.destructive, size: 20)),
                  ]),
                ),
          ],
        ],
      ),
    );
  }
}

class _Line {
  String? itemId;
  final desc = TextEditingController();
  final qty = TextEditingController(text: '1');
  final cost = TextEditingController();
}

class _PurchaseDialog extends StatefulWidget {
  const _PurchaseDialog({this.invoice, required this.suppliers, required this.items});
  final Map<String, dynamic>? invoice;
  final List<Map<String, dynamic>> suppliers;
  final List<Map<String, dynamic>> items;

  @override
  State<_PurchaseDialog> createState() => _PurchaseDialogState();
}

class _PurchaseDialogState extends State<_PurchaseDialog> {
  late List<Map<String, dynamic>> _suppliers = [...widget.suppliers];
  late String? _supplier = widget.invoice?['supplier_id']?.toString();
  late final _number = TextEditingController(text: '${widget.invoice?['invoice_number'] ?? ''}');
  late DateTime _date = DateTime.tryParse('${widget.invoice?['invoice_date'] ?? ''}') ?? DateTime.now();
  late String _class = '${widget.invoice?['tax_classification'] ?? 'raw_material'}';
  late final _taxable = TextEditingController(text: widget.invoice?['taxable_amount']?.toString() ?? '');
  late final _rate = TextEditingController(text: '${widget.invoice?['vat_rate'] ?? 15}');
  late final _vat = TextEditingController(text: widget.invoice?['vat_amount']?.toString() ?? '');
  late final _notes = TextEditingController(text: '${widget.invoice?['notes'] ?? ''}');
  late String? _doc = widget.invoice?['document_url']?.toString();
  final _lines = <_Line>[_Line()];
  bool _saving = false;
  bool _uploading = false;

  @override
  void initState() {
    super.initState();
    if (widget.invoice != null) _loadLines();
  }

  Future<void> _loadLines() async {
    try {
      final rows = await context.read<Rest>().select('purchase_invoice_items', filters: {'purchase_invoice_id': 'eq.${widget.invoice!['id']}'});
      if (!mounted || rows.isEmpty) return;
      setState(() {
        _lines
          ..clear()
          ..addAll(rows.map((r) => _Line()
            ..itemId = r['item_id']?.toString()
            ..desc.text = '${r['description'] ?? ''}'
            ..qty.text = '${r['quantity'] ?? 1}'
            ..cost.text = '${r['unit_cost'] ?? ''}'));
      });
    } on ApiException {
      // البنود اختيارية
    }
  }

  void _recalc() {
    final v = (double.tryParse(_taxable.text) ?? 0) * ((double.tryParse(_rate.text) ?? 0) / 100);
    _vat.text = v.toStringAsFixed(2);
    setState(() {});
  }

  Future<void> _attach() async {
    final rest = context.read<Rest>();
    final x = await ImagePicker().pickImage(source: ImageSource.gallery, maxWidth: 2200, imageQuality: 85);
    if (x == null) return;
    setState(() => _uploading = true);
    try {
      final path = '${DateTime.now().millisecondsSinceEpoch}-invoice.jpg';
      final bytes = await x.readAsBytes();
      // نفس الموقع: حاوية purchase-invoices ويُحفظ الرابط، ويُفتح لاحقاً برابط موقّع
      final url = await rest.upload('purchase-invoices', path, bytes);
      if (mounted) setState(() => _doc = url);
    } on ApiException catch (e) {
      if (mounted) toast(context, 'تعذّر رفع المستند: ${e.message}', error: true);
    } finally {
      if (mounted) setState(() => _uploading = false);
    }
  }

  Future<void> _quickSupplier() async {
    final created = await showDialog<Map<String, dynamic>>(context: context, builder: (_) => const SupplierDialog());
    if (created != null && mounted) {
      setState(() {
        _suppliers = [..._suppliers, created];
        _supplier = '${created['id']}';
      });
      toast(context, validVat(created['vat_number']?.toString())
          ? 'تم إضافة المورد بالرقم الضريبي ✅ — واخترناه لك بهذي الفاتورة'
          : 'تم إضافة المورد — لكن بدون رقم ضريبي صالح، فاتورته لن تُقبل بالإقرار حتى تضيفه');
    }
  }

  Future<void> _save() async {
    if (_supplier == null || _number.text.trim().isEmpty || (double.tryParse(_taxable.text) ?? 0) <= 0) {
      toast(context, 'المورد ورقم الفاتورة والمبلغ الخاضع مطلوبة', error: true);
      return;
    }
    final rest = context.read<Rest>();
    final sup = _suppliers.firstWhere((s) => '${s['id']}' == _supplier, orElse: () => const {});
    setState(() => _saving = true);
    final payload = {
      'supplier_id': _supplier,
      'invoice_number': _number.text.trim(),
      'invoice_date': _day(_date),
      'taxable_amount': double.tryParse(_taxable.text) ?? 0,
      'vat_rate': double.tryParse(_rate.text) ?? 0,
      'vat_amount': double.tryParse(_vat.text) ?? 0,
      'tax_classification': _class,
      'document_url': _doc,
      'notes': _notes.text.trim().isEmpty ? null : _notes.text.trim(),
      'supplier_vat_number_snapshot': sup['vat_number'],
      'vat_number_valid_format': validVat(sup['vat_number']?.toString()),
    };
    try {
      final saved = widget.invoice == null
          ? await rest.insert('purchase_invoices', payload)
          : await rest.update('purchase_invoices', '${widget.invoice!['id']}', payload);
      final id = '${saved?['id'] ?? widget.invoice?['id']}';
      if (widget.invoice != null) {
        final old = await rest.select('purchase_invoice_items', select: 'id', filters: {'purchase_invoice_id': 'eq.$id'});
        for (final l in old) {
          await rest.delete('purchase_invoice_items', '${l['id']}');
        }
      }
      for (final l in _lines.where((l) => l.itemId != null || l.desc.text.trim().isNotEmpty)) {
        await rest.insert('purchase_invoice_items', {
          'purchase_invoice_id': id,
          'item_id': l.itemId,
          'description': l.desc.text.trim().isEmpty ? null : l.desc.text.trim(),
          'quantity': double.tryParse(l.qty.text) ?? 1,
          'unit_cost': double.tryParse(l.cost.text) ?? 0,
        }, select: 'id');
      }
      if (!mounted) return;
      toast(context, widget.invoice == null ? 'تم إضافة فاتورة الشراء' : 'تم تحديث فاتورة الشراء');
      Navigator.pop(context, true);
    } on ApiException catch (e) {
      if (mounted) {
        toast(context, 'فشل الحفظ: ${e.message}', error: true);
        setState(() => _saving = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final sup = _suppliers.where((s) => '${s['id']}' == _supplier).firstOrNull;
    final total = (double.tryParse(_taxable.text) ?? 0) + (double.tryParse(_vat.text) ?? 0);
    return AlertDialog(
      title: Text(widget.invoice == null ? 'فاتورة شراء جديدة' : 'تعديل فاتورة الشراء'),
      content: SizedBox(
        width: 560,
        child: SingleChildScrollView(
          child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Row(children: [
              Expanded(
                child: DropdownButtonFormField<String>(
                  value: sup == null ? null : _supplier,
                  hint: const Text('اختر المورد'),
                  decoration: const InputDecoration(labelText: 'المورد *'),
                  items: [for (final s in _suppliers) DropdownMenuItem(value: '${s['id']}', child: Text('${s['name']}'))],
                  onChanged: (v) => setState(() => _supplier = v),
                ),
              ),
              IconButton(tooltip: 'مورد جديد', onPressed: _quickSupplier, icon: const Icon(Icons.person_add_alt_1_rounded, color: Pos.primary)),
            ]),
            if (sup != null)
              Padding(
                padding: const EdgeInsets.only(top: 6),
                child: validVat(sup['vat_number']?.toString())
                    ? const SoftBadge('المورد برقم ضريبي صالح — تُخصم ضريبتها', Pos.green, icon: Icons.verified_user_outlined)
                    : const SoftBadge('المورد بدون رقم ضريبي صالح — لن تُقبل في الإقرار', Pos.red, icon: Icons.gpp_maybe_outlined),
              ),
            const SizedBox(height: 10),
            Row(children: [
              Expanded(child: TextField(controller: _number, decoration: const InputDecoration(labelText: 'رقم الفاتورة الضريبية *'))),
              const SizedBox(width: 10),
              Expanded(
                child: InkWell(
                  onTap: () async {
                    final d = await showDatePicker(context: context, initialDate: _date, firstDate: DateTime(2023), lastDate: DateTime.now());
                    if (d != null) setState(() => _date = d);
                  },
                  child: InputDecorator(decoration: const InputDecoration(labelText: 'تاريخ الفاتورة *'), child: Text(_day(_date))),
                ),
              ),
            ]),
            const SizedBox(height: 10),
            DropdownButtonFormField<String>(
              value: _class,
              decoration: const InputDecoration(labelText: 'التصنيف الضريبي'),
              items: [for (final e in _taxClass.entries) DropdownMenuItem(value: e.key, child: Text(e.value))],
              onChanged: (v) => setState(() => _class = v ?? 'raw_material'),
            ),
            const SizedBox(height: 10),
            Row(children: [
              Expanded(
                flex: 2,
                child: TextField(
                    controller: _taxable,
                    keyboardType: const TextInputType.numberWithOptions(decimal: true),
                    onChanged: (_) => _recalc(),
                    decoration: const InputDecoration(labelText: 'المبلغ الخاضع للضريبة *')),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: TextField(
                    controller: _rate, keyboardType: TextInputType.number, onChanged: (_) => _recalc(), decoration: const InputDecoration(labelText: 'النسبة %')),
              ),
              const SizedBox(width: 8),
              Expanded(
                flex: 2,
                child: TextField(
                    controller: _vat,
                    keyboardType: const TextInputType.numberWithOptions(decimal: true),
                    onChanged: (_) => setState(() {}),
                    decoration: const InputDecoration(labelText: 'قيمة الضريبة')),
              ),
            ]),
            Padding(
              padding: const EdgeInsets.only(top: 6),
              child: Row(children: [const Text('الإجمالي: ', style: TextStyle(color: Pos.muted)), PosMoney(total, weight: FontWeight.w800)]),
            ),
            const SizedBox(height: 12),
            const Text('مواد المخزون المشتراة بهذه الفاتورة', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13)),
            const SizedBox(height: 6),
            for (final l in _lines)
              Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: Row(children: [
                  Expanded(
                    flex: 3,
                    child: DropdownButtonFormField<String>(
                      value: widget.items.any((i) => '${i['id']}' == l.itemId) ? l.itemId : null,
                      isExpanded: true,
                      hint: const Text('مادة'),
                      items: [for (final i in widget.items) DropdownMenuItem(value: '${i['id']}', child: Text('${i['name']}', overflow: TextOverflow.ellipsis))],
                      onChanged: (v) => setState(() => l.itemId = v),
                    ),
                  ),
                  const SizedBox(width: 6),
                  Expanded(child: TextField(controller: l.qty, keyboardType: TextInputType.number, decoration: const InputDecoration(hintText: 'الكمية'))),
                  const SizedBox(width: 6),
                  Expanded(child: TextField(controller: l.cost, keyboardType: TextInputType.number, decoration: const InputDecoration(hintText: 'التكلفة'))),
                  IconButton(onPressed: _lines.length > 1 ? () => setState(() => _lines.remove(l)) : null, icon: const Icon(Icons.close_rounded, size: 18)),
                ]),
              ),
            Align(
              alignment: AlignmentDirectional.centerStart,
              child: TextButton.icon(onPressed: () => setState(() => _lines.add(_Line())), icon: const Icon(Icons.add_rounded), label: const Text('بند')),
            ),
            const SizedBox(height: 8),
            Row(children: [
              Expanded(
                child: Text(_doc == null ? 'مستند الفاتورة: غير مرفق' : 'مستند الفاتورة: مرفق ✅',
                    style: TextStyle(color: _doc == null ? Pos.muted : Pos.green, fontSize: 13)),
              ),
              _uploading
                  ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2))
                  : OutlineSmall(label: 'إرفاق صورة', icon: Icons.attach_file_rounded, onPressed: _attach),
            ]),
            const SizedBox(height: 10),
            TextField(controller: _notes, maxLines: 2, decoration: const InputDecoration(labelText: 'ملاحظات')),
          ]),
        ),
      ),
      actions: [
        TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('إلغاء')),
        PrimaryButton(label: 'حفظ', busy: _saving, onPressed: _uploading ? null : _save),
      ],
    );
  }
}

// ═══════════════════════════ الموردون ═══════════════════════════

/// الموردون — نفس /suppliers (للمالك): بيانات المورد ورقمه الضريبي.
class SuppliersScreen extends StatefulWidget {
  const SuppliersScreen({super.key});

  @override
  State<SuppliersScreen> createState() => _SuppliersScreenState();
}

class _SuppliersScreenState extends State<SuppliersScreen> {
  List<Map<String, dynamic>>? _rows;
  String? _error;
  String _q = '';

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final r = await context.read<Rest>().select('suppliers', order: 'name.asc', limit: 200);
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
    final r = await showDialog<Map<String, dynamic>>(context: context, builder: (_) => SupplierDialog(supplier: s));
    if (r != null) _load();
  }

  Future<void> _delete(Map<String, dynamic> s) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (c) => AlertDialog(
        title: Text('حذف ${s['name']}؟'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(c, false), child: const Text('إلغاء')),
          FilledButton(style: FilledButton.styleFrom(backgroundColor: Pos.destructive), onPressed: () => Navigator.pop(c, true), child: const Text('حذف')),
        ],
      ),
    );
    if (ok != true || !mounted) return;
    try {
      await context.read<Rest>().delete('suppliers', '${s['id']}');
      _load();
    } on ApiException catch (e) {
      if (mounted) toast(context, 'تعذّر الحذف: ${e.message}', error: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    final q = _q.trim().toLowerCase();
    final list = (_rows ?? const []).where((s) => q.isEmpty || '${s['name'] ?? ''}'.toLowerCase().contains(q) || '${s['phone'] ?? ''}'.contains(q)).toList();
    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 40),
        physics: const AlwaysScrollableScrollPhysics(),
        children: [
          PageHeader(
            title: 'الموردون',
            subtitle: '${_rows?.length ?? 0} مورد',
            icon: Icons.local_shipping_outlined,
            tone: Tone.gray,
            trailing: PrimaryButton(label: 'مورد جديد', icon: Icons.add_rounded, onPressed: () => _edit()),
          ),
          TextField(onChanged: (v) => setState(() => _q = v), decoration: const InputDecoration(hintText: 'بحث بالاسم أو الجوال...', prefixIcon: Icon(Icons.search_rounded, size: 20))),
          const SizedBox(height: 14),
          if (_error != null) LoadError(message: _error!, onRetry: _load),
          if (_rows == null && _error == null)
            const Padding(padding: EdgeInsets.all(60), child: Center(child: CircularProgressIndicator()))
          else if (list.isEmpty && _error == null)
            const EmptyState(icon: Icons.local_shipping_outlined, text: 'لا يوجد موردون')
          else
            for (final s in list)
              GlassCard(
                margin: const EdgeInsets.only(bottom: 10),
                onTap: () => _edit(s),
                child: Row(children: [
                  Expanded(
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text('${s['name']}', style: const TextStyle(fontWeight: FontWeight.w700)),
                      Text([s['contact_name'], s['phone'], s['email']].where((x) => (x ?? '').toString().isNotEmpty).join(' · '),
                          style: const TextStyle(fontSize: 12, color: Pos.muted)),
                      const SizedBox(height: 5),
                      validVat(s['vat_number']?.toString())
                          ? SoftBadge('VAT ${s['vat_number']}', Pos.green, icon: Icons.verified_outlined)
                          : const SoftBadge('بدون رقم ضريبي صالح', Pos.red, icon: Icons.gpp_maybe_outlined),
                    ]),
                  ),
                  IconButton(onPressed: () => _delete(s), icon: const Icon(Icons.delete_outline_rounded, color: Pos.destructive, size: 20)),
                ]),
              ),
        ],
      ),
    );
  }
}

/// نموذج المورد (إضافة/تعديل) — يُستخدم أيضاً كإضافة سريعة من فاتورة الشراء.
class SupplierDialog extends StatefulWidget {
  const SupplierDialog({super.key, this.supplier});
  final Map<String, dynamic>? supplier;

  @override
  State<SupplierDialog> createState() => _SupplierDialogState();
}

class _SupplierDialogState extends State<SupplierDialog> {
  late final _f = {
    for (final k in ['name', 'contact_name', 'phone', 'email', 'address', 'vat_number', 'notes'])
      k: TextEditingController(text: '${widget.supplier?[k] ?? ''}'),
  };
  bool _saving = false;

  Future<void> _save() async {
    if (_f['name']!.text.trim().isEmpty) return;
    final rest = context.read<Rest>();
    setState(() => _saving = true);
    final data = {for (final e in _f.entries) e.key: e.value.text.trim().isEmpty ? null : e.value.text.trim()};
    try {
      final r = widget.supplier == null
          ? await rest.insert('suppliers', {...data, 'is_active': true})
          : await rest.update('suppliers', '${widget.supplier!['id']}', data);
      if (mounted) Navigator.pop(context, r ?? data);
    } on ApiException catch (e) {
      if (mounted) {
        toast(context, 'تعذّر الحفظ: ${e.message}', error: true);
        setState(() => _saving = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    Widget t(String k, String l, {TextInputType? kb}) => Padding(
          padding: const EdgeInsets.only(bottom: 10),
          child: TextField(controller: _f[k], keyboardType: kb, onChanged: (_) => setState(() {}), decoration: InputDecoration(labelText: l)),
        );
    final vat = _f['vat_number']!.text.trim();
    return AlertDialog(
      title: Text(widget.supplier == null ? 'مورد جديد' : 'تعديل المورد'),
      content: SizedBox(
        width: 440,
        child: SingleChildScrollView(
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            t('name', 'اسم المورد *'),
            t('contact_name', 'اسم المسؤول'),
            t('phone', 'الجوال', kb: TextInputType.phone),
            t('email', 'البريد الإلكتروني', kb: TextInputType.emailAddress),
            t('address', 'العنوان'),
            t('vat_number', 'الرقم الضريبي (VAT)', kb: TextInputType.number),
            if (vat.isNotEmpty && !validVat(vat))
              const Padding(
                padding: EdgeInsets.only(bottom: 8),
                child: Text('لازم 15 رقم ويبدأ وينتهي بـ 3 — بدونه لا تُخصم ضريبة فواتيره', style: TextStyle(fontSize: 12, color: Pos.amber)),
              ),
            t('notes', 'ملاحظات'),
          ]),
        ),
      ),
      actions: [
        TextButton(onPressed: () => Navigator.pop(context), child: const Text('إلغاء')),
        PrimaryButton(label: 'حفظ', busy: _saving, onPressed: _save),
      ],
    );
  }
}
