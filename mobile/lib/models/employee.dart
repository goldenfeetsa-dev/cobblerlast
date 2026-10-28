import '../core/config.dart';

/// المستخدم (الموظف) كما يرجعه الخادم بعد الدخول — بيانات عرض فقط بدون أي سر.
class Employee {
  const Employee({
    required this.id,
    required this.name,
    required this.role,
    this.branchId,
    this.branchName,
    this.avatarUrl,
  });

  final String id;
  final String name;
  final String role;
  final String? branchId;
  final String? branchName;
  final String? avatarUrl;

  bool get isFinance => AppConfig.financeRoles.contains(role);

  String get roleLabel => switch (role) {
        'owner' => 'المالك',
        'admin' => 'مدير النظام',
        'manager' => 'المدير',
        'accountant' => 'المحاسب',
        'cashier' => 'الكاشير',
        'staff' => 'فني',
        _ => role,
      };

  factory Employee.fromJson(Map<String, dynamic> json) => Employee(
        id: (json['id'] ?? '').toString(),
        name: (json['name'] ?? '').toString(),
        role: (json['role'] ?? '').toString(),
        branchId: json['branch_id']?.toString(),
        branchName: json['branch_name']?.toString(),
        avatarUrl: json['avatar_url']?.toString(),
      );

  Map<String, dynamic> toJson() => {
        'id': id,
        'name': name,
        'role': role,
        'branch_id': branchId,
        'branch_name': branchName,
        'avatar_url': avatarUrl,
      };
}
