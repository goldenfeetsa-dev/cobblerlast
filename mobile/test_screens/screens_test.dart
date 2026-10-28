// لقطات شاشة حقيقية للتطبيق (بالخطوط والألوان الفعلية) لمراجعة التصميم.
// تُشغَّل يدوياً من GitHub Actions:  flutter test test_screens --update-goldens
// ignore_for_file: invalid_use_of_visible_for_testing_member
import 'dart:convert';
import 'dart:io';

import 'package:cobbler_accounting/core/api_client.dart';
import 'package:cobbler_accounting/core/session_storage.dart';
import 'package:cobbler_accounting/main.dart';
import 'package:cobbler_accounting/models/employee.dart';
import 'package:cobbler_accounting/pos/pos_shell.dart';
import 'package:cobbler_accounting/pos/pos_ui.dart';
import 'package:cobbler_accounting/pos/receipt.dart';
import 'package:cobbler_accounting/models/order.dart';
import 'package:cobbler_accounting/screens/login_screen.dart';
import 'package:cobbler_accounting/pos/screens/order_details_screen.dart';
import 'package:cobbler_accounting/state/auth_controller.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_test/flutter_test.dart';

final _now = DateTime.now();
String _ago(int h) => _now.subtract(Duration(hours: h)).toUtc().toIso8601String();

final _orders = [
  for (var i = 0; i < 8; i++)
    {
      'id': '00000000-0000-0000-0000-00000000000$i',
      'order_number': 'NT26102${i}9466',
      'customer_name': ['محمد', 'سارة', 'فهد', 'نورة', 'خالد', 'ريم', 'عبدالله', 'هند'][i],
      'customer_phone': '05000000${10 + i}',
      'employee_name': 'الكاشير',
      'item_type': ['shoes', 'bag', 'shoes', 'bag', 'jacket', 'shoes', 'bag', 'other'][i],
      'quantity': 1 + i % 2,
      'status': ['pending', 'in_progress', 'ready', 'completed', 'pending', 'cancelled'][i % 6],
      'payment_status': i.isOdd ? 'paid' : 'unpaid',
      'payment_method': i % 3 == 0 ? 'network' : 'cash',
      'total_price': 35 + i * 20.5,
      'subtotal': (35 + i * 20.5) / 1.15,
      'vat_amount': (35 + i * 20.5) - (35 + i * 20.5) / 1.15,
      'photos': <String>[],
      'created_at': _ago(i * 9),
      'delivery_method': 'pickup',
      'shelf_location': i == 3 ? 'A3' : null,
      'description': 'تغيير نعل وتلميع',
      'delivery_date': '2026-10-30',
      'order_items': [
        {'item_type': 'shoes', 'services': ['تلميع', 'تغيير نعل'], 'technician_name': 'أحمد'}
      ],
      'points_earned': 3,
    }
];

final _customers = [
  for (final (i, n) in ['محمد', 'سارة', 'فهد', 'نورة', 'خالد', 'ريم'].indexed)
    {'id': 'c$i', 'name': n, 'phone': '05000000${10 + i}', 'total_orders': i + 1, 'total_spent': 100 * i + 35, 'loyalty_points': i * 5}
];

const _report = '''
{"vat":{"input_vat":96.52,"output_vat":736.25,"net_vat_due":639.73,"taxable_sales":4908.35,"taxable_purchases":420,"input_vat_expenses":33.52,"input_vat_purchases":63},
"trend":[{"month":"2025-11","revenue":0,"costs":0},{"month":"2025-12","revenue":0,"costs":0},{"month":"2026-01","revenue":0,"costs":0},{"month":"2026-02","revenue":0,"costs":0},{"month":"2026-03","revenue":0,"costs":0},{"month":"2026-04","revenue":0,"costs":0},{"month":"2026-05","revenue":0,"costs":0},{"month":"2026-06","revenue":0,"costs":0},{"month":"2026-07","revenue":0,"costs":10},{"month":"2026-08","revenue":0,"costs":0},{"month":"2026-09","revenue":4826.92,"costs":1600},{"month":"2026-10","revenue":81.43,"costs":20}],
"counts":{"sales":52},
"ledger":[{"net":30.43,"ref":"NT2610259466","vat":4.57,"date":"2026-10-25","kind":"repair","sign":1,"party":"عميل أ","total":35,"status":"paid"},{"net":1376.48,"ref":"إيجار سبتمبر","vat":0,"date":"2026-09-30","kind":"expense","sign":-1,"party":"rent","total":1376.48}],
"balances":{"payable":483,"receivable":4850.95,"payable_docs":1,"receivable_docs":39},
"income_statement":{"net_profit":3288.35,"gross_profit":4888.35,"cogs_products":20,"revenue_total":4908.35,"cogs_materials":0,"net_margin_pct":67.0,"revenue_repair":4857.35,"revenue_partners":27,"revenue_products":24,"operating_expenses":1600,"materials_estimated":false,"revenue_adjustments":0},
"inventory_purchases":420,"expenses_by_category":[{"category":"rent","amount":1376.48},{"category":"electricity","amount":223.52}]}
''';

final _employees = [
  {'id': 'e1', 'name': 'أبو فهد', 'role': 'owner', 'branch_name': 'الفرع الرئيسي', 'is_active': true, 'total_orders': 120, 'total_revenue': 18400},
  {'id': 'e2', 'name': 'سارة', 'role': 'cashier', 'branch_name': 'الفرع الرئيسي', 'is_active': true, 'total_orders': 64, 'total_revenue': 9200},
  {'id': 'e3', 'name': 'محمد الفني', 'role': 'staff', 'branch_name': 'الفرع الرئيسي', 'is_active': true, 'total_orders': 80, 'total_revenue': 0},
  {'id': 'e4', 'name': 'خالد', 'role': 'accountant', 'branch_name': '', 'is_active': false, 'total_orders': 0, 'total_revenue': 0},
];
final _bookings = [
  {'id': 'b1', 'booking_number': 'BK1029', 'customer_name': 'نورة', 'customer_phone': '0551234567', 'booking_date': '2026-10-29', 'booking_time': '10:00', 'booking_type': 'home_visit', 'service_name': 'تلميع حذاء', 'status': 'pending', 'total_price': 60, 'item_photos': ['x'], 'latitude': 24.7, 'longitude': 46.6},
  {'id': 'b2', 'booking_number': 'BK1030', 'customer_name': 'فيصل', 'customer_phone': '0509876543', 'booking_date': '2026-10-28', 'booking_time': '17:30', 'booking_type': 'in_store', 'service_name': 'تبديل نعل', 'status': 'completed', 'total_price': 120},
];
final _auditLogs = [
  {'id': 'a1', 'employee_name': 'أبو فهد', 'employee_role': 'owner', 'page': 'الموظفون', 'action': 'create', 'entity': 'employee', 'entity_id': 'e2abcdef12', 'created_at': '2026-10-27T09:12:00Z'},
  {'id': 'a2', 'employee_name': 'سارة', 'employee_role': 'cashier', 'page': 'الطلبات', 'action': 'update', 'entity': 'order', 'entity_id': '00000000-1', 'created_at': '2026-10-27T11:40:00Z'},
];

/// خادم وهمي يرد بنفس شكل بوابة الموقع.
class _FakeApi extends ApiClient {
  _FakeApi() : super(SessionStorage());

  @override
  Future<dynamic> request(String method, String path, {Map<String, dynamic>? query, Object? data, Map<String, String>? headers}) async {
    if (path.endsWith('/orders')) {
      final id = query?['id']?.toString();
      if (id != null && id.startsWith('eq.')) return _orders.where((o) => o['id'] == id.substring(3)).toList();
      return _orders;
    }
    if (path.endsWith('/sales_invoices')) return const [];
    if (path.endsWith('/employees')) return _employees;
    if (path.endsWith('/bookings')) return _bookings;
    if (path.endsWith('/audit_logs')) return _auditLogs;
    if (path == '/api/secure/data' && query?['resource'] == 'customers') return _customers;
    return const [];
  }

  @override
  Future<Map<String, dynamic>> accountingReport(DateTime from, DateTime to) async => jsonDecode(_report) as Map<String, dynamic>;

  @override
  Future<List<Map<String, dynamic>>> listExpenses(DateTime from, DateTime to) async => const [];
}

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
  final root = Platform.environment['FLUTTER_ROOT'];
  if (root != null) {
    final icons = File('$root/bin/cache/artifacts/material_fonts/MaterialIcons-Regular.otf');
    if (icons.existsSync()) await family('MaterialIcons', [icons.path]);
  }
}

void main() {
  setUpAll(_loadFonts);

  Future<void> shot(WidgetTester tester, String name, Size size, Widget home, {String role = 'owner', bool signedOut = false}) async {
    tester.view.physicalSize = size * 3;
    tester.view.devicePixelRatio = 3;
    addTearDown(tester.view.reset);

    final api = _FakeApi();
    final auth = AuthController(api, SessionStorage());
    if (signedOut) {
      auth.debugSignedOut('الرمز غير صحيح');
    } else {
      auth.debugSignIn(Employee(id: 'x', name: 'عبدالله', role: role));
    }

    await tester.runAsync(() async {
      await tester.pumpWidget(AppProviders(
        api: api,
        auth: auth,
        child: MaterialApp(
          debugShowCheckedModeBanner: false,
          theme: Pos.theme(),
          locale: const Locale('ar', 'SA'),
          supportedLocales: const [Locale('ar', 'SA')],
          localizationsDelegates: const [GlobalMaterialLocalizations.delegate, GlobalWidgetsLocalizations.delegate, GlobalCupertinoLocalizations.delegate],
          home: home,
        ),
      ));
      await Future<void>.delayed(const Duration(milliseconds: 300));
      for (final el in find.byType(Image).evaluate()) {
        await precacheImage((el.widget as Image).image, el);
      }
    });
    await tester.pump(const Duration(milliseconds: 400));
    await tester.pump(const Duration(milliseconds: 400));
    await expectLater(find.byType(MaterialApp), matchesGoldenFile('shots/$name.png'));
  }

  const phone = Size(390, 844);
  const tall = Size(390, 1400);
  const desktop = Size(1366, 900);

  testWidgets('login', (t) => shot(t, '00-login', phone, const LoginScreen(), signedOut: true));
  testWidgets('dashboard-desktop', (t) => shot(t, '01-dashboard-desktop', desktop, const PosShell(initial: 'pos')));
  testWidgets('dashboard-phone', (t) => shot(t, '02-dashboard-phone', tall, const PosShell(initial: 'pos')));
  testWidgets('orders-desktop', (t) => shot(t, '03-orders-desktop', desktop, const PosShell(initial: 'orders')));
  testWidgets('orders-phone', (t) => shot(t, '04-orders-phone', tall, const PosShell(initial: 'orders')));
  testWidgets('order-details', (t) => shot(t, '05-order-details', const Size(390, 1900), const OrderDetailsScreen(orderId: '00000000-0000-0000-0000-000000000002')));
  testWidgets('order-details-desktop', (t) => shot(t, '06-order-details-desktop', desktop, const OrderDetailsScreen(orderId: '00000000-0000-0000-0000-000000000001')));
  testWidgets('customers', (t) => shot(t, '07-customers', desktop, const PosShell(initial: 'customers')));
  testWidgets('staff', (t) => shot(t, '08-staff', tall, const PosShell(), role: 'staff'));
  testWidgets('new-order', (t) => shot(t, '10-new-order', const Size(390, 2300), const PosShell(initial: 'new-order'), role: 'cashier'));
  testWidgets('receipt', (t) => shot(t, '11-receipt', const Size(390, 1300),
      Scaffold(backgroundColor: const Color(0xFFEEEEEE), body: SingleChildScrollView(child: Center(child: Receipt(order: Order(_orders[2]), shop: ShopInfo.fallback))))));
  testWidgets('scan', (t) => shot(t, '12-scan', phone, const PosShell(initial: 'scan')));
  testWidgets('invoices', (t) => shot(t, '13-invoices', desktop, const PosShell(initial: 'invoices')));
  testWidgets('sales', (t) => shot(t, '14-sales', desktop, const PosShell(initial: 'sales')));
  testWidgets('purchasing', (t) => shot(t, '15-purchasing', desktop, const PosShell(initial: 'purchasing')));
  testWidgets('returns', (t) => shot(t, '16-returns', phone, const PosShell(initial: 'returns')));
  testWidgets('partners', (t) => shot(t, '17-partners', desktop, const PosShell(initial: 'partners')));
  testWidgets('employees', (t) => shot(t, '18-employees', desktop, const PosShell(initial: 'employees')));
  testWidgets('leaderboard', (t) => shot(t, '19-leaderboard', tall, const PosShell(initial: 'leaderboard')));
  testWidgets('audit', (t) => shot(t, '20-audit', desktop, const PosShell(initial: 'audit')));
  testWidgets('bookings', (t) => shot(t, '21-bookings', tall, const PosShell(initial: 'bookings')));
  testWidgets('accounting', (t) => shot(t, '09-accounting', desktop, const PosShell(initial: 'accounting')));
}
