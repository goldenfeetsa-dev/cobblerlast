import '../core/api_client.dart';
import '../core/rest.dart';
import '../models/employee.dart';
import '../models/order.dart';

/// عمليات الطلبات — نفس ما يفعله الموقع حرفياً عند كل تعديل:
///  • تحديث الطلب عبر البوابة (نفس صلاحيات الدور).
///  • تسجيل الحركة في سجل التدقيق (auditLog.js).
///  • عند «جاهز»: إشعار العميل واتساب من الخادم (waNotify.js).
///  • للفني: تسجيل اسمه مع بدء/إنجاز العمل (workerTiming.js).
class OrderService {
  OrderService(this.rest, this.api);
  final Rest rest;
  final ApiClient api;

  static final _uuid = RegExp(r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$', caseSensitive: false);

  Future<List<Order>> list(Employee me, {int limit = 200}) async {
    final isStaff = me.role == 'staff';
    final rows = await rest.select('orders',
        select: isStaff ? orderListColumnsStaff : orderListColumns, order: 'created_at.desc', limit: limit);
    var orders = rows.map(Order.new).toList();
    // نفس فلتر الفرع في الموقع: غير الإدارة يرى فرعه فقط
    if (!{'admin', 'owner', 'manager'}.contains(me.role) && me.branchId != null) {
      orders = orders.where((o) => o.branchId == null || o.branchId == me.branchId).toList();
    }
    return orders;
  }

  Future<Order?> get(String id) async {
    final row = await rest.single('orders', id);
    return row == null ? null : Order(row);
  }

  Future<Order> update(Employee me, Order order, Map<String, dynamic> patch, {String page = 'الطلبات'}) async {
    final full = {...patch};
    if (me.role == 'staff' && patch.containsKey('status')) {
      if (_uuid.hasMatch(me.id)) full['worker_id'] = me.id;
      full['worker_name'] = me.name;
    }
    final row = await rest.update('orders', order.id, full);
    if (patch['status'] == 'ready') notifyReady(order.id);
    audit(me, action: 'update', page: page, entity: 'order', entityId: order.id, details: {
      'order_number': order.number,
      'changes': patch,
    });
    return row == null ? order.copyWith(full) : Order(row);
  }

  Future<void> delete(Employee me, Order order) async {
    await rest.delete('orders', order.id);
    audit(me, action: 'delete', page: 'الطلبات', entity: 'order', entityId: order.id, details: {'order_number': order.number});
  }

  /// إشعار واتساب من الخادم (يتحقق من الجلسة ويمنع التكرار) — اختياري لا يوقف العملية.
  void notifyReady(String orderId) {
    rest.securePost('wa-notify', {'order_id': orderId}).catchError((_) => null);
  }

  /// سجل التدقيق — ثانوي: أي فشل لا يوقف عمل المستخدم.
  void audit(Employee me,
      {required String action, String? page, String? entity, String? entityId, Map<String, dynamic>? details}) {
    rest.insert('audit_logs', {
      'action': action,
      'page': page,
      'entity': entity,
      'entity_id': entityId,
      'employee_name': me.name,
      'employee_role': me.role,
      'branch_id': me.branchId,
      'new_value': details,
    }, select: 'id').catchError((_) => null);
  }
}
