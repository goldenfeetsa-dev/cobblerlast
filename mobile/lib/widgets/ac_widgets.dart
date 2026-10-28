import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../models/accounting_report.dart';
import '../state/accounting_controller.dart';
import '../theme.dart';

/// مبلغ برمز الريال الرسمي (نفس خط SAR-Symbol في الموقع، الحرف # = ⃁).
/// السالب يظهر بين قوسين وباللون الأحمر الهادئ — نفس <Money> في الموقع.
class Money extends StatelessWidget {
  const Money(this.value, {super.key, this.size = 14, this.weight = FontWeight.w400, this.color, this.forceNeg = false});

  final double value;
  final double size;
  final FontWeight weight;
  final Color? color;
  final bool forceNeg;

  @override
  Widget build(BuildContext context) {
    // تقريب لمنزلتين أولاً حتى لا يظهر «-0.00»
    final v = (value * 100).roundToDouble() / 100;
    final neg = forceNeg || v < 0;
    final c = neg ? AC.neg : (color ?? AC.tx);
    final text = neg ? '(${money(v.abs())})' : money(v == 0 ? 0 : v);
    return Directionality(
      textDirection: TextDirection.ltr,
      child: Text.rich(
        TextSpan(children: [
          TextSpan(text: '#', style: TextStyle(fontFamily: AC.riyalFont, fontSize: size * .92, color: c)),
          const TextSpan(text: ' '),
          TextSpan(text: text),
        ]),
        maxLines: 1,
        softWrap: false,
        overflow: TextOverflow.fade,
        style: TextStyle(fontSize: size, fontWeight: weight, color: c, fontFeatures: AC.tabular),
      ),
    );
  }
}

/// بطاقة قسم: عنوان عربي + تسمية إنجليزية صغيرة (مثل .ac-card في الموقع).
class SectionCard extends StatelessWidget {
  const SectionCard({super.key, required this.title, this.en, required this.child, this.trailing});

  final String title;
  final String? en;
  final Widget child;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      padding: const EdgeInsets.fromLTRB(18, 18, 18, 14),
      decoration: BoxDecoration(
        color: AC.s1,
        borderRadius: BorderRadius.circular(AC.radius),
        border: Border.all(color: AC.line),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              Expanded(child: Text(title, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700))),
              if (trailing != null) trailing!,
              if (en != null && trailing == null)
                Text(en!.toUpperCase(), style: TextStyle(fontSize: 10.5, letterSpacing: 1.6, color: AC.fa)),
            ],
          ),
          const SizedBox(height: 12),
          child,
        ],
      ),
    );
  }
}

enum RowStyle { normal, indent, sum, grand }

/// سطر في قائمة مالية — نفس .ac-row / .ind / .sum / .grand.
class StatementRow extends StatelessWidget {
  const StatementRow(this.label, this.value, {super.key, this.style = RowStyle.normal, this.gold = false, this.showValue = true});

  final String label;
  final double value;
  final RowStyle style;
  final bool gold;
  final bool showValue;

  @override
  Widget build(BuildContext context) {
    final isGrand = style == RowStyle.grand;
    final isSum = style == RowStyle.sum;
    return Container(
      margin: EdgeInsets.only(top: isGrand ? 6 : 0),
      padding: EdgeInsets.only(top: isGrand ? 14 : 10, bottom: 10),
      decoration: BoxDecoration(
        border: isGrand
            ? const Border(top: BorderSide(color: AC.gold))
            : Border(bottom: BorderSide(color: isSum ? AC.line2 : AC.line)),
      ),
      child: Row(
        children: [
          if (style == RowStyle.indent) const SizedBox(width: 14),
          Expanded(
            child: Text(
              label,
              style: TextStyle(
                fontSize: isGrand ? 16 : 13.5,
                fontWeight: isSum || isGrand ? FontWeight.w700 : FontWeight.w400,
                color: isSum || isGrand ? AC.tx : AC.mu,
              ),
            ),
          ),
          if (showValue)
            Money(
              value,
              size: isGrand ? 16 : 13.5,
              weight: isSum || isGrand ? FontWeight.w700 : FontWeight.w400,
              color: gold ? AC.gold : null,
            ),
        ],
      ),
    );
  }
}

/// مؤشر رئيسي — نفس .ac-kpi.
class KpiTile extends StatelessWidget {
  const KpiTile({super.key, required this.label, required this.value, required this.note, this.gold = false});

  final String label;
  final double value;
  final String note;
  final bool gold;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 14),
      color: AC.s1,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: TextStyle(fontSize: 12, color: AC.mu)),
          const SizedBox(height: 10),
          FittedBox(
            fit: BoxFit.scaleDown,
            alignment: AlignmentDirectional.centerStart,
            child: Money(value, size: 22, weight: FontWeight.w700, color: gold ? AC.gold : null),
          ),
          const SizedBox(height: 6),
          Text(note, maxLines: 2, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 11, color: AC.fa)),
        ],
      ),
    );
  }
}

/// شبكة المؤشرات 2×2 بخطوط فاصلة رفيعة (مثل .ac-kpis).
class KpiGrid extends StatelessWidget {
  const KpiGrid({super.key, required this.children});
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(builder: (context, c) {
      final cols = c.maxWidth >= 900 ? 4 : 2;
      final rows = <Widget>[];
      for (var i = 0; i < children.length; i += cols) {
        final slice = children.sublist(i, (i + cols).clamp(0, children.length));
        rows.add(IntrinsicHeight(
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              for (var j = 0; j < slice.length; j++) ...[
                if (j > 0) Container(width: 1, color: AC.line),
                Expanded(child: slice[j]),
              ],
            ],
          ),
        ));
        if (i + cols < children.length) rows.add(Container(height: 1, color: AC.line));
      }
      return Container(
        margin: const EdgeInsets.only(bottom: 16),
        decoration: BoxDecoration(borderRadius: BorderRadius.circular(AC.radius), border: Border.all(color: AC.line)),
        clipBehavior: Clip.antiAlias,
        child: Column(children: rows),
      );
    });
  }
}

/// رأس الشاشة + اختيار الفترة — نفس .ac-head في الموقع.
class AcHeader extends StatelessWidget {
  const AcHeader({super.key, required this.title, required this.en});

  final String title;
  final String en;

  @override
  Widget build(BuildContext context) {
    final ctl = context.watch<AccountingController>();
    return Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(en.toUpperCase(),
              style: const TextStyle(fontSize: 11, letterSpacing: 2.6, color: AC.gold, fontWeight: FontWeight.w600)),
          const SizedBox(height: 4),
          Text(title, style: const TextStyle(fontSize: 26, fontWeight: FontWeight.w700, height: 1.25)),
          const SizedBox(height: 2),
          Directionality(
            textDirection: TextDirection.ltr,
            child: Align(
              alignment: Alignment.centerRight,
              child: Text('${ymd(ctl.from)}  –  ${ymd(ctl.to)}', style: TextStyle(fontSize: 12.5, color: AC.mu)),
            ),
          ),
          const SizedBox(height: 14),
          const PeriodBar(),
          const SizedBox(height: 6),
          Container(height: 1, color: AC.line),
        ],
      ),
    );
  }
}

class PeriodBar extends StatelessWidget {
  const PeriodBar({super.key});

  @override
  Widget build(BuildContext context) {
    final ctl = context.watch<AccountingController>();
    Future<void> pickCustom() async {
      final r = await showDateRangePicker(
        context: context,
        firstDate: DateTime(2024, 1, 1),
        lastDate: DateTime.now().add(const Duration(days: 366)),
        initialDateRange: DateTimeRange(start: ctl.from, end: ctl.to),
        helpText: 'اختر الفترة',
        saveText: 'تطبيق',
      );
      if (r != null) {
        if (r.end.difference(r.start).inDays > 1100) {
          if (context.mounted) {
            ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('أقصى فترة 3 سنوات')));
          }
          return;
        }
        ctl.setCustom(r.start, r.end);
      }
    }

    return SizedBox(
      height: 40,
      child: ListView(
        scrollDirection: Axis.horizontal,
        children: [
          for (final p in Period.values.where((p) => p != Period.custom))
            Padding(
              padding: const EdgeInsetsDirectional.only(end: 8),
              child: AcChip(label: p.label, selected: ctl.period == p, onTap: () => ctl.setPeriod(p)),
            ),
          AcChip(
            label: ctl.period == Period.custom ? 'مخصّصة ✓' : 'فترة مخصّصة',
            selected: ctl.period == Period.custom,
            icon: Icons.date_range_rounded,
            onTap: pickCustom,
          ),
        ],
      ),
    );
  }
}

/// زر شريحة بيضاوي — نفس .ac-chip (ذهبي عند الاختيار).
class AcChip extends StatelessWidget {
  const AcChip({super.key, required this.label, required this.selected, required this.onTap, this.icon});

  final String label;
  final bool selected;
  final VoidCallback onTap;
  final IconData? icon;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      selected: selected,
      child: Material(
        color: selected ? AC.gold : Colors.transparent,
        shape: StadiumBorder(side: BorderSide(color: selected ? AC.gold : AC.line2)),
        child: InkWell(
          customBorder: const StadiumBorder(),
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
            child: Row(mainAxisSize: MainAxisSize.min, children: [
              if (icon != null) ...[Icon(icon, size: 15, color: selected ? AC.bg : AC.mu), const SizedBox(width: 6)],
              Text(label,
                  style: TextStyle(
                      fontSize: 12.5, fontWeight: FontWeight.w600, color: selected ? AC.bg : AC.mu)),
            ]),
          ),
        ),
      ),
    );
  }
}

/// أعمدة الاتجاه الشهري — نفس .ac-trend (الإيراد ذهبي، التكاليف عاجي خافت).
class TrendBars extends StatelessWidget {
  const TrendBars({super.key, required this.points});
  final List<TrendPoint> points;

  @override
  Widget build(BuildContext context) {
    final maxV = points.fold<double>(1, (m, p) => [m, p.revenue, p.costs].reduce((a, b) => a > b ? a : b));
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(children: [
          _legend(AC.gold, 'الإيراد'),
          const SizedBox(width: 16),
          _legend(AC.tx.withValues(alpha: .22), 'التكاليف'),
        ]),
        const SizedBox(height: 12),
        SizedBox(
          height: 170,
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              for (var i = 0; i < points.length; i++)
                Expanded(
                  child: Tooltip(
                    message: '${monthLabel(points[i].month)}\nإيراد ${money(points[i].revenue)}\nتكاليف ${money(points[i].costs)}',
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.end,
                      children: [
                        Expanded(
                          child: Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            crossAxisAlignment: CrossAxisAlignment.end,
                            children: [
                              _bar(points[i].revenue / maxV, AC.gold),
                              const SizedBox(width: 2),
                              _bar(points[i].costs / maxV, AC.tx.withValues(alpha: .22)),
                            ],
                          ),
                        ),
                        const SizedBox(height: 6),
                        Text(i.isEven || points.length <= 6 ? monthLabel(points[i].month) : '',
                            maxLines: 1,
                            overflow: TextOverflow.clip,
                            style: TextStyle(fontSize: 9, color: AC.fa)),
                      ],
                    ),
                  ),
                ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _bar(double f, Color c) => Flexible(
        child: FractionallySizedBox(
          heightFactor: f.isNaN ? 0 : f.clamp(0.012, 1.0),
          child: Container(
            constraints: const BoxConstraints(maxWidth: 12),
            decoration: BoxDecoration(color: c, borderRadius: const BorderRadius.vertical(top: Radius.circular(4))),
          ),
        ),
      );

  Widget _legend(Color c, String t) => Row(mainAxisSize: MainAxisSize.min, children: [
        Container(width: 10, height: 10, decoration: BoxDecoration(color: c, borderRadius: BorderRadius.circular(3))),
        const SizedBox(width: 6),
        Text(t, style: TextStyle(fontSize: 11.5, color: AC.mu)),
      ]);
}

/// هيكل تحميل لامع — نفس .ac-sk.
class Skeleton extends StatefulWidget {
  const Skeleton({super.key, this.height = 20, this.width});
  final double height;
  final double? width;

  @override
  State<Skeleton> createState() => _SkeletonState();
}

class _SkeletonState extends State<Skeleton> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(vsync: this, duration: const Duration(milliseconds: 1400))..repeat();

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _c,
      builder: (_, __) => Container(
        height: widget.height,
        width: widget.width,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(10),
          gradient: LinearGradient(
            begin: Alignment(-1 + 2 * _c.value - 1, 0),
            end: Alignment(1 + 2 * _c.value - 1, 0),
            colors: const [AC.s1, AC.s2, AC.s1],
          ),
        ),
      ),
    );
  }
}

/// شريط خطأ مع إعادة المحاولة — نفس .ac-err.
class ErrorBanner extends StatelessWidget {
  const ErrorBanner({super.key, required this.message, required this.onRetry});
  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AC.neg.withValues(alpha: .08),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AC.neg.withValues(alpha: .4)),
      ),
      child: Row(children: [
        Expanded(child: Text(message, style: const TextStyle(fontSize: 13))),
        const SizedBox(width: 10),
        FilledButton(
          onPressed: onRetry,
          style: FilledButton.styleFrom(backgroundColor: AC.gold, foregroundColor: AC.bg, shape: const StadiumBorder()),
          child: const Text('إعادة المحاولة', style: TextStyle(fontWeight: FontWeight.w700)),
        ),
      ]),
    );
  }
}

/// غلاف موحّد لكل شاشة: سحب للتحديث + عرض محدود على الشاشات الكبيرة + حالات التحميل/الخطأ.
class AcPage extends StatelessWidget {
  const AcPage({super.key, required this.title, required this.en, required this.builder});

  final String title;
  final String en;
  final List<Widget> Function(BuildContext context, AccountingReport report) builder;

  @override
  Widget build(BuildContext context) {
    final ctl = context.watch<AccountingController>();
    final report = ctl.report;
    return RefreshIndicator(
      color: AC.gold,
      backgroundColor: AC.s1,
      onRefresh: ctl.load,
      child: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 1100),
          child: ListView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 28),
            children: [
              AcHeader(title: title, en: en),
              if (ctl.loading && report != null) const LinearProgressIndicator(minHeight: 2),
              if (ctl.error != null) ErrorBanner(message: ctl.error!, onRetry: ctl.load),
              if (report == null && ctl.loading) ...[
                const Skeleton(height: 210),
                const SizedBox(height: 16),
                const Skeleton(height: 320),
              ] else if (report != null)
                ...builder(context, report),
            ],
          ),
        ),
      ),
    );
  }
}

/// وسم صغير (نوع الحركة) — نفس .ac-tag (.in = ذهبي للداخل).
class Tag extends StatelessWidget {
  const Tag(this.text, {super.key, this.incoming = false});
  final String text;
  final bool incoming;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 3),
      decoration: BoxDecoration(
        color: incoming ? AC.goldSoft : AC.s2,
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: incoming ? AC.gold.withValues(alpha: .35) : AC.line),
      ),
      child: Text(text, style: TextStyle(fontSize: 11, color: incoming ? AC.gold : AC.mu)),
    );
  }
}
