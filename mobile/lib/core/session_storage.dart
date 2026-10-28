import 'dart:convert';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import '../models/employee.dart';

/// جلسة محفوظة: قيمة كوكي الجلسة الموقّعة + تاريخ انتهائها + بيانات العرض.
class StoredSession {
  const StoredSession({required this.token, required this.expiresAt, this.employee});

  final String token;
  final DateTime expiresAt;
  final Employee? employee;

  bool get isExpired => DateTime.now().isAfter(expiresAt);
}

/// تخزين آمن للجلسة:
///  • Android: EncryptedSharedPreferences (مفاتيح Android Keystore)
///  • iOS / macOS: Keychain (يُمسح مع حذف التطبيق، غير متزامن مع iCloud)
///  • Windows: Credential Manager عبر DPAPI ، Linux: libsecret
/// لا يُحفظ الـ PIN أبداً — فقط الكوكي الموقّع من الخادم.
class SessionStorage {
  SessionStorage([FlutterSecureStorage? storage])
      : _storage = storage ??
            const FlutterSecureStorage(
              aOptions: AndroidOptions(encryptedSharedPreferences: true, resetOnError: true),
              iOptions: IOSOptions(accessibility: KeychainAccessibility.first_unlock_this_device),
              mOptions: MacOsOptions(accessibility: KeychainAccessibility.first_unlock_this_device),
            );

  final FlutterSecureStorage _storage;

  static const _kToken = 'nt_session_token';
  static const _kExpiry = 'nt_session_expiry';
  static const _kEmployee = 'nt_session_employee';

  /// نسخة في الذاكرة لتفادي قراءة التخزين المشفّر مع كل طلب.
  StoredSession? _cache;

  Future<StoredSession?> read() async {
    if (_cache != null) return _cache;
    try {
      final token = await _storage.read(key: _kToken);
      final expiry = await _storage.read(key: _kExpiry);
      if (token == null || token.isEmpty || expiry == null) return null;
      final expiresAt = DateTime.tryParse(expiry);
      if (expiresAt == null) return null;
      final empRaw = await _storage.read(key: _kEmployee);
      Employee? employee;
      if (empRaw != null) {
        try {
          employee = Employee.fromJson(jsonDecode(empRaw) as Map<String, dynamic>);
        } catch (_) {
          employee = null;
        }
      }
      final s = StoredSession(token: token, expiresAt: expiresAt, employee: employee);
      if (s.isExpired) {
        await clear();
        return null;
      }
      _cache = s;
      return s;
    } catch (_) {
      // تخزين تالف (مثلاً بعد استعادة نسخة احتياطية لجهاز آخر) — نبدأ من جديد
      await clear();
      return null;
    }
  }

  Future<void> save(StoredSession session) async {
    _cache = session;
    await _storage.write(key: _kToken, value: session.token);
    await _storage.write(key: _kExpiry, value: session.expiresAt.toIso8601String());
    if (session.employee != null) {
      await _storage.write(key: _kEmployee, value: jsonEncode(session.employee!.toJson()));
    }
  }

  Future<void> saveEmployee(Employee employee) async {
    final current = await read();
    if (current == null) return;
    await save(StoredSession(token: current.token, expiresAt: current.expiresAt, employee: employee));
  }

  Future<void> clear() async {
    _cache = null;
    try {
      await _storage.delete(key: _kToken);
      await _storage.delete(key: _kExpiry);
      await _storage.delete(key: _kEmployee);
    } catch (_) {
      // لا شيء — المسح أفضل جهد
    }
  }
}
