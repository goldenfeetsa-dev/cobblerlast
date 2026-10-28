import 'package:flutter/material.dart';

import '../pos/pos_ui.dart';

double _d(dynamic v) => v is num ? v.toDouble() : double.tryParse('${v ?? ''}') ?? 0;
int _i(dynamic v) => v is num ? v.toInt() : int.tryParse('${v ?? ''}') ?? 0;
DateTime? _t(dynamic v) => v == null ? null : DateTime.tryParse(v.toString())?.toLocal();

/// تسميات أنواع القطع — نفس ITEM_LABELS في الموقع.
const itemLabels = <String, String>{
  'shoes': 'أحذية',
  'bag': 'حقيبة',
  'dress': 'فستان',
  'suit': 'بدلة',
  'jacket': 'جاكيت',
  'pants': 'بنطال',
  'shirt': 'قميص',
  'other': 'أخرى',
};

const itemEmoji = <String, String>{
  'shoes': '👟', 'bag': '👜', 'dress': '👗', 'suit': '👔', 'jacket': '🧥', 'pants': '👖', 'shirt': '👕', 'other': '📦',
};

/// حالات الطلب الفعلية في قاعدة البيانات (نوع order_status).
/// ملاحظة: «مسترجع/مستبدل/متوقف» الظاهرة في الموقع ليست ضمن النوع فيرفضها الخادم،
/// لذلك لا تُعرض هنا حتى تُضاف لقاعدة البيانات.
enum OrderStatus {
  pending('قيد الانتظار', Icons.schedule_rounded, Pos.amber),
  inProgress('جارٍ التنفيذ', Icons.autorenew_rounded, Pos.blue),
  ready('جاهز', Icons.inventory_2_outlined, Pos.green),
  completed('تم التسليم', Icons.check_circle_outline_rounded, Color(0xFF0E8A6A)),
  cancelled('ملغى', Icons.cancel_outlined, Pos.red);

  const OrderStatus(this.label, this.icon, this.color);
  final String label;
  final IconData icon;
  final Color color;

  String get db => this == OrderStatus.inProgress ? 'in_progress' : name;

  static OrderStatus parse(String? s) => switch (s) {
        'in_progress' => OrderStatus.inProgress,
        'ready' => OrderStatus.ready,
        'completed' => OrderStatus.completed,
        'cancelled' => OrderStatus.cancelled,
        _ => OrderStatus.pending,
      };
}

/// نصوص رسالة واتساب للعميل — نفس STATUS_LABELS في OrderDetails.jsx.
const whatsappStatusText = <String, String>{
  'pending': 'قيد الانتظار ⏳',
  'in_progress': 'جارٍ التنفيذ 🔧',
  'ready': 'جاهز للاستلام ✅',
  'completed': 'مكتمل 🎉',
  'cancelled': 'ملغى ❌',
};

const paymentMethodLabels = <String, String>{
  'cash': 'نقد',
  'network': 'شبكة',
  'card': 'بطاقة',
  'mada': 'مدى',
  'visa': 'فيزا',
  'mastercard': 'ماستركارد',
  'apple_pay': 'Apple Pay',
  'online': 'إلكتروني',
};

class OrderItem {
  const OrderItem({required this.itemType, required this.services, this.technician, this.description});
  final String itemType;
  final List<String> services;
  final String? technician;
  final String? description;

  factory OrderItem.fromJson(Map<String, dynamic> j) => OrderItem(
        itemType: (j['item_type'] ?? 'other').toString(),
        services: (j['services'] is List) ? (j['services'] as List).map((e) => '$e').toList() : const [],
        technician: j['technician_name']?.toString(),
        description: j['description']?.toString(),
      );
}

class Order {
  Order(this.raw);
  final Map<String, dynamic> raw;

  String get id => '${raw['id']}';
  String get number => '${raw['order_number'] ?? '—'}';
  String get customerName => (raw['customer_name'] ?? '').toString().trim().isEmpty ? 'بدون اسم' : '${raw['customer_name']}';
  String? get customerPhone => raw['customer_phone']?.toString();
  String get itemType => '${raw['item_type'] ?? 'other'}';
  String get itemLabel => itemLabels[itemType] ?? itemType;
  int get quantity => _i(raw['quantity']) == 0 ? 1 : _i(raw['quantity']);
  String get statusRaw => '${raw['status'] ?? 'pending'}';
  OrderStatus get status => OrderStatus.parse(statusRaw);
  bool get isPaid => raw['payment_status'] == 'paid';
  String? get paymentMethod => raw['payment_method']?.toString();
  double get total => _d(raw['total_price']);
  double? get subtotal => raw['subtotal'] == null ? null : _d(raw['subtotal']);
  double? get vat => raw['vat_amount'] == null ? null : _d(raw['vat_amount']);
  DateTime? get createdAt => _t(raw['created_at']);
  String? get employeeName => raw['employee_name']?.toString();
  String? get branchId => raw['branch_id']?.toString();
  String? get shelf => (raw['shelf_location'] ?? '').toString().trim().isEmpty ? null : '${raw['shelf_location']}';
  List<String> get photos => (raw['photos'] is List) ? (raw['photos'] as List).map((e) => '$e').where((e) => e.startsWith('http')).toList() : const [];
  String? get description => (raw['description'] ?? '').toString().trim().isEmpty ? null : '${raw['description']}';
  String? get notes => (raw['notes'] ?? '').toString().trim().isEmpty ? null : '${raw['notes']}';
  String get deliveryMethod => '${raw['delivery_method'] ?? 'pickup'}';
  String? get deliveryAddress => raw['delivery_address']?.toString();
  double? get lat => raw['delivery_lat'] == null ? null : _d(raw['delivery_lat']);
  double? get lng => raw['delivery_lng'] == null ? null : _d(raw['delivery_lng']);
  DateTime? get deliveryDate => raw['delivery_date'] == null ? null : DateTime.tryParse('${raw['delivery_date']}');
  int get points => _i(raw['points_earned']);
  bool get keepPhotos => raw['keep_photos'] == true;
  String? get zatcaStatus => raw['zatca_status']?.toString();
  bool get isZatcaLocked => zatcaStatus == 'REPORTED' || zatcaStatus == 'CLEARED';
  String? get workerName => raw['worker_name']?.toString();
  DateTime? get workStartedAt => _t(raw['work_started_at']);
  DateTime? get workDoneAt => _t(raw['work_done_at']);
  List<OrderItem> get items => (raw['order_items'] is List)
      ? (raw['order_items'] as List).whereType<Map>().map((e) => OrderItem.fromJson(e.map((k, v) => MapEntry('$k', v)))).toList()
      : const [];

  Order copyWith(Map<String, dynamic> patch) => Order({...raw, ...patch});
}

/// أعمدة قائمة الطلبات — نفس select في Orders.jsx (الفني بدون جوال/سعر/دفع).
const orderListColumns =
    'id,order_number,customer_name,customer_phone,employee_name,item_type,quantity,shelf_location,status,payment_status,payment_method,total_price,photos,created_at,branch_id,delivery_method,zatca_status';
const orderListColumnsStaff =
    'id,order_number,customer_name,employee_name,item_type,quantity,shelf_location,status,photos,created_at,branch_id,delivery_method';

String fmtDateTime(DateTime? d) {
  if (d == null) return '—';
  String two(int n) => n.toString().padLeft(2, '0');
  return '${d.year}/${two(d.month)}/${two(d.day)} ${two(d.hour)}:${two(d.minute)}';
}

String fmtDuration(Duration? d) {
  if (d == null || d.isNegative) return '—';
  final mins = d.inMinutes;
  if (mins < 1) return 'أقل من دقيقة';
  final h = mins ~/ 60, m = mins % 60;
  if (h >= 24) return '${h ~/ 24} يوم ${h % 24} ساعة';
  return h > 0 ? '$h ساعة${m > 0 ? ' و$m دقيقة' : ''}' : '$m دقيقة';
}
