import 'package:flutter/foundation.dart';

import '../core/api_client.dart';
import '../models/accounting_report.dart';

/// الفترات — نفس PERIODS في src/lib/accounting.js.
enum Period { thisMonth, lastMonth, thisQuarter, lastQuarter, thisYear, custom }

extension PeriodLabel on Period {
  String get label => switch (this) {
        Period.thisMonth => 'هذا الشهر',
        Period.lastMonth => 'الشهر الماضي',
        Period.thisQuarter => 'هذا الربع',
        Period.lastQuarter => 'الربع الماضي',
        Period.thisYear => 'هذه السنة',
        Period.custom => 'فترة مخصّصة',
      };
}

(DateTime, DateTime) rangeFor(Period p, [DateTime? now]) {
  final n = now ?? DateTime.now();
  DateTime monthEnd(int y, int m) => DateTime(y, m + 1, 0);
  switch (p) {
    case Period.thisMonth:
      return (DateTime(n.year, n.month, 1), monthEnd(n.year, n.month));
    case Period.lastMonth:
      final d = DateTime(n.year, n.month - 1, 1);
      return (d, monthEnd(d.year, d.month));
    case Period.thisQuarter:
      final qs = ((n.month - 1) ~/ 3) * 3 + 1;
      return (DateTime(n.year, qs, 1), monthEnd(n.year, qs + 2));
    case Period.lastQuarter:
      final qs = ((n.month - 1) ~/ 3) * 3 + 1;
      final d = DateTime(n.year, qs - 3, 1);
      return (d, monthEnd(d.year, d.month + 2));
    case Period.thisYear:
    case Period.custom:
      return (DateTime(n.year, 1, 1), DateTime(n.year, 12, 31));
  }
}

class AccountingController extends ChangeNotifier {
  AccountingController(this._api) {
    final r = rangeFor(Period.thisMonth);
    _from = r.$1;
    _to = r.$2;
  }

  final ApiClient _api;

  Period _period = Period.thisMonth;
  late DateTime _from;
  late DateTime _to;
  AccountingReport? _report;
  List<Expense> _expenses = const [];
  bool _loading = false;
  String? _error;
  int _seq = 0;

  Period get period => _period;
  DateTime get from => _from;
  DateTime get to => _to;
  AccountingReport? get report => _report;
  List<Expense> get expenses => _expenses;
  bool get loading => _loading;
  String? get error => _error;

  void setPeriod(Period p) {
    if (p == Period.custom) return;
    final r = rangeFor(p);
    _period = p;
    _from = r.$1;
    _to = r.$2;
    load();
  }

  void setCustom(DateTime from, DateTime to) {
    _period = Period.custom;
    _from = from.isAfter(to) ? to : from;
    _to = from.isAfter(to) ? from : to;
    load();
  }

  Future<void> load() async {
    final seq = ++_seq; // نتجاهل ردود الطلبات القديمة إذا غيّر المستخدم الفترة بسرعة
    _loading = true;
    _error = null;
    notifyListeners();
    try {
      final results = await Future.wait([
        _api.accountingReport(_from, _to),
        _api.listExpenses(_from, _to),
      ]);
      if (seq != _seq) return;
      _report = AccountingReport.fromJson(results[0] as Map<String, dynamic>);
      _expenses = (results[1] as List<Map<String, dynamic>>).map(Expense.fromJson).toList();
    } on ApiException catch (e) {
      if (seq != _seq) return;
      _error = e.message;
    } catch (_) {
      if (seq != _seq) return;
      _error = 'تعذّر قراءة الأرقام — حاول مجدداً';
    } finally {
      if (seq == _seq) {
        _loading = false;
        notifyListeners();
      }
    }
  }

  /// نفس منطق إضافة المصروف في الموقع (FinancialReports.addExpense):
  /// المبلغ شامل الضريبة، ونستخرج الضريبة 15% إذا كان خاضعاً.
  Future<void> addExpense({
    required String category,
    required String description,
    required double amount,
    required DateTime date,
    required bool hasVat,
    required bool hasTaxInvoice,
    String? supplierVatNumber,
  }) async {
    final vat = hasVat ? double.parse((amount - amount / 1.15).toStringAsFixed(2)) : 0.0;
    final subtotal = double.parse((amount - vat).toStringAsFixed(2));
    await _api.createExpense({
      'category': category,
      'description': description,
      'amount': amount,
      'subtotal': subtotal,
      'vat_amount': vat,
      'is_vat_applicable': hasVat,
      'has_tax_invoice': hasVat ? hasTaxInvoice : false,
      'supplier_vat_number': hasVat && (supplierVatNumber ?? '').isNotEmpty ? supplierVatNumber : null,
      'expense_date':
          '${date.year.toString().padLeft(4, '0')}-${date.month.toString().padLeft(2, '0')}-${date.day.toString().padLeft(2, '0')}',
      // المنشئ والفرع يحددهما الخادم من الجلسة الموقّعة — لا نرسلهما
    });
    await load();
  }

  /// لاختبارات لقطات الشاشة فقط: يضع بيانات جاهزة بدون اتصال.
  @visibleForTesting
  void debugSet(AccountingReport report, List<Expense> expenses, {DateTime? from, DateTime? to}) {
    _report = report;
    _expenses = expenses;
    if (from != null) _from = from;
    if (to != null) _to = to;
    _loading = false;
    _error = null;
    notifyListeners();
  }

  void clear() {
    _report = null;
    _expenses = const [];
    _error = null;
    notifyListeners();
  }
}
