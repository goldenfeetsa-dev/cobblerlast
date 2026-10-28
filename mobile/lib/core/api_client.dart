import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart' show visibleForTesting;

import '../models/employee.dart';
import 'config.dart';
import 'session_storage.dart';

/// خطأ موحّد برسالة عربية مفهومة للمستخدم.
class ApiException implements Exception {
  ApiException(this.message, {this.status, this.code});

  final String message;
  final int? status;
  final String? code;

  bool get isUnauthorized => status == 401;

  @override
  String toString() => message;
}

/// عميل HTTP واحد للتطبيق كله.
///
/// الـ Interceptor يقوم تلقائياً بـ:
///  1) حقن كوكي الجلسة (`Cookie: nt_session=...`) في كل طلب للخادم.
///     الخادم مصمم أصلاً على كوكي HttpOnly، فالتطبيق يرسله كما يرسله المتصفح —
///     بدون أي تعديل على الخادم وبنفس التحقق من الدور لكل جدول.
///  2) عند أي 401 من طلب محمي: يمسح الجلسة ويستدعي [onUnauthorized] فيرجع
///     التطبيق لشاشة الدخول.
class ApiClient {
  ApiClient(this._storage) {
    _dio = Dio(BaseOptions(
      baseUrl: AppConfig.apiBase,
      connectTimeout: AppConfig.connectTimeout,
      receiveTimeout: AppConfig.receiveTimeout,
      sendTimeout: AppConfig.connectTimeout,
      contentType: Headers.jsonContentType,
      responseType: ResponseType.json,
      headers: {'Accept': 'application/json', 'X-Client': 'cobbler-accounting-app'},
      // نتعامل مع كل الحالات بأنفسنا لنرجع رسائل عربية واضحة
      validateStatus: (s) => s != null && s < 600,
      followRedirects: false,
    ));

    _dio.interceptors.add(QueuedInterceptorsWrapper(
      onRequest: (options, handler) async {
        if (options.extra['public'] != true) {
          final s = await _storage.read();
          if (s != null) {
            options.headers['Cookie'] = '${AppConfig.sessionCookie}=${s.token}';
          }
        }
        handler.next(options);
      },
      onResponse: (response, handler) async {
        final isAuthCall = response.requestOptions.extra['public'] == true;
        if (response.statusCode == 401 && !isAuthCall) {
          await _storage.clear();
          _emitUnauthorized();
        }
        handler.next(response);
      },
    ));
  }

  final SessionStorage _storage;
  late final Dio _dio;

  /// يُستدعى مرة واحدة لكل موجة 401 (مثلاً عدة طلبات متزامنة بعد انتهاء الجلسة).
  void Function()? onUnauthorized;
  bool _notifying = false;

  void _emitUnauthorized() {
    if (_notifying) return;
    _notifying = true;
    scheduleMicrotask(() {
      onUnauthorized?.call();
      Future<void>.delayed(const Duration(seconds: 2), () => _notifying = false);
    });
  }

  // ═══════════════════ المصادقة ═══════════════════

  /// POST /api/auth/login — نفس دخول الموقع بالـ PIN (تحقق bcrypt + حد محاولات على الخادم).
  Future<Employee> login(String pin) async {
    final res = await _send(() => _dio.post<dynamic>(
          '/api/auth/login',
          data: {'pin': pin},
          options: Options(extra: {'public': true}),
        ));
    final body = _asMap(res.data);

    if (res.statusCode == 429) {
      final secs = (body['retry_after_seconds'] as num?)?.toInt() ?? 900;
      final mins = (secs / 60).ceil();
      throw ApiException('محاولات كثيرة — انتظر $mins دقيقة ثم حاول مجدداً', status: 429, code: 'rate_limited');
    }
    if (res.statusCode == 401 || body['error'] == 'invalid_pin') {
      throw ApiException('الرمز غير صحيح', status: 401, code: 'invalid_pin');
    }
    if (res.statusCode == 400) {
      throw ApiException('أدخل رمزاً من 4 إلى 8 أرقام', status: 400, code: 'invalid_pin');
    }
    if (res.statusCode != 200 || body['success'] != true) {
      throw ApiException('تعذّر تسجيل الدخول حالياً — حاول بعد قليل', status: res.statusCode, code: body['error']?.toString());
    }

    final cookie = extractSessionCookie(res.headers);
    if (cookie == null) {
      throw ApiException('الخادم لم يُصدر جلسة — حدّث التطبيق أو تواصل مع الدعم', status: res.statusCode);
    }
    final employee = Employee.fromJson(_asMap(body['employee']));
    await _storage.save(StoredSession(token: cookie.value, expiresAt: cookie.expiresAt, employee: employee));
    return employee;
  }

  /// GET /api/auth/me — يتحقق أن الجلسة المحفوظة ما زالت سارية على الخادم.
  Future<Employee?> me() async {
    final res = await _send(() => _dio.get<dynamic>('/api/auth/me'));
    if (res.statusCode == 401) return null;
    _ensureOk(res);
    final body = _asMap(res.data);
    if (body['authenticated'] != true) return null;
    return Employee.fromJson(_asMap(body['employee']));
  }

  Future<void> logout() async {
    try {
      await _dio.post<dynamic>('/api/auth/logout');
    } catch (_) {
      // حتى لو فشل الاتصال، نمسح الجلسة محلياً
    }
    await _storage.clear();
  }

  // ═══════════════════ المحاسبة ═══════════════════

  /// نفس دالة الموقع: accounting_report عبر بوابة /sb (دور مالي فقط).
  Future<Map<String, dynamic>> accountingReport(DateTime from, DateTime to) async {
    final res = await _send(() => _dio.post<dynamic>(
          '/sb/rest/v1/rpc/accounting_report',
          data: {'p_from': _day(from), 'p_to': _day(to)},
        ));
    _ensureOk(res);
    return _asMap(res.data);
  }

  /// مصروفات الفترة — /api/secure/expenses (نفس صفحة التقارير المالية).
  Future<List<Map<String, dynamic>>> listExpenses(DateTime from, DateTime to) async {
    final res = await _send(() => _dio.get<dynamic>('/api/secure/expenses', queryParameters: {
          'op': 'list',
          'orderBy': '-expense_date',
          'limit': '500',
          'gte_col': 'expense_date',
          'gte_val': _day(from),
          'lte_col': 'expense_date',
          'lte_val': _day(to),
        }));
    _ensureOk(res);
    final data = res.data;
    if (data is List) return data.map(_asMap).toList();
    return const [];
  }

  Future<void> createExpense(Map<String, dynamic> record) async {
    final res = await _send(() => _dio.post<dynamic>('/api/secure/expenses', data: record));
    _ensureOk(res);
  }

  // ═══════════════════ أدوات داخلية ═══════════════════

  Future<Response<dynamic>> _send(Future<Response<dynamic>> Function() call) async {
    try {
      return await call();
    } on DioException catch (e) {
      switch (e.type) {
        case DioExceptionType.connectionTimeout:
        case DioExceptionType.sendTimeout:
        case DioExceptionType.receiveTimeout:
          throw ApiException('الخادم تأخر بالرد — تحقق من الإنترنت وحاول مجدداً');
        case DioExceptionType.connectionError:
          throw ApiException('لا يوجد اتصال بالإنترنت');
        case DioExceptionType.badCertificate:
          throw ApiException('شهادة الاتصال غير موثوقة — تم إيقاف الطلب لحمايتك');
        default:
          throw ApiException('تعذّر الاتصال بالخادم');
      }
    }
  }

  void _ensureOk(Response<dynamic> res) {
    final code = res.statusCode ?? 0;
    if (code >= 200 && code < 300) return;
    final body = _asMap(res.data);
    final msg = switch (code) {
      401 => 'انتهت الجلسة — سجّل الدخول من جديد',
      403 => 'هذا القسم للإدارة والمحاسب فقط',
      404 => 'الخدمة غير متاحة على الخادم بعد — حدّث الموقع',
      429 => 'طلبات كثيرة — انتظر قليلاً',
      _ when code >= 500 => 'خطأ في الخادم — حاول بعد قليل',
      _ => (body['message'] ?? body['error'] ?? 'تعذّر تنفيذ الطلب ($code)').toString(),
    };
    throw ApiException(msg, status: code, code: body['error']?.toString());
  }

  static Map<String, dynamic> _asMap(dynamic v) {
    if (v is Map<String, dynamic>) return v;
    if (v is Map) return v.map((k, val) => MapEntry(k.toString(), val));
    return <String, dynamic>{};
  }

  static String _day(DateTime d) =>
      '${d.year.toString().padLeft(4, '0')}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';

  /// يستخرج قيمة nt_session ومدة صلاحيتها من ترويسة Set-Cookie.
  @visibleForTesting
  static ({String value, DateTime expiresAt})? extractSessionCookie(Headers headers) {
    final all = headers.map['set-cookie'] ?? const <String>[];
    for (final raw in all) {
      // قد تجمع بعض البيئات عدة كوكيز في سطر واحد مفصولة بفاصلة
      for (final cookie in raw.split(RegExp(r',(?=\s*[A-Za-z0-9_\-]+=)'))) {
        final parts = cookie.split(';').map((p) => p.trim()).toList();
        if (parts.isEmpty) continue;
        final eq = parts.first.indexOf('=');
        if (eq <= 0) continue;
        if (parts.first.substring(0, eq) != AppConfig.sessionCookie) continue;
        final value = parts.first.substring(eq + 1);
        if (value.isEmpty) continue;
        var maxAge = 12 * 60 * 60;
        for (final attr in parts.skip(1)) {
          final lower = attr.toLowerCase();
          if (lower.startsWith('max-age=')) {
            maxAge = int.tryParse(attr.substring(8)) ?? maxAge;
          }
        }
        // هامش دقيقة حتى لا نرسل كوكي على وشك الانتهاء
        return (value: value, expiresAt: DateTime.now().add(Duration(seconds: maxAge - 60)));
      }
    }
    return null;
  }
}
