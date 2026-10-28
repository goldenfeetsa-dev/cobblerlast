import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/api_client.dart';
import '../../core/rest.dart';
import '../pos_ui.dart';

const _colors = [Color(0xFFC9A84C), Color(0xFF3B82F6), Color(0xFF10B981), Color(0xFFF59E0B), Color(0xFFEF4444), Color(0xFF8B5CF6), Color(0xFFEC4899)];

String _two(int n) => n.toString().padLeft(2, '0');
String _ymd(DateTime d) => '${d.year}-${_two(d.month)}-${_two(d.day)}';

/// إحصائيات الموقع — نفس /site-analytics: زوار موقع الحجز (آخر 2000 زيارة).
class SiteAnalyticsScreen extends StatefulWidget {
  const SiteAnalyticsScreen({super.key});
  @override
  State<SiteAnalyticsScreen> createState() => _SiteAnalyticsScreenState();
}

class _SiteAnalyticsScreenState extends State<SiteAnalyticsScreen> {
  List<Map<String, dynamic>>? _v;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final r = await context.read<Rest>().select('site_visits', order: 'created_at.desc', limit: 2000);
      if (mounted) {
        setState(() {
          _v = r;
          _error = null;
        });
      }
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    }
  }

  static List<MapEntry<String, int>> _group(List<Map<String, dynamic>> v, String k, int take) {
    final m = <String, int>{};
    for (final x in v) {
      final key = (x[k] ?? '').toString().isEmpty ? 'غير معروف' : '${x[k]}';
      m[key] = (m[key] ?? 0) + 1;
    }
    return (m.entries.toList()..sort((a, b) => b.value.compareTo(a.value))).take(take).toList();
  }

  @override
  Widget build(BuildContext context) {
    final v = _v ?? const <Map<String, dynamic>>[];
    final dates = [for (final x in v) DateTime.tryParse('${x['created_at']}')?.toLocal()];
    final now = DateTime.now();
    final last14 = [
      for (var i = 13; i >= 0; i--)
        () {
          final d = now.subtract(Duration(days: i));
          final k = _ymd(d);
          return (label: '${_two(d.month)}/${_two(d.day)}', count: dates.where((x) => x != null && _ymd(x) == k).length);
        }(),
    ];
    final today = dates.where((x) => x != null && _ymd(x) == _ymd(now)).length;
    final mobile = v.where((x) => x['is_mobile'] == true).length;
    final unique = {for (final x in v) if (x['ip'] != null) x['ip']}.length;
    final countries = _group(v, 'country', 8), cities = _group(v, 'city', 10);
    final maxDay = last14.fold<int>(1, (a, b) => b.count > a ? b.count : a);

    Widget kpi(IconData i, Color c, String val, String l) => GlassCard(
          padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 8),
          child: Column(children: [
            Icon(i, size: 20, color: c),
            const SizedBox(height: 4),
            Text(val, style: TextStyle(fontSize: 22, fontWeight: FontWeight.w900, color: c)),
            Text(l, style: const TextStyle(fontSize: 11.5, color: Pos.muted)),
          ]),
        );

    Widget ranking(String title, IconData icon, List<MapEntry<String, int>> data, Color? single) => GlassCard(
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Row(children: [Icon(icon, size: 16, color: single ?? Pos.primary), const SizedBox(width: 6), Text(title, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13.5))]),
            const SizedBox(height: 10),
            if (data.isEmpty)
              const Padding(padding: EdgeInsets.all(24), child: Text('لا توجد بيانات بعد', textAlign: TextAlign.center, style: TextStyle(color: Pos.muted, fontSize: 13)))
            else
              for (var i = 0; i < data.length; i++)
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 4),
                  child: Row(children: [
                    SizedBox(width: 18, child: Text('${i + 1}', style: const TextStyle(fontSize: 11, color: Pos.muted))),
                    Expanded(
                      child: ClipRRect(
                        borderRadius: BorderRadius.circular(4),
                        child: LinearProgressIndicator(value: data[i].value / data.first.value, minHeight: 8, backgroundColor: Pos.muted.withValues(alpha: .1), color: single ?? _colors[i % _colors.length]),
                      ),
                    ),
                    const SizedBox(width: 8),
                    SizedBox(width: 90, child: Text(data[i].key, style: const TextStyle(fontSize: 12), overflow: TextOverflow.ellipsis)),
                    Text('${data[i].value}', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: single ?? Pos.primary)),
                  ]),
                ),
          ]),
        );

    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 40),
        physics: const AlwaysScrollableScrollPhysics(),
        children: [
          const PageHeader(title: 'إحصائيات الموقع', subtitle: 'زوار موقع الحجز الإلكتروني', icon: Icons.public_rounded, tone: Tone.teal),
          if (_error != null) LoadError(message: _error!, onRetry: _load),
          if (_v == null && _error == null)
            const Padding(padding: EdgeInsets.all(60), child: Center(child: CircularProgressIndicator()))
          else ...[
            LayoutBuilder(builder: (context, c) {
              final cols = c.maxWidth >= 700 ? 4 : 2;
              final w = (c.maxWidth - (cols - 1) * 10) / cols;
              return Wrap(spacing: 10, runSpacing: 10, children: [
                SizedBox(width: w, child: kpi(Icons.visibility_outlined, Pos.primary, '${v.length}', 'إجمالي الزيارات')),
                SizedBox(width: w, child: kpi(Icons.people_outline_rounded, Pos.blue, '$unique', 'زوار فريدون (تقريبي)')),
                SizedBox(width: w, child: kpi(Icons.trending_up_rounded, Pos.green, '$today', 'زيارات اليوم')),
                SizedBox(width: w, child: kpi(Icons.smartphone_rounded, Pos.amber, '${v.isEmpty ? 0 : (mobile * 100 / v.length).round()}%', 'من الجوال')),
              ]);
            }),
            const SizedBox(height: 12),
            GlassCard(
              child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                const Text('الزيارات - آخر 14 يوم', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13.5)),
                const SizedBox(height: 12),
                SizedBox(
                  height: 170,
                  child: Row(crossAxisAlignment: CrossAxisAlignment.end, children: [
                    for (final d in last14)
                      Expanded(
                        child: Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 2),
                          child: Column(mainAxisAlignment: MainAxisAlignment.end, children: [
                            if (d.count > 0) Text('${d.count}', style: const TextStyle(fontSize: 9.5, color: Pos.muted)),
                            Container(
                              height: 120 * d.count / maxDay + 2,
                              decoration: const BoxDecoration(color: Color(0xFFE6A23C), borderRadius: BorderRadius.vertical(top: Radius.circular(4))),
                            ),
                            const SizedBox(height: 4),
                            FittedBox(child: Text(d.label, style: const TextStyle(fontSize: 9, color: Pos.muted))),
                          ]),
                        ),
                      ),
                  ]),
                ),
                const SizedBox(height: 10),
                Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                  SoftBadge('جوال $mobile', const Color(0xFFC9A84C), icon: Icons.smartphone_rounded),
                  const SizedBox(width: 8),
                  SoftBadge('كمبيوتر ${v.length - mobile}', Pos.blue, icon: Icons.computer_rounded),
                ]),
              ]),
            ),
            const SizedBox(height: 12),
            LayoutBuilder(builder: (context, c) {
              final w = c.maxWidth >= 760 ? (c.maxWidth - 12) / 2 : c.maxWidth;
              return Wrap(spacing: 12, runSpacing: 12, children: [
                SizedBox(width: w, child: ranking('حسب الدولة', Icons.flag_outlined, countries, null)),
                SizedBox(width: w, child: ranking('حسب المدينة', Icons.location_on_outlined, cities, const Color(0xFF60A5FA))),
              ]);
            }),
            const SizedBox(height: 12),
            GlassCard(
              padding: EdgeInsets.zero,
              child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                const Padding(padding: EdgeInsets.all(14), child: Text('آخر الزيارات', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13.5))),
                if (v.isEmpty)
                  const Padding(padding: EdgeInsets.all(24), child: Text('لا توجد زيارات بعد', textAlign: TextAlign.center, style: TextStyle(color: Pos.muted)))
                else
                  for (var i = 0; i < v.length && i < 20; i++)
                    ListTile(
                      dense: true,
                      leading: Icon(v[i]['is_mobile'] == true ? Icons.smartphone_rounded : Icons.computer_rounded, size: 18, color: v[i]['is_mobile'] == true ? Pos.amber : Pos.blue),
                      title: Text('${v[i]['country'] ?? '—'} · ${v[i]['city'] ?? '—'}', style: const TextStyle(fontSize: 13)),
                      subtitle: Text('${v[i]['page'] ?? '/'}', textDirection: TextDirection.ltr, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 11.5)),
                      trailing: Text(dates[i] == null ? '—' : '${_two(dates[i]!.month)}/${_two(dates[i]!.day)} ${_two(dates[i]!.hour)}:${_two(dates[i]!.minute)}', style: const TextStyle(fontSize: 11.5, color: Pos.muted)),
                    ),
              ]),
            ),
          ],
        ],
      ),
    );
  }
}
