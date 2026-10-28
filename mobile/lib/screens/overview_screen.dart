import 'package:flutter/material.dart';

import '../theme.dart';
import '../widgets/ac_widgets.dart';

/// نظرة عامة — المؤشرات الأربعة + الأرصدة + الاتجاه (أعلى صفحة /accounting).
class OverviewScreen extends StatelessWidget {
  const OverviewScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return AcPage(
      title: 'المركز المحاسبي',
      en: 'Accounting Centre',
      builder: (context, r) => [
        KpiGrid(children: [
          KpiTile(label: 'صافي الإيراد', value: r.income.revenueTotal, note: '${r.salesDocs} مستند مبيعات · بدون ضريبة'),
          KpiTile(
            label: 'صافي الربح',
            value: r.income.netProfit,
            gold: true,
            note: r.income.netMarginPct != null ? 'هامش ${r.income.netMarginPct}%' : 'لا إيراد بالفترة',
          ),
          KpiTile(
            label: 'ضريبة القيمة المضافة المستحقة',
            value: r.vat.netVatDue,
            note: 'مخرجات ${money(r.vat.outputVat)} − مدخلات ${money(r.vat.inputVat)}',
          ),
          KpiTile(label: 'مستحقات لنا', value: r.balances.receivable, note: '${r.balances.receivableDocs} مستند غير مسدّد · رصيد لحظي'),
        ]),
        SectionCard(
          title: 'الأرصدة المفتوحة',
          en: 'Open Balances',
          child: Row(children: [
            Expanded(child: _bal('مستحقات لنا (عملاء)', r.balances.receivable, '${r.balances.receivableDocs} مستند')),
            const SizedBox(width: 12),
            Expanded(child: _bal('مستحقات علينا (موردون)', r.balances.payable, '${r.balances.payableDocs} فاتورة')),
          ]),
        ),
        SectionCard(title: 'آخر 12 شهراً', en: 'Monthly Trend', child: TrendBars(points: r.trend)),
      ],
    );
  }

  Widget _bal(String label, double v, String note) => Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(color: AC.s2, borderRadius: BorderRadius.circular(12), border: Border.all(color: AC.line)),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(label, style: TextStyle(fontSize: 11.5, color: AC.mu)),
          const SizedBox(height: 8),
          FittedBox(fit: BoxFit.scaleDown, child: Money(v, size: 18, weight: FontWeight.w700)),
          const SizedBox(height: 4),
          Text(note, style: TextStyle(fontSize: 11, color: AC.fa)),
        ]),
      );
}
