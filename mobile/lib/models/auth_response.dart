import 'employee.dart';

/// رد الدخول: الموظف + انتهاء الجلسة. الكوكي نفسه لا يخرج من طبقة التخزين الآمن.
class AuthResponse {
  const AuthResponse({required this.employee, required this.expiresAt});

  final Employee employee;
  final DateTime expiresAt;

  factory AuthResponse.fromJson(Map<String, dynamic> json, {required DateTime expiresAt}) => AuthResponse(
        employee: Employee.fromJson((json['employee'] as Map?)?.cast<String, dynamic>() ?? const {}),
        expiresAt: expiresAt,
      );
}
