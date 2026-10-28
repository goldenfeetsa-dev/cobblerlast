import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/api_client.dart';
import '../../core/rest.dart';
import '../../models/order.dart';
import '../pos_ui.dart';
import 'order_details_screen.dart';

/// العملاء — نفس /customers: قائمة، بحث، سجل طلبات العميل، اتصال/واتساب.
class CustomersScreen extends StatefulWidget {
  const CustomersScreen({super.key});

  @override
  State<CustomersScreen> createState() => _CustomersScreenState();
}

class _CustomersScreenState extends State<CustomersScreen> {
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
      final rows = await context.read<Rest>().secureList('customers', limit: 500);
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

  @override
  Widget build(BuildContext context) {
    final q = _q.trim().toLowerCase();
    final list = (_rows ?? const []).where((c) {
      if (q.isEmpty) return true;
      return '${c['name'] ?? ''}'.toLowerCase().contains(q) || '${c['phone'] ?? ''}'.contains(q) || '${c['email'] ?? ''}'.toLowerCase().contains(q);
    }).toList();

    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
        physics: const AlwaysScrollableScrollPhysics(),
        children: [
          PageHeader(title: 'العملاء', subtitle: '${_rows?.length ?? 0} عميل', icon: Icons.groups_rounded, tone: Tone.blue),
          TextField(
            onChanged: (v) => setState(() => _q = v),
            decoration: const InputDecoration(hintText: 'بحث بالاسم أو الجوال...', prefixIcon: Icon(Icons.search_rounded, size: 20)),
          ),
          const SizedBox(height: 14),
          if (_error != null) LoadError(message: _error!, onRetry: _load),
          if (_rows == null && _error == null)
            const Padding(padding: EdgeInsets.all(60), child: Center(child: CircularProgressIndicator()))
          else if (list.isEmpty && _error == null)
            const EmptyState(icon: Icons.groups_outlined, text: 'لا يوجد عملاء')
          else
            LayoutBuilder(builder: (context, c) {
              final cols = c.maxWidth >= 1000 ? 3 : c.maxWidth >= 640 ? 2 : 1;
              return Wrap(spacing: 12, runSpacing: 12, children: [
                for (final cu in list)
                  SizedBox(width: (c.maxWidth - (cols - 1) * 12) / cols, child: _card(cu)),
              ]);
            }),
        ],
      ),
    );
  }

  Widget _card(Map<String, dynamic> c) {
    final name = '${c['name'] ?? 'عميل'}';
    final phone = c['phone']?.toString();
    final orders = (c['total_orders'] as num?)?.toInt() ?? 0;
    final spent = (c['total_spent'] as num?) ?? 0;
    final points = (c['loyalty_points'] as num?)?.toInt() ?? 0;
    return GlassCard(
      onTap: phone == null ? null : () => _history(name, phone),
      child: Row(children: [
        CircleAvatar(
          radius: 21,
          backgroundColor: Pos.primary.withValues(alpha: .12),
          child: Text(name.isEmpty ? '؟' : name.characters.first, style: const TextStyle(color: Pos.primary, fontWeight: FontWeight.w800)),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(name, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14.5)),
            if (phone != null) Directionality(textDirection: TextDirection.ltr, child: Text(phone, style: const TextStyle(fontSize: 12.5, color: Pos.muted))),
            const SizedBox(height: 4),
            Wrap(spacing: 6, runSpacing: 4, children: [
              SoftBadge('$orders طلب', Pos.primary),
              SoftBadge('${spent.toStringAsFixed(0)} ر.س', Pos.green),
              if (points > 0) SoftBadge('$points نقطة', Pos.amber),
            ]),
          ]),
        ),
        if (phone != null)
          IconButton(
            tooltip: 'اتصال',
            onPressed: () => launchUrl(Uri.parse('tel:$phone')),
            icon: const Icon(Icons.call_rounded, color: Pos.primary),
          ),
      ]),
    );
  }

  Future<void> _history(String name, String phone) async {
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (_) => _HistorySheet(name: name, phone: phone),
    );
  }
}

class _HistorySheet extends StatefulWidget {
  const _HistorySheet({required this.name, required this.phone});
  final String name;
  final String phone;

  @override
  State<_HistorySheet> createState() => _HistorySheetState();
}

class _HistorySheetState extends State<_HistorySheet> {
  List<Order>? _orders;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final r = await context.read<Rest>().select('orders',
          select: orderListColumns, filters: {'customer_phone': 'eq.${widget.phone}'}, order: 'created_at.desc', limit: 100);
      if (mounted) setState(() => _orders = r.map(Order.new).toList());
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    }
  }

  @override
  Widget build(BuildContext context) {
    final total = (_orders ?? []).where((o) => o.statusRaw != 'cancelled').fold<double>(0, (s, o) => s + o.total);
    return SizedBox(
      height: MediaQuery.sizeOf(context).height * .75,
      child: Column(children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(20, 0, 20, 10),
          child: Row(children: [
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(widget.name, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
                Text('سجل الطلبات · ${_orders?.length ?? '…'} طلب', style: const TextStyle(color: Pos.muted, fontSize: 12.5)),
              ]),
            ),
            PosMoney(total, size: 17, weight: FontWeight.w800),
          ]),
        ),
        const Divider(height: 1),
        Expanded(
          child: _error != null
              ? Center(child: Text(_error!))
              : _orders == null
                  ? const Center(child: CircularProgressIndicator())
                  : _orders!.isEmpty
                      ? const EmptyState(icon: Icons.receipt_long_outlined, text: 'لا توجد طلبات لهذا العميل')
                      : ListView.separated(
                          padding: const EdgeInsets.all(12),
                          itemCount: _orders!.length,
                          separatorBuilder: (_, __) => const SizedBox(height: 6),
                          itemBuilder: (_, i) {
                            final o = _orders![i];
                            return ListTile(
                              tileColor: const Color(0x0F7882A0),
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                              title: Text(o.number, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13.5)),
                              subtitle: Text('${o.itemLabel} · ${fmtDateTime(o.createdAt)}', style: const TextStyle(fontSize: 12)),
                              trailing: Column(mainAxisAlignment: MainAxisAlignment.center, crossAxisAlignment: CrossAxisAlignment.end, children: [
                                PosMoney(o.total, size: 13.5),
                                SoftBadge(o.status.label, o.status.color),
                              ]),
                              onTap: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => OrderDetailsScreen(orderId: o.id))),
                            );
                          },
                        ),
        ),
      ]),
    );
  }
}
