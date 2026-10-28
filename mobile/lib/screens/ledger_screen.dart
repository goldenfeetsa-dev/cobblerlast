import 'package:flutter/material.dart';

import '../models/accounting_report.dart';
import '../theme.dart';
import '../widgets/ac_widgets.dart';

/// دفتر الحركات — نفس جدول «دفتر الحركات» في الموقع (نفس الفلاتر والبحث).
class LedgerScreen extends StatefulWidget {
  const LedgerScreen({super.key});

  @override
  State<LedgerScreen> createState() => _LedgerScreenState();
}

class _LedgerScreenState extends State<LedgerScreen> {
  String _kind = 'all';
  String _q = '';

  @override
  Widget build(BuildContext context) {
    return AcPage(
      title: 'دفتر الحركات',
      en: 'General Journal',
      builder: (context, r) {
        final present = ['all', ...ledgerKinds.keys.where((k) => r.ledger.any((e) => e.kind == k))];
        if (!present.contains(_kind)) _kind = 'all';
        final term = _q.trim().toLowerCase();
        final rows = r.ledger
            .where((e) => (_kind == 'all' || e.kind == _kind) && (term.isEmpty || '${e.ref} ${e.party}'.toLowerCase().contains(term)))
            .toList();

        return [
          SizedBox(
            height: 40,
            child: ListView(scrollDirection: Axis.horizontal, children: [
              for (final k in present)
                Padding(
                  padding: const EdgeInsetsDirectional.only(end: 8),
                  child: AcChip(label: k == 'all' ? 'الكل' : ledgerKinds[k]!, selected: _kind == k, onTap: () => setState(() => _kind = k)),
                ),
            ]),
          ),
          const SizedBox(height: 10),
          TextField(
            onChanged: (v) => setState(() => _q = v),
            textInputAction: TextInputAction.search,
            decoration: const InputDecoration(
              hintText: 'رقم المستند أو الاسم',
              prefixIcon: Icon(Icons.search_rounded, size: 20),
              isDense: true,
            ),
          ),
          const SizedBox(height: 14),
          if (rows.isEmpty)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 40),
              child: Text('لا توجد حركات تطابق الفترة أو البحث.', textAlign: TextAlign.center, style: TextStyle(color: AC.mu)),
            )
          else
            Container(
              decoration: BoxDecoration(color: AC.s1, borderRadius: BorderRadius.circular(AC.radius), border: Border.all(color: AC.line)),
              clipBehavior: Clip.antiAlias,
              child: Column(children: [
                for (var i = 0; i < rows.length; i++) ...[
                  if (i > 0) Container(height: 1, color: AC.line),
                  _EntryTile(rows[i]),
                ],
              ]),
            ),
          if (r.ledger.length >= 400)
            Padding(
              padding: const EdgeInsets.only(top: 10),
              child: Text('يُعرض أحدث 400 حركة — ضيّق الفترة لرؤية الباقي.', style: TextStyle(fontSize: 11.5, color: AC.fa)),
            ),
        ];
      },
    );
  }
}

class _EntryTile extends StatelessWidget {
  const _EntryTile(this.e);
  final LedgerEntry e;

  @override
  Widget build(BuildContext context) {
    final party = e.kind == 'expense' ? (expenseCategories[e.party] ?? e.party) : e.party;
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Wrap(spacing: 6, runSpacing: 4, crossAxisAlignment: WrapCrossAlignment.center, children: [
              Tag(ledgerKinds[e.kind] ?? e.kind, incoming: e.sign > 0),
              if (e.isUnpaid) const Tag('غير مسدّد'),
            ]),
            const SizedBox(height: 6),
            Text(party, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 13.5)),
            const SizedBox(height: 2),
            Directionality(
              textDirection: TextDirection.ltr,
              child: Text('${e.date} · ${e.ref}',
                  maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 11.5, color: AC.fa)),
            ),
          ]),
        ),
        const SizedBox(width: 10),
        Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
          Money(e.sign * e.total, size: 14, weight: FontWeight.w600),
          const SizedBox(height: 4),
          Text('ضريبة ${moneyShort(e.vat)}', style: TextStyle(fontSize: 11, color: AC.fa)),
        ]),
      ]),
    );
  }
}
