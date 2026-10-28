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

  /// عند فتح التطبيق: نقرأ الجلسة المحفوظة ونتحقق منها مع الخادم.
  Future<void> restore() async {
    final saved = await _storage.read();
    if (saved == null) {
      _set(AuthStatus.unauthenticated);
      return;
    }
    // نعرض بيانات آخر دخول فوراً، ثم نتحقق بصمت
    _employee = saved.employee;
    try {
      final me = await _api.me();
      if (me == null) {
        await _storage.clear();
        _employee = null;
        _message = 'انتهت جلستك — سجّل الدخول من جديد';
        _set(AuthStatus.unauthenticated);
        return;
      }
      if (!me.isFinance) {
        await _api.logout();
        _employee = null;
        _message = 'المركز المحاسبي للإدارة والمحاسب فقط';
        _set(AuthStatus.unauthenticated);
        return;
      }
      _employee = me;
      await _storage.saveEmployee(me);
      _set(AuthStatus.authenticated);
    } on ApiException {
      // بدون إنترنت: نسمح بفتح التطبيق بالجلسة المحلية السارية؛ الطلبات ستُظهر خطأ الاتصال
      if (saved.employee?.isFinance == true) {
        _set(AuthStatus.authenticated);
      } else {
        _set(AuthStatus.unauthenticated);
      }
    }
  }

  Future<bool> login(String pin) async {
    _message = null;
    _set(AuthStatus.authenticating);
    try {
      final emp = await _api.login(pin);
      if (!emp.isFinance) {
        // نفس قاعدة الموقع: المركز المحاسبي للإدارة والمحاسب
        await _api.logout();
        _message = 'المركز المحاسبي للإدارة والمحاسب فقط — استخدم نظام الكاشير على الموقع';
        _set(AuthStatus.unauthenticated);
        return false;
      }
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
