import 'dart:convert';

import 'package:cobbler_accounting/core/api_client.dart';
import 'package:cobbler_accounting/models/accounting_report.dart';
import 'package:cobbler_accounting/models/employee.dart';
import 'package:cobbler_accounting/state/accounting_controller.dart';
import 'package:cobbler_accounting/theme.dart';
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';

/// رد حقيقي مختصر من accounting_report (سبتمبر–أكتوبر 2026، بأسماء مستبدلة).
const _sample = '''
{"vat":{"input_vat":0,"output_vat":736.25,"net_vat_due":736.25,"taxable_sales":4908.35,"taxable_purchases":0,"input_vat_expenses":0,"input_vat_purchases":0},
 "trend":[{"net":0,"costs":0,"month":"2026-08","revenue":0},{"net":4826.92,"costs":0,"month":"2026-09","revenue":4826.92},{"net":61.43,"costs":20,"month":"2026-10","revenue":81.43}],
 "counts":{"notes":0,"sales":52,"expenses":0,"purchases":0},
 "ledger":[{"net":30.43,"ref":"NT2610259466","vat":4.57,"date":"2026-10-25","kind":"repair","sign":1,"party":"عميل","total":35,"status":"paid"},
           {"net":100,"ref":"كهرباء","vat":15,"date":"2026-10-20","kind":"expense","sign":-1,"party":"electricity","total":115,"status":null}],
 "balances":{"payable":0,"receivable":4850.95,"payable_docs":0,"receivable_docs":39},
 "income_statement":{"net_profit":4888.35,"gross_profit":4888.35,"cogs_products":20,"revenue_total":4908.35,"cogs_materials":0,"net_margin_pct":99.6,"revenue_repair":4857.35,"cost_of_revenue":20,"revenue_partners":27,"revenue_products":24,"operating_expenses":0,"materials_estimated":false,"revenue_adjustments":0},
 "inventory_purchases":0,"expenses_by_category":[]}
''';

void main() {
  group('AccountingReport', () {
    test('يقرأ رد المحرك كاملاً بنفس أرقام الموقع', () {
      final r = AccountingReport.fromJson(jsonDecode(_sample) as Map<String, dynamic>);
      expect(r.income.revenueTotal, 4908.35);
      expect(r.income.revenueRepair + r.income.revenueProducts + r.income.revenuePartners, closeTo(4908.35, .001));
      expect(r.income.netMarginPct, 99.6);
      expect(r.vat.netVatDue, 736.25);
      expect(r.balances.receivableDocs, 39);
      expect(r.trend, hasLength(3));
      expect(r.trend.last.net, closeTo(61.43, .001));
      expect(r.ledger.first.kind, 'repair');
      expect(r.ledger.last.sign, -1);
      expect(r.salesDocs, 52);
    });

    test('يتحمّل الحقول الناقصة والأرقام كنصوص', () {
      final r = AccountingReport.fromJson({
        'income_statement': {'revenue_total': '12.50', 'net_margin_pct': null},
      });
      expect(r.income.revenueTotal, 12.5);
      expect(r.income.netMarginPct, isNull);
      expect(r.ledger, isEmpty);
      expect(r.balances.payable, 0);
    });
  });

  group('Employee', () {
    test('صلاحية المركز المحاسبي = نفس FINANCE_ROLES في الموقع', () {
      for (final role in ['owner', 'admin', 'manager', 'accountant']) {
        expect(Employee.fromJson({'id': '1', 'name': 'x', 'role': role}).isFinance, isTrue, reason: role);
      }
      for (final role in ['cashier', 'staff', '']) {
        expect(Employee.fromJson({'id': '1', 'name': 'x', 'role': role}).isFinance, isFalse, reason: role);
      }
    });
  });

  group('Session cookie', () {
    Headers h(List<String> v) => Headers.fromMap({'set-cookie': v});

    test('يستخرج nt_session ومدته من ترويسة الخادم', () {
      final c = ApiClient.extractSessionCookie(
          h(['nt_session=eyJhYmMiOjF9.c2ln; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=43200']));
      expect(c, isNotNull);
      expect(c!.value, 'eyJhYmMiOjF9.c2ln');
      final hours = c.expiresAt.difference(DateTime.now()).inMinutes / 60;
      expect(hours, closeTo(12, .1));
    });

    test('يتجاهل الكوكيز الأخرى ويقبل عدة كوكيز في سطر واحد', () {
      final c = ApiClient.extractSessionCookie(h(['other=1; Path=/, nt_session=tok.sig; Path=/; Max-Age=600']));
      expect(c?.value, 'tok.sig');
    });

    test('يرجع null عند غياب الجلسة أو قيمة فارغة (تسجيل خروج)', () {
      expect(ApiClient.extractSessionCookie(h(['nt_session=; Path=/; Max-Age=0'])), isNull);
      expect(ApiClient.extractSessionCookie(h([])), isNull);
    });
  });

  group('Periods', () {
    final now = DateTime(2026, 10, 28);
    test('هذا الشهر / الشهر الماضي', () {
      expect(rangeFor(Period.thisMonth, now), (DateTime(2026, 10, 1), DateTime(2026, 10, 31)));
      expect(rangeFor(Period.lastMonth, now), (DateTime(2026, 9, 1), DateTime(2026, 9, 30)));
    });
    test('الربع الحالي والسابق (يشمل تجاوز السنة)', () {
      expect(rangeFor(Period.thisQuarter, now), (DateTime(2026, 10, 1), DateTime(2026, 12, 31)));
      expect(rangeFor(Period.lastQuarter, now), (DateTime(2026, 7, 1), DateTime(2026, 9, 30)));
      expect(rangeFor(Period.lastQuarter, DateTime(2026, 2, 10)), (DateTime(2025, 10, 1), DateTime(2025, 12, 31)));
    });
  });

  group('Formatting', () {
    test('تنسيق المبالغ مطابق للموقع', () {
      expect(money(4908.35), '4,908.35');
      expect(money(0), '0.00');
      expect(moneyShort(48500), '48.5K');
      expect(monthLabel('2026-10'), 'أكتوبر');
    });
  });
}
