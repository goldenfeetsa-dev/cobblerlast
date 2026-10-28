import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/api_client.dart';
import '../../core/rest.dart';
import '../../state/auth_controller.dart';
import '../pos_ui.dart';
import 'order_details_screen.dart';
import 'staff_screens.dart';

const _capacity = 8; // أقصى طاقة استيعابية يومياً — نفس CAPACITY بالموقع

const _st = <String, (String, Color)>{
  'pending': ('انتظار', Color(0xFFF59E0B)),
  'in_progress': ('جارٍ التنفيذ', Color(0xFF3B82F6)),
  'ready': ('جاهز', Color(0xFF10B981)),
  'completed': ('مكتمل', Color(0xFF22C55E)),
  'cancelled': ('ملغى', Color(0xFFEF4444)),
};

const _arMonths = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
const _arDays = ['الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت', 'الأحد']; // DateTime.weekday 1..7

String _ymd(DateTime d) => '${d.year}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';
String _dayMonth(String ymd) {
  final d = DateTime.tryParse(ymd);
  return d == null ? ymd : '${d.day} ${_arMonths[d.month - 1]}';
}

String _longDay(DateTime d) => '${_arDays[d.weekday - 1]} ${d.day} ${_arMonths[d.month - 1]}';

/// الجدولة المرئية — نفس /calendar: تسليمات اليوم، تنبيهات الضغط، تقويم الشهر
/// حسب تاريخ التسليم مع ألوان الطاقة، تفاصيل اليوم، وطلبات يجب إنجازها.
/// الفني لا يرى الأسعار ولا جوال العميل (تُستثنى من الاستعلام نفسه).
class CalendarScreen extends StatefulWidget {
  const CalendarScreen({super.key});

  @override
  State<CalendarScreen> createState() => _CalendarScreenState();
}

class _CalendarScreenState extends State<CalendarScreen> {
  DateTime _month = DateTime(DateTime.now().year, DateTime.now().month);
  DateTime? _selected;
  List<Map<String, dynamic>>? _monthOrders;
  List<Map<String, dynamic>> _ready = const [];
  List<Map<String, dynamic>> _open = const [];
  String? _error;

  bool get _worker => context.read<AuthController>().employee?.role == 'staff';
  String get _money => _worker ? '' : ',total_price';
  String get _phone => _worker ? '' : ',customer_phone';

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final rest = context.read<Rest>();
    final start = _ymd(_month);
    final end = _ymd(DateTime(_month.year, _month.month + 1, 0));
    try {
      final r = await Future.wait([
        rest.select('orders',
            select: 'id,order_number,customer_name,status,created_at,delivery_date,item_type$_money',
            filters: {'and': '(delivery_date.gte.$start,delivery_date.lte.$end)'},
            order: 'delivery_date.asc',
            limit: 1000),
        rest.select('orders',
            select: 'id,order_number,customer_name$_phone,item_type,status,delivery_date,shelf_location$_money',
            filters: {'status': 'eq.ready'},
            order: 'delivery_date.asc.nullslast',
            limit: 300),
        rest.select('orders',
            select: 'id,order_number,customer_name$_phone,item_type,status,delivery_date,created_at$_money',
            filters: {'status': 'not.in.(completed,cancelled)'},
            order: 'delivery_date.asc.nullslast',
            limit: 500),
      ]);
      if (mounted) {
        setState(() {
          _monthOrders = r[0];
          _ready = r[1];
          _open = r[2];
          _error = null;
        });
      }
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    }
  }

  void _openOrder(Map<String, dynamic> o) {
    final id = '${o['id']}';
    Navigator.of(context).push(MaterialPageRoute(builder: (_) => _worker ? StaffOrderDetailScreen(orderId: id) : OrderDetailsScreen(orderId: id)));
  }

  void _shiftMonth(int d) {
    setState(() {
      _month = DateTime(_month.year, _month.month + d);
      _selected = null;
      _monthOrders = null;
    });
    _load();
  }

  @override
  Widget build(BuildContext context) {
    final byDay = <String, List<Map<String, dynamic>>>{};
    for (final o in _monthOrders ?? const <Map<String, dynamic>>[]) {
      final k = '${o['delivery_date'] ?? ''}';
      if (k.isEmpty) continue;
      byDay.putIfAbsent(k.length >= 10 ? k.substring(0, 10) : k, () => []).add(o);
    }
    final today = _ymd(DateTime.now());
    final alerts = (byDay.entries.where((e) => e.key.compareTo(today) >= 0 && e.value.length >= _capacity * .75).toList()..sort((a, b) => a.key.compareTo(b.key))).take(3).toList();

    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 40),
        physics: const AlwaysScrollableScrollPhysics(),
        children: [
          const PageHeader(title: 'الجدولة المرئية', subtitle: 'توزيع الطلبات على أيام التسليم وطاقة الورشة اليومية', icon: Icons.calendar_month_rounded, tone: Tone.blue),
          if (_error != null) LoadError(message: _error!, onRetry: _load),
          if (_ready.isNotEmpty) ...[_deliveries(today), const SizedBox(height: 12)],
          for (final a in alerts) _alert(a.key, a.value.length),
          _calendar(byDay),
          const SizedBox(height: 8),
          Wrap(spacing: 14, runSpacing: 6, children: const [
            _Legend(Color(0x3322C55E), Color(0xFF22C55E), 'طلبات عادية'),
            _Legend(Color(0x26F59E0B), Color(0xFFF59E0B), 'ضغط عالٍ (75%+)'),
            _Legend(Color(0x26EF4444), Color(0xFFEF4444), 'طاقة ممتلئة ($_capacity+ طلب)'),
          ]),
          if (_selected != null) ...[const SizedBox(height: 12), _dayDetails(byDay[_ymd(_selected!)] ?? const [], today)],
          if (_open.isNotEmpty) ...[const SizedBox(height: 14), _pending()],
        ],
      ),
    );
  }

  Widget _alert(String date, int n) {
    final full = n >= _capacity;
    final c = full ? const Color(0xFFEF4444) : const Color(0xFFF59E0B);
    final d = DateTime.tryParse(date);
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 11),
      decoration: BoxDecoration(color: c.withValues(alpha: .08), border: Border.all(color: c.withValues(alpha: .2)), borderRadius: BorderRadius.circular(12)),
      child: Row(children: [
        Icon(Icons.notifications_active_outlined, size: 17, color: c),
        const SizedBox(width: 8),
        Text('${full ? '🔴 طاقة ممتلئة' : '🟡 ضغط عالٍ'} — ', style: TextStyle(fontWeight: FontWeight.w800, color: c, fontSize: 13)),
        Expanded(child: Text('${d == null ? date : _longDay(d)} — $n/$_capacity طلب', style: const TextStyle(fontSize: 13, color: Pos.muted))),
      ]),
    );
  }

  Widget _deliveries(String today) => ClipRRect(
        borderRadius: BorderRadius.circular(16),
        child: DecoratedBox(
          decoration: BoxDecoration(border: Border.all(color: const Color(0x4D3B82F6)), borderRadius: BorderRadius.circular(16), color: Colors.white),
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Container(
              color: const Color(0xFF3B82F6),
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
              child: Row(children: [
                const Icon(Icons.local_shipping_rounded, size: 17, color: Colors.white),
                const SizedBox(width: 8),
                const Text('تسليمات اليوم', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w900, fontSize: 13.5)),
                const Spacer(),
                Text('${_ready.length} طلب جاهز للاستلام', style: const TextStyle(color: Color(0xCCFFFFFF), fontSize: 12, fontWeight: FontWeight.w700)),
              ]),
            ),
            for (final o in _ready)
              Material(
                color: const Color(0x0A3B82F6),
                child: InkWell(
                  onTap: () => _openOrder(o),
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                    child: Row(children: [
                      Container(width: 6, height: 32, decoration: BoxDecoration(color: const Color(0xFF3B82F6), borderRadius: BorderRadius.circular(4))),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                          Wrap(spacing: 6, runSpacing: 3, crossAxisAlignment: WrapCrossAlignment.center, children: [
                            Text('${o['order_number']}', style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 13)),
                            if ((o['shelf_location'] ?? '').toString().isNotEmpty) SoftBadge('رف: ${o['shelf_location']}', Pos.blue),
                            if (o['delivery_date'] != null && '${o['delivery_date']}'.compareTo(today) < 0) SoftBadge('بانتظار الاستلام من ${_dayMonth('${o['delivery_date']}')}', Pos.amber),
                          ]),
                          Text('${o['customer_name'] ?? ''}${o['customer_phone'] != null ? ' • ${o['customer_phone']}' : ''}', style: const TextStyle(fontSize: 12, color: Pos.muted)),
                        ]),
                      ),
                      if (((o['total_price'] as num?) ?? 0) > 0) PosMoney((o['total_price'] as num).toDouble(), size: 12.5, weight: FontWeight.w700, color: Pos.muted),
                    ]),
                  ),
                ),
              ),
          ]),
        ),
      );

  Widget _calendar(Map<String, List<Map<String, dynamic>>> byDay) {
    final last = DateTime(_month.year, _month.month + 1, 0).day;
    final offset = DateTime(_month.year, _month.month, 1).weekday % 7 + 1; // الأسبوع يبدأ السبت
    final realOffset = offset % 7;
    final todayKey = _ymd(DateTime.now());
    final cells = <Widget>[
      for (var i = 0; i < realOffset; i++) const SizedBox.shrink(),
      for (var d = 1; d <= last; d++) _dayCell(DateTime(_month.year, _month.month, d), byDay, todayKey),
    ];
    return GlassCard(
      padding: EdgeInsets.zero,
      child: Column(children: [
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 10),
          child: Row(children: [
            IconButton(onPressed: () => _shiftMonth(-1), icon: const Icon(Icons.chevron_right_rounded)),
            Expanded(
              child: Column(children: [
                Text('${_arMonths[_month.month - 1]} ${_month.year}', style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 15)),
                Text('${_monthOrders?.length ?? 0} طلب هذا الشهر', style: const TextStyle(fontSize: 11.5, color: Pos.muted)),
              ]),
            ),
            IconButton(onPressed: () => _shiftMonth(1), icon: const Icon(Icons.chevron_left_rounded)),
          ]),
        ),
        const Divider(height: 1),
        Row(children: [
          for (final d in const ['س', 'ح', 'ن', 'ث', 'ر', 'خ', 'ج'])
            Expanded(child: Padding(padding: const EdgeInsets.symmetric(vertical: 8), child: Text(d, textAlign: TextAlign.center, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: Pos.muted)))),
        ]),
        const Divider(height: 1),
        if (_monthOrders == null)
          const Padding(padding: EdgeInsets.all(40), child: CircularProgressIndicator())
        else
          GridView.count(
            crossAxisCount: 7,
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            childAspectRatio: 0.95,
            children: cells,
          ),
      ]),
    );
  }

  Widget _dayCell(DateTime day, Map<String, List<Map<String, dynamic>>> byDay, String todayKey) {
    final key = _ymd(day);
    final list = byDay[key] ?? const [];
    final n = list.length;
    final p = n / _capacity;
    final sel = _selected != null && _ymd(_selected!) == key;
    final isToday = key == todayKey;
    final (Color bg, Color border, Color text) = sel
        ? (const Color(0xFF1A0F00), const Color(0xFFC9A84C), const Color(0xFFF5EDD8))
        : p >= 1
            ? (const Color(0x26EF4444), const Color(0xFFEF4444), const Color(0xFFEF4444))
            : p >= .75
                ? (const Color(0x1FF59E0B), const Color(0xFFF59E0B), const Color(0xFFF59E0B))
                : n > 0
                    ? (const Color(0x1422C55E), const Color(0xFF22C55E), const Color(0xFF22C55E))
                    : (isToday ? const Color(0x14C9A84C) : Colors.transparent, isToday ? const Color(0xFFC9A84C) : const Color(0xFFE5E7EB), const Color(0xFF374151));
    return InkWell(
      onTap: () => setState(() => _selected = sel ? null : day),
      child: Container(
        decoration: BoxDecoration(
          color: bg,
          border: sel ? Border.all(color: border, width: 2) : const Border(bottom: BorderSide(color: Color(0xFFF3F4F6)), left: BorderSide(color: Color(0xFFF3F4F6))),
        ),
        padding: const EdgeInsets.all(4),
        child: Column(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
          Text('${day.day}', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: isToday && !sel ? const Color(0xFFD97706) : text)),
          if (n > 0)
            Column(mainAxisSize: MainAxisSize.min, children: [
              Text('$n', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w900, color: sel ? text : border)),
              Row(mainAxisSize: MainAxisSize.min, children: [
                for (final o in list.take(4))
                  Container(width: 5, height: 5, margin: const EdgeInsets.symmetric(horizontal: 1), decoration: BoxDecoration(shape: BoxShape.circle, color: _st[o['status']]?.$2 ?? const Color(0xFF9CA3AF))),
                if (n > 4) Text('+${n - 4}', style: const TextStyle(fontSize: 8, color: Pos.muted)),
              ]),
            ])
          else
            const SizedBox.shrink(),
        ]),
      ),
    );
  }

  Widget _dayDetails(List<Map<String, dynamic>> list, String today) => GlassCard(
        padding: EdgeInsets.zero,
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 8, 8, 8),
            child: Row(children: [
              Expanded(
                child: Text.rich(TextSpan(children: [
                  TextSpan(text: '${_longDay(_selected!)} ${_selected!.year}', style: const TextStyle(fontWeight: FontWeight.w900)),
                  TextSpan(text: '  (${list.length} طلب)', style: const TextStyle(fontSize: 12.5, color: Pos.muted)),
                ])),
              ),
              IconButton(onPressed: () => setState(() => _selected = null), icon: const Icon(Icons.close_rounded, size: 18)),
            ]),
          ),
          const Divider(height: 1),
          if (list.isEmpty)
            const Padding(padding: EdgeInsets.all(28), child: Text('لا توجد طلبات في هذا اليوم', textAlign: TextAlign.center, style: TextStyle(color: Pos.muted)))
          else
            for (final o in list)
              () {
                final cfg = _st[o['status']] ?? _st['pending']!;
                final late = '${o['delivery_date']}'.compareTo(today) < 0 && o['status'] != 'completed' && o['status'] != 'cancelled';
                return _OrderRow(
                  order: o,
                  bar: late ? const Color(0xFFEF4444) : cfg.$2,
                  badge: late ? 'متأخر' : null,
                  badgeColor: Pos.red,
                  sub: '${o['customer_name'] ?? ''}',
                  status: cfg,
                  onTap: () => _openOrder(o),
                );
              }(),
        ]),
      );

  Widget _pending() {
    final now = DateTime.now();
    final t0 = DateTime(now.year, now.month, now.day);
    final urgent = <Map<String, dynamic>>[], upcoming = <Map<String, dynamic>>[], later = <Map<String, dynamic>>[], noDate = <Map<String, dynamic>>[];
    for (final o in _open) {
      final d = DateTime.tryParse('${o['delivery_date']}');
      if (d == null) {
        noDate.add(o);
        continue;
      }
      final days = DateTime(d.year, d.month, d.day).difference(t0).inDays;
      if (days <= 1) {
        urgent.add(o);
      } else if (days <= 3) {
        upcoming.add(o);
      } else {
        later.add(o);
      }
    }
    Widget row(Map<String, dynamic> o, String tone) {
      final (Color bar, String? label, Color bc) = switch (tone) {
        'red' => (const Color(0xFFEF4444), 'عاجل', Pos.red),
        'yellow' => (const Color(0xFFF59E0B), 'قريب', Pos.amber),
        _ => (const Color(0xFF9CA3AF), null, Pos.muted),
      };
      return _OrderRow(
        order: o,
        bar: bar,
        badge: label,
        badgeColor: bc,
        tint: tone == 'gray' ? null : bar.withValues(alpha: .06),
        sub: '${o['customer_name'] ?? ''}${o['delivery_date'] != null ? ' • تسليم: ${_dayMonth('${o['delivery_date']}')}' : ''}',
        status: (_st[o['status']]?.$1 ?? '${o['status']}', Pos.muted),
        onTap: () => _openOrder(o),
      );
    }

    return GlassCard(
      padding: EdgeInsets.zero,
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Padding(
          padding: const EdgeInsets.all(16),
          child: Row(children: [
            const Icon(Icons.event_note_rounded, size: 17, color: Pos.muted),
            const SizedBox(width: 8),
            const Text('طلبات يجب إنجازها', style: TextStyle(fontWeight: FontWeight.w900)),
            const Spacer(),
            Text('${_open.length} طلب', style: const TextStyle(fontSize: 12, color: Pos.muted)),
          ]),
        ),
        const Divider(height: 1),
        for (final o in urgent) row(o, 'red'),
        for (final o in upcoming) row(o, 'yellow'),
        for (final o in later) row(o, 'gray'),
        for (final o in noDate) row(o, 'gray'),
      ]),
    );
  }
}

class _OrderRow extends StatelessWidget {
  const _OrderRow({required this.order, required this.bar, required this.sub, required this.status, required this.onTap, this.badge, this.badgeColor = Pos.red, this.tint});
  final Map<String, dynamic> order;
  final Color bar;
  final String sub;
  final (String, Color) status;
  final VoidCallback onTap;
  final String? badge;
  final Color badgeColor;
  final Color? tint;

  @override
  Widget build(BuildContext context) {
    final price = ((order['total_price'] as num?) ?? 0).toDouble();
    return Material(
      color: tint ?? Colors.transparent,
      child: InkWell(
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
          child: Row(children: [
            Container(width: 6, height: 32, decoration: BoxDecoration(color: bar, borderRadius: BorderRadius.circular(4))),
            const SizedBox(width: 12),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Row(children: [
                  Text('${order['order_number']}', style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 13)),
                  if (badge != null) ...[const SizedBox(width: 6), SoftBadge(badge!, badgeColor)],
                ]),
                Text(sub, style: const TextStyle(fontSize: 12, color: Pos.muted), overflow: TextOverflow.ellipsis),
              ]),
            ),
            SoftBadge(status.$1, status.$2),
            if (price > 0) ...[const SizedBox(width: 8), PosMoney(price, size: 12.5, weight: FontWeight.w700, color: Pos.muted)],
          ]),
        ),
      ),
    );
  }
}

class _Legend extends StatelessWidget {
  const _Legend(this.fill, this.border, this.label);
  final Color fill, border;
  final String label;
  @override
  Widget build(BuildContext context) => Row(mainAxisSize: MainAxisSize.min, children: [
        Container(width: 12, height: 12, decoration: BoxDecoration(color: fill, border: Border.all(color: border), borderRadius: BorderRadius.circular(3))),
        const SizedBox(width: 5),
        Text(label, style: const TextStyle(fontSize: 11.5, color: Pos.muted)),
      ]);
}
