// لقطات شاشة حقيقية للتطبيق (بالخطوط والألوان الفعلية) لمراجعة التصميم.
// تُشغَّل يدوياً من GitHub Actions:  flutter test test_screens --update-goldens
// ignore_for_file: invalid_use_of_visible_for_testing_member
import 'dart:convert';
import 'dart:io';

import 'package:cobbler_accounting/core/api_client.dart';
import 'package:cobbler_accounting/core/session_storage.dart';
import 'package:cobbler_accounting/main.dart';
import 'package:cobbler_accounting/models/accounting_report.dart';
import 'package:cobbler_accounting/models/employee.dart';
import 'package:cobbler_accounting/state/accounting_controller.dart';
import 'package:cobbler_accounting/state/auth_controller.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';

class _FakeAccounting extends AccountingController {
  _FakeAccounting(super.api);
  @override
  Future<void> load() async {}
}

const _fixture = '''
{"vat":{"input_vat":96.52,"output_vat":736.25,"net_vat_due":639.73,"taxable_sales":4908.35,"taxable_purchases":420,"input_vat_expenses":33.52,"input_vat_purchases":63},
"trend":[{"month":"2025-11","revenue":0,"costs":0},{"month":"2025-12","revenue":0,"costs":0},{"month":"2026-01","revenue":0,"costs":0},{"month":"2026-02","revenue":0,"costs":0},{"month":"2026-03","revenue":0,"costs":0},{"month":"2026-04","revenue":0,"costs":0},{"month":"2026-05","revenue":0,"costs":0},{"month":"2026-06","revenue":0,"costs":0},{"month":"2026-07","revenue":0,"costs":10},{"month":"2026-08","revenue":0,"costs":0},{"month":"2026-09","revenue":4826.92,"costs":1600},{"month":"2026-10","revenue":81.43,"costs":20}],
"counts":{"sales":52},
"ledger":[{"net":30.43,"ref":"NT2610259466","vat":4.57,"date":"2026-10-25","kind":"repair","sign":1,"party":"عميل أ","total":35,"status":"paid"},{"net":24,"ref":"INV-51337246","vat":3.6,"date":"2026-10-25","kind":"product","sign":1,"party":"عميل نقدي","total":27.6},{"net":27,"ref":"INV-01000","vat":4.05,"date":"2026-10-23","kind":"partner","sign":1,"party":"شركة تجريبية","total":31.05},{"net":1376.48,"ref":"إيجار سبتمبر","vat":0,"date":"2026-09-30","kind":"expense","sign":-1,"party":"rent","total":1376.48},{"net":420,"ref":"PI-0007","vat":63,"date":"2026-09-20","kind":"purchase","sign":-1,"party":"مورد الجلود","total":483},{"net":213.04,"ref":"NT2609189362","vat":31.96,"date":"2026-09-18","kind":"repair","sign":1,"party":"عميل ب","total":245,"status":"unpaid"}],
"balances":{"payable":483,"receivable":4850.95,"payable_docs":1,"receivable_docs":39},
"income_statement":{"net_profit":3288.35,"gross_profit":4888.35,"cogs_products":20,"revenue_total":4908.35,"cogs_materials":0,"net_margin_pct":67.0,"revenue_repair":4857.35,"revenue_partners":27,"revenue_products":24,"operating_expenses":1600,"materials_estimated":false,"revenue_adjustments":0},
"inventory_purchases":420,"expenses_by_category":[{"category":"rent","amount":1376.48},{"category":"electricity","amount":223.52}]}
''';

Future<void> _loadFonts() async {
  Future<void> family(String name, List<String> files) async {
    final loader = FontLoader(name);
    for (final f in files) {
      final bytes = File(f).readAsBytesSync();
      loader.addFont(Future.value(ByteData.view(bytes.buffer)));
    }
    await loader.load();
  }

  await family('IBMPlexSansArabic', [
    'assets/fonts/IBMPlexSansArabic-Regular.ttf',
    'assets/fonts/IBMPlexSansArabic-SemiBold.ttf',
    'assets/fonts/IBMPlexSansArabic-Bold.ttf',
  ]);
  await family('SaudiRiyal', ['assets/fonts/SaudiRiyal.ttf']);
  // أيقونات Material من حزمة Flutter نفسها
  final flutterRoot = Platform.environment['FLUTTER_ROOT'];
  if (flutterRoot != null) {
    final icons = File('$flutterRoot/bin/cache/artifacts/material_fonts/MaterialIcons-Regular.otf');
    if (icons.existsSync()) await family('MaterialIcons', [icons.path]);
  }
}

void main() {
  setUpAll(_loadFonts);

  Future<void> shot(WidgetTester tester, String name, Size size, {int tab = -1, bool login = false}) async {
    tester.view.physicalSize = size * 3;
    tester.view.devicePixelRatio = 3;
    addTearDown(tester.view.reset);

    final api = ApiClient(SessionStorage());
    final auth = AuthController(api, SessionStorage());
    final acc = _FakeAccounting(api)
      ..debugSet(
        AccountingReport.fromJson(jsonDecode(_fixture) as Map<String, dynamic>),
        [
          Expense.fromJson({'id': '1', 'category': 'rent', 'description': 'إيجار سبتمبر', 'amount': 1376.48, 'expense_date': '2026-09-30'}),
          Expense.fromJson({'id': '2', 'category': 'electricity', 'description': 'فاتورة الكهرباء', 'amount': 257.05, 'vat_amount': 33.53, 'expense_date': '2026-09-28', 'has_tax_invoice': true}),
        ],
        from: DateTime(2026, 9, 1),
        to: DateTime(2026, 10, 31),
      );
    if (login) {
      auth.debugSignedOut('الرمز غير صحيح');
    } else {
      auth.debugSignIn(const Employee(id: 'x', name: 'عبدالله', role: 'owner'));
    }

    await tester.runAsync(() async {
      await tester.pumpWidget(MultiProvider(
        providers: [
          ChangeNotifierProvider<AuthController>.value(value: auth),
          ChangeNotifierProvider<AccountingController>.value(value: acc),
        ],
        child: const CobblerAccountingApp(),
      ));
      for (final el in find.byType(Image).evaluate()) {
        await precacheImage((el.widget as Image).image, el);
      }
    });
    await tester.pumpAndSettle(const Duration(milliseconds: 400));

    if (tab > 0) {
      const labels = ['نظرة عامة', 'القوائم', 'الدفتر', 'المصاريف'];
      await tester.tap(find.text(labels[tab]).last);
      await tester.pumpAndSettle();
    }
    await expectLater(find.byType(MaterialApp), matchesGoldenFile('shots/$name.png'));
  }

  const phone = Size(390, 844);
  const desktop = Size(1280, 860);

  testWidgets('login', (t) => shot(t, '0-login', phone, login: true));
  testWidgets('overview', (t) => shot(t, '1-overview', const Size(390, 1300)));
  testWidgets('statements', (t) => shot(t, '2-statements', const Size(390, 1750), tab: 1));
  testWidgets('ledger', (t) => shot(t, '3-ledger', phone, tab: 2));
  testWidgets('expenses', (t) => shot(t, '4-expenses', phone, tab: 3));
  testWidgets('desktop', (t) => shot(t, '5-desktop', desktop));
}
