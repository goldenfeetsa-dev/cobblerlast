import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';

import '../core/config.dart';
import '../models/employee.dart';
import '../screens/accounting_section.dart';
import '../state/accounting_controller.dart';
import '../state/auth_controller.dart';
import 'pos_ui.dart';
import 'screens/customers_screen.dart';
import 'screens/dashboard_screen.dart';
import 'screens/new_order_screen.dart';
import 'screens/orders_screen.dart';
import 'screens/staff_screens.dart';

/// عنصر في القائمة الجانبية — نفس navGroups في src/components/pos/Sidebar.jsx
/// (نفس الترتيب، الأيقونات، الألوان، وقواعد الظهور حسب الدور).
class NavItem {
  const NavItem(this.id, this.label, this.icon, this.tone, {this.adminOnly = false, this.financeOnly = false, this.workerOnly = false, this.hideForWorker = false});
  final String id;
  final String label;
  final IconData icon;
  final Tone tone;
  final bool adminOnly, financeOnly, workerOnly, hideForWorker;

  bool visibleFor(Employee e) {
    final admin = {'owner', 'admin', 'manager'}.contains(e.role);
    final finance = admin || e.role == 'accountant';
    final worker = e.role == 'staff';
    if (adminOnly && !admin) return false;
    if (financeOnly && !finance) return false;
    if (workerOnly && !worker) return false;
    if (hideForWorker && worker) return false;
    return true;
  }
}

class NavGroup {
  const NavGroup(this.label, this.items);
  final String? label;
  final List<NavItem> items;
}

/// الأقسام المتاحة حالياً في التطبيق (تُضاف البقية تباعاً بنفس الترتيب).
const navGroups = <NavGroup>[
  NavGroup(null, [
    NavItem('pos', 'لوحة التحكم', Icons.grid_view_rounded, Tone.blue, adminOnly: true),
    NavItem('new-order', 'طلب جديد', Icons.add_circle_outline_rounded, Tone.green, hideForWorker: true),
    NavItem('staff', 'مهامي 🔧', Icons.content_cut_rounded, Tone.orange, workerOnly: true),
    NavItem('orders', 'الطلبات', Icons.format_list_bulleted_rounded, Tone.indigo),
  ]),
  NavGroup('العملاء والفريق', [
    NavItem('customers', 'العملاء', Icons.groups_rounded, Tone.blue, hideForWorker: true),
  ]),
  NavGroup('التقارير', [
    NavItem('accounting', 'المركز المحاسبي', Icons.account_balance_rounded, Tone.orange, financeOnly: true),
  ]),
];

/// الصفحة الافتراضية بعد الدخول حسب الدور — getHomePath في roles.js
String homeFor(Employee e) {
  if (e.role == 'staff') return 'staff';
  if (e.role == 'cashier') return 'new-order';
  if (e.role == 'accountant') return 'accounting';
  return 'pos';
}

class PosShell extends StatefulWidget {
  const PosShell({super.key, this.initial});

  /// للاختبارات فقط: يفتح قسماً محدداً بدل الصفحة الافتراضية للدور.
  final String? initial;

  @override
  State<PosShell> createState() => _PosShellState();
}

class _PosShellState extends State<PosShell> {
  late String _current;
  final _scaffold = GlobalKey<ScaffoldState>();

  @override
  void initState() {
    super.initState();
    _current = widget.initial ?? homeFor(context.read<AuthController>().employee!);
  }

  void _go(String id) {
    setState(() => _current = id);
    if (_scaffold.currentState?.isDrawerOpen ?? false) Navigator.of(context).pop();
  }

  Widget _page(String id) => switch (id) {
        'pos' => DashboardScreen(onOpenOrders: () => _go('orders')),
        'staff' => const StaffTasksScreen(),
        'new-order' => NewOrderScreen(onCreated: (_) => _go('orders')),
        'orders' => const OrdersScreen(),
        'customers' => const CustomersScreen(),
        'accounting' => const AccountingSection(),
        _ => const OrdersScreen(),
      };

  Future<void> _logout() async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (c) => AlertDialog(
        title: const Text('تسجيل الخروج'),
        content: const Text('سيُطلب منك الرمز السري عند الدخول القادم.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(c, false), child: const Text('إلغاء')),
          FilledButton(onPressed: () => Navigator.pop(c, true), child: const Text('خروج')),
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
    final me = context.watch<AuthController>().employee!;
    final wide = MediaQuery.sizeOf(context).width >= 1000;
    final groups = [
      for (final g in navGroups)
        if (g.items.any((i) => i.visibleFor(me))) NavGroup(g.label, g.items.where((i) => i.visibleFor(me)).toList()),
    ];
    if (!groups.any((g) => g.items.any((i) => i.id == _current))) _current = groups.first.items.first.id;
    final title = groups.expand((g) => g.items).firstWhere((i) => i.id == _current).label;

    final sidebar = _Sidebar(groups: groups, current: _current, me: me, onTap: _go, onLogout: _logout);
    final body = KeyedSubtree(key: ValueKey(_current), child: _page(_current));

    if (wide) {
      return Scaffold(
        backgroundColor: Colors.transparent,
        body: PosBackground(
          child: Row(children: [
            SizedBox(width: 256, child: sidebar),
            Expanded(child: SafeArea(child: body)),
          ]),
        ),
      );
    }

    return Scaffold(
      key: _scaffold,
      backgroundColor: Colors.transparent,
      drawer: Drawer(width: 270, backgroundColor: Colors.transparent, child: sidebar),
      body: PosBackground(
        child: SafeArea(
          child: Column(children: [
            Container(
              height: 56,
              padding: const EdgeInsets.symmetric(horizontal: 8),
              decoration: const BoxDecoration(color: Pos.glass, border: Border(bottom: BorderSide(color: Pos.border))),
              child: Row(children: [
                IconButton(onPressed: () => _scaffold.currentState?.openDrawer(), icon: const Icon(Icons.menu_rounded), tooltip: 'القائمة'),
                Image.asset('assets/images/cobblers-official-mark.png', height: 24, color: Pos.fg),
                const SizedBox(width: 8),
                Expanded(child: Text(title, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15), overflow: TextOverflow.ellipsis)),
              ]),
            ),
            Expanded(child: body),
          ]),
        ),
      ),
    );
  }
}

class _Sidebar extends StatelessWidget {
  const _Sidebar({required this.groups, required this.current, required this.me, required this.onTap, required this.onLogout});
  final List<NavGroup> groups;
  final String current;
  final Employee me;
  final ValueChanged<String> onTap;
  final VoidCallback onLogout;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        color: Color(0xD9FFFFFF),
        border: BorderDirectional(end: BorderSide(color: Pos.glassBorder)),
      ),
      child: SafeArea(
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 22, 20, 12),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Image.asset('assets/images/cobblers-official-mark.png', height: 42, color: Pos.fg, semanticLabel: 'إبرة وخيط الإسكافي'),
              const SizedBox(height: 8),
              const Text('نظام إدارة الورشة والمبيعات', style: TextStyle(fontSize: 11, color: Pos.muted)),
            ]),
          ),
          Expanded(
            child: ListView(
              padding: const EdgeInsets.symmetric(horizontal: 8),
              children: [
                for (final g in groups) ...[
                  if (g.label != null)
                    Padding(
                      padding: const EdgeInsets.fromLTRB(12, 14, 12, 6),
                      child: Text(g.label!, style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: Color(0x8C151B2C))),
                    ),
                  for (final it in g.items) _tile(it),
                ],
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(12, 0, 12, 10),
            child: OutlinedButton.icon(
              onPressed: () => launchUrl(Uri.parse('${AppConfig.apiBase}/booking'), mode: LaunchMode.externalApplication),
              icon: const Icon(Icons.open_in_new_rounded, size: 18),
              label: const Text('موقع الحجز الإلكتروني'),
              style: OutlinedButton.styleFrom(
                foregroundColor: Pos.fg,
                backgroundColor: const Color(0x80FFFFFF),
                side: const BorderSide(color: Pos.glassBorder),
                padding: const EdgeInsets.symmetric(vertical: 12),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
            ),
          ),
          Container(
            padding: const EdgeInsets.fromLTRB(18, 12, 10, 14),
            decoration: const BoxDecoration(border: Border(top: BorderSide(color: Pos.border))),
            child: Row(children: [
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(me.name, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13.5)),
                  Text(me.roleLabel, style: const TextStyle(fontSize: 11.5, color: Pos.muted)),
                ]),
              ),
              IconButton(onPressed: onLogout, icon: const Icon(Icons.logout_rounded, size: 19, color: Pos.muted), tooltip: 'تسجيل الخروج'),
            ]),
          ),
        ]),
      ),
    );
  }

  Widget _tile(NavItem it) {
    final active = it.id == current;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 1.5),
      child: Material(
        color: active ? const Color(0xCCFFFFFF) : Colors.transparent,
        borderRadius: BorderRadius.circular(12),
        elevation: active ? 1 : 0,
        shadowColor: const Color(0x331F2D5A),
        child: InkWell(
          borderRadius: BorderRadius.circular(12),
          onTap: () => onTap(it.id),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
            child: Row(children: [
              IosTile(it.icon, it.tone),
              const SizedBox(width: 12),
              Expanded(
                child: Text(it.label,
                    style: TextStyle(fontSize: 13.5, fontWeight: active ? FontWeight.w700 : FontWeight.w400, color: Pos.fg)),
              ),
            ]),
          ),
        ),
      ),
    );
  }
}
