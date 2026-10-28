/// نماذج رد محرك المحاسبة الموحّد (Postgres: accounting_report).
/// نفس البنية التي يقرؤها الموقع في src/pages/AccountingCenter.jsx.
library;

double _d(dynamic v) {
  if (v is num) return v.toDouble();
  if (v is String) return double.tryParse(v) ?? 0;
  return 0;
}

int _i(dynamic v) {
  if (v is num) return v.toInt();
  if (v is String) return int.tryParse(v) ?? 0;
  return 0;
}

Map<String, dynamic> _m(dynamic v) =>
    v is Map ? v.map((k, val) => MapEntry(k.toString(), val)) : <String, dynamic>{};

List<dynamic> _l(dynamic v) => v is List ? v : const [];

class IncomeStatement {
  const IncomeStatement({
    required this.revenueRepair,
    required this.revenueProducts,
    required this.revenuePartners,
    required this.revenueAdjustments,
    required this.revenueTotal,
    required this.cogsProducts,
    required this.cogsMaterials,
    required this.materialsEstimated,
    required this.grossProfit,
    required this.operatingExpenses,
    required this.netProfit,
    required this.netMarginPct,
  });

  final double revenueRepair, revenueProducts, revenuePartners, revenueAdjustments, revenueTotal;
  final double cogsProducts, cogsMaterials, grossProfit, operatingExpenses, netProfit;
  final bool materialsEstimated;
  final double? netMarginPct;

  factory IncomeStatement.fromJson(Map<String, dynamic> j) => IncomeStatement(
        revenueRepair: _d(j['revenue_repair']),
        revenueProducts: _d(j['revenue_products']),
        revenuePartners: _d(j['revenue_partners']),
        revenueAdjustments: _d(j['revenue_adjustments']),
        revenueTotal: _d(j['revenue_total']),
        cogsProducts: _d(j['cogs_products']),
        cogsMaterials: _d(j['cogs_materials']),
        materialsEstimated: j['materials_estimated'] == true,
        grossProfit: _d(j['gross_profit']),
        operatingExpenses: _d(j['operating_expenses']),
        netProfit: _d(j['net_profit']),
        netMarginPct: j['net_margin_pct'] == null ? null : _d(j['net_margin_pct']),
      );
}

class VatSummary {
  const VatSummary({
    required this.outputVat,
    required this.inputVat,
    required this.inputVatPurchases,
    required this.inputVatExpenses,
    required this.netVatDue,
    required this.taxableSales,
    required this.taxablePurchases,
  });

  final double outputVat, inputVat, inputVatPurchases, inputVatExpenses, netVatDue, taxableSales, taxablePurchases;

  factory VatSummary.fromJson(Map<String, dynamic> j) => VatSummary(
        outputVat: _d(j['output_vat']),
        inputVat: _d(j['input_vat']),
        inputVatPurchases: _d(j['input_vat_purchases']),
        inputVatExpenses: _d(j['input_vat_expenses']),
        netVatDue: _d(j['net_vat_due']),
        taxableSales: _d(j['taxable_sales']),
        taxablePurchases: _d(j['taxable_purchases']),
      );
}

class Balances {
  const Balances({required this.receivable, required this.receivableDocs, required this.payable, required this.payableDocs});

  final double receivable, payable;
  final int receivableDocs, payableDocs;

  factory Balances.fromJson(Map<String, dynamic> j) => Balances(
        receivable: _d(j['receivable']),
        receivableDocs: _i(j['receivable_docs']),
        payable: _d(j['payable']),
        payableDocs: _i(j['payable_docs']),
      );
}

class TrendPoint {
  const TrendPoint({required this.month, required this.revenue, required this.costs});

  final String month; // YYYY-MM
  final double revenue, costs;

  double get net => revenue - costs;

  factory TrendPoint.fromJson(Map<String, dynamic> j) =>
      TrendPoint(month: (j['month'] ?? '').toString(), revenue: _d(j['revenue']), costs: _d(j['costs']));
}

class LedgerEntry {
  const LedgerEntry({
    required this.date,
    required this.kind,
    required this.ref,
    required this.party,
    required this.net,
    required this.vat,
    required this.total,
    required this.sign,
    this.status,
  });

  final String date, kind, ref, party;
  final double net, vat, total;
  final int sign; // +1 داخل / −1 خارج
  final String? status;

  bool get isUnpaid => status == 'unpaid';

  factory LedgerEntry.fromJson(Map<String, dynamic> j) => LedgerEntry(
        date: (j['date'] ?? '').toString(),
        kind: (j['kind'] ?? '').toString(),
        ref: (j['ref'] ?? '—').toString(),
        party: (j['party'] ?? '—').toString(),
        net: _d(j['net']),
        vat: _d(j['vat']),
        total: _d(j['total']),
        sign: _i(j['sign']) == 0 ? 1 : _i(j['sign']),
        status: j['status']?.toString(),
      );
}

class CategoryAmount {
  const CategoryAmount(this.category, this.amount);
  final String category;
  final double amount;
}

class AccountingReport {
  const AccountingReport({
    required this.income,
    required this.vat,
    required this.balances,
    required this.trend,
    required this.ledger,
    required this.expensesByCategory,
    required this.inventoryPurchases,
    required this.salesDocs,
  });

  final IncomeStatement income;
  final VatSummary vat;
  final Balances balances;
  final List<TrendPoint> trend;
  final List<LedgerEntry> ledger;
  final List<CategoryAmount> expensesByCategory;
  final double inventoryPurchases;
  final int salesDocs;

  factory AccountingReport.fromJson(Map<String, dynamic> j) => AccountingReport(
        income: IncomeStatement.fromJson(_m(j['income_statement'])),
        vat: VatSummary.fromJson(_m(j['vat'])),
        balances: Balances.fromJson(_m(j['balances'])),
        trend: _l(j['trend']).map((e) => TrendPoint.fromJson(_m(e))).toList(),
        ledger: _l(j['ledger']).map((e) => LedgerEntry.fromJson(_m(e))).toList(),
        expensesByCategory: _l(j['expenses_by_category'])
            .map((e) => _m(e))
            .map((e) => CategoryAmount((e['category'] ?? 'other').toString(), _d(e['amount'])))
            .toList(),
        inventoryPurchases: _d(j['inventory_purchases']),
        salesDocs: _i(_m(j['counts'])['sales']),
      );
}

/// مصروف (جدول expenses) — للعرض والإضافة.
class Expense {
  const Expense({
    required this.id,
    required this.category,
    required this.description,
    required this.amount,
    required this.vatAmount,
    required this.date,
    required this.hasTaxInvoice,
  });

  final String id, category, description, date;
  final double amount, vatAmount;
  final bool hasTaxInvoice;

  factory Expense.fromJson(Map<String, dynamic> j) => Expense(
        id: (j['id'] ?? '').toString(),
        category: (j['category'] ?? 'other').toString(),
        description: (j['description'] ?? '').toString(),
        amount: _d(j['amount']),
        vatAmount: _d(j['vat_amount']),
        date: (j['expense_date'] ?? j['date'] ?? '').toString(),
        hasTaxInvoice: j['has_tax_invoice'] == true,
      );
}
