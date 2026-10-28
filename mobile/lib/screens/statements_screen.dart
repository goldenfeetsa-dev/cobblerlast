import 'package:flutter/material.dart';

import '../theme.dart';
import '../widgets/ac_widgets.dart';

/// قائمة الدخل + ضريبة القيمة المضافة — نفس ترتيب أسطر الموقع حرفياً.
class StatementsScreen extends StatelessWidget {
  const StatementsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return AcPage(
      title: 'القوائم المالية',
      en: 'Financial Statements',
      builder: (context, r) {
        final i = r.income;
        final v = r.vat;
        return [
          SectionCard(
            title: 'قائمة الدخل',
            en: 'Income Statement',
            child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              const StatementRow('الإيرادات', 0, style: RowStyle.sum, showValue: false),
              StatementRow('خدمات الإصلاح', i.revenueRepair, style: RowStyle.indent),
              StatementRow('مبيعات المنتجات', i.revenueProducts, style: RowStyle.indent),
              StatementRow('فواتير الشركات (B2B)', i.revenuePartners, style: RowStyle.indent),
              if (i.revenueAdjustments != 0)
                StatementRow('إشعارات دائنة/مدينة', i.revenueAdjustments, style: RowStyle.indent),
              StatementRow('صافي الإيرادات', i.revenueTotal, style: RowStyle.sum),
              StatementRow('تكلفة البضاعة المباعة', -i.cogsProducts, style: RowStyle.indent),
              StatementRow(i.materialsEstimated ? 'مواد الورشة (تقديري)' : 'مواد الورشة', -i.cogsMaterials,
                  style: RowStyle.indent),
              StatementRow('مجمل الربح', i.grossProfit, style: RowStyle.sum),
              if (r.expensesByCategory.isEmpty)
                const StatementRow('المصاريف التشغيلية', 0, style: RowStyle.indent)
              else
                for (final c in r.expensesByCategory)
                  StatementRow(expenseCategories[c.category] ?? c.category, -c.amount, style: RowStyle.indent),
              StatementRow('إجمالي المصاريف التشغيلية', -i.operatingExpenses, style: RowStyle.sum),
              StatementRow(i.netProfit >= 0 ? 'صافي الربح' : 'صافي الخسارة', i.netProfit, style: RowStyle.grand, gold: true),
              const SizedBox(height: 10),
              Text(
                'أساس الاستحقاق: الإيراد يُثبت بتاريخ الطلب/الفاتورة، والمبالغ بدون ضريبة. مشتريات المخزون بالفترة '
                '(${money(r.inventoryPurchases)}) أصل لا تُخصم مباشرة — تدخل التكلفة عند بيع المنتج أو سحب المادة للورشة.',
                style: TextStyle(fontSize: 11.5, color: AC.fa, height: 1.7),
              ),
            ]),
          ),
          SectionCard(
            title: 'ضريبة القيمة المضافة',
            en: 'VAT · 15%',
            child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              StatementRow('المبيعات الخاضعة', v.taxableSales),
              StatementRow('ضريبة المخرجات', v.outputVat),
              StatementRow('مدخلات — مشتريات', -v.inputVatPurchases, style: RowStyle.indent),
              StatementRow('مدخلات — مصروفات بفاتورة ضريبية', -v.inputVatExpenses, style: RowStyle.indent),
              StatementRow('صافي الضريبة المستحقة', v.netVatDue, style: RowStyle.grand, gold: true),
              const SizedBox(height: 10),
              Text('نموذج الإقرار الكامل وملاحقه في الموقع: لوحة الضرائب.',
                  style: TextStyle(fontSize: 11.5, color: AC.fa)),
            ]),
          ),
        ];
      },
    );
  }
}
