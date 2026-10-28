import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/api_client.dart';
import '../../core/rest.dart';
import '../../models/order.dart';
import '../pos_ui.dart';
import 'employees_screen.dart' show roleBadges;
import 'order_details_screen.dart';

// ───────────────────────── عمليات موحّدة (نفس lib/analytics.js) ─────────────────────────

const _orderTxCols =
    'id,order_number,customer_name,customer_phone,branch_id,branch_name,employee_id,employee_name,total_price,payment_method,payment_status,status,created_at,partner_invoice_id';
const _saleTxCols = 'id,invoice_number,branch_id,branch_name,employee_id,employee_name,total,payment_method,payment_status,created_at,items';

class Tx {
  Tx(this.kind, this.raw)
      : number = '${raw[kind == 'repair' ? 'order_number' : 'invoice_number'] ?? ''}',
        branch = (raw['branch_name'] ?? '').toString().isEmpty ? 'الفرع الرئيسي' : '${raw['branch_name']}',
        employeeId = raw['employee_id']?.toString(),
        employee = raw['employee_name']?.toString(),
        amount = ((raw[kind == 'repair' ? 'total_price' : 'total'] as num?) ?? 0).toDouble(),
        method = raw['payment_method']?.toString(),
        payStatus = raw['payment_status']?.toString() ?? (kind == 'sale' ? 'paid' : null),
        status = kind == 'sale' ? 'completed' : raw['status']?.toString(),
        createdAt = DateTime.tryParse('${raw['created_at']}')?.toLocal();
  final String kind; // repair | sale
  final Map<String, dynamic> raw;
  final String number, branch;
  final String? employeeId, employee, method, payStatus, status;
  final double amount;
  final DateTime? createdAt;
  bool get completed => status == 'completed';
}

bool _isPartnerInvoice(Map<String, dynamic> inv) => inv['items'] is List && (inv['items'] as List).any((it) => it is Map && it['order_id'] != null);

List<Tx> unifyTransactions(List<Map<String, dynamic>> orders, List<Map<String, dynamic>> sales) => [
      for (final o in orders)
        if (!{'cancelled', 'returned'}.contains(o['status'])) Tx('repair', o),
      for (final s in sales)
        if (!_isPartnerInvoice(s)) Tx('sale', s),
    ];

Future<List<Tx>> _loadTx(Rest rest, int limit) async {
  final r = await Future.wait([
    rest.select('orders', select: _orderTxCols, order: 'created_at.desc', limit: limit),
    rest.select('sales_invoices', select: _saleTxCols, order: 'created_at.desc', limit: limit).catchError((_) => <Map<String, dynamic>>[]),
  ]);
  return unifyTransactions(r[0], r[1]);
}

class _BranchSum {
  _BranchSum(this.name);
  final String name;
  double revenue = 0;
  int repairs = 0, sales = 0;
}

List<_BranchSum> _byBranch(List<Tx> tx) {
  final m = <String, _BranchSum>{};
  for (final t in tx) {
    final b = m.putIfAbsent(t.branch, () => _BranchSum(t.branch));
    b.revenue += t.amount;
    if (t.kind == 'repair') {
      b.repairs++;
    } else {
      b.sales++;
    }
  }
  return m.values.toList()..sort((a, b) => b.revenue.compareTo(a.revenue));
}

// ───────────────────────── لوحة المتصدرين ─────────────────────────

/// لوحة المتصدرين — نفس /leaderboard: سباق الفنيين، أفضل فرع، الكاشير حسب
/// إيراد المبيعات، والفنيين حسب الإصلاحات المكتملة فعلاً.
class LeaderboardScreen extends StatefulWidget {
  const LeaderboardScreen({super.key});

  @override
  State<LeaderboardScreen> createState() => _LeaderboardScreenState();
}

class _LeaderboardScreenState extends State<LeaderboardScreen> {
  String _period = 'monthly';
  String _branch = 'all';
  List<Map<String, dynamic>> _emps = const [];
  List<Tx> _tx = const [];
  List<Map<String, dynamic>>? _done;
  List<Map<String, dynamic>> _live = const [];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final rest = context.read<Rest>();
    try {
      final r = await Future.wait<dynamic>([
        rest.select('employees', select: 'id,name,role,branch_id,branch_name,is_active', order: 'created_at.desc', limit: 200),
        _loadTx(rest, 1000),
      ]);
      List<Map<String, dynamic>>? done;
      var live = <Map<String, dynamic>>[];
      try {
        done = await rest.select('orders',
            select: 'id,order_number,item_type,worker_id,worker_name,work_started_at,work_done_at',
            filters: {'work_done_at': 'not.is.null'},
            order: 'work_done_at.desc',
            limit: 2000);
        live = await rest.select('orders',
            select: 'id,order_number,item_type,worker_name,work_started_at',
            filters: {'status': 'eq.in_progress', 'work_started_at': 'not.is.null'},
            order: 'work_started_at.asc',
            limit: 50);
      } on ApiException {
        done = null;
      }
      if (!mounted) return;
      setState(() {
        _emps = r[0] as List<Map<String, dynamic>>;
        _tx = r[1] as List<Tx>;
        _done = done;
        _live = live;
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

  DateTime? get _cutoff {
    final n = DateTime.now();
    return switch (_period) {
      'daily' => DateTime(n.year, n.month, n.day),
      'monthly' => DateTime(n.year, n.month),
      'yearly' => DateTime(n.year),
      _ => null,
    };
  }

  @override
  Widget build(BuildContext context) {
    final cutoff = _cutoff;
    final tx = cutoff == null ? _tx : _tx.where((t) => t.createdAt != null && !t.createdAt!.isBefore(cutoff)).toList();
    final branches = _byBranch(tx);
    final btx = _branch == 'all' ? tx : tx.where((t) => t.branch == _branch).toList();
    final bEmps = _branch == 'all' ? _emps : _emps.where((e) => ((e['branch_name'] ?? '').toString().isEmpty ? 'الفرع الرئيسي' : e['branch_name']) == _branch).toList();

    final stats = [
      for (final e in bEmps)
        () {
          final mine = btx.where((t) => (t.employeeId != null && t.employeeId == '${e['id']}') || t.employee == e['name']).toList();
          final sales = mine.where((t) => t.kind == 'sale');
          final repairs = mine.where((t) => t.kind == 'repair');
          return (
            e: e,
            salesCount: sales.length,
            salesRevenue: sales.fold<double>(0, (s, t) => s + t.amount),
            repairs: repairs.length,
            completed: repairs.where((t) => t.completed).length,
            total: mine.fold<double>(0, (s, t) => s + t.amount),
          );
        }(),
    ];
    final cashiers = stats.where((s) => s.e['role'] == 'cashier').toList()..sort((a, b) => b.salesRevenue.compareTo(a.salesRevenue));
    final techs = stats.where((s) => s.e['role'] == 'staff' || s.e['role'] == null).toList()..sort((a, b) => b.completed.compareTo(a.completed));
    final others = stats.where((s) => !cashiers.contains(s) && !techs.contains(s)).toList()..sort((a, b) => b.total.compareTo(a.total));

    final n = DateTime.now();
    final label = switch (_period) {
      'daily' => 'اليوم — ${n.year}/${n.month.toString().padLeft(2, '0')}/${n.day.toString().padLeft(2, '0')}',
      'monthly' => 'شهر ${n.month}/${n.year}',
      'yearly' => 'سنة ${n.year}',
      _ => 'جميع الأوقات',
    };

    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 40),
        physics: const AlwaysScrollableScrollPhysics(),
        children: [
          const PageHeader(title: 'لوحة المتصدرين', subtitle: 'أفضل الفروع، وأفضل موظف حسب دوره الفعلي', icon: Icons.emoji_events_rounded, tone: Tone.orange),
          Wrap(spacing: 6, runSpacing: 6, children: [
            for (final p in const [('daily', 'اليوم'), ('monthly', 'الشهر'), ('yearly', 'السنة'), ('all', 'الكل')])
              PillChip(label: p.$2, selected: _period == p.$1, onTap: () => setState(() => _period = p.$1)),
          ]),
          const SizedBox(height: 10),
          Row(children: [
            const Icon(Icons.calendar_today_rounded, size: 15, color: Pos.muted),
            const SizedBox(width: 6),
            Text(label, style: const TextStyle(fontSize: 13, color: Pos.muted)),
          ]),
          const SizedBox(height: 12),
          if (_error != null) LoadError(message: _error!, onRetry: _load),
          if (_loading)
            const Padding(padding: EdgeInsets.all(60), child: Center(child: CircularProgressIndicator()))
          else ...[
            _WorkerRace(done: _done, live: _live, cutoff: cutoff),
            const SizedBox(height: 14),
            if (branches.length > 1) ...[
              GlassCard(
                color: Pos.primary.withValues(alpha: .06),
                child: Row(children: [
                  const Icon(Icons.workspace_premium_rounded, size: 32, color: Color(0xFFF59E0B)),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      const Text('أفضل فرع من حيث الإيراد', style: TextStyle(fontSize: 12, color: Pos.muted)),
                      Text(branches.first.name, style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w800)),
                    ]),
                  ),
                  PosMoney(branches.first.revenue, size: 20, weight: FontWeight.w800, color: Pos.primary, decimals: 0),
                ]),
              ),
              const SizedBox(height: 12),
              GlassCard(
                child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                  const Text('ترتيب الفروع حسب الإيراد', style: TextStyle(fontWeight: FontWeight.w700)),
                  const SizedBox(height: 8),
                  for (var i = 0; i < branches.length; i++)
                    Padding(
                      padding: const EdgeInsets.symmetric(vertical: 6),
                      child: Row(children: [
                        SizedBox(width: 28, child: Text('#${i + 1}', style: const TextStyle(fontSize: 12, color: Pos.muted, fontWeight: FontWeight.w700))),
                        Expanded(child: Text(branches[i].name, style: const TextStyle(fontWeight: FontWeight.w600))),
                        Text('${branches[i].repairs} إصلاح · ${branches[i].sales} بيع   ', style: const TextStyle(fontSize: 12, color: Pos.muted)),
                        PosMoney(branches[i].revenue, weight: FontWeight.w700, decimals: 0),
                      ]),
                    ),
                ]),
              ),
              const SizedBox(height: 12),
            ],
            Wrap(spacing: 6, runSpacing: 6, crossAxisAlignment: WrapCrossAlignment.center, children: [
              const Text('عرض موظفي:', style: TextStyle(fontSize: 12, color: Pos.muted)),
              PillChip(label: 'كل الفروع', selected: _branch == 'all', onTap: () => setState(() => _branch = 'all')),
              for (final b in branches) PillChip(label: b.name, selected: _branch == b.name, onTap: () => setState(() => _branch = b.name)),
            ]),
            const SizedBox(height: 14),
            const _SectionTitle(Icons.credit_card_rounded, 'أفضل الكاشير — حسب إيراد المبيعات'),
            if (cashiers.isEmpty)
              const _Hint('لا يوجد موظفون بدور "كاشير" لهذا الفرع/الفترة')
            else
              for (var i = 0; i < cashiers.length; i++)
                _RankRow(i: i, name: '${cashiers[i].e['name']}', branch: _bn(cashiers[i].e), top: cashiers[i].salesRevenue > 0, metric: _metricMoney(cashiers[i].salesRevenue, 'مبيعات'), secondary: '${cashiers[i].salesCount} فاتورة بيع'),
            const SizedBox(height: 14),
            const _SectionTitle(Icons.build_rounded, 'أفضل الفنيين — حسب عدد الإصلاحات المُنجزة (مكتملة فعلاً)'),
            if (techs.isEmpty)
              const _Hint('لا يوجد موظفون بدور "عامل/فني" لهذا الفرع/الفترة')
            else
              for (var i = 0; i < techs.length; i++)
                _RankRow(
                    i: i,
                    name: '${techs[i].e['name']}',
                    branch: _bn(techs[i].e),
                    top: techs[i].completed > 0,
                    metric: _metricText('${techs[i].completed}', 'إصلاح مكتمل'),
                    secondary: '${techs[i].repairs} إجمالي طلبات دخلت باسمه'),
            if (others.isNotEmpty) ...[
              const SizedBox(height: 14),
              const _SectionTitle(Icons.trending_up_rounded, 'أدوار أخرى (مرجعي)', muted: true),
              for (var i = 0; i < others.length; i++)
                _RankRow(i: i, name: '${others[i].e['name']} — ${roleBadges[others[i].e['role']]?.$1 ?? others[i].e['role'] ?? 'بدون دور'}', branch: _bn(others[i].e), top: others[i].total > 0, metric: _metricMoney(others[i].total, 'إجمالي')),
            ],
          ],
        ],
      ),
    );
  }

  static String _bn(Map<String, dynamic> e) => (e['branch_name'] ?? '').toString().isEmpty ? 'الفرع الرئيسي' : '${e['branch_name']}';
}

class _WorkerRace extends StatelessWidget {
  const _WorkerRace({required this.done, required this.live, required this.cutoff});
  final List<Map<String, dynamic>>? done;
  final List<Map<String, dynamic>> live;
  final DateTime? cutoff;

  static DateTime? _d(Object? v) => DateTime.tryParse('$v')?.toLocal();
  static Duration? _dur(Object? a, Object? b) {
    final s = _d(a), e = _d(b);
    return s == null || e == null ? null : e.difference(s);
  }

  @override
  Widget build(BuildContext context) {
    if (done == null) {
      return const GlassCard(child: Text('سباق الفنيين يحتاج تفعيل توقيت العمل في قاعدة البيانات.', style: TextStyle(fontSize: 13, color: Pos.muted)));
    }
    final list = done!.where((o) => cutoff == null || !(_d(o['work_done_at'])?.isBefore(cutoff!) ?? true)).toList();
    final g = <String, ({String name, List<Duration> durs, int count})>{};
    for (final o in list) {
      final k = '${o['worker_id'] ?? o['worker_name'] ?? 'غير معروف'}';
      final cur = g[k] ?? (name: '${o['worker_name'] ?? 'غير معروف'}', durs: <Duration>[], count: 0);
      final d = _dur(o['work_started_at'], o['work_done_at']);
      if (d != null && !d.isNegative) cur.durs.add(d);
      g[k] = (name: cur.name, durs: cur.durs, count: cur.count + 1);
    }
    Duration? avg(List<Duration> d) => d.isEmpty ? null : Duration(seconds: d.fold<int>(0, (s, x) => s + x.inSeconds) ~/ d.length);
    final rows = g.values.toList()
      ..sort((a, b) {
        final c = b.count.compareTo(a.count);
        if (c != 0) return c;
        return (avg(a.durs)?.inSeconds ?? 1 << 30).compareTo(avg(b.durs)?.inSeconds ?? 1 << 30);
      });
    final speedyList = rows.where((r) => r.durs.length >= 3).toList()..sort((a, b) => avg(a.durs)!.compareTo(avg(b.durs)!));
    final speedy = speedyList.isEmpty ? null : speedyList.first.name;
    const medals = ['🥇', '🥈', '🥉'];

    return GlassCard(
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        const Row(children: [
          Icon(Icons.local_fire_department_rounded, size: 18, color: Color(0xFFF97316)),
          SizedBox(width: 6),
          Text('سباق الفنيين', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
        ]),
        const SizedBox(height: 10),
        if (rows.isEmpty)
          const Text('لا توجد طلبات منجزة بتوقيت في هذه الفترة بعد.', style: TextStyle(fontSize: 13, color: Pos.muted))
        else
          for (var i = 0; i < rows.length; i++)
            Container(
              margin: const EdgeInsets.only(bottom: 8),
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: i == 0 ? const Color(0xFFFBBF24) : Pos.border),
                color: i == 0 ? const Color(0xFFFFFBEB) : null,
              ),
              child: Row(children: [
                SizedBox(width: 36, child: Text(i < 3 ? medals[i] : '#${i + 1}', textAlign: TextAlign.center, style: const TextStyle(fontSize: 22))),
                const SizedBox(width: 8),
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text('${rows[i].name}${speedy == rows[i].name ? ' ⚡ الأسرع' : ''}', style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13.5)),
                    Text(
                        'متوسط الوقت: ${fmtDuration(avg(rows[i].durs))} · أسرع طلب: ${fmtDuration(rows[i].durs.isEmpty ? null : rows[i].durs.reduce((a, b) => a < b ? a : b))}',
                        style: const TextStyle(fontSize: 11.5, color: Pos.muted)),
                  ]),
                ),
                Column(children: [
                  Text('${rows[i].count}', style: const TextStyle(fontSize: 19, fontWeight: FontWeight.w900)),
                  const Text('طلب منجز', style: TextStyle(fontSize: 10, color: Pos.muted)),
                ]),
              ]),
            ),
        if (live.isNotEmpty) ...[
          const SizedBox(height: 6),
          const _IconText(Icons.timer_outlined, 'جارية الآن', color: Pos.fg, bold: true),
          const SizedBox(height: 4),
          for (final o in live)
            Container(
              margin: const EdgeInsets.only(bottom: 4),
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
              decoration: BoxDecoration(color: Pos.muted.withValues(alpha: .08), borderRadius: BorderRadius.circular(8)),
              child: Row(children: [
                Expanded(child: Text('${o['order_number']} · ${itemLabels[o['item_type']] ?? ''} · ${o['worker_name'] ?? 'غير معروف'}', style: const TextStyle(fontSize: 12))),
                Text(fmtDuration(_dur(o['work_started_at'], DateTime.now().toIso8601String())), style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700)),
              ]),
            ),
        ],
        if (list.isNotEmpty) ...[
          const SizedBox(height: 8),
          const Text('آخر الطلبات المنجزة ومدة كل واحد', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700)),
          for (final o in list.take(15))
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 5),
              child: Row(children: [
                SizedBox(width: 110, child: Text('${o['order_number']}', style: const TextStyle(fontSize: 11.5, fontFamily: 'monospace'))),
                Expanded(child: Text('${o['worker_name'] ?? '—'} · ${fmtDateTime(_d(o['work_done_at']))}', style: const TextStyle(fontSize: 11.5, color: Pos.muted), overflow: TextOverflow.ellipsis)),
                Text(fmtDuration(_dur(o['work_started_at'], o['work_done_at'])), style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.w700)),
              ]),
            ),
        ],
      ]),
    );
  }
}

class _SectionTitle extends StatelessWidget {
  const _SectionTitle(this.icon, this.text, {this.muted = false});
  final IconData icon;
  final String text;
  final bool muted;
  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(bottom: 8),
        child: Row(children: [
          Icon(icon, size: 16, color: muted ? Pos.muted : Pos.primary),
          const SizedBox(width: 6),
          Expanded(child: Text(text, style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13.5, color: muted ? Pos.muted : Pos.fg))),
        ]),
      );
}

class _Hint extends StatelessWidget {
  const _Hint(this.text);
  final String text;
  @override
  Widget build(BuildContext context) => Padding(padding: const EdgeInsets.symmetric(vertical: 8), child: Text(text, style: const TextStyle(fontSize: 13, color: Pos.muted)));
}

Widget _metricMoney(double v, String label) => Row(mainAxisSize: MainAxisSize.min, children: [
      PosMoney(v, weight: FontWeight.w800, decimals: 0),
      const SizedBox(width: 4),
      Text(label, style: const TextStyle(fontSize: 11, color: Pos.muted)),
    ]);

Widget _metricText(String v, String label) => Row(mainAxisSize: MainAxisSize.min, children: [
      Text(v, style: const TextStyle(fontWeight: FontWeight.w800)),
      const SizedBox(width: 4),
      Text(label, style: const TextStyle(fontSize: 11, color: Pos.muted)),
    ]);

class _RankRow extends StatelessWidget {
  const _RankRow({required this.i, required this.name, required this.branch, required this.top, required this.metric, this.secondary});
  final int i;
  final String name, branch;
  final bool top;
  final Widget metric;
  final String? secondary;

  @override
  Widget build(BuildContext context) {
    final icon = !top || i > 2
        ? Text('#${i + 1}', style: const TextStyle(fontSize: 11, color: Pos.muted, fontWeight: FontWeight.w700))
        : Icon(i == 0 ? Icons.workspace_premium_rounded : Icons.military_tech_rounded,
            size: 20, color: [const Color(0xFFF59E0B), const Color(0xFF9CA3AF), const Color(0xFFB45309)][i]);
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: GlassCard(
        color: i == 0 && top ? Pos.primary.withValues(alpha: .06) : null,
        padding: const EdgeInsets.all(12),
        child: Row(children: [
          CircleAvatar(radius: 17, backgroundColor: Pos.muted.withValues(alpha: .1), child: icon),
          const SizedBox(width: 10),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(name, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13.5)),
              Text(branch, style: const TextStyle(fontSize: 11.5, color: Pos.muted)),
            ]),
          ),
          Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
            metric,
            if (secondary != null) Text(secondary!, style: const TextStyle(fontSize: 11, color: Pos.muted)),
          ]),
        ]),
      ),
    );
  }
}

// ───────────────────────── لوحة التدقيق ─────────────────────────

const _statusLabels = <String, (String, Color)>{
  'pending': ('قيد الانتظار', Pos.amber),
  'in_progress': ('جارٍ التنفيذ', Pos.blue),
  'ready': ('جاهز', Pos.green),
  'completed': ('مكتمل', Color(0xFF047857)),
  'cancelled': ('ملغى', Pos.red),
};

const _actionLabels = <String, (String, Color)>{
  'create': ('إنشاء', Color(0xFF047857)),
  'update': ('تعديل', Pos.blue),
  'delete': ('حذف', Pos.red),
  'status_change': ('تغيير حالة', Pos.amber),
};

/// لوحة التدقيق — نفس /audit: الحركات المالية (إصلاح + بيع) بفلاتر، وسجل النشاط.
class AuditLogScreen extends StatefulWidget {
  const AuditLogScreen({super.key});

  @override
  State<AuditLogScreen> createState() => _AuditLogScreenState();
}

class _AuditLogScreenState extends State<AuditLogScreen> {
  int _tab = 0;
  List<Tx>? _tx;
  List<Map<String, dynamic>>? _logs;
  String? _error;
  String _period = 'today', _kind = 'all', _branch = 'all', _status = 'all', _emp = 'all', _q = '';
  DateTimeRange? _custom;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final rest = context.read<Rest>();
    try {
      final r = await Future.wait<dynamic>([
        _loadTx(rest, 500),
        rest.select('audit_logs', order: 'created_at.desc', limit: 300).catchError((_) => <Map<String, dynamic>>[]),
      ]);
      if (mounted) {
        setState(() {
          _tx = r[0] as List<Tx>;
          _logs = r[1] as List<Map<String, dynamic>>;
          _error = null;
        });
      }
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    }
  }

  DateTime? get _start {
    final n = DateTime.now();
    return switch (_period) {
      'today' => DateTime(n.year, n.month, n.day),
      'week' => DateTime(n.year, n.month, n.day).subtract(Duration(days: n.weekday % 7)), // الأسبوع يبدأ الأحد
      'month' => DateTime(n.year, n.month),
      'year' => DateTime(n.year),
      _ => null,
    };
  }

  List<Tx> get _filtered {
    final start = _start;
    final q = _q.trim().toLowerCase();
    return (_tx ?? const <Tx>[]).where((t) {
      if (_branch != 'all' && t.branch != _branch) return false;
      if (_kind != 'all' && t.kind != _kind) return false;
      final d = t.createdAt;
      if (_period == 'custom' && _custom != null && d != null) {
        if (d.isBefore(_custom!.start) || d.isAfter(_custom!.end.add(const Duration(hours: 23, minutes: 59, seconds: 59)))) return false;
      } else if (start != null && d != null && d.isBefore(start)) {
        return false;
      }
      if (_status != 'all' && t.status != _status) return false;
      if (_emp != 'all' && t.employee != _emp) return false;
      if (q.isNotEmpty) {
        return t.number.toLowerCase().contains(q) ||
            '${t.raw['customer_name'] ?? ''}'.toLowerCase().contains(q) ||
            '${t.raw['customer_phone'] ?? ''}'.contains(q) ||
            (t.employee ?? '').toLowerCase().contains(q);
      }
      return true;
    }).toList();
  }

  Widget _dropdown(String label, String value, Map<String, String> items, ValueChanged<String> onChanged) => SizedBox(
        width: 165,
        child: DropdownButtonFormField<String>(
          value: items.containsKey(value) ? value : 'all',
          isExpanded: true,
          isDense: true,
          decoration: InputDecoration(labelText: label),
          items: [for (final e in items.entries) DropdownMenuItem(value: e.key, child: Text(e.value, overflow: TextOverflow.ellipsis))],
          onChanged: (v) => onChanged(v ?? 'all'),
        ),
      );

  @override
  Widget build(BuildContext context) {
    final f = _filtered;
    double sum(Iterable<Tx> x) => x.fold(0, (s, t) => s + t.amount);
    final all = _tx ?? const <Tx>[];
    final branches = {for (final t in all) t.branch}.toList();
    final emps = {for (final t in all) if (t.employee != null && t.employee!.isNotEmpty) t.employee!}.toList();

    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 40),
        physics: const AlwaysScrollableScrollPhysics(),
        children: [
          const PageHeader(title: 'لوحة التدقيق', subtitle: 'مراجعة شاملة لكل عمليات الإصلاح والبيع معاً', icon: Icons.fact_check_rounded, tone: Tone.indigo),
          SegmentedButton<int>(
            segments: [
              const ButtonSegment(value: 0, label: Text('الحركات المالية'), icon: Icon(Icons.assignment_outlined, size: 16)),
              ButtonSegment(value: 1, label: Text('سجل النشاط (${_logs?.length ?? 0})'), icon: const Icon(Icons.timeline_rounded, size: 16)),
            ],
            selected: {_tab},
            showSelectedIcon: false,
            onSelectionChanged: (v) => setState(() => _tab = v.first),
          ),
          const SizedBox(height: 14),
          if (_error != null) LoadError(message: _error!, onRetry: _load),
          if (_tx == null && _error == null)
            const Padding(padding: EdgeInsets.all(60), child: Center(child: CircularProgressIndicator()))
          else if (_tab == 0) ...[
            LayoutBuilder(builder: (context, c) {
              final cols = c.maxWidth >= 700 ? 4 : 2;
              final w = (c.maxWidth - (cols - 1) * 10) / cols;
              Widget tile(Widget v, String l) => SizedBox(
                    width: w,
                    child: GlassCard(
                      padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 8),
                      child: Column(children: [v, const SizedBox(height: 4), Text(l, style: const TextStyle(fontSize: 11.5, color: Pos.muted))]),
                    ),
                  );
              return Wrap(spacing: 10, runSpacing: 10, children: [
                tile(Text('${f.length}', style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w900, color: Pos.primary)), 'إجمالي العمليات'),
                tile(PosMoney(sum(f), size: 20, weight: FontWeight.w900, color: const Color(0xFF047857), decimals: 0), 'الإيراد الكلي'),
                tile(PosMoney(sum(f.where((t) => t.method == 'cash')), size: 20, weight: FontWeight.w900, color: Pos.green, decimals: 0), 'نقد'),
                tile(PosMoney(sum(f.where((t) => t.method == 'network')), size: 20, weight: FontWeight.w900, color: Pos.blue, decimals: 0), 'شبكة'),
                tile(PosMoney(sum(f.where((t) => t.kind == 'repair')), size: 16, weight: FontWeight.w800, color: const Color(0xFF4338CA), decimals: 0), 'إيراد الإصلاح'),
                tile(PosMoney(sum(f.where((t) => t.kind == 'sale')), size: 16, weight: FontWeight.w800, color: const Color(0xFF0E7490), decimals: 0), 'إيراد بيع المنتجات'),
              ]);
            }),
            const SizedBox(height: 14),
            Wrap(spacing: 6, runSpacing: 6, children: [
              for (final p in const [('today', 'اليوم'), ('week', 'هذا الأسبوع'), ('month', 'هذا الشهر'), ('year', 'هذه السنة'), ('custom', 'تاريخ محدد'), ('all', 'الكل')])
                PillChip(
                  label: p.$1 == 'custom' && _custom != null && _period == 'custom' ? '${ymdShort(_custom!.start)} – ${ymdShort(_custom!.end)}' : p.$2,
                  selected: _period == p.$1,
                  onTap: () async {
                    if (p.$1 != 'custom') {
                      setState(() => _period = p.$1);
                      return;
                    }
                    final r = await showDateRangePicker(context: context, firstDate: DateTime(2023), lastDate: DateTime.now().add(const Duration(days: 1)), initialDateRange: _custom);
                    if (r != null) {
                      setState(() {
                        _custom = r;
                        _period = 'custom';
                      });
                    }
                  },
                ),
            ]),
            const SizedBox(height: 12),
            TextField(decoration: const InputDecoration(hintText: 'بحث...', prefixIcon: Icon(Icons.search_rounded)), onChanged: (v) => setState(() => _q = v)),
            const SizedBox(height: 10),
            Wrap(spacing: 8, runSpacing: 10, children: [
              _dropdown('نوع العملية', _kind, const {'all': 'كل الأنواع', 'repair': 'إصلاح فقط', 'sale': 'بيع منتج فقط'}, (v) => setState(() => _kind = v)),
              _dropdown('الفرع', _branch, {'all': 'كل الفروع', for (final b in branches) b: b}, (v) => setState(() => _branch = v)),
              _dropdown('الحالة', _status, {'all': 'كل الحالات', for (final e in _statusLabels.entries) e.key: e.value.$1}, (v) => setState(() => _status = v)),
              _dropdown('الموظف', _emp, {'all': 'كل الموظفين', for (final e in emps) e: e}, (v) => setState(() => _emp = v)),
            ]),
            const SizedBox(height: 12),
            Wrap(spacing: 8, children: [
              SoftBadge('${f.where((t) => t.payStatus == 'paid').length} مدفوع', Pos.green),
              SoftBadge('${f.where((t) => t.payStatus == 'unpaid').length} غير مدفوع', Pos.red),
              SoftBadge('${f.length} إجمالي', Pos.muted),
            ]),
            const SizedBox(height: 12),
            if (f.isEmpty)
              const EmptyState(icon: Icons.fact_check_outlined, text: 'لا توجد نتائج')
            else
              GlassCard(
                padding: EdgeInsets.zero,
                child: Column(children: [
                  for (final t in f.take(300))
                    ListTile(
                      dense: true,
                      onTap: t.kind == 'repair' ? () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => OrderDetailsScreen(orderId: '${t.raw['id']}'))) : null,
                      title: Wrap(spacing: 6, crossAxisAlignment: WrapCrossAlignment.center, children: [
                        Text(t.number, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 13)),
                        SoftBadge(t.kind == 'repair' ? 'إصلاح' : 'بيع منتج', t.kind == 'repair' ? const Color(0xFF4338CA) : const Color(0xFF0E7490)),
                        SoftBadge(_statusLabels[t.status]?.$1 ?? (t.status ?? '—'), _statusLabels[t.status]?.$2 ?? Pos.muted),
                      ]),
                      subtitle: Text(
                        '${t.raw['customer_name'] ?? '—'} · ${t.branch} · ${t.employee ?? '—'} · ${fmtDateTime(t.createdAt)}',
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(fontSize: 11.5),
                      ),
                      trailing: Column(mainAxisAlignment: MainAxisAlignment.center, crossAxisAlignment: CrossAxisAlignment.end, children: [
                        PosMoney(t.amount, weight: FontWeight.w800),
                        Text(
                          '${t.payStatus == 'paid' ? 'مدفوع' : t.payStatus == 'unpaid' ? 'غير مدفوع' : '—'} · ${t.method == 'cash' ? 'نقد' : t.method == 'network' ? 'شبكة' : '—'}',
                          style: TextStyle(fontSize: 10.5, color: t.payStatus == 'paid' ? Pos.green : Pos.red),
                        ),
                      ]),
                    ),
                ]),
              ),
          ] else ...[
            if ((_logs ?? const []).isEmpty)
              const EmptyState(icon: Icons.timeline_rounded, text: 'ما فيه حركات مسجّلة بعد', sub: 'سيبدأ التسجيل تلقائياً مع أي إنشاء/تعديل/حذف جديد بالنظام')
            else
              GlassCard(
                padding: EdgeInsets.zero,
                child: Column(children: [
                  for (final l in _logs!)
                    ListTile(
                      dense: true,
                      leading: const Icon(Icons.person_outline_rounded, size: 20, color: Pos.muted),
                      title: Wrap(spacing: 6, crossAxisAlignment: WrapCrossAlignment.center, children: [
                        Text('${l['employee_name'] ?? '—'}', style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13)),
                        Text('${l['employee_role'] ?? ''}', style: const TextStyle(fontSize: 11, color: Pos.muted)),
                        SoftBadge(_actionLabels[l['action']]?.$1 ?? '${l['action'] ?? '—'}', _actionLabels[l['action']]?.$2 ?? Pos.muted),
                      ]),
                      subtitle: Text(
                        '${l['page'] ?? '—'} · ${l['entity'] ?? '—'}${l['entity_id'] != null ? ' · ${'${l['entity_id']}'.length > 8 ? '${l['entity_id']}'.substring(0, 8) : l['entity_id']}' : ''}',
                        style: const TextStyle(fontSize: 11.5),
                      ),
                      trailing: Text(fmtDateTime(DateTime.tryParse('${l['created_at']}')?.toLocal()), style: const TextStyle(fontSize: 11, color: Pos.muted)),
                    ),
                ]),
              ),
          ],
        ],
      ),
    );
  }
}

String ymdShort(DateTime d) => '${d.month}/${d.day}';

// ───────────────────────── إدارة الحجوزات ─────────────────────────

const _bookingStatus = <String, (String, Color)>{
  'pending': ('قيد الانتظار', Pos.amber),
  'confirmed': ('مؤكد', Pos.blue),
  'in_progress': ('جارٍ الشغل', Color(0xFF7E22CE)),
  'completed': ('انتهينا', Pos.green),
  'cancelled': ('ملغى', Pos.red),
};

String _waPhone(Object? p) => '${p ?? ''}'.replaceFirst(RegExp(r'^0'), '966').replaceAll(RegExp(r'\D'), '');

/// إدارة الحجوزات — نفس /admin/bookings: إحصائيات، بحث وفلترة، تغيير الحالة
/// خطوة بخطوة، صور القطعة، موقع العميل، وواتساب فردي/جماعي.
class BookingsScreen extends StatefulWidget {
  const BookingsScreen({super.key});

  @override
  State<BookingsScreen> createState() => _BookingsScreenState();
}

class _BookingsScreenState extends State<BookingsScreen> {
  List<Map<String, dynamic>>? _rows;
  String? _error;
  String _q = '', _status = 'all';
  final _selected = <String>{};

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final r = await context.read<Rest>().select('bookings', order: 'booking_date.desc', limit: 200);
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

  Future<void> _setStatus(Map<String, dynamic> b, String s) async {
    try {
      await context.read<Rest>().update('bookings', '${b['id']}', {'status': s}, select: 'id');
      if (!mounted) return;
      const labels = {'confirmed': 'استلمناه ✓', 'in_progress': 'جارٍ الشغل 🔧', 'completed': 'انتهينا ✅'};
      toast(context, 'تم: ${labels[s] ?? 'تحديث الحالة'}');
      _load();
    } on ApiException catch (e) {
      if (mounted) toast(context, e.message, error: true);
    }
  }

  Future<void> _open(String url) async {
    if (!await launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication) && mounted) toast(context, 'تعذّر فتح الرابط', error: true);
  }

  Future<void> _bulkWhatsapp() async {
    final ctrl = TextEditingController(text: 'يا هلا يا {اسم العميل}، عندنا لك عرض خاص من إبرة وخيط الإسكافي! 🧵\nتواصل معنا الحين: https://wa.me/966549678191');
    final ok = await showDialog<bool>(
      context: context,
      builder: (c) => AlertDialog(
        title: const Text('إرسال رسالة واتساب جماعية'),
        content: SizedBox(
          width: 420,
          child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Text('سيتم إرسال رسالة لـ ${_selected.length} عميل', style: const TextStyle(color: Pos.muted)),
            const SizedBox(height: 10),
            TextField(controller: ctrl, maxLines: 5, decoration: const InputDecoration(labelText: 'نص الرسالة', helperText: 'استخدم {اسم العميل} للتخصيص')),
            const SizedBox(height: 10),
            const Text('💡 سيتم فتح محادثة واتساب منفصلة لكل عميل. يتطلب مراجعة يدوية للإرسال.', style: TextStyle(fontSize: 12, color: Pos.muted)),
          ]),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(c, false), child: const Text('إلغاء')),
          PrimaryButton(label: 'إرسال (${_selected.length})', icon: Icons.send_rounded, color: const Color(0xFF25D366), onPressed: () => Navigator.pop(c, true)),
        ],
      ),
    );
    if (ok != true) return;
    final targets = (_rows ?? const []).where((b) => _selected.contains('${b['id']}')).toList();
    for (final b in targets) {
      final msg = ctrl.text.replaceAll('{اسم العميل}', '${b['customer_name'] ?? 'عزيزي العميل'}');
      await launchUrl(Uri.parse('https://wa.me/${_waPhone(b['customer_phone'])}?text=${Uri.encodeComponent(msg)}'), mode: LaunchMode.externalApplication);
    }
    if (!mounted) return;
    toast(context, 'تم فتح ${targets.length} محادثة واتساب');
    setState(_selected.clear);
  }

  void _photos(Map<String, dynamic> b) {
    final urls = (b['item_photos'] as List? ?? const []).map((e) => '$e').toList();
    showDialog<void>(
      context: context,
      builder: (c) => AlertDialog(
        title: Text('صور القطعة — ${b['customer_name'] ?? ''}'),
        content: SizedBox(
          width: 480,
          child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Text('الخدمة: ${b['service_name'] ?? ''} | الموعد: ${b['booking_date'] ?? ''} ${b['booking_time'] ?? ''}', style: const TextStyle(fontSize: 12, color: Pos.muted)),
            const SizedBox(height: 10),
            Flexible(
              child: GridView.count(
                shrinkWrap: true,
                crossAxisCount: 2,
                mainAxisSpacing: 8,
                crossAxisSpacing: 8,
                children: [
                  for (final u in urls)
                    InkWell(
                      onTap: () => _open(u),
                      child: ClipRRect(
                        borderRadius: BorderRadius.circular(12),
                        child: Image.network(u, fit: BoxFit.cover, errorBuilder: (_, __, ___) => const ColoredBox(color: Color(0x11000000), child: Icon(Icons.broken_image_outlined))),
                      ),
                    ),
                ],
              ),
            ),
          ]),
        ),
        actions: [TextButton(onPressed: () => Navigator.pop(c), child: const Text('إغلاق'))],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final all = _rows ?? const <Map<String, dynamic>>[];
    final f = all.where((b) {
      final q = _q.trim();
      final mq = q.isEmpty || '${b['customer_name'] ?? ''}'.contains(q) || '${b['customer_phone'] ?? ''}'.contains(q) || '${b['booking_number'] ?? ''}'.contains(q);
      return mq && (_status == 'all' || b['status'] == _status);
    }).toList();
    int count(String s) => all.where((b) => b['status'] == s).length;
    final revenue = all.where((b) => b['status'] == 'completed').fold<double>(0, (s, b) => s + ((b['total_price'] as num?) ?? 0));

    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 40),
        physics: const AlwaysScrollableScrollPhysics(),
        children: [
          PageHeader(
            title: 'إدارة الحجوزات',
            subtitle: 'متابعة وإدارة جميع المواعيد',
            icon: Icons.event_available_rounded,
            tone: Tone.purple,
            trailing: _selected.isEmpty
                ? null
                : PrimaryButton(label: 'إرسال واتساب (${_selected.length})', icon: Icons.chat_rounded, color: const Color(0xFF25D366), onPressed: _bulkWhatsapp),
          ),
          if (_error != null) LoadError(message: _error!, onRetry: _load),
          LayoutBuilder(builder: (context, c) {
            final cols = c.maxWidth >= 800 ? 5 : 2;
            final w = (c.maxWidth - (cols - 1) * 10) / cols;
            Widget tile(Widget v, String l) => SizedBox(
                  width: w,
                  child: GlassCard(
                    padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 8),
                    child: Column(children: [v, const SizedBox(height: 4), Text(l, style: const TextStyle(fontSize: 11.5, color: Pos.muted))]),
                  ),
                );
            Text n(int v, Color c) => Text('$v', style: TextStyle(fontSize: 22, fontWeight: FontWeight.w900, color: c));
            return Wrap(spacing: 10, runSpacing: 10, children: [
              tile(n(all.length, Pos.fg), 'الكل'),
              tile(n(count('pending'), Pos.amber), 'انتظار'),
              tile(n(count('confirmed'), Pos.blue), 'مؤكدة'),
              tile(n(count('completed'), Pos.green), 'مكتملة'),
              tile(PosMoney(revenue, size: 20, weight: FontWeight.w900, color: Pos.amber, decimals: 0), 'الإيرادات'),
            ]);
          }),
          const SizedBox(height: 12),
          Row(children: [
            Expanded(
              child: TextField(
                decoration: const InputDecoration(hintText: 'ابحث بالاسم أو الجوال أو رقم الحجز...', prefixIcon: Icon(Icons.search_rounded)),
                onChanged: (v) => setState(() => _q = v),
              ),
            ),
            const SizedBox(width: 8),
            SizedBox(
              width: 150,
              child: DropdownButtonFormField<String>(
                value: _status,
                isExpanded: true,
                decoration: const InputDecoration(labelText: 'الحالة'),
                items: [
                  const DropdownMenuItem(value: 'all', child: Text('جميع الحالات')),
                  for (final e in _bookingStatus.entries) DropdownMenuItem(value: e.key, child: Text(e.value.$1)),
                ],
                onChanged: (v) => setState(() => _status = v ?? 'all'),
              ),
            ),
          ]),
          if (f.isNotEmpty)
            Align(
              alignment: AlignmentDirectional.centerStart,
              child: TextButton.icon(
                onPressed: () => setState(() {
                  if (_selected.length == f.length) {
                    _selected.clear();
                  } else {
                    _selected
                      ..clear()
                      ..addAll(f.map((b) => '${b['id']}'));
                  }
                }),
                icon: Icon(_selected.length == f.length ? Icons.check_box_rounded : Icons.check_box_outline_blank_rounded, size: 18),
                label: Text(_selected.isEmpty ? 'تحديد الكل' : 'تحديد الكل (${_selected.length} محدد)'),
              ),
            ),
          const SizedBox(height: 4),
          if (_rows == null && _error == null)
            const Padding(padding: EdgeInsets.all(60), child: Center(child: CircularProgressIndicator()))
          else if (f.isEmpty)
            const EmptyState(icon: Icons.event_busy_outlined, text: 'لا توجد حجوزات')
          else
            GlassCard(
              padding: EdgeInsets.zero,
              child: Column(children: [
                for (final b in f) _bookingTile(b),
              ]),
            ),
        ],
      ),
    );
  }

  Widget _bookingTile(Map<String, dynamic> b) {
    final id = '${b['id']}';
    final st = _bookingStatus[b['status']] ?? _bookingStatus['pending']!;
    final photos = (b['item_photos'] as List?)?.length ?? 0;
    final sel = _selected.contains(id);
    final s = '${b['status']}';
    Widget act(String label, Color c, String to) => Padding(
          padding: const EdgeInsetsDirectional.only(end: 6),
          child: FilledButton(
            style: FilledButton.styleFrom(backgroundColor: c, minimumSize: const Size(0, 32), padding: const EdgeInsets.symmetric(horizontal: 10), textStyle: const TextStyle(fontSize: 12, fontFamily: 'IBMPlexSansArabic', fontWeight: FontWeight.w600)),
            onPressed: () => _setStatus(b, to),
            child: Text(label),
          ),
        );
    return Container(
      color: sel ? const Color(0x0FF59E0B) : null,
      padding: const EdgeInsets.all(12),
      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        InkWell(
          onTap: () => setState(() {
            if (sel) {
              _selected.remove(id);
            } else {
              _selected.add(id);
            }
          }),
          child: Padding(
            padding: const EdgeInsets.only(top: 2),
            child: Icon(sel ? Icons.check_box_rounded : Icons.check_box_outline_blank_rounded, size: 20, color: sel ? const Color(0xFFF59E0B) : Pos.muted),
          ),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Wrap(spacing: 6, runSpacing: 4, crossAxisAlignment: WrapCrossAlignment.center, children: [
              Text('${b['customer_name'] ?? ''}', style: const TextStyle(fontWeight: FontWeight.w800)),
              Text('#${b['booking_number'] ?? ''}', style: const TextStyle(fontSize: 11.5, color: Pos.muted)),
              SoftBadge(st.$1, st.$2),
              if (photos > 0)
                InkWell(onTap: () => _photos(b), child: SoftBadge('$photos صور', const Color(0xFFD97706), icon: Icons.photo_camera_outlined)),
            ]),
            const SizedBox(height: 4),
            Wrap(spacing: 12, runSpacing: 4, crossAxisAlignment: WrapCrossAlignment.center, children: [
              _IconText(Icons.phone_outlined, '${b['customer_phone'] ?? ''}', ltr: true),
              _IconText(Icons.calendar_today_outlined, '${b['booking_date'] ?? ''} — ${b['booking_time'] ?? ''}'),
              _IconText(b['booking_type'] == 'home_visit' ? Icons.local_shipping_outlined : Icons.storefront_outlined, '${b['service_name'] ?? ''}'),
              if (b['latitude'] != null)
                InkWell(
                  onTap: () => _open('https://maps.google.com/?q=${b['latitude']},${b['longitude']}'),
                  child: const _IconText(Icons.location_on_outlined, 'موقع العميل', color: Pos.blue),
                ),
              PosMoney(((b['total_price'] as num?) ?? 0).toDouble(), size: 12.5, weight: FontWeight.w800, color: const Color(0xFFD97706)),
            ]),
            const SizedBox(height: 8),
            Wrap(runSpacing: 6, children: [
              if (s == 'pending') act('استلمناه ✓', Pos.blue, 'confirmed'),
              if (s == 'confirmed') act('جارٍ الشغل 🔧', const Color(0xFF7E22CE), 'in_progress'),
              if (s == 'in_progress') act('انتهينا ✅', Pos.green, 'completed'),
              if (s != 'completed' && s != 'cancelled')
                Padding(
                  padding: const EdgeInsetsDirectional.only(end: 6),
                  child: OutlineSmall(label: 'إلغاء', color: Pos.red, onPressed: () => _setStatus(b, 'cancelled')),
                ),
              OutlineSmall(label: 'واتساب', icon: Icons.chat_rounded, color: const Color(0xFF16A34A), onPressed: () => _open('https://wa.me/${_waPhone(b['customer_phone'])}')),
            ]),
          ]),
        ),
      ]),
    );
  }
}

class _IconText extends StatelessWidget {
  const _IconText(this.icon, this.text, {this.color = Pos.muted, this.ltr = false, this.bold = false});
  final IconData icon;
  final String text;
  final Color color;
  final bool ltr, bold;
  @override
  Widget build(BuildContext context) => Row(mainAxisSize: MainAxisSize.min, children: [
        Icon(icon, size: 14, color: color),
        const SizedBox(width: 4),
        Text(text, textDirection: ltr ? TextDirection.ltr : null, style: TextStyle(fontSize: 12, color: color, fontWeight: bold ? FontWeight.w700 : null)),
      ]);
}
