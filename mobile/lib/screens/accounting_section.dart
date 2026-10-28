import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../state/accounting_controller.dart';
import '../theme.dart';
import 'expenses_screen.dart';
import 'ledger_screen.dart';
import 'overview_screen.dart';
import 'statements_screen.dart';

/// المركز المحاسبي داخل النظام — بتصميمه الداكن الخاص (أسود/عاجي/ذهبي)
/// تماماً كما يظهر في صفحة /accounting داخل نظام الكاشير بالموقع.
/// أقسامه الأربعة بشريط علوي (على كل الأحجام) حتى لا يتعارض مع قائمة النظام.
class AccountingSection extends StatefulWidget {
  const AccountingSection({super.key});

  @override
  State<AccountingSection> createState() => _AccountingSectionState();
}

class _AccountingSectionState extends State<AccountingSection> {
  int _index = 0;

  static const _pages = <Widget>[OverviewScreen(), StatementsScreen(), LedgerScreen(), ExpensesScreen()];
  static const _items = [
    (Icons.space_dashboard_rounded, 'نظرة عامة'),
    (Icons.account_balance_rounded, 'القوائم'),
    (Icons.receipt_long_rounded, 'الدفتر'),
    (Icons.payments_rounded, 'المصاريف'),
  ];

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final ctl = context.read<AccountingController>();
      if (ctl.report == null && !ctl.loading) ctl.load();
    });
  }

  @override
  Widget build(BuildContext context) {
    return Theme(
      data: AC.theme(),
      child: Builder(builder: (context) {
        return Material(
          color: AC.bg,
          child: Column(children: [
            Container(
              color: AC.s1,
              height: 52,
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                itemCount: _items.length,
                separatorBuilder: (_, __) => const SizedBox(width: 8),
                itemBuilder: (_, i) {
                  final sel = i == _index;
                  return InkWell(
                    borderRadius: BorderRadius.circular(999),
                    onTap: () => setState(() => _index = i),
                    child: AnimatedContainer(
                      duration: const Duration(milliseconds: 150),
                      padding: const EdgeInsets.symmetric(horizontal: 14),
                      decoration: BoxDecoration(
                        color: sel ? AC.goldSoft : Colors.transparent,
                        borderRadius: BorderRadius.circular(999),
                        border: Border.all(color: sel ? AC.gold.withValues(alpha: .5) : AC.line2),
                      ),
                      child: Row(children: [
                        Icon(_items[i].$1, size: 17, color: sel ? AC.gold : AC.mu),
                        const SizedBox(width: 6),
                        Text(_items[i].$2,
                            style: TextStyle(
                                fontFamily: AC.font,
                                fontSize: 13,
                                fontWeight: sel ? FontWeight.w700 : FontWeight.w500,
                                color: sel ? AC.gold : AC.mu)),
                      ]),
                    ),
                  );
                },
              ),
            ),
            Container(height: 1, color: AC.line),
            Expanded(child: IndexedStack(index: _index, children: _pages)),
          ]),
        );
      }),
    );
  }
}
