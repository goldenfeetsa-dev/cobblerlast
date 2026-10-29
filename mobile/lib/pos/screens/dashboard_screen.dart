import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/api_client.dart';
import '../../core/rest.dart';
import '../../models/order.dart';
import '../../state/auth_controller.dart';
import '../pos_ui.dart';
import 'order_details_screen.dart';

/// عملية موحّدة (إصلاح أو بيع منتج) — نفس unifyTransactions في src/lib/analytics.js.
class _Tx {
  _Tx({required this.kind, required this.number, required this.amount, this.method, this.paid = false,
      this.status, this.createdAt, this.branch, this.customer, this.orderId, this.subtotal});
  final String kind; // repair | sale
  final String number;
  final double amount;
  final String? method;
  final bool paid;
  final String? status;
  final DateTime? createdAt;
  final String? branch;
  final String? customer;
  final String? orderId;
  final double? subtotal;
}

enum _Period { today, week, month, year, all }

extension on _Period {
  String get label => const {'today': 'اليوم', 'week': 'الأسبوع', 'month': 'الشهر', 'year': 'السنة', 'all': 'الكل'}[name]!;
  DateTime? get start {
    final n = DateTime.now();
    final d0 = DateTime(n.year, n.month, n.day);
    return switch (this) {
      _Period.today => d0,
      _Period.week => d0.subtract(Duration(days: n.weekday % 7)), // الأسبوع يبدأ الأحد
      _Period.month => DateTime(n.year, n.month, 1),
      _Period.year => DateTime(n.year, 1, 1),
      _Period.all => null,
    };
  }
}

/// لوحة التحكم — نفس /pos.
class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key, required this.onOpenOrders});
  final VoidCallback onOpenOrders;

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  List<_Tx>? _all;
  List<Order> _orders = const [];
  int _customers = 0;
  String? _error;
  _Period _period = _Period.month;
  _Period _finPeriod = _Period.today;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final rest = context.read<Rest>();
    final me = context.read<AuthController>().employee!;
    try {
      final res = await Future.wait([
        rest.select('orders',
            select: 'id,order_number,customer_name,branch_id,branch_name,employee_name,total_price,subtotal,payment_method,payment_status,status,created_at',
            order: 'created_at.desc',
            limit: 500),
        rest.select('sales_invoices',
            select: 'id,invoice_number,branch_id,branch_name,total,subtotal,payment_method,payment_status,created_at,items', order: 'created_at.desc', limit: 500),
      ]);
      // عدد العملاء ملف كبير — يتحمل بالخلفية بدون ما يأخّر بقية الأرقام
      rest.secureList('customers', limit: 2000).then((c) {
        if (mounted) setState(() => _customers = c.length);
      }).catchError((_) {});
      final admin = {'admin', 'owner', 'manager'}.contains(me.role);
      bool inBranch(Map<String, dynamic> r) => admin || me.branchId == null || r['branch_id'] == null || r['branch_id'] == me.branchId;
      final orders = res[0].where(inBranch).map(Order.new).toList();
      final sales = res[1].where(inBranch).toList();
      final tx = <_Tx>[
        for (final o in orders)
          if (o.statusRaw != 'cancelled' && o.statusRaw != 'returned')
            _Tx(kind: 'repair', number: o.number, amount: o.total, method: o.paymentMethod, paid: o.isPaid, status: o.statusRaw,
                createdAt: o.createdAt, branch: o.raw['branch_name']?.toString(), customer: o.customerName, orderId: o.id, subtotal: o.subtotal),
        for (final s in sales)
          if (!((s['items'] is List) && (s['items'] as List).any((it) => it is Map && it.containsKey('order_id'))))
            _Tx(kind: 'sale', number: '${s['invoice_number']}', amount: (s['total'] as num?)?.toDouble() ?? 0, method: s['payment_method']?.toString(),
                paid: (s['payment_status'] ?? 'paid') == 'paid', status: 'completed', createdAt: DateTime.tryParse('${s['created_at']}')?.toLocal(),
                branch: s['branch_name']?.toString(), subtotal: (s['subtotal'] as num?)?.toDouble()),
      ];
      if (!mounted) return;
      setState(() {
        _all = tx;
        _orders = orders;
        _error = null;
      });
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    }
  }

  @override
  Widget build(BuildContext context) {
    final me = context.watch<AuthController>().employee!;
    final admin = {'admin', 'owner', 'manager'}.contains(me.role);
    final start = _period.start;
    final tx = (_all ?? const <_Tx>[]).where((t) => start == null || (t.createdAt != null && !t.createdAt!.isBefore(start))).toList();
    final orders = _orders.where((o) => start == null || (o.createdAt != null && !o.createdAt!.isBefore(start))).toList();
    final total = tx.fold<double>(0, (s, t) => s + t.amount);
    final exVat = tx.fold<double>(0, (s, t) => s + (t.subtotal ?? t.amount / 1.15));
    final paid = tx.where((t) => t.paid).toList();
    final collected = paid.fold<double>(0, (s, t) => s + t.amount);
    final pendingRepairs = orders.where((o) => o.statusRaw == 'pending' || o.statusRaw == 'in_progress').length;
    final completion = orders.isEmpty ? 0 : (orders.where((o) => o.statusRaw == 'completed').length / orders.length * 100).round();

    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
        physics: const AlwaysScrollableScrollPhysics(),
        children: [
          PageHeader(title: 'مرحباً، ${me.name}', subtitle: 'نظرة عامة على أعمالك'),
          Wrap(spacing: 8, runSpacing: 8, children: [
            for (final p in _Period.values) PillChip(label: p.label, selected: p == _period, onTap: () => setState(() => _period = p)),
          ]),
          const SizedBox(height: 16),
          if (_error != null) LoadError(message: _error!, onRetry: _load),
          if (_all == null && _error == null) const Padding(padding: EdgeInsets.all(40), child: Center(child: CircularProgressIndicator())),
          if (_all != null) ...[
            _grid([
              _stat('إجمالي العمليات', Text('${tx.length}', style: _big), '$pendingRepairs إصلاح قيد الانتظار', Icons.shopping_bag_outlined, Tone.blue, const Color(0x330A84FF)),
              _stat('الإيرادات (شامل الضريبة)', PosMoney(total, size: 30, weight: FontWeight.w600, decimals: 0),
                  'قبل الضريبة ${exVat.toStringAsFixed(0)} · محصَّل ${collected.toStringAsFixed(0)} (${paid.length} عملية مدفوعة)', Icons.account_balance_wallet_outlined, Tone.green, const Color(0x3330D158)),
              _stat('العملاء', Text('$_customers', style: _big), null, Icons.groups_outlined, Tone.orange, const Color(0x33FF9500)),
              _stat('نسبة الإنجاز', Text('$completion%', style: _big), null, Icons.trending_up_rounded, Tone.purple, const Color(0x33AF52DE)),
            ]),
            if (admin) ...[const SizedBox(height: 16), _financial()],
            const SizedBox(height: 16),
            LayoutBuilder(builder: (context, c) {
              final chart = _last7();
              final recent = _recent();
              if (c.maxWidth < 900) return Column(children: [chart, const SizedBox(height: 16), recent]);
              return Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Expanded(flex: 2, child: chart),
                const SizedBox(width: 16),
                Expanded(child: recent),
              ]);
            }),
          ],
        ],
      ),
    );
  }

  static const _big = TextStyle(fontSize: 30, fontWeight: FontWeight.w600, height: 1.1, fontFeatures: [FontFeature.tabularFigures()]);

  Widget _grid(List<Widget> items) => LayoutBuilder(builder: (context, c) {
        final cols = c.maxWidth >= 1000 ? 4 : c.maxWidth >= 560 ? 2 : 1;
        final w = (c.maxWidth - (cols - 1) * 14) / cols;
        return Wrap(spacing: 14, runSpacing: 14, children: [for (final i in items) SizedBox(width: w, child: i)]);
      });

  Widget _stat(String title, Widget value, String? sub, IconData icon, Tone tone, Color tint) {
    return Container(
      height: 150,
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(Pos.radius),
        border: Border.all(color: Pos.glassBorder),
        boxShadow: Pos.shadow,
        gradient: LinearGradient(begin: Alignment.topLeft, end: Alignment.bottomRight, colors: [Pos.glass, Color.alphaBlend(tint, Pos.glass)]),
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Expanded(child: Text(title, style: const TextStyle(fontSize: 13, color: Pos.muted, fontWeight: FontWeight.w500))),
          IosTile(icon, tone),
        ]),
        const Spacer(),
        FittedBox(fit: BoxFit.scaleDown, alignment: AlignmentDirectional.centerStart, child: value),
        const SizedBox(height: 6),
        Text(sub ?? ' ', maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 11.5, color: Pos.muted)),
      ]),
    );
  }

  /// التقرير المالي (نقد / شبكة / الإجمالي) — FinancialReport.jsx.
  Widget _financial() {
    final start = _finPeriod.start;
    final v = (_all ?? []).where((t) => t.createdAt != null && (start == null || !t.createdAt!.isBefore(start)));
    final cash = v.where((t) => t.method == 'cash').fold<double>(0, (s, t) => s + t.amount);
    final net = v.where((t) => t.method == 'network').fold<double>(0, (s, t) => s + t.amount);
    Widget box(String l, double n, IconData i, {bool primary = false}) => Expanded(
          child: Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: primary ? null : const Color(0x1A7882A0),
              gradient: primary ? const LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter, colors: [Pos.primaryTop, Pos.primary]) : null,
              borderRadius: BorderRadius.circular(primary ? 4 : 12),
              border: primary ? null : Border.all(color: Pos.border),
            ),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Icon(i, size: 17, color: primary ? Colors.white : Pos.fg),
              const SizedBox(height: 4),
              Text(l, style: TextStyle(fontSize: 11.5, color: primary ? Colors.white70 : Pos.fg, fontWeight: FontWeight.w500)),
              PosMoney(n, size: 18, weight: FontWeight.w800, decimals: 0, color: primary ? Colors.white : Pos.fg),
            ]),
          ),
        );
    return GlassCard(
      padding: const EdgeInsets.all(18),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        const Row(children: [
          Icon(Icons.account_balance_wallet_outlined, size: 18, color: Pos.primary),
          SizedBox(width: 6),
          Text('التقرير المالي', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
        ]),
        const SizedBox(height: 10),
        Wrap(spacing: 8, children: [
          for (final p in const [_Period.today, _Period.week, _Period.month, _Period.year])
            PillChip(label: p.label, selected: p == _finPeriod, onTap: () => setState(() => _finPeriod = p)),
        ]),
        const SizedBox(height: 14),
        Row(children: [
          box('إجمالي النقد', cash, Icons.payments_outlined),
          const SizedBox(width: 10),
          box('إجمالي الشبكة', net, Icons.credit_card_rounded),
          const SizedBox(width: 10),
          box('الإجمالي', cash + net, Icons.account_balance_wallet_outlined, primary: true),
        ]),
        const SizedBox(height: 8),
        const Text('* الطلبات الملغاة مستبعدة من الحساب', style: TextStyle(fontSize: 10.5, color: Pos.muted)),
      ]),
    );
  }

  Widget _last7() {
    final now = DateTime.now();
    final days = [for (var i = 6; i >= 0; i--) DateTime(now.year, now.month, now.day).subtract(Duration(days: i))];
    final counts = [
      for (final d in days)
        (_all ?? []).where((t) => t.createdAt != null && t.createdAt!.year == d.year && t.createdAt!.month == d.month && t.createdAt!.day == d.day).length
    ];
    final maxC = counts.fold<int>(1, (m, c) => c > m ? c : m);
    const names = ['الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت', 'الأحد'];
    return GlassCard(
      padding: const EdgeInsets.all(18),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        const Text('آخر 7 أيام', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
        const SizedBox(height: 14),
        SizedBox(
          height: 190,
          child: Row(crossAxisAlignment: CrossAxisAlignment.end, children: [
            for (var i = 0; i < days.length; i++)
              Expanded(
                child: Tooltip(
                  message: '${counts[i]} عملية',
                  child: Column(mainAxisAlignment: MainAxisAlignment.end, children: [
                    Text('${counts[i]}', style: const TextStyle(fontSize: 11, color: Pos.muted)),
                    const SizedBox(height: 4),
                    Flexible(
                      child: FractionallySizedBox(
                        heightFactor: (counts[i] / maxC).clamp(.02, 1.0),
                        child: Container(
                          margin: const EdgeInsets.symmetric(horizontal: 6),
                          decoration: const BoxDecoration(color: Pos.primary, borderRadius: BorderRadius.vertical(top: Radius.circular(8))),
                        ),
                      ),
                    ),
                    const SizedBox(height: 6),
                    Text(names[days[i].weekday - 1], style: const TextStyle(fontSize: 10.5, color: Pos.muted)),
                  ]),
                ),
              ),
          ]),
        ),
      ]),
    );
  }

  Widget _recent() {
    final list = [...?_all]..sort((a, b) => (b.createdAt ?? DateTime(0)).compareTo(a.createdAt ?? DateTime(0)));
    return GlassCard(
      padding: const EdgeInsets.all(18),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Row(children: [
          const Expanded(child: Text('أحدث الطلبات', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 15))),
          TextButton(onPressed: widget.onOpenOrders, child: const Text('عرض الكل')),
        ]),
        if (list.isEmpty)
          const Padding(padding: EdgeInsets.all(20), child: Center(child: Text('لا توجد طلبات بعد', style: TextStyle(color: Pos.muted))))
        else
          for (final t in list.take(5))
            InkWell(
              borderRadius: BorderRadius.circular(10),
              onTap: t.orderId == null ? null : () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => OrderDetailsScreen(orderId: t.orderId!))),
              child: Padding(
                padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 4),
                child: Row(children: [
                  Expanded(
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text(t.customer ?? '—', style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13.5)),
                      Text(t.number, style: const TextStyle(fontSize: 11.5, color: Pos.muted)),
                    ]),
                  ),
                  Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
                    PosMoney(t.amount, decimals: 0, weight: FontWeight.w800),
                    SoftBadge(t.kind == 'repair' ? OrderStatus.parse(t.status).label : 'بيع منتج', Pos.muted),
                  ]),
                ]),
              ),
            ),
      ]),
    );
  }
}
