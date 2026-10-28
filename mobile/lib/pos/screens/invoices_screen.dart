import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/api_client.dart';
import '../../core/rest.dart';
import '../../models/order.dart';
import '../pos_ui.dart';
import '../receipt.dart';
import 'order_details_screen.dart';

/// الفواتير — نفس /invoices: فواتير الإصلاح ومبيعات المنتجات في مكان واحد.
class InvoicesScreen extends StatefulWidget {
  const InvoicesScreen({super.key});

  @override
  State<InvoicesScreen> createState() => _InvoicesScreenState();
}

class _Row {
  _Row(this.kind, this.number, this.customer, this.phone, this.total, this.method, this.createdAt, this.raw);
  final String kind; // repair | product
  final String number;
  final String customer;
  final String? phone;
  final double total;
  final String? method;
  final DateTime? createdAt;
  final Map<String, dynamic> raw;
}

class _InvoicesScreenState extends State<InvoicesScreen> {
  List<_Row>? _rows;
  String? _error;
  String _type = 'all';
  String _q = '';

  static const _payLabels = {'cash': 'نقداً', 'network': 'شبكة', 'credit': 'آجل'};

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final rest = context.read<Rest>();
    try {
      final res = await Future.wait([
        rest.select('orders', order: 'created_at.desc', limit: 300),
        rest.select('sales_invoices', order: 'created_at.desc', limit: 300),
      ]);
      final rows = <_Row>[
        // طلب الشركة المسدّد تمثّله فاتورته المجمّعة — لا يظهر مرتين
        for (final o in res[0].where((o) => o['partner_invoice_id'] == null))
          _Row('repair', '${o['order_number']}', '${o['customer_name'] ?? ''}', o['customer_phone']?.toString(), ((o['total_price'] as num?) ?? 0).toDouble(),
              o['payment_method']?.toString(), DateTime.tryParse('${o['created_at']}')?.toLocal(), o),
        for (final s in res[1])
          _Row('product', '${s['invoice_number']}', '${s['customer_name'] ?? ''}', s['customer_phone']?.toString(), ((s['total'] as num?) ?? 0).toDouble(),
              s['payment_method']?.toString(), DateTime.tryParse('${s['created_at']}')?.toLocal(), s),
      ]..sort((a, b) => (b.createdAt ?? DateTime(0)).compareTo(a.createdAt ?? DateTime(0)));
      if (mounted) {
        setState(() {
          _rows = rows;
          _error = null;
        });
      }
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    }
  }

  void _open(_Row r) {
    if (r.kind == 'repair') {
      Navigator.of(context).push(MaterialPageRoute(builder: (_) => OrderDetailsScreen(orderId: '${r.raw['id']}')));
      return;
    }
    // فاتورة منتج: نفس salesInvoiceToReceipt في الموقع
    final adapted = Order({
      ...r.raw,
      'order_number': r.raw['invoice_number'],
      'total_price': r.raw['total'],
      'items': r.raw['items'] ?? const [],
      'payment_status': r.raw['payment_status'] ?? 'paid',
    });
    showDialog<void>(
      context: context,
      builder: (_) => Dialog(
        insetPadding: const EdgeInsets.all(16),
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 380),
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(16),
            child: Column(children: [
              Text('الفاتورة #${r.number}', style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
              const SizedBox(height: 12),
              ReceiptPanel(order: adapted),
            ]),
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final all = _rows ?? const <_Row>[];
    final q = _q.trim().toLowerCase();
    final list = all
        .where((r) => (_type == 'all' || r.kind == _type) && (q.isEmpty || r.number.toLowerCase().contains(q) || r.customer.toLowerCase().contains(q) || (r.phone ?? '').contains(q)))
        .toList();
    final counts = {'all': all.length, 'repair': all.where((r) => r.kind == 'repair').length, 'product': all.where((r) => r.kind == 'product').length};

    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
        physics: const AlwaysScrollableScrollPhysics(),
        children: [
          const PageHeader(title: 'الفواتير', subtitle: 'كل فواتير الإصلاح ومبيعات المنتجات في مكان واحد', icon: Icons.receipt_long_rounded, tone: Tone.teal),
          Wrap(spacing: 8, runSpacing: 8, children: [
            for (final t in const [('all', 'الكل'), ('repair', 'إصلاح 🔧'), ('product', 'بيع منتج 🛍️')])
              PillChip(label: '${t.$2} (${counts[t.$1]})', selected: _type == t.$1, onTap: () => setState(() => _type = t.$1)),
          ]),
          const SizedBox(height: 12),
          TextField(
            onChanged: (v) => setState(() => _q = v),
            decoration: const InputDecoration(hintText: 'بحث برقم الفاتورة أو اسم العميل أو الجوال...', prefixIcon: Icon(Icons.search_rounded, size: 20)),
          ),
          const SizedBox(height: 14),
          if (_error != null) LoadError(message: _error!, onRetry: _load),
          if (_rows == null && _error == null)
            const Padding(padding: EdgeInsets.all(60), child: Center(child: CircularProgressIndicator()))
          else if (list.isEmpty && _error == null)
            const EmptyState(icon: Icons.receipt_long_outlined, text: 'لا توجد فواتير مطابقة')
          else
            GlassCard(
              padding: EdgeInsets.zero,
              child: Column(children: [
                for (var i = 0; i < list.length; i++) ...[
                  if (i > 0) const Divider(height: 1),
                  _tile(list[i]),
                ],
              ]),
            ),
        ],
      ),
    );
  }

  Widget _tile(_Row r) {
    final repair = r.kind == 'repair';
    final c = repair ? const Color(0xFFD97706) : const Color(0xFF2563EB);
    return InkWell(
      onTap: () => _open(r),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        child: Row(children: [
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(color: c.withValues(alpha: .1), borderRadius: BorderRadius.circular(12)),
            child: Icon(repair ? Icons.build_outlined : Icons.shopping_bag_outlined, size: 18, color: c),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(r.number, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13.5)),
              Text('${r.customer.isEmpty ? 'عميل نقدي' : r.customer}${r.phone != null && r.phone!.isNotEmpty ? ' · ${r.phone}' : ''}',
                  maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 12, color: Pos.muted)),
              Text('${fmtDateTime(r.createdAt)} · ${_payLabels[r.method] ?? r.method ?? '—'}', style: const TextStyle(fontSize: 11, color: Pos.muted)),
            ]),
          ),
          SoftBadge(repair ? 'إصلاح' : 'منتج', Pos.muted),
          const SizedBox(width: 10),
          PosMoney(r.total, decimals: 0, color: Pos.primary, weight: FontWeight.w900),
          const SizedBox(width: 4),
          const Icon(Icons.chevron_left_rounded, color: Pos.muted),
        ]),
      ),
    );
  }
}
