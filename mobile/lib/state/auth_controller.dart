import 'dart:async';

import 'package:flutter/foundation.dart';

import '../core/api_client.dart';
import '../core/session_storage.dart';
import '../models/employee.dart';

/// الحالات الثلاث للدخول (+ حالة البدء أثناء قراءة الجلسة المحفوظة).
enum AuthStatus { checking, unauthenticated, authenticating, authenticated }

class AuthController extends ChangeNotifier {
  AuthController(this._api, this._storage) {
    // أي 401 من أي طلب → خروج تلقائي ورجوع لشاشة الدخول برسالة واضحة
    _api.onUnauthorized = () => _expire('انتهت جلستك — سجّل الدخول من جديد');
  }

  final ApiClient _api;
  final SessionStorage _storage;

  AuthStatus _status = AuthStatus.checking;
  Employee? _employee;
  String? _message;

  AuthStatus get status => _status;
  Employee? get employee => _employee;

  /// رسالة تظهر في شاشة الدخول (خطأ PIN، انتهاء جلسة، صلاحية...).
  String? get message => _message;

  /// عند فتح التطبيق: نفتح فوراً بالجلسة المحفوظة (بدون انتظار الإنترنت)،
  /// ونتحقق منها مع الخادم بالخلفية — لو طلعت منتهية نرجع لشاشة الدخول.
  Future<void> restore() async {
    final saved = await _storage.read();
    if (saved == null || saved.isExpired || saved.employee == null) {
      if (saved != null) await _storage.clear();
      _set(AuthStatus.unauthenticated);
      return;
    }
    _employee = saved.employee;
    _set(AuthStatus.authenticated);
    unawaited(_revalidate());
  }

  Future<void> _revalidate() async {
    try {
      final me = await _api.me();
      if (me == null) {
        await _storage.clear();
        _expire('انتهت جلستك — سجّل الدخول من جديد');
        return;
      }
      if (me.role != _employee?.role || me.name != _employee?.name || me.branchId != _employee?.branchId) {
        _employee = me;
        notifyListeners();
      }
      await _storage.saveEmployee(me);
    } on ApiException {
      // بدون إنترنت: نكمل بالجلسة المحلية السارية
    }
  }

  Future<bool> login(String pin) async {
    _message = null;
    _set(AuthStatus.authenticating);
    try {
      final emp = await _api.login(pin);
      _employee = emp;
      _set(AuthStatus.authenticated);
      return true;
    } on ApiException catch (e) {
      _message = e.message;
      _set(AuthStatus.unauthenticated);
      return false;
    }
  }

  Future<void> logout() async {
    await _api.logout();
    _employee = null;
    _message = null;
    _set(AuthStatus.unauthenticated);
  }

  @visibleForTesting
  void debugSignIn(Employee e) {
    _employee = e;
    _set(AuthStatus.authenticated);
  }

  @visibleForTesting
  void debugSignedOut([String? message]) {
    _employee = null;
    _message = message;
    _set(AuthStatus.unauthenticated);
  }

  void _expire(String msg) {
    if (_status == AuthStatus.unauthenticated) return;
    _employee = null;
    _message = msg;
    _set(AuthStatus.unauthenticated);
  }

  void _set(AuthStatus s) {
    _status = s;
    notifyListeners();
  }
}
