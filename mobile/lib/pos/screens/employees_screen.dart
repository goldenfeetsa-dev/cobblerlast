import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';

import '../../core/api_client.dart';
import '../../core/rest.dart';
import '../../state/auth_controller.dart';
import '../../state/order_service.dart';
import '../pos_ui.dart';

const _safeCols = 'id,name,role,branch_id,branch_name,is_active,total_orders,total_revenue,created_at,avatar_url';

const roleBadges = <String, (String, Color)>{
  'owner': ('مالك', Color(0xFF7E22CE)),
  'manager': ('مدير', Color(0xFF1D4ED8)),
  'admin': ('مدير', Color(0xFF1D4ED8)),
  'accountant': ('محاسب', Color(0xFF15803D)),
  'cashier': ('كاشير', Color(0xFFB45309)),
  'staff': ('عامل', Color(0xFF374151)),
};

/// الموظفون — نفس /employees: إضافة/تعديل/حذف، PIN من 4 أرقام، الصلاحية والفرع.
class EmployeesScreen extends StatefulWidget {
  const EmployeesScreen({super.key});

  @override
  State<EmployeesScreen> createState() => _EmployeesScreenState();
}

class _EmployeesScreenState extends State<EmployeesScreen> {
  List<Map<String, dynamic>>? _rows;
  List<Map<String, dynamic>> _branches = const [];
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final rest = context.read<Rest>();
    try {
      final r = await Future.wait([
        rest.select('employees', select: _safeCols, order: 'created_at.desc', limit: 200),
        rest.select('branches', order: 'created_at.desc', limit: 200).catchError((_) => <Map<String, dynamic>>[]),
      ]);
      if (mounted) {
        setState(() {
          _rows = r[0];
          _branches = r[1];
          _error = null;
        });
      }
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    }
  }

  Future<void> _edit([Map<String, dynamic>? e]) async {
    final ok = await showDialog<bool>(context: context, builder: (_) => _EmployeeDialog(employee: e, branches: _branches));
    if (ok == true) _load();
  }

  Future<void> _delete(Map<String, dynamic> e) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (c) => AlertDialog(
        title: Text('حذف ${e['name']}؟'),
        content: const Text('لن يتمكن من الدخول بعد الحذف.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(c, false), child: const Text('إلغاء')),
          FilledButton(style: FilledButton.styleFrom(backgroundColor: Pos.destructive), onPressed: () => Navigator.pop(c, true), child: const Text('حذف')),
        ],
      ),
    );
    if (ok != true || !mounted) return;
    final me = context.read<AuthController>().employee!;
    try {
      await context.read<Rest>().delete('employees', '${e['id']}');
      if (!mounted) return;
      context.read<OrderService>().audit(me, action: 'delete', page: 'الموظفون', entity: 'employee', entityId: '${e['id']}', details: {'name': e['name'], 'role': e['role']});
      toast(context, 'تم حذف الموظف');
      _load();
    } on ApiException catch (err) {
      if (mounted) toast(context, err.status == 403 ? 'إدارة الموظفين للمالك فقط' : err.message, error: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    final rows = _rows ?? const [];
    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 40),
        physics: const AlwaysScrollableScrollPhysics(),
        children: [
          PageHeader(
            title: 'الموظفون',
            subtitle: '${rows.length} موظف',
            icon: Icons.manage_accounts_rounded,
            tone: Tone.teal,
            trailing: PrimaryButton(label: 'إضافة موظف', icon: Icons.add_rounded, onPressed: () => _edit()),
          ),
          if (_error != null) LoadError(message: _error!, onRetry: _load),
          if (_rows == null && _error == null)
            const Padding(padding: EdgeInsets.all(60), child: Center(child: CircularProgressIndicator()))
          else
            LayoutBuilder(builder: (context, c) {
              final cols = c.maxWidth >= 1000 ? 3 : c.maxWidth >= 640 ? 2 : 1;
              final w = (c.maxWidth - (cols - 1) * 12) / cols;
              return Wrap(spacing: 12, runSpacing: 12, children: [
                for (final e in rows)
                  SizedBox(
                    width: w,
                    child: GlassCard(
                      child: Row(children: [
                        CircleAvatar(
                          radius: 22,
                          backgroundColor: Pos.primary.withValues(alpha: .12),
                          child: Text('${e['name'] ?? '؟'}'.characters.first, style: const TextStyle(color: Pos.primary, fontWeight: FontWeight.w800)),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                            Text('${e['name']}', style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14.5)),
                            const SizedBox(height: 3),
                            Wrap(spacing: 6, runSpacing: 4, children: [
                              SoftBadge(roleBadges[e['role']]?.$1 ?? '${e['role']}', roleBadges[e['role']]?.$2 ?? Pos.muted),
                              if ((e['branch_name'] ?? '').toString().isNotEmpty) SoftBadge('${e['branch_name']}', Pos.muted),
                              if (e['is_active'] == false) const SoftBadge('موقوف', Pos.red),
                            ]),
                            const SizedBox(height: 3),
                            Text('${e['total_orders'] ?? 0} طلب · ${((e['total_revenue'] as num?) ?? 0).toStringAsFixed(0)} ر.س',
                                style: const TextStyle(fontSize: 12, color: Pos.muted)),
                          ]),
                        ),
                        IconButton(onPressed: () => _edit(e), icon: const Icon(Icons.edit_outlined, size: 19)),
                        IconButton(onPressed: () => _delete(e), icon: const Icon(Icons.delete_outline_rounded, size: 19, color: Pos.destructive)),
                      ]),
                    ),
                  ),
              ]);
            }),
        ],
      ),
    );
  }
}

class _EmployeeDialog extends StatefulWidget {
  const _EmployeeDialog({this.employee, required this.branches});
  final Map<String, dynamic>? employee;
  final List<Map<String, dynamic>> branches;

  @override
  State<_EmployeeDialog> createState() => _EmployeeDialogState();
}

class _EmployeeDialogState extends State<_EmployeeDialog> {
  late final _name = TextEditingController(text: '${widget.employee?['name'] ?? ''}');
  final _pin = TextEditingController();
  late String _role = '${widget.employee?['role'] ?? 'staff'}';
  late String? _branch = widget.employee?['branch_id']?.toString();
  bool _saving = false;

  Future<void> _save() async {
    final isNew = widget.employee == null;
    if (_name.text.trim().isEmpty || (isNew && _pin.text.length != 4)) {
      toast(context, 'الاسم ورقم PIN مطلوبان', error: true);
      return;
    }
    if (_pin.text.isNotEmpty && _pin.text.length != 4) {
      toast(context, 'رقم PIN لازم يكون 4 أرقام بالضبط', error: true);
      return;
    }
    final rest = context.read<Rest>();
    final me = context.read<AuthController>().employee!;
    final audit = context.read<OrderService>();
    final branchName = widget.branches.firstWhere((b) => '${b['id']}' == _branch, orElse: () => const {})['name'];
    final payload = <String, dynamic>{
      'name': _name.text.trim(),
      'role': _role,
      'is_active': true,
      'branch_id': _branch,
      'branch_name': branchName ?? '',
      if (_pin.text.isNotEmpty) 'pin': _pin.text, // فاضي = يبقى القديم كما هو
    };
    setState(() => _saving = true);
    try {
      final r = isNew
          ? await rest.insert('employees', payload, select: _safeCols)
          : await rest.update('employees', '${widget.employee!['id']}', payload, select: _safeCols);
      audit.audit(me,
          action: isNew ? 'create' : 'update',
          page: 'الموظفون',
          entity: 'employee',
          entityId: '${r?['id'] ?? widget.employee?['id']}',
          details: isNew ? {'name': payload['name'], 'role': _role} : {'name': payload['name'], 'role_before': widget.employee!['role'], 'role_after': _role});
      if (!mounted) return;
      toast(context, isNew ? 'تم إضافة الموظف' : 'تم تحديث الموظف');
      Navigator.pop(context, true);
    } on ApiException catch (e) {
      if (mounted) {
        toast(
            context,
            e.message.contains('pin_in_use')
                ? 'رقم PIN مستخدم لموظف آخر، اختر رقماً مختلفاً'
                : e.status == 403
                    ? 'إدارة الموظفين للمالك فقط'
                    : 'تعذّر الحفظ، حاول مرة ثانية',
            error: true);
        setState(() => _saving = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: Text(widget.employee == null ? 'إضافة موظف' : 'تعديل موظف'),
      content: SizedBox(
        width: 400,
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          TextField(controller: _name, decoration: const InputDecoration(labelText: 'الاسم الكامل', hintText: 'اسم الموظف')),
          const SizedBox(height: 12),
          TextField(
            controller: _pin,
            obscureText: true,
            keyboardType: TextInputType.number,
            maxLength: 4,
            textAlign: TextAlign.center,
            autocorrect: false,
            enableSuggestions: false,
            inputFormatters: [FilteringTextInputFormatter.digitsOnly],
            style: const TextStyle(fontSize: 22, letterSpacing: 10),
            decoration: InputDecoration(
              labelText: 'رقم PIN (4 أرقام)',
              hintText: '••••',
              counterText: '',
              helperText: widget.employee == null ? null : 'اتركه فاضياً ليبقى الرمز الحالي',
            ),
          ),
          const SizedBox(height: 12),
          DropdownButtonFormField<String>(
            value: _role,
            isExpanded: true,
            decoration: const InputDecoration(labelText: 'الصلاحية'),
            items: const [
              DropdownMenuItem(value: 'owner', child: Text('مالك — كامل الصلاحيات')),
              DropdownMenuItem(value: 'manager', child: Text('مدير — يرى كل الفروع')),
              DropdownMenuItem(value: 'accountant', child: Text('محاسب — يرى التقارير المالية')),
              DropdownMenuItem(value: 'cashier', child: Text('كاشير — مبيعات وطلبات')),
              DropdownMenuItem(value: 'staff', child: Text('عامل — يرى مهامه فقط بدون أسعار')),
            ],
            onChanged: (v) => setState(() => _role = v ?? 'staff'),
          ),
          const SizedBox(height: 12),
          DropdownButtonFormField<String?>(
            value: widget.branches.any((b) => '${b['id']}' == _branch) ? _branch : null,
            isExpanded: true,
            decoration: const InputDecoration(labelText: 'الفرع'),
            items: [
              const DropdownMenuItem<String?>(value: null, child: Text('بدون فرع (كل الفروع)')),
              for (final b in widget.branches) DropdownMenuItem<String?>(value: '${b['id']}', child: Text('${b['name']}')),
            ],
            onChanged: (v) => setState(() => _branch = v),
          ),
        ]),
      ),
      actions: [
        TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('إلغاء')),
        PrimaryButton(label: 'حفظ', busy: _saving, onPressed: _save),
      ],
    );
  }
}
