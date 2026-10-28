import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/api_client.dart';
import '../../models/order.dart';
import '../../state/auth_controller.dart';
import '../../state/order_service.dart';
import '../pos_ui.dart';
import 'order_details_screen.dart';

/// الطلبات — نفس صفحة /orders: بحث، فلتر الحالة، الرف، «تم التسليم»، الحذف للإدارة.
class OrdersScreen extends StatefulWidget {
  const OrdersScreen({super.key});

  @override
  State<OrdersScreen> createState() => _OrdersScreenState();
}

class _OrdersScreenState extends State<OrdersScreen> {
  List<Order>? _orders;
  String? _error;
  String _q = '';
  String _status = 'all';
  final _shelf = <String, TextEditingController>{};
  final _busy = <String>{};

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    for (final c in _shelf.values) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _load() async {
    final me = context.read<AuthController>().employee!;
    try {
      final list = await context.read<OrderService>().list(me);
      if (mounted) {
        setState(() {
          _orders = list;
          _error = null;
        });
      }
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    }
  }

  Future<void> _patch(Order o, Map<String, dynamic> patch, String okMsg) async {
    final me = context.read<AuthController>().employee!;
    setState(() => _busy.add(o.id));
    try {
      final updated = await context.read<OrderService>().update(me, o, patch);
      if (!mounted) return;
      setState(() => _orders = _orders!.map((x) => x.id == o.id ? Order({...x.raw, ...updated.raw}) : x).toList());
      toast(context, okMsg);
    } on ApiException catch (e) {
      if (mounted) toast(context, 'فشل التحديث: ${e.message}', error: true);
    } finally {
      if (mounted) setState(() => _busy.remove(o.id));
    }
  }

  Future<void> _delete(Order o) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (c) => AlertDialog(
        title: Text('حذف الطلب ${o.number}؟'),
        content: const Text('هذا الإجراء نهائي ولا يمكن التراجع عنه. سيُحذف الطلب بكل بياناته بشكل كامل.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(c, false), child: const Text('إلغاء')),
          FilledButton(
              style: FilledButton.styleFrom(backgroundColor: Pos.destructive),
              onPressed: () => Navigator.pop(c, true),
              child: const Text('نعم، احذف')),
        ],
      ),
    );
    if (ok != true || !mounted) return;
    final me = context.read<AuthController>().employee!;
    try {
      await context.read<OrderService>().delete(me, o);
      if (!mounted) return;
      setState(() => _orders!.removeWhere((x) => x.id == o.id));
      toast(context, 'تم حذف الطلب');
    } on ApiException catch (e) {
      if (mounted) toast(context, e.message, error: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    final me = context.watch<AuthController>().employee!;
    final isStaff = me.role == 'staff';
    final canDelete = {'owner', 'admin', 'manager'}.contains(me.role);
    final q = _q.trim().toLowerCase();
    final list = (_orders ?? const <Order>[]).where((o) {
      final mq = q.isEmpty ||
          o.number.toLowerCase().contains(q) ||
          o.customerName.toLowerCase().contains(q) ||
          (o.customerPhone ?? '').contains(q);
      return mq && (_status == 'all' || o.statusRaw == _status);
    }).toList();

    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
        physics: const AlwaysScrollableScrollPhysics(),
        children: [
          PageHeader(title: 'الطلبات', subtitle: '${_orders?.length ?? 0} طلب إجمالاً', icon: Icons.format_list_bulleted_rounded, tone: Tone.indigo),
          Row(children: [
            Expanded(
              child: TextField(
                onChanged: (v) => setState(() => _q = v),
                decoration: const InputDecoration(hintText: 'بحث برقم الطلب أو الاسم أو الهاتف...', prefixIcon: Icon(Icons.search_rounded, size: 20)),
              ),
            ),
            const SizedBox(width: 10),
            DecoratedBox(
              decoration: BoxDecoration(color: const Color(0x8CFFFFFF), borderRadius: BorderRadius.circular(12), border: Border.all(color: const Color(0x477882A0))),
              child: DropdownButtonHideUnderline(
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 10),
                  child: DropdownButton<String>(
                    value: _status,
                    borderRadius: BorderRadius.circular(14),
                    items: [
                      const DropdownMenuItem(value: 'all', child: Text('كل الحالات')),
                      for (final s in OrderStatus.values) DropdownMenuItem(value: s.db, child: Text(s.label)),
                    ],
                    onChanged: (v) => setState(() => _status = v ?? 'all'),
                  ),
                ),
              ),
            ),
          ]),
          const SizedBox(height: 16),
          if (_error != null) LoadError(message: _error!, onRetry: _load),
          if (_orders == null && _error == null)
            const Padding(padding: EdgeInsets.all(60), child: Center(child: CircularProgressIndicator()))
          else if (list.isEmpty && _error == null)
            const EmptyState(icon: Icons.format_list_bulleted_rounded, text: 'لا توجد طلبات')
          else
            for (final o in list) _card(o, isStaff, canDelete),
        ],
      ),
    );
  }

  Widget _card(Order o, bool isStaff, bool canDelete) {
    final st = o.status;
    final busy = _busy.contains(o.id);
    final shelfCtl = _shelf.putIfAbsent(o.id, TextEditingController.new);
    return GlassCard(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(14),
      child: Column(children: [
        Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Expanded(
            child: InkWell(
              borderRadius: BorderRadius.circular(12),
              onTap: () async {
                await Navigator.of(context).push(MaterialPageRoute(builder: (_) => OrderDetailsScreen(orderId: o.id)));
                _load();
              },
              child: Row(children: [
                _thumb(o),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Wrap(spacing: 8, runSpacing: 4, crossAxisAlignment: WrapCrossAlignment.center, children: [
                      Text(o.number, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14, fontFeatures: [FontFeature.tabularFigures()])),
                      SoftBadge(st.label, st.color, icon: st.icon),
                    ]),
                    const SizedBox(height: 3),
                    Text('${o.customerName} • ${o.itemLabel} × ${o.quantity}',
                        maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 13, color: Pos.muted)),
                    Text('${fmtDateTime(o.createdAt)} • ${o.employeeName ?? '—'}',
                        maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 11.5, color: Pos.muted)),
                  ]),
                ),
              ]),
            ),
          ),
          const SizedBox(width: 8),
          Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
            if (!isStaff) ...[
              PosMoney(o.total, size: 17, weight: FontWeight.w700),
              const SizedBox(height: 4),
              SoftBadge(o.isPaid ? 'مدفوع' : 'غير مدفوع', o.isPaid ? Pos.green : Pos.red),
            ],
            if (canDelete && !o.isZatcaLocked) ...[
              const SizedBox(height: 6),
              SizedBox(
                height: 28,
                child: OutlineSmall(label: 'حذف', icon: Icons.delete_outline_rounded, color: Pos.destructive, onPressed: () => _delete(o)),
              ),
            ],
            if (canDelete && o.isZatcaLocked) ...[
              const SizedBox(height: 6),
              const SoftBadge('مُبلَّغة لزاتكا — للقراءة فقط', Pos.muted),
            ],
          ]),
        ]),
        if (st == OrderStatus.ready || (st == OrderStatus.completed && o.shelf != null)) ...[
          const Divider(height: 22),
          Wrap(spacing: 8, runSpacing: 8, crossAxisAlignment: WrapCrossAlignment.center, children: [
            if (st == OrderStatus.ready && o.shelf == null) ...[
              const Icon(Icons.layers_outlined, size: 18, color: Pos.amber),
              SizedBox(
                width: 190,
                child: TextField(controller: shelfCtl, onChanged: (_) => setState(() {}), decoration: const InputDecoration(hintText: 'رقم الرف / مكان التخزين')),
              ),
              PrimaryButton(
                label: 'حفظ الرف',
                color: const Color(0xFFF59E0B),
                busy: busy,
                onPressed: shelfCtl.text.trim().isEmpty
                    ? null
                    : () {
                        final v = shelfCtl.text.trim();
                        shelfCtl.clear();
                        _patch(o, {'shelf_location': v}, 'تم حفظ الرف');
                      },
              ),
            ],
            if (o.shelf != null) SoftBadge('رف: ${o.shelf}', Pos.amber, icon: Icons.layers_outlined),
            if (st == OrderStatus.ready)
              PrimaryButton(
                label: 'تم التسليم',
                icon: Icons.local_shipping_outlined,
                color: const Color(0xFF059669),
                busy: busy,
                onPressed: () => _patch(o, {'status': 'completed'}, 'تم تسليم الطلب'),
              ),
          ]),
        ],
      ]),
    );
  }

  Widget _thumb(Order o) {
    final url = o.photos.isEmpty ? null : o.photos.first;
    return ClipRRect(
      borderRadius: BorderRadius.circular(12),
      child: Container(
        width: 48,
        height: 48,
        color: const Color(0x1A7882A0),
        child: url == null
            ? const Icon(Icons.inventory_2_outlined, color: Pos.muted, size: 22)
            : Image.network(url, fit: BoxFit.cover, errorBuilder: (_, __, ___) => const Icon(Icons.inventory_2_outlined, color: Pos.muted)),
      ),
    );
  }
}
