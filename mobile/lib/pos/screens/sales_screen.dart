import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/api_client.dart';
import '../../core/rest.dart';
import '../../models/order.dart';
import '../../state/auth_controller.dart';
import '../pos_ui.dart';
import '../receipt.dart';

const units = {'piece': 'حبة', 'dozen': 'درزن', 'carton': 'كرتون', 'kg': 'كغ', 'liter': 'لتر'};

double _d(dynamic v) => v is num ? v.toDouble() : double.tryParse('${v ?? ''}') ?? 0;

/// المبيعات والمخازن — نفس /sales: المخزون والمنتجات، إصدار الفواتير، تقرير التحويلات.
class SalesScreen extends StatefulWidget {
  const SalesScreen({super.key});

  @override
  State<SalesScreen> createState() => _SalesScreenState();
}

class _SalesScreenState extends State<SalesScreen> {
  List<Map<String, dynamic>> _items = const [];
  List<Map<String, dynamic>> _branches = const [];
  List<Map<String, dynamic>> _moves = const [];
  bool _loaded = false;
  String? _error;
  int _tab = 0;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final rest = context.read<Rest>();
    try {
      final r = await Future.wait([
        rest.select('inventory_items', order: 'created_at.desc', limit: 500),
        rest.select('branches', order: 'created_at.desc', limit: 200),
        rest.select('stock_movements', order: 'created_at.desc', limit: 300),
      ]);
      if (!mounted) return;
      setState(() {
        _items = r[0];
        _branches = r[1];
        _moves = r[2];
        _loaded = true;
        _error = null;
      });
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    }
  }

  @override
  Widget build(BuildContext context) {
    final me = context.watch<AuthController>().employee!;
    final admin = {'owner', 'admin', 'manager'}.contains(me.role);
    final tabs = [
      if (admin) (0, 'المخزون والمنتجات'),
      (1, 'إصدار الفواتير'),
      if (admin) (2, 'تقرير التحويلات'),
    ];
    if (!tabs.any((t) => t.$1 == _tab)) _tab = tabs.first.$1;

    final sales = _items.where((i) => i['category'] != 'workshop').toList();
    final whTotal = sales.fold<double>(0, (s, i) => s + _d(i['warehouse_qty']));
    final whValue = sales.fold<double>(0, (s, i) => s + _d(i['warehouse_qty']) * _d(i['cost_price']));
    final now = DateTime.now();
    final today = _moves.where((m) {
      final t = DateTime.tryParse('${m['created_at']}')?.toLocal();
      return t != null && t.year == now.year && t.month == now.month && t.day == now.day;
    }).length;

    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 40),
        physics: const AlwaysScrollableScrollPhysics(),
        children: [
          const PageHeader(title: 'نظام المبيعات والمخازن', subtitle: 'مستقل تماماً عن نظام الورشة — فواتير · مخزون · تحويلات', icon: Icons.shopping_cart_outlined, tone: Tone.orange),
          if (_error != null) LoadError(message: _error!, onRetry: _load),
          if (!_loaded && _error == null) const Padding(padding: EdgeInsets.all(60), child: Center(child: CircularProgressIndicator())),
          if (_loaded) ...[
            LayoutBuilder(builder: (context, c) {
              final cols = c.maxWidth >= 760 ? 4 : 2;
              final w = (c.maxWidth - (cols - 1) * 12) / cols;
              Widget stat(String l, Widget v, IconData i, Color col) => SizedBox(
                    width: w,
                    child: GlassCard(
                      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Container(
                            width: 34,
                            height: 34,
                            decoration: BoxDecoration(color: col.withValues(alpha: .1), borderRadius: BorderRadius.circular(10)),
                            child: Icon(i, size: 18, color: col)),
                        const SizedBox(height: 8),
                        v,
                        Text(l, style: const TextStyle(fontSize: 12, color: Pos.muted)),
                      ]),
                    ),
                  );
              const big = TextStyle(fontSize: 19, fontWeight: FontWeight.w900);
              return Wrap(spacing: 12, runSpacing: 12, children: [
                stat('منتجات المبيعات', Text('${sales.length}', style: big), Icons.inventory_2_outlined, Pos.blue),
                stat('إجمالي المستودع', Text('${whTotal.toStringAsFixed(0)} وحدة', style: big), Icons.warehouse_outlined, const Color(0xFF9333EA)),
                stat('قيمة المخزون', PosMoney(whValue, size: 19, weight: FontWeight.w900, decimals: 0), Icons.trending_up_rounded, Pos.green),
                stat('حركات اليوم', Text('$today', style: big), Icons.swap_horiz_rounded, Pos.primary),
              ]);
            }),
            const SizedBox(height: 16),
            Wrap(spacing: 8, children: [for (final t in tabs) PillChip(label: t.$2, selected: _tab == t.$1, onTap: () => setState(() => _tab = t.$1))]),
            const SizedBox(height: 14),
            switch (_tab) {
              0 => _InventoryTab(items: sales, branches: _branches, onChanged: _load),
              2 => _TransfersTab(moves: _moves),
              _ => _InvoiceTab(items: _items, branches: _branches, onChanged: _load),
            },
          ],
        ],
      ),
    );
  }
}

// ═══════════════ المخزون ═══════════════

class _InventoryTab extends StatefulWidget {
  const _InventoryTab({required this.items, required this.branches, required this.onChanged});
  final List<Map<String, dynamic>> items;
  final List<Map<String, dynamic>> branches;
  final Future<void> Function() onChanged;

  @override
  State<_InventoryTab> createState() => _InventoryTabState();
}

class _InventoryTabState extends State<_InventoryTab> {
  String _q = '';

  List<Map<String, dynamic>> get _active => widget.branches.where((b) => b['is_active'] == true).toList();

  Future<void> _edit([Map<String, dynamic>? item]) async {
    final saved = await showDialog<bool>(context: context, builder: (_) => _ItemDialog(item: item));
    if (saved == true) widget.onChanged();
  }

  Future<void> _delete(Map<String, dynamic> item) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (c) => AlertDialog(
        title: Text('حذف ${item['name']}؟'),
        content: const Text('لا يمكن التراجع عن الحذف.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(c, false), child: const Text('إلغاء')),
          FilledButton(style: FilledButton.styleFrom(backgroundColor: Pos.destructive), onPressed: () => Navigator.pop(c, true), child: const Text('حذف')),
        ],
      ),
    );
    if (ok != true || !mounted) return;
    try {
      await context.read<Rest>().delete('inventory_items', '${item['id']}');
      if (mounted) toast(context, 'تم حذف المنتج');
      widget.onChanged();
    } on ApiException catch (e) {
      if (mounted) toast(context, 'فشل حذف المنتج: ${e.message}', error: true);
    }
  }

  Future<void> _transfer(Map<String, dynamic> item) async {
    final done = await showDialog<bool>(context: context, builder: (_) => _TransferDialog(item: item, branches: _active));
    if (done == true) widget.onChanged();
  }

  @override
  Widget build(BuildContext context) {
    final q = _q.trim().toLowerCase();
    final list = widget.items.where((i) => q.isEmpty || '${i['name'] ?? ''}'.toLowerCase().contains(q) || '${i['sku'] ?? ''}'.contains(q)).toList();
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      Row(children: [
        Expanded(
          child: TextField(
            onChanged: (v) => setState(() => _q = v),
            decoration: const InputDecoration(hintText: 'بحث بالاسم أو الرمز...', prefixIcon: Icon(Icons.search_rounded, size: 20)),
          ),
        ),
        const SizedBox(width: 10),
        PrimaryButton(label: 'منتج جديد', icon: Icons.add_rounded, onPressed: () => _edit()),
      ]),
      const SizedBox(height: 12),
      if (list.isEmpty)
        const EmptyState(icon: Icons.inventory_2_outlined, text: 'لا توجد منتجات')
      else
        for (final i in list)
          GlassCard(
            margin: const EdgeInsets.only(bottom: 10),
            padding: const EdgeInsets.all(14),
            child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              Row(children: [
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text('${i['name']}', style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14.5)),
                    if ((i['sku'] ?? '').toString().isNotEmpty) Text('SKU: ${i['sku']}', style: const TextStyle(fontSize: 11.5, color: Pos.muted)),
                  ]),
                ),
                Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
                  PosMoney(_d(i['sell_price']), weight: FontWeight.w800),
                  Text('تكلفة ${_d(i['cost_price']).toStringAsFixed(2)}', style: const TextStyle(fontSize: 11.5, color: Pos.muted)),
                ]),
              ]),
              const SizedBox(height: 8),
              Wrap(spacing: 6, runSpacing: 6, children: [
                SoftBadge('المستودع: ${_d(i['warehouse_qty']).toStringAsFixed(0)} ${units[i['unit']] ?? i['unit'] ?? ''}', const Color(0xFF9333EA)),
                for (final b in _active)
                  SoftBadge('${b['name']}: ${_d((i['branch_qty'] is Map ? i['branch_qty'] : const {})['${b['id']}']).toStringAsFixed(0)}', Pos.blue),
              ]),
              const SizedBox(height: 8),
              Wrap(spacing: 8, children: [
                OutlineSmall(label: 'تحويل لفرع', icon: Icons.swap_horiz_rounded, onPressed: () => _transfer(i)),
                OutlineSmall(label: 'تعديل', icon: Icons.edit_outlined, onPressed: () => _edit(i)),
                OutlineSmall(label: 'حذف', icon: Icons.delete_outline_rounded, color: Pos.destructive, onPressed: () => _delete(i)),
              ]),
            ]),
          ),
    ]);
  }
}

class _ItemDialog extends StatefulWidget {
  const _ItemDialog({this.item});
  final Map<String, dynamic>? item;

  @override
  State<_ItemDialog> createState() => _ItemDialogState();
}

class _ItemDialogState extends State<_ItemDialog> {
  late final _name = TextEditingController(text: '${widget.item?['name'] ?? ''}');
  late final _sku = TextEditingController(text: '${widget.item?['sku'] ?? ''}');
  late final _cost = TextEditingController(text: widget.item?['cost_price']?.toString() ?? '');
  late final _sell = TextEditingController(text: widget.item?['sell_price']?.toString() ?? '');
  late final _qty = TextEditingController(text: widget.item?['warehouse_qty']?.toString() ?? '');
  late String _unit = '${widget.item?['unit'] ?? 'piece'}';
  String _category = 'sales';
  bool _saving = false;

  Future<void> _save() async {
    if (_name.text.trim().isEmpty) return;
    final rest = context.read<Rest>();
    final me = context.read<AuthController>().employee!;
    setState(() => _saving = true);
    final data = <String, dynamic>{
      'name': _name.text.trim(),
      'sku': _sku.text.trim(),
      'unit': _unit,
      'cost_price': double.tryParse(_cost.text) ?? 0,
      'sell_price': double.tryParse(_sell.text),
      'warehouse_qty': double.tryParse(_qty.text) ?? 0,
    };
    try {
      if (widget.item == null) {
        final created = await rest.insert('inventory_items', {...data, 'category': _category});
        if (created != null) {
          await rest.insert('stock_movements', {
            'item_id': created['id'],
            'item_name': created['name'],
            'movement_type': 'warehouse_in',
            'quantity': created['warehouse_qty'] ?? 0,
            'unit': created['unit'],
            'from_location': 'external',
            'to_location': 'warehouse',
            'cost_price': created['cost_price'],
            'reference_type': 'manual',
            'created_by_name': me.name,
          }, select: 'id');
        }
      } else {
        await rest.update('inventory_items', '${widget.item!['id']}', data);
      }
      if (!mounted) return;
      toast(context, widget.item == null ? 'تمت إضافة المنتج' : 'تم حفظ التعديلات');
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
    Widget f(TextEditingController c, String l, {bool num = false}) => Padding(
          padding: const EdgeInsets.only(bottom: 10),
          child: TextField(controller: c, keyboardType: num ? const TextInputType.numberWithOptions(decimal: true) : null, decoration: InputDecoration(labelText: l)),
        );
    return AlertDialog(
      title: Text(widget.item == null ? 'منتج جديد' : 'تعديل المنتج'),
      content: SizedBox(
        width: 420,
        child: SingleChildScrollView(
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            f(_name, 'اسم المنتج *'),
            f(_sku, 'رمز SKU'),
            DropdownButtonFormField<String>(
              value: units.containsKey(_unit) ? _unit : null,
              decoration: const InputDecoration(labelText: 'الوحدة'),
              items: [for (final e in units.entries) DropdownMenuItem(value: e.key, child: Text(e.value))],
              onChanged: (v) => setState(() => _unit = v ?? 'piece'),
            ),
            const SizedBox(height: 10),
            if (widget.item == null) ...[
              DropdownButtonFormField<String>(
                value: _category,
                decoration: const InputDecoration(labelText: 'الفئة'),
                items: const [
                  DropdownMenuItem(value: 'sales', child: Text('مبيعات فقط')),
                  DropdownMenuItem(value: 'workshop', child: Text('ورشة فقط')),
                  DropdownMenuItem(value: 'both', child: Text('كلاهما')),
                ],
                onChanged: (v) => setState(() => _category = v ?? 'sales'),
              ),
              const SizedBox(height: 10),
            ],
            f(_cost, 'سعر التكلفة *', num: true),
            f(_sell, 'سعر البيع', num: true),
            f(_qty, 'كمية المستودع', num: true),
          ]),
        ),
      ),
      actions: [
        TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('إلغاء')),
        PrimaryButton(label: 'حفظ', busy: _saving, onPressed: _save),
      ],
    );
  }
}

class _TransferDialog extends StatefulWidget {
  const _TransferDialog({required this.item, required this.branches});
  final Map<String, dynamic> item;
  final List<Map<String, dynamic>> branches;

  @override
  State<_TransferDialog> createState() => _TransferDialogState();
}

class _TransferDialogState extends State<_TransferDialog> {
  final _qty = TextEditingController();
  String? _branch;
  bool _saving = false;

  Future<void> _go() async {
    final qty = double.tryParse(_qty.text) ?? 0;
    if (_branch == null || qty <= 0) return;
    final item = widget.item;
    final left = _d(item['warehouse_qty']) - qty;
    if (left < 0) {
      toast(context, 'الكمية في المستودع غير كافية', error: true);
      return;
    }
    final rest = context.read<Rest>();
    final me = context.read<AuthController>().employee!;
    setState(() => _saving = true);
    try {
      final bq = Map<String, dynamic>.from(item['branch_qty'] is Map ? item['branch_qty'] as Map : const {});
      bq[_branch!] = _d(bq[_branch!]) + qty;
      await rest.update('inventory_items', '${item['id']}', {'warehouse_qty': left, 'branch_qty': bq});
      final bName = '${widget.branches.firstWhere((b) => '${b['id']}' == _branch)['name']}';
      await rest.insert('stock_movements', {
        'item_id': item['id'],
        'item_name': item['name'],
        'movement_type': 'warehouse_to_branch',
        'quantity': qty,
        'unit': item['unit'],
        'from_location': 'warehouse',
        'to_location': _branch,
        'cost_price': item['cost_price'],
        'reference_type': 'transfer',
        'branch_id': _branch,
        'branch_name': bName,
        'created_by_name': me.name,
      }, select: 'id');
      if (!mounted) return;
      toast(context, 'تم التحويل من المستودع للفرع ✅');
      Navigator.pop(context, true);
    } on ApiException catch (e) {
      if (mounted) {
        toast(context, e.message, error: true);
        setState(() => _saving = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final item = widget.item;
    return AlertDialog(
      title: Text('تحويل ${item['name']}'),
      content: SizedBox(
        width: 380,
        child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Text('متوفر في المستودع: ${_d(item['warehouse_qty']).toStringAsFixed(0)} ${units[item['unit']] ?? ''}', style: const TextStyle(color: Pos.muted)),
          const SizedBox(height: 12),
          DropdownButtonFormField<String>(
            value: _branch,
            hint: const Text('اختر الفرع'),
            decoration: const InputDecoration(labelText: 'الفرع المستهدف'),
            items: [for (final b in widget.branches) DropdownMenuItem(value: '${b['id']}', child: Text('${b['name']}'))],
            onChanged: (v) => setState(() => _branch = v),
          ),
          const SizedBox(height: 10),
          TextField(controller: _qty, keyboardType: const TextInputType.numberWithOptions(decimal: true), decoration: const InputDecoration(labelText: 'الكمية')),
        ]),
      ),
      actions: [
        TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('إلغاء')),
        PrimaryButton(label: 'تحويل', busy: _saving, onPressed: _go),
      ],
    );
  }
}

// ═══════════════ إصدار الفواتير ═══════════════

class _InvoiceTab extends StatefulWidget {
  const _InvoiceTab({required this.items, required this.branches, required this.onChanged});
  final List<Map<String, dynamic>> items;
  final List<Map<String, dynamic>> branches;
  final Future<void> Function() onChanged;

  @override
  State<_InvoiceTab> createState() => _InvoiceTabState();
}

class _CartLine {
  _CartLine(this.item) : qty = 1;
  final Map<String, dynamic> item;
  int qty;
  double get sell => _d(item['sell_price']);
  double get cost => _d(item['cost_price']);
  Map<String, dynamic> toJson() => {
        'item_id': item['id'],
        'item_name': item['name'],
        'unit': item['unit'],
        'sell_price': sell,
        'cost_price': cost,
        'qty': qty,
      };
}

class _InvoiceTabState extends State<_InvoiceTab> {
  final _cart = <_CartLine>[];
  final _name = TextEditingController();
  final _phone = TextEditingController();
  String _q = '';
  String? _branch;
  String _pay = 'cash';
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    _branch = context.read<AuthController>().employee?.branchId;
  }

  @override
  void dispose() {
    _name.dispose();
    _phone.dispose();
    super.dispose();
  }

  double _avail(Map<String, dynamic> i) => _branch == null ? 0 : _d((i['branch_qty'] is Map ? i['branch_qty'] as Map : const {})[_branch]);

  void _add(Map<String, dynamic> i) {
    final ex = _cart.where((c) => c.item['id'] == i['id']).firstOrNull;
    setState(() {
      if (ex == null) {
        _cart.add(_CartLine(i));
      } else if (ex.qty < _avail(i)) {
        ex.qty++;
      }
    });
  }

  Future<void> _issue() async {
    if (_branch == null || _cart.isEmpty) {
      toast(context, _branch == null ? 'اختر الفرع أولاً' : 'الفاتورة فارغة', error: true);
      return;
    }
    final rest = context.read<Rest>();
    final api = context.read<ApiClient>();
    final me = context.read<AuthController>().employee!;
    final branch = widget.branches.firstWhere((b) => '${b['id']}' == _branch, orElse: () => const {});
    final sub = _cart.fold<double>(0, (s, c) => s + c.sell * c.qty);
    final vat = sub * .15;
    final cost = _cart.fold<double>(0, (s, c) => s + c.cost * c.qty);
    final now = DateTime.now();
    setState(() => _saving = true);
    try {
      final inv = await rest.insert('sales_invoices', {
        'invoice_number': 'INV-${now.millisecondsSinceEpoch.toString().substring(5)}',
        'customer_name': _name.text.trim().isEmpty ? 'عميل نقدي' : _name.text.trim(),
        'customer_phone': _phone.text.trim(),
        'branch_id': _branch,
        'branch_name': branch['name'] ?? '',
        'items': _cart.map((c) => c.toJson()).toList(),
        'subtotal': sub,
        'vat_amount': vat,
        'total': sub + vat,
        'cost_total': cost,
        'gross_profit': sub - cost,
        'payment_method': _pay,
        'payment_status': 'paid',
        'month_key': '${now.year}-${now.month.toString().padLeft(2, '0')}',
        'employee_name': me.name,
      });
      if (inv == null) throw ApiException('لم يرجع الخادم الفاتورة');
      // خصم مخزون الفرع + تسجيل الحركة (نفس الموقع)
      for (final c in _cart) {
        final bq = Map<String, dynamic>.from(c.item['branch_qty'] is Map ? c.item['branch_qty'] as Map : const {});
        bq[_branch!] = (_d(bq[_branch!]) - c.qty).clamp(0, double.infinity);
        await rest.update('inventory_items', '${c.item['id']}', {'branch_qty': bq}, select: 'id');
        await rest.insert('stock_movements', {
          'item_id': c.item['id'],
          'item_name': c.item['name'],
          'movement_type': 'branch_sale',
          'quantity': c.qty,
          'unit': c.item['unit'],
          'from_location': _branch,
          'to_location': 'customer',
          'cost_price': c.cost,
          'sell_price': c.sell,
          'reference_id': inv['id'],
          'reference_type': 'invoice',
          'branch_id': _branch,
          'branch_name': branch['name'],
          'created_by_name': me.name,
        }, select: 'id');
      }
      Map<String, dynamic> z = const {};
      try {
        final r = await api.request('POST', '/api/zatca/submit', data: {'type': 'sale', 'id': inv['id']});
        if (r is Map) z = r.map((k, v) => MapEntry('$k', v));
      } on ApiException {
        // الفاتورة صدرت؛ زاتكا يُعاد إرسالها من سجل زاتكا
      }
      if (!mounted) return;
      toast(context, 'تم إصدار الفاتورة وخصم المخزون ✅');
      final receipt = Order({
        ...inv,
        'order_number': inv['invoice_number'],
        'total_price': inv['total'],
        'zatca_qr': z['qr'] ?? inv['zatca_qr'],
        'zatca_status': z['zatca_status'] ?? inv['zatca_status'],
      });
      setState(() {
        _cart.clear();
        _name.clear();
        _phone.clear();
      });
      widget.onChanged();
      await showDialog<void>(
        context: context,
        builder: (_) => Dialog(
          insetPadding: const EdgeInsets.all(16),
          child: SingleChildScrollView(padding: const EdgeInsets.all(16), child: ReceiptPanel(order: receipt, autoPrint: true)),
        ),
      );
    } on ApiException catch (e) {
      if (mounted) toast(context, e.message, error: true);
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final active = widget.branches.where((b) => b['is_active'] == true).toList();
    final q = _q.trim().toLowerCase();
    final list = widget.items
        .where((i) => i['category'] != 'workshop' && _avail(i) > 0 && (q.isEmpty || '${i['name'] ?? ''}'.toLowerCase().contains(q)))
        .toList();
    final sub = _cart.fold<double>(0, (s, c) => s + c.sell * c.qty);

    final products = GlassCard(
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        DropdownButtonFormField<String>(
          value: active.any((b) => '${b['id']}' == _branch) ? _branch : null,
          hint: const Text('اختر الفرع'),
          decoration: const InputDecoration(labelText: 'الفرع'),
          items: [for (final b in active) DropdownMenuItem(value: '${b['id']}', child: Text('${b['name']}'))],
          onChanged: (v) => setState(() {
            _branch = v;
            _cart.clear();
          }),
        ),
        const SizedBox(height: 10),
        TextField(onChanged: (v) => setState(() => _q = v), decoration: const InputDecoration(hintText: 'بحث عن منتج...', prefixIcon: Icon(Icons.search_rounded, size: 20))),
        const SizedBox(height: 10),
        if (_branch == null)
          const EmptyState(icon: Icons.store_outlined, text: 'اختر الفرع لعرض منتجاته')
        else if (list.isEmpty)
          const EmptyState(icon: Icons.inventory_2_outlined, text: 'لا توجد منتجات متوفرة بهذا الفرع')
        else
          for (final i in list)
            ListTile(
              contentPadding: EdgeInsets.zero,
              title: Text('${i['name']}', style: const TextStyle(fontWeight: FontWeight.w600)),
              subtitle: Text('متوفر: ${_avail(i).toStringAsFixed(0)} ${units[i['unit']] ?? ''}', style: const TextStyle(fontSize: 12)),
              trailing: Row(mainAxisSize: MainAxisSize.min, children: [
                PosMoney(_d(i['sell_price'])),
                IconButton(onPressed: () => _add(i), icon: const Icon(Icons.add_circle_rounded, color: Pos.primary)),
              ]),
            ),
      ]),
    );

    final cart = GlassCard(
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Text('الفاتورة (${_cart.length})', style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
        const SizedBox(height: 10),
        TextField(controller: _name, decoration: const InputDecoration(labelText: 'اسم العميل (اختياري)')),
        const SizedBox(height: 8),
        TextField(controller: _phone, keyboardType: TextInputType.phone, decoration: const InputDecoration(labelText: 'جوال العميل (اختياري)')),
        const SizedBox(height: 10),
        for (final c in _cart)
          Row(children: [
            Expanded(child: Text('${c.item['name']}', style: const TextStyle(fontSize: 13))),
            IconButton(
                visualDensity: VisualDensity.compact,
                onPressed: () => setState(() {
                  if (c.qty <= 1) {
                    _cart.remove(c);
                  } else {
                    c.qty--;
                  }
                }),
                icon: const Icon(Icons.remove_circle_outline_rounded, size: 20)),
            Text('${c.qty}', style: const TextStyle(fontWeight: FontWeight.w700)),
            IconButton(
                visualDensity: VisualDensity.compact,
                onPressed: c.qty >= _avail(c.item) ? null : () => setState(() => c.qty++),
                icon: const Icon(Icons.add_circle_outline_rounded, size: 20)),
            PosMoney(c.sell * c.qty, size: 13),
          ]),
        const Divider(),
        _line('المجموع', sub),
        _line('الضريبة 15%', sub * .15),
        _line('الإجمالي', sub * 1.15, strong: true),
        const SizedBox(height: 10),
        SegmentedButton<String>(
          segments: const [ButtonSegment(value: 'cash', label: Text('نقداً')), ButtonSegment(value: 'network', label: Text('شبكة'))],
          selected: {_pay},
          showSelectedIcon: false,
          onSelectionChanged: (v) => setState(() => _pay = v.first),
        ),
        const SizedBox(height: 12),
        PrimaryButton(label: 'إصدار الفاتورة وطباعتها', icon: Icons.receipt_long_rounded, expand: true, busy: _saving, onPressed: _cart.isEmpty ? null : _issue),
      ]),
    );

    return LayoutBuilder(builder: (context, c) {
      if (c.maxWidth < 860) return Column(children: [products, const SizedBox(height: 12), cart]);
      return Row(crossAxisAlignment: CrossAxisAlignment.start, children: [Expanded(flex: 3, child: products), const SizedBox(width: 12), Expanded(flex: 2, child: cart)]);
    });
  }

  Widget _line(String l, double v, {bool strong = false}) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 3),
        child: Row(children: [
          Expanded(child: Text(l, style: TextStyle(color: strong ? Pos.fg : Pos.muted, fontWeight: strong ? FontWeight.w800 : FontWeight.w400))),
          PosMoney(v, size: strong ? 16 : 13.5, weight: strong ? FontWeight.w900 : FontWeight.w500),
        ]),
      );
}

// ═══════════════ تقرير التحويلات ═══════════════

class _TransfersTab extends StatelessWidget {
  const _TransfersTab({required this.moves});
  final List<Map<String, dynamic>> moves;

  @override
  Widget build(BuildContext context) {
    final t = moves.where((m) => m['movement_type'] == 'warehouse_to_branch').toList();
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(color: const Color(0xFFFFFBEB), borderRadius: BorderRadius.circular(14), border: Border.all(color: const Color(0xFFFDE68A))),
        child: const Text('📊 تقرير التحويل من المستودع إلى الفروع — يُظهر كل بضاعة خرجت من المستودع ووجهتها. أي بضاعة خرجت يجب أن تظهر في رصيد الفرع.',
            style: TextStyle(fontSize: 13, color: Color(0xFF92400E))),
      ),
      const SizedBox(height: 12),
      if (t.isEmpty)
        const EmptyState(icon: Icons.swap_horiz_rounded, text: 'لا توجد تحويلات بعد')
      else
        GlassCard(
          padding: EdgeInsets.zero,
          child: Column(children: [
            for (final m in t)
              ListTile(
                title: Text('${m['item_name']}', style: const TextStyle(fontWeight: FontWeight.w600)),
                subtitle: Text('${m['branch_name'] ?? m['to_location']} · ${fmtDateTime(DateTime.tryParse('${m['created_at']}')?.toLocal())}', style: const TextStyle(fontSize: 12)),
                trailing: Column(mainAxisAlignment: MainAxisAlignment.center, crossAxisAlignment: CrossAxisAlignment.end, children: [
                  Text('${m['quantity']} ${units[m['unit']] ?? m['unit'] ?? ''}', style: const TextStyle(fontWeight: FontWeight.w700)),
                  PosMoney(_d(m['cost_price']) * _d(m['quantity']), size: 12),
                ]),
              ),
          ]),
        ),
    ]);
  }
}
