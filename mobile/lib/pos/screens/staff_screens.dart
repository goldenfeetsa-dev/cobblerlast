import 'dart:async';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/api_client.dart';
import '../../core/rest.dart';
import '../../models/order.dart';
import '../../state/auth_controller.dart';
import '../../state/order_service.dart';
import '../pos_ui.dart';

// ألوان الحالات في شاشة الفني — نفس STATUS في StaffOrders.jsx
const _st = {
  'pending': ('قيد الانتظار', Color(0xFFF59E0B), Color(0xFFFEF3C7), 'in_progress', 'ابدأ العمل ▶'),
  'in_progress': ('جارٍ التنفيذ', Color(0xFF3B82F6), Color(0xFFDBEAFE), 'ready', 'تم الإنجاز ✅'),
  'ready': ('جاهز للاستلام', Color(0xFF10B981), Color(0xFFD1FAE5), null, null),
  'completed': ('مكتمل', Color(0xFF6B7280), Color(0xFFF3F4F6), null, null),
  'cancelled': ('ملغى', Color(0xFFEF4444), Color(0xFFFEE2E2), null, null),
};

const _cols = 'id,order_number,customer_name,item_type,description,notes,status,created_at,shelf_location,photos,order_items';

/// مهامي — شاشة الفني (نفس /staff): بدون أسعار ولا جوال العميل، تحديث كل 30 ثانية.
class StaffTasksScreen extends StatefulWidget {
  const StaffTasksScreen({super.key});

  @override
  State<StaffTasksScreen> createState() => _StaffTasksScreenState();
}

class _StaffTasksScreenState extends State<StaffTasksScreen> {
  List<Order>? _orders;
  String? _error;
  String _q = '';
  bool _activeOnly = true;
  final _busy = <String>{};
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _load();
    _timer = Timer.periodic(const Duration(seconds: 30), (_) => _load());
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  Future<void> _load() async {
    final me = context.read<AuthController>().employee!;
    final filters = <String, String>{
      if (me.branchId != null) 'branch_id': 'eq.${me.branchId}',
      if (_activeOnly) 'status': 'in.(pending,in_progress)',
    };
    try {
      final rows = await context.read<Rest>().select('orders', select: _cols, filters: filters, order: 'created_at.asc', limit: 100);
      if (mounted) {
        setState(() {
          _orders = rows.map(Order.new).toList();
          _error = null;
        });
      }
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    }
  }

  Future<void> _advance(Order o, String next) async {
    final me = context.read<AuthController>().employee!;
    setState(() => _busy.add(o.id));
    try {
      await context.read<OrderService>().update(me, o, {'status': next}, page: 'مهامي');
      if (!mounted) return;
      toast(context, '✅ تم تحديث حالة الطلب');
      await _load();
    } on ApiException {
      if (mounted) toast(context, 'فشل التحديث', error: true);
    } finally {
      if (mounted) setState(() => _busy.remove(o.id));
    }
  }

  @override
  Widget build(BuildContext context) {
    final me = context.watch<AuthController>().employee!;
    final q = _q.trim();
    final list = (_orders ?? const <Order>[]).where((o) =>
        q.isEmpty || o.number.contains(q) || o.customerName.contains(q) || (o.description ?? '').contains(q) || (o.shelf ?? '').contains(q)).toList();
    final pending = (_orders ?? []).where((o) => o.statusRaw == 'pending').length;
    final inProg = (_orders ?? []).where((o) => o.statusRaw == 'in_progress').length;

    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
        physics: const AlwaysScrollableScrollPhysics(),
        children: [
          Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 680),
              child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                PageHeader(title: 'مهامك اليوم', subtitle: 'مرحباً ${me.name}', icon: Icons.content_cut_rounded, tone: Tone.blue),
                Row(children: [
                  Expanded(child: _stat('بانتظار البدء', pending, const Color(0xFFF59E0B), const Color(0xFFFEF3C7), Icons.schedule_rounded)),
                  const SizedBox(width: 12),
                  Expanded(child: _stat('جارٍ التنفيذ', inProg, const Color(0xFF3B82F6), const Color(0xFFDBEAFE), Icons.inventory_2_outlined)),
                ]),
                const SizedBox(height: 14),
                Row(children: [
                  Expanded(
                    child: TextField(
                      onChanged: (v) => setState(() => _q = v),
                      decoration: const InputDecoration(hintText: 'ابحث برقم الطلب أو الوصف...', prefixIcon: Icon(Icons.search_rounded, size: 20)),
                    ),
                  ),
                  const SizedBox(width: 8),
                  PillChip(
                    label: _activeOnly ? 'النشطة' : 'الكل',
                    selected: _activeOnly,
                    onTap: () {
                      setState(() => _activeOnly = !_activeOnly);
                      _load();
                    },
                  ),
                ]),
                const SizedBox(height: 14),
                if (_error != null) LoadError(message: _error!, onRetry: _load),
                if (_orders == null && _error == null)
                  const Padding(padding: EdgeInsets.all(50), child: Center(child: CircularProgressIndicator()))
                else if (list.isEmpty && _error == null)
                  const EmptyState(icon: Icons.check_circle_outline_rounded, text: 'لا توجد طلبات نشطة', sub: 'أحسنت! كل المهام منجزة 🎉')
                else
                  for (final o in list) _card(o),
              ]),
            ),
          ),
        ],
      ),
    );
  }

  Widget _stat(String label, int n, Color c, Color bg, IconData icon) => Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(14), border: Border.all(color: c.withValues(alpha: .2))),
        child: Row(children: [
          Icon(icon, color: c, size: 26),
          const SizedBox(width: 10),
          Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text('$n', style: TextStyle(fontSize: 24, fontWeight: FontWeight.w900, color: c)),
            Text(label, style: TextStyle(fontSize: 12, color: c)),
          ]),
        ]),
      );

  Widget _card(Order o) {
    final st = _st[o.statusRaw] ?? _st['pending']!;
    final urgent = o.createdAt != null &&
        DateTime.now().difference(o.createdAt!).inHours > 24 &&
        !{'completed', 'cancelled'}.contains(o.statusRaw);
    final busy = _busy.contains(o.id);
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: urgent ? const Color(0xFFFFF8F8) : Colors.white,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: urgent ? const Color(0xFFFECACA) : const Color(0xFFF1F2F4)),
        boxShadow: Pos.shadow,
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
          color: st.$3,
          child: Row(children: [
            Text(o.number, style: TextStyle(fontWeight: FontWeight.w900, color: st.$2, fontSize: 13.5)),
            if (urgent) ...[
              const SizedBox(width: 6),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                decoration: BoxDecoration(color: const Color(0xFFEF4444), borderRadius: BorderRadius.circular(99)),
                child: const Text('عاجل ⚡', style: TextStyle(color: Colors.white, fontSize: 10.5, fontWeight: FontWeight.w700)),
              ),
            ],
            const Spacer(),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
              decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(99), border: Border.all(color: st.$2.withValues(alpha: .25))),
              child: Text(st.$1, style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w700, color: st.$2)),
            ),
          ]),
        ),
        Padding(
          padding: const EdgeInsets.all(14),
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Row(children: [
              Expanded(child: Text('👤 ${o.customerName}', style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 15.5))),
              TextButton(
                style: TextButton.styleFrom(backgroundColor: const Color(0xFFFEF3C7), foregroundColor: const Color(0xFF92400E), shape: const StadiumBorder(), visualDensity: VisualDensity.compact),
                onPressed: () async {
                  await Navigator.of(context).push(MaterialPageRoute(builder: (_) => StaffOrderDetailScreen(orderId: o.id)));
                  _load();
                },
                child: const Text('التفاصيل والناقص ←', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700)),
              ),
            ]),
            Text('${itemEmoji[o.itemType] ?? '📦'} ${o.itemLabel}', style: const TextStyle(fontWeight: FontWeight.w700)),
            for (var i = 0; i < o.items.length; i++) _pieceBox(o.items[i], i),
            if (o.description != null || o.notes != null)
              Container(
                margin: const EdgeInsets.only(top: 8),
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(color: const Color(0xFFF9FAFB), borderRadius: BorderRadius.circular(10)),
                child: Text(o.description ?? o.notes!, style: const TextStyle(fontSize: 13, color: Color(0xFF4B5563), height: 1.5)),
              ),
            if (o.shelf != null)
              Padding(
                padding: const EdgeInsets.only(top: 8),
                child: Text.rich(TextSpan(children: [
                  const TextSpan(text: 'الرف: ', style: TextStyle(color: Pos.muted)),
                  TextSpan(text: o.shelf, style: const TextStyle(fontWeight: FontWeight.w700)),
                ])),
              ),
            if (o.photos.isNotEmpty)
              SizedBox(
                height: 72,
                child: ListView(
                  scrollDirection: Axis.horizontal,
                  padding: const EdgeInsets.only(top: 8),
                  children: [
                    for (final u in o.photos)
                      Padding(
                        padding: const EdgeInsetsDirectional.only(end: 8),
                        child: ClipRRect(borderRadius: BorderRadius.circular(10), child: Image.network(u, width: 64, height: 64, fit: BoxFit.cover)),
                      ),
                  ],
                ),
              ),
            if (st.$4 != null) ...[
              const SizedBox(height: 10),
              PrimaryButton(
                label: st.$5!,
                expand: true,
                busy: busy,
                color: st.$4 == 'ready' ? const Color(0xFF10B981) : const Color(0xFF3B82F6),
                onPressed: () => _advance(o, st.$4!),
              ),
            ],
          ]),
        ),
      ]),
    );
  }

  Widget _pieceBox(OrderItem it, int i) => Container(
        margin: const EdgeInsets.only(top: 6),
        padding: const EdgeInsets.all(10),
        decoration: BoxDecoration(color: const Color(0x99EFF6FF), borderRadius: BorderRadius.circular(10), border: Border.all(color: const Color(0xFFDBEAFE))),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            Expanded(child: Text('قطعة ${i + 1} — ${itemLabels[it.itemType] ?? it.itemType}', style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13))),
            if (it.technician != null) Text('👤 ${it.technician}', style: const TextStyle(fontSize: 12, color: Color(0xFF1D4ED8))),
          ]),
          if (it.services.isNotEmpty) ...[
            const SizedBox(height: 5),
            Wrap(spacing: 4, runSpacing: 4, children: [
              for (final s in it.services)
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                  decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(99), border: Border.all(color: const Color(0xFFE5E7EB))),
                  child: Text(s, style: const TextStyle(fontSize: 11)),
                ),
            ]),
          ],
          if ((it.description ?? '').isNotEmpty) Text(it.description!, style: const TextStyle(fontSize: 12, color: Pos.muted)),
        ]),
      );
}

/// صفحة الطلب للفني (نفس /staff/:id): الناقص/الملاحظات، الرف، ابدأ/أنجز.
class StaffOrderDetailScreen extends StatefulWidget {
  const StaffOrderDetailScreen({super.key, required this.orderId});
  final String orderId;

  @override
  State<StaffOrderDetailScreen> createState() => _StaffOrderDetailScreenState();
}

class _StaffOrderDetailScreenState extends State<StaffOrderDetailScreen> {
  Order? _o;
  String? _error;
  bool _saving = false;
  final _notes = TextEditingController();
  final _shelf = TextEditingController();

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _notes.dispose();
    _shelf.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final row = await context.read<Rest>().single('orders', widget.orderId,
          select: '$_cols,delivery_date,work_started_at,work_done_at,worker_name');
      if (!mounted) return;
      setState(() {
        _o = row == null ? null : Order(row);
        _error = row == null ? 'الطلب غير موجود' : null;
        _notes.text = _o?.notes ?? '';
        _shelf.text = _o?.shelf ?? '';
      });
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    }
  }

  Future<void> _patch(Map<String, dynamic> p, String msg) async {
    final me = context.read<AuthController>().employee!;
    setState(() => _saving = true);
    try {
      final o = await context.read<OrderService>().update(me, _o!, p, page: 'مهامي');
      if (!mounted) return;
      setState(() => _o = Order({..._o!.raw, ...o.raw}));
      toast(context, msg);
    } on ApiException {
      if (mounted) toast(context, 'تعذّر الحفظ', error: true);
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final o = _o;
    final next = o?.statusRaw == 'pending'
        ? ('in_progress', 'ابدأ العمل ▶', const Color(0xFF3B82F6))
        : o?.statusRaw == 'in_progress'
            ? ('ready', 'تم الإنجاز ✅', const Color(0xFF10B981))
            : null;
    final dur = o?.workStartedAt == null
        ? null
        : (o!.workDoneAt ?? (o.statusRaw == 'in_progress' ? DateTime.now() : o.workStartedAt!)).difference(o.workStartedAt!);

    return Scaffold(
      backgroundColor: Colors.transparent,
      body: PosBackground(
        child: SafeArea(
          child: _error != null
              ? Padding(padding: const EdgeInsets.all(16), child: LoadError(message: _error!, onRetry: _load))
              : o == null
                  ? const Center(child: CircularProgressIndicator())
                  : ListView(
                      padding: const EdgeInsets.all(16),
                      children: [
                        Align(
                          alignment: AlignmentDirectional.centerStart,
                          child: TextButton.icon(onPressed: () => Navigator.pop(context), icon: const Icon(Icons.arrow_forward_rounded, size: 18), label: const Text('مهامي')),
                        ),
                        GlassCard(
                          color: Colors.white,
                          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                            Row(children: [
                              Text(o.number, style: const TextStyle(fontSize: 12, color: Pos.muted)),
                              const Spacer(),
                              SoftBadge(o.status.label, o.status.color),
                            ]),
                            const SizedBox(height: 4),
                            Text('👤 ${o.customerName}', style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w900)),
                            Text('${itemEmoji[o.itemType] ?? '📦'} ${o.itemLabel}${o.deliveryDate != null ? ' · التسليم ${o.raw['delivery_date']}' : ''}',
                                style: const TextStyle(color: Pos.muted, fontSize: 13)),
                            if (dur != null) Text('⏱ مدة العمل: ${fmtDuration(dur)}', style: const TextStyle(fontSize: 13)),
                          ]),
                        ),
                        for (var i = 0; i < o.items.length; i++)
                          GlassCard(
                            margin: const EdgeInsets.only(top: 10),
                            color: const Color(0xCCEFF6FF),
                            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                              Text('قطعة ${i + 1} — ${itemLabels[o.items[i].itemType] ?? o.items[i].itemType}', style: const TextStyle(fontWeight: FontWeight.w700)),
                              if (o.items[i].services.isNotEmpty) ...[
                                const SizedBox(height: 6),
                                Wrap(spacing: 5, runSpacing: 5, children: [for (final s in o.items[i].services) SoftBadge(s, Pos.primary)]),
                              ],
                              if ((o.items[i].description ?? '').isNotEmpty) Text(o.items[i].description!, style: const TextStyle(fontSize: 12.5, color: Pos.muted)),
                            ]),
                          ),
                        if (o.description != null)
                          GlassCard(margin: const EdgeInsets.only(top: 10), child: Text(o.description!, style: const TextStyle(fontSize: 13.5))),
                        if (o.photos.isNotEmpty)
                          SizedBox(
                            height: 108,
                            child: ListView(scrollDirection: Axis.horizontal, padding: const EdgeInsets.only(top: 10), children: [
                              for (final u in o.photos)
                                Padding(
                                  padding: const EdgeInsetsDirectional.only(end: 8),
                                  child: ClipRRect(borderRadius: BorderRadius.circular(12), child: Image.network(u, width: 96, height: 96, fit: BoxFit.cover)),
                                ),
                            ]),
                          ),
                        GlassCard(
                          margin: const EdgeInsets.only(top: 12),
                          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                            const Text('الناقص / الملاحظات', style: TextStyle(fontWeight: FontWeight.w700)),
                            const SizedBox(height: 8),
                            TextField(
                              controller: _notes,
                              maxLines: 4,
                              maxLength: 2000,
                              onChanged: (_) => setState(() {}),
                              decoration: const InputDecoration(hintText: 'مثال: ناقص الشكشك — العميل يريد تغييره', counterText: ''),
                            ),
                            const SizedBox(height: 8),
                            PrimaryButton(
                              label: 'حفظ الملاحظات',
                              expand: true,
                              color: const Color(0xFFB45309),
                              busy: _saving,
                              onPressed: _notes.text == (o.notes ?? '') ? null : () => _patch({'notes': _notes.text}, 'تم حفظ الملاحظات'),
                            ),
                          ]),
                        ),
                        GlassCard(
                          margin: const EdgeInsets.only(top: 12),
                          child: Row(children: [
                            const Icon(Icons.inventory_2_outlined, size: 18),
                            const SizedBox(width: 6),
                            const Text('الرف', style: TextStyle(fontWeight: FontWeight.w700)),
                            const SizedBox(width: 10),
                            Expanded(
                              child: TextField(
                                controller: _shelf,
                                maxLength: 30,
                                onChanged: (_) => setState(() {}),
                                decoration: const InputDecoration(hintText: 'مثال: A3', counterText: ''),
                              ),
                            ),
                            const SizedBox(width: 8),
                            PrimaryButton(
                              label: 'حفظ',
                              color: const Color(0xFFB45309),
                              busy: _saving,
                              onPressed: _shelf.text == (o.shelf ?? '') ? null : () => _patch({'shelf_location': _shelf.text}, 'تم حفظ الرف'),
                            ),
                          ]),
                        ),
                        if (next != null) ...[
                          const SizedBox(height: 14),
                          PrimaryButton(
                            label: next.$2,
                            expand: true,
                            color: next.$3,
                            busy: _saving,
                            onPressed: () => _patch({'status': next.$1}, next.$1 == 'ready' ? 'تم الإنجاز ✅' : 'بدأ العمل'),
                          ),
                        ],
                      ],
                    ),
        ),
      ),
    );
  }
}
