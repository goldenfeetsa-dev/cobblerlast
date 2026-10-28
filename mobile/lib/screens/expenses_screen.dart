import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';

import '../core/api_client.dart';
import '../state/accounting_controller.dart';
import '../theme.dart';
import '../widgets/ac_widgets.dart';

/// المصاريف — نفس قسم «إضافة مصروف» في صفحة التقارير المالية بالموقع
/// (نفس الحقول، نفس قاعدة الضريبة، ونفس الجدول في قاعدة البيانات).
class ExpensesScreen extends StatelessWidget {
  const ExpensesScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final ctl = context.watch<AccountingController>();
    return Scaffold(
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => showModalBottomSheet<void>(
          context: context,
          isScrollControlled: true,
          showDragHandle: true,
          builder: (_) => const _AddExpenseSheet(),
        ),
        backgroundColor: AC.gold,
        foregroundColor: AC.bg,
        icon: const Icon(Icons.add_rounded),
        label: const Text('مصروف جديد', style: TextStyle(fontWeight: FontWeight.w700)),
      ),
      body: AcPage(
        title: 'المصاريف',
        en: 'Expenses',
        builder: (context, r) {
          final list = ctl.expenses;
          final total = list.fold<double>(0, (s, e) => s + e.amount);
          return [
            SectionCard(
              title: 'مصاريف الفترة',
              en: 'Period Total',
              child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                Text('${list.length} مصروف بالفترة', style: TextStyle(fontSize: 12.5, color: AC.mu)),
                StatementRow('الإجمالي شامل الضريبة', total, style: RowStyle.sum),
                StatementRow('الصافي في قائمة الدخل', r.income.operatingExpenses, style: RowStyle.grand, gold: true),
              ]),
            ),
            if (list.isEmpty)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 36),
                child: Column(children: [
                  Icon(Icons.receipt_long_outlined, size: 40, color: AC.fa),
                  const SizedBox(height: 10),
                  Text('لا توجد مصاريف بهذه الفترة', style: TextStyle(color: AC.mu)),
                  const SizedBox(height: 4),
                  Text('أضف الإيجار والرواتب والفواتير ليظهر صافي الربح الحقيقي', style: TextStyle(color: AC.fa, fontSize: 12)),
                ]),
              )
            else
              Container(
                decoration: BoxDecoration(color: AC.s1, borderRadius: BorderRadius.circular(AC.radius), border: Border.all(color: AC.line)),
                clipBehavior: Clip.antiAlias,
                child: Column(children: [
                  for (var i = 0; i < list.length; i++) ...[
                    if (i > 0) Container(height: 1, color: AC.line),
                    ListTile(
                      title: Text(expenseCategories[list[i].category] ?? list[i].category,
                          style: const TextStyle(fontSize: 13.5, fontWeight: FontWeight.w600)),
                      subtitle: Text(
                        [list[i].date, if (list[i].description.isNotEmpty) list[i].description].join(' · '),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(fontSize: 11.5, color: AC.fa),
                      ),
                      trailing: Column(mainAxisAlignment: MainAxisAlignment.center, crossAxisAlignment: CrossAxisAlignment.end, children: [
                        Money(-list[i].amount, size: 14, weight: FontWeight.w600),
                        if (list[i].hasTaxInvoice) ...[
                          const SizedBox(height: 3),
                          const Tag('فاتورة ضريبية', incoming: true),
                        ],
                      ]),
                    ),
                  ],
                ]),
              ),
            const SizedBox(height: 70),
          ];
        },
      ),
    );
  }
}

class _AddExpenseSheet extends StatefulWidget {
  const _AddExpenseSheet();

  @override
  State<_AddExpenseSheet> createState() => _AddExpenseSheetState();
}

class _AddExpenseSheetState extends State<_AddExpenseSheet> {
  final _form = GlobalKey<FormState>();
  final _amount = TextEditingController();
  final _desc = TextEditingController();
  final _vatNo = TextEditingController();
  String _category = 'other';
  DateTime _date = DateTime.now();
  bool _hasVat = false;
  bool _hasTaxInvoice = false;
  bool _saving = false;

  @override
  void dispose() {
    _amount.dispose();
    _desc.dispose();
    _vatNo.dispose();
    super.dispose();
  }

  double? get _amountValue {
    final t = _amount.text.trim().replaceAllMapped(RegExp('[٠-٩]'), (m) => '٠١٢٣٤٥٦٧٨٩'.indexOf(m[0]!).toString()).replaceAll(',', '');
    return double.tryParse(t);
  }

  Future<void> _save() async {
    if (!_form.currentState!.validate()) return;
    setState(() => _saving = true);
    final messenger = ScaffoldMessenger.of(context);
    final nav = Navigator.of(context);
    try {
      await context.read<AccountingController>().addExpense(
            category: _category,
            description: _desc.text.trim(),
            amount: _amountValue!,
            date: _date,
            hasVat: _hasVat,
            hasTaxInvoice: _hasTaxInvoice,
            supplierVatNumber: _vatNo.text.trim(),
          );
      nav.pop();
      messenger.showSnackBar(const SnackBar(content: Text('تمت إضافة المصروف ✓')));
    } on ApiException catch (e) {
      messenger.showSnackBar(SnackBar(content: Text('فشل الحفظ: ${e.message}')));
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final amount = _amountValue ?? 0;
    final vat = _hasVat ? amount - amount / 1.15 : 0.0;
    return Padding(
      padding: EdgeInsets.only(left: 20, right: 20, bottom: MediaQuery.viewInsetsOf(context).bottom + 20),
      child: Form(
        key: _form,
        child: ListView(shrinkWrap: true, children: [
          const Text('مصروف جديد', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
          const SizedBox(height: 16),
          DropdownButtonFormField<String>(
            value: _category,
            decoration: const InputDecoration(labelText: 'التصنيف'),
            dropdownColor: AC.s2,
            items: [for (final e in expenseCategories.entries) DropdownMenuItem(value: e.key, child: Text(e.value))],
            onChanged: (v) => setState(() => _category = v ?? 'other'),
          ),
          const SizedBox(height: 12),
          TextFormField(
            controller: _amount,
            keyboardType: const TextInputType.numberWithOptions(decimal: true),
            inputFormatters: [FilteringTextInputFormatter.allow(RegExp(r'[0-9٠-٩.,]'))],
            decoration: const InputDecoration(labelText: 'المبلغ (شامل الضريبة)', suffixText: 'ر.س'),
            onChanged: (_) => setState(() {}),
            validator: (_) {
              final v = _amountValue;
              if (v == null || v <= 0) return 'أدخل مبلغاً صحيحاً';
              if (v > 10000000) return 'المبلغ كبير جداً';
              return null;
            },
          ),
          const SizedBox(height: 12),
          TextFormField(
            controller: _desc,
            maxLength: 200,
            decoration: const InputDecoration(labelText: 'الوصف (اختياري)', counterText: ''),
          ),
          const SizedBox(height: 12),
          InkWell(
            borderRadius: BorderRadius.circular(12),
            onTap: () async {
              final d = await showDatePicker(
                context: context,
                initialDate: _date,
                firstDate: DateTime(2024),
                lastDate: DateTime.now().add(const Duration(days: 31)),
              );
              if (d != null) setState(() => _date = d);
            },
            child: InputDecorator(
              decoration: const InputDecoration(labelText: 'التاريخ', suffixIcon: Icon(Icons.event_outlined)),
              child: Directionality(textDirection: TextDirection.ltr, child: Align(alignment: Alignment.centerRight, child: Text(ymd(_date)))),
            ),
          ),
          const SizedBox(height: 8),
          SwitchListTile(
            contentPadding: EdgeInsets.zero,
            activeColor: AC.gold,
            title: const Text('خاضع لضريبة القيمة المضافة', style: TextStyle(fontSize: 14)),
            subtitle: _hasVat ? Text('الضريبة المضمّنة: ${money(vat)}', style: TextStyle(fontSize: 12, color: AC.mu)) : null,
            value: _hasVat,
            onChanged: (v) => setState(() {
              _hasVat = v;
              if (!v) _hasTaxInvoice = false;
            }),
          ),
          if (_hasVat) ...[
            CheckboxListTile(
              contentPadding: EdgeInsets.zero,
              activeColor: AC.gold,
              controlAffinity: ListTileControlAffinity.leading,
              title: const Text('لدي فاتورة ضريبية رسمية (تُخصم ضريبتها)', style: TextStyle(fontSize: 13.5)),
              value: _hasTaxInvoice,
              onChanged: (v) => setState(() => _hasTaxInvoice = v ?? false),
            ),
            TextFormField(
              controller: _vatNo,
              keyboardType: TextInputType.number,
              maxLength: 15,
              inputFormatters: [FilteringTextInputFormatter.digitsOnly],
              decoration: const InputDecoration(labelText: 'الرقم الضريبي للمورد (اختياري)', counterText: ''),
              validator: (v) {
                final t = (v ?? '').trim();
                if (t.isEmpty) return null;
                return RegExp(r'^3\d{13}3$').hasMatch(t) ? null : 'يجب أن يكون 15 رقماً ويبدأ وينتهي بـ 3';
              },
            ),
          ],
          const SizedBox(height: 18),
          FilledButton(
            onPressed: _saving ? null : _save,
            style: FilledButton.styleFrom(
              backgroundColor: AC.gold,
              foregroundColor: AC.bg,
              minimumSize: const Size.fromHeight(50),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            ),
            child: _saving
                ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: AC.bg))
                : const Text('حفظ المصروف', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
          ),
        ]),
      ),
    );
  }
}
