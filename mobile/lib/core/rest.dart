import 'dart:convert';

import 'dart:typed_data';

import 'api_client.dart';
import 'config.dart';

/// طبقة بيانات بنفس منطق `supabase-js` في الموقع، لكن عبر بوابة الخادم `/sb`
/// (نفس الصلاحيات لكل جدول ولكل دور، ونفس إخفاء الأعمدة عن الفني).
///
/// الفلاتر بصيغة PostgREST مثل الموقع تماماً:
///   {'status': 'eq.pending', 'branch_id': 'eq.<id>', 'status': 'in.(pending,in_progress)'}
class Rest {
  Rest(this._api);
  final ApiClient _api;

  static const _base = '/sb/rest/v1';

  Future<List<Map<String, dynamic>>> select(
    String table, {
    String select = '*',
    Map<String, String> filters = const {},
    String? order,
    int? limit,
  }) async {
    final q = <String, dynamic>{'select': select, ...filters};
    if (order != null) q['order'] = order;
    if (limit != null) q['limit'] = '$limit';
    final data = await _api.request('GET', '$_base/$table', query: q);
    return _rows(data);
  }

  Future<Map<String, dynamic>?> single(String table, String id, {String select = '*'}) async {
    final rows = await this.select(table, select: select, filters: {'id': 'eq.$id'}, limit: 1);
    return rows.isEmpty ? null : rows.first;
  }

  Future<Map<String, dynamic>?> insert(String table, Map<String, dynamic> row, {String select = '*'}) async {
    final data = await _api.request('POST', '$_base/$table',
        query: {'select': select}, data: row, headers: {'Prefer': 'return=representation'});
    final rows = _rows(data);
    return rows.isEmpty ? null : rows.first;
  }

  Future<Map<String, dynamic>?> update(String table, String id, Map<String, dynamic> patch, {String select = '*'}) async {
    final data = await _api.request('PATCH', '$_base/$table',
        query: {'id': 'eq.$id', 'select': select}, data: patch, headers: {'Prefer': 'return=representation'});
    final rows = _rows(data);
    return rows.isEmpty ? null : rows.first;
  }

  Future<void> delete(String table, String id) async {
    await _api.request('DELETE', '$_base/$table', query: {'id': 'eq.$id'});
  }

  Future<dynamic> rpc(String fn, [Map<String, dynamic> args = const {}]) =>
      _api.request('POST', '$_base/rpc/$fn', data: args);

  /// /api/secure/data?resource=... (العملاء وغيرهم من الجداول الحساسة)
  Future<List<Map<String, dynamic>>> secureList(String resource,
      {String orderBy = '-created_at', int limit = 200, Map<String, dynamic>? filters}) async {
    final q = <String, dynamic>{
      'resource': resource,
      'op': filters == null ? 'list' : 'filter',
      'orderBy': orderBy,
      'limit': '$limit',
    };
    if (filters != null) q['filters'] = jsonEncode(filters);
    final data = await _api.request('GET', '/api/secure/data', query: q);
    return _rows(data);
  }

  Future<dynamic> securePost(String resource, Map<String, dynamic> body) =>
      _api.request('POST', '/api/secure/data', query: {'resource': resource}, data: body);

  Future<dynamic> securePatch(String resource, String id, Map<String, dynamic> body) =>
      _api.request('PATCH', '/api/secure/data', query: {'resource': resource, 'id': id}, data: body);

  /// رفع ملف للتخزين عبر البوابة (نفس storage.uploadFile في الموقع) ويرجع الرابط العام.
  Future<String> upload(String bucket, String path, Uint8List bytes, {String contentType = 'image/jpeg'}) async {
    await _api.request('POST', '/sb/storage/v1/object/$bucket/$path',
        data: Stream.fromIterable([bytes]),
        headers: {'Content-Type': contentType, 'Content-Length': '${bytes.length}', 'cache-control': '3600', 'x-upsert': 'false'});
    return '${AppConfig.supabasePublicUrl}/storage/v1/object/public/$bucket/$path';
  }

  static List<Map<String, dynamic>> _rows(dynamic data) {
    if (data is List) {
      return data.map((e) => e is Map ? e.map((k, v) => MapEntry(k.toString(), v)) : <String, dynamic>{}).toList();
    }
    if (data is Map) return [data.map((k, v) => MapEntry(k.toString(), v))];
    return const [];
  }
}
