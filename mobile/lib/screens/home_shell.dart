import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../state/accounting_controller.dart';
import '../state/auth_controller.dart';
import '../theme.dart';
import 'expenses_screen.dart';
import 'ledger_screen.dart';
import 'overview_screen.dart';
import 'statements_screen.dart';

/// الهيكل الرئيسي: شريط سفلي على الجوال، وشريط جانبي على الشاشات العريضة
/// (تابلت/كمبيوتر) — نفس أقسام الموقع.
class HomeShell extends StatefulWidget {
  const HomeShell({super.key});

  @override
  State<HomeShell> createState() => _HomeShellState();
}

class _HomeShellState extends State<HomeShell> {
  int _index = 0;

  static const _pages = <Widget>[OverviewScreen(), StatementsScreen(), LedgerScreen(), ExpensesScreen()];
  static const _items = [
    (Icons.space_dashboard_outlined, Icons.space_dashboard_rounded, 'نظرة عامة'),
    (Icons.account_balance_outlined, Icons.account_balance_rounded, 'القوائم'),
    (Icons.receipt_long_outlined, Icons.receipt_long_rounded, 'الدفتر'),
    (Icons.payments_outlined, Icons.payments_rounded, 'المصاريف'),
  ];

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => context.read<AccountingController>().load());
  }

  Future<void> _confirmLogout() async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (c) => AlertDialog(
        backgroundColor: AC.s1,
        title: const Text('تسجيل الخروج'),
        content: const Text('سيُطلب منك الرمز السري عند الدخول القادم.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(c, false), child: Text('إلغاء', style: TextStyle(color: AC.mu))),
          FilledButton(
            onPressed: () => Navigator.pop(c, true),
            style: FilledButton.styleFrom(backgroundColor: AC.gold, foregroundColor: AC.bg),
            child: const Text('خروج'),
          ),
        ],
      ),
    );
    if (ok == true && mounted) {
      context.read<AccountingController>().clear();
      await context.read<AuthController>().logout();
    }
  }

  @override
  Widget build(BuildContext context) {
    final emp = context.watch<AuthController>().employee;
    final wide = MediaQuery.sizeOf(context).width >= 900;

    final appBar = AppBar(
      titleSpacing: 16,
      toolbarHeight: 60,
      title: Row(children: [
        Image.asset('assets/images/cobblers-official-mark-white.png', height: 30),
        const SizedBox(width: 10),
        const Text('إبرة وخيط الإسكافي', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700)),
      ]),
      actions: [
        if (emp != null)
          Padding(
            padding: const EdgeInsetsDirectional.only(end: 4),
            child: Column(mainAxisAlignment: MainAxisAlignment.center, crossAxisAlignment: CrossAxisAlignment.end, children: [
              Text(emp.name, style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w600)),
              Text(emp.roleLabel, style: TextStyle(fontSize: 10.5, color: AC.fa)),
            ]),
          ),
        IconButton(tooltip: 'تسجيل الخروج', onPressed: _confirmLogout, icon: Icon(Icons.logout_rounded, color: AC.mu)),
        const SizedBox(width: 6),
      ],
      bottom: PreferredSize(preferredSize: const Size.fromHeight(1), child: Container(height: 1, color: AC.line)),
    );

    final body = IndexedStack(index: _index, children: _pages);

    if (wide) {
      return Scaffold(
        appBar: appBar,
        body: Row(children: [
          NavigationRail(
            backgroundColor: AC.s1,
            selectedIndex: _index,
            onDestinationSelected: (i) => setState(() => _index = i),
            labelType: NavigationRailLabelType.all,
            indicatorColor: AC.goldSoft,
            selectedIconTheme: const IconThemeData(color: AC.gold),
            unselectedIconTheme: IconThemeData(color: AC.mu),
            selectedLabelTextStyle: const TextStyle(color: AC.gold, fontWeight: FontWeight.w700, fontSize: 12),
            unselectedLabelTextStyle: TextStyle(color: AC.mu, fontSize: 12),
            destinations: [
              for (final it in _items)
                NavigationRailDestination(icon: Icon(it.$1), selectedIcon: Icon(it.$2), label: Text(it.$3)),
            ],
          ),
          Container(width: 1, color: AC.line),
          Expanded(child: body),
        ]),
      );
    }

    return Scaffold(
      appBar: appBar,
      body: body,
      bottomNavigationBar: NavigationBar(
        selectedIndex: _index,
        onDestinationSelected: (i) => setState(() => _index = i),
        destinations: [
          for (final it in _items) NavigationDestination(icon: Icon(it.$1), selectedIcon: Icon(it.$2), label: it.$3),
        ],
      ),
    );
  }
}
