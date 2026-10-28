import 'dart:math';

import '../core/api_client.dart';
import '../core/rest.dart';
import '../models/employee.dart';
import '../models/order.dart';

/// قطعة في الطلب الجديد (نفس newPiece في NewOrder.jsx).
class Piece {
  Piece() : key = Random().nextInt(1 << 31).toString();
  final String key;
  String itemType = 'shoes';
  final Set<String> services = {};
  String description = '';
  String? technicianId;
  String technicianName = '';

  Map<String, dynamic> toJson() => {
        'item_type': itemType,
        'services': services.toList(),
        'description': description,
        'technician_id': technicianId,
        'technician_name': technicianName,
      };
}

/// خدمات كل نوع — SERVICES_BY_TYPE في الموقع حرفياً.
const servicesByType = <String, List<String>>{
  'shoes': ['تلميع', 'تنظيف', 'خياطة', 'دعسات', 'تنعيل', 'بطانة', 'كعب', 'صيانة', 'غراء', 'توسيع', 'تقصير', 'تغيير جلد', 'أخرى'],
  'bag': [
    'تلوين', 'صبغات', 'تنظيف', 'خياطة', 'تغيير يد', 'تغيير عجلات', 'رسم', 'سفر', 'مدرسية', 'سحاب', 'مفتاح', 'تغليف',
    'سحاب كامل', 'صيانة', 'صيانة هندل', 'غراء', 'قاعدة', 'تثبيت', 'تغيير جلد', 'تلبيس', 'تقصير', 'أخرى'
  ],
};

const dailyCapacity = 8;

class NewOrderResult {
  NewOrderResult(this.order, this.zatcaStatus, {this.warning});
  final Order order;
  final String? zatcaStatus;
  final String? warning;
}

/// إنشاء طلب إصلاح — نفس تسلسل createOrder في NewOrder.jsx:
///  1) حفظ الطلب  2) نقاط/طوابع العميل (أو تسجيله)  3) إحصائيات الموظف
///  4) رسالة الولاء للعميل  5) إصدار الفاتورة الإلكترونية (زاتكا).
class NewOrderService {
  NewOrderService(this.rest, this.api);
  final Rest rest;
  final ApiClient api;

  static String generateOrderNumber([DateTime? now]) {
    final n = now ?? DateTime.now();
    String two(int v) => v.toString().padLeft(2, '0');
    final rand = Random().nextInt(10000).toString().padLeft(4, '0');
    return 'NT${n.year.toString().substring(2)}${two(n.month)}${two(n.day)}$rand';
  }

  static String normalizePhone(String? p) {
    final d = (p ?? '').replaceAll(RegExp(r'\D'), '');
    return d.length <= 9 ? d : d.substring(d.length - 9);
  }

  /// عدد الطلبات (غير الملغاة) لكل يوم تسليم في الشهر — لتلوين التقويم ومنع الأيام الممتلئة.
  Future<Map<String, int>> dayLoad(DateTime month) async {
    String d(DateTime x) => '${x.year}-${x.month.toString().padLeft(2, '0')}-${x.day.toString().padLeft(2, '0')}';
    final start = DateTime(month.year, month.month, 1);
    final end = DateTime(month.year, month.month + 1, 0);
    final rows = await rest.select('orders', select: 'delivery_date', filters: {
      'and': '(delivery_date.gte.${d(start)},delivery_date.lte.${d(end)})',
      'status': 'neq.cancelled',
    }, limit: 2000);
    final map = <String, int>{};
    for (final r in rows) {
      final k = '${r['delivery_date'] ?? ''}';
      if (k.length >= 10) map[k.substring(0, 10)] = (map[k.substring(0, 10)] ?? 0) + 1;
    }
    return map;
  }

  Future<int> countForDay(String day) async {
    final rows = await rest.select('orders', select: 'id', filters: {'delivery_date': 'eq.$day', 'status': 'neq.cancelled'}, limit: 50);
    return rows.length;
  }

  Future<NewOrderResult> create({
    required Employee me,
    required String customerName,
    required String customerPhone,
    required List<Piece> pieces,
    required List<String> photos,
    required String deliveryMethod,
    required String deliveryAddress,
    required String deliveryDate,
    required double price,
    required String paymentStatus,
    required String paymentMethod,
    bool isB2b = false,
    String buyerCompany = '',
    String buyerVat = '',
    String buyerCr = '',
    String buyerAddress = '',
    String? branchName,
  }) async {
    // السعر المُدخل شامل الضريبة (طلب صريح في الموقع) — نستخرج الصافي والضريبة منه
    final subtotal = double.parse((price / 1.15).toStringAsFixed(2));
    final vat = double.parse((price - subtotal).toStringAsFixed(2));

    final combined = [
      for (var i = 0; i < pieces.length; i++)
        'قطعة ${i + 1} (${itemLabels[pieces[i].itemType] ?? pieces[i].itemType})'
            '${pieces[i].services.isEmpty ? '' : ' [${pieces[i].services.join('، ')}]'}'
            '${pieces[i].technicianName.isEmpty ? '' : ' — الفني: ${pieces[i].technicianName}'}'
            '${pieces[i].description.isEmpty ? '' : ': ${pieces[i].description}'}'
    ].join('\n');
    final first = pieces.first.itemType;
    final overall = pieces.every((p) => p.itemType == first) ? first : 'other';
    final points = (price / 10).floor();

    final row = await rest.insert('orders', {
      'order_number': generateOrderNumber(),
      'employee_id': me.id,
      'employee_name': me.name,
      'branch_id': me.branchId,
      'branch_name': branchName ?? me.branchName ?? '',
      'customer_name': customerName,
      'customer_phone': customerPhone,
      'is_b2b': isB2b,
      'buyer_company_name': isB2b ? buyerCompany : null,
      'buyer_vat_number': isB2b ? buyerVat.trim() : null,
      'buyer_cr_number': isB2b ? buyerCr : null,
      'buyer_address': isB2b ? buyerAddress : null,
      'item_type': overall,
      'quantity': pieces.length,
      'order_items': pieces.map((p) => p.toJson()).toList(),
      'photos': photos,
      'delivery_method': deliveryMethod,
      'delivery_address': deliveryMethod == 'delivery' ? deliveryAddress : '',
      'delivery_date': deliveryDate,
      'subtotal': subtotal,
      'vat_amount': vat,
      'total_price': price,
      'payment_status': paymentStatus,
      'payment_method': paymentMethod,
      'status': 'pending',
      'notes': combined,
      'description': combined,
      'points_earned': points,
    });
    if (row == null) throw ApiException('لم يرجع الخادم الطلب المحفوظ');
    final order = Order(row);
    String? warning;

    // ── العميل: نقاط وطوابع (أو تسجيل عميل جديد) — من القاعدة مباشرة ──
    if (customerPhone.trim().isNotEmpty) {
      try {
        final plans = await rest.select('operations_plans', select: 'loyalty_free_after', limit: 1).catchError((_) => <Map<String, dynamic>>[]);
        final freeAfter = (plans.isNotEmpty ? (plans.first['loyalty_free_after'] as num?)?.toInt() : null) ?? 4;
        final found = await rest.secureList('customers', filters: {'phone': customerPhone});
        if (found.isNotEmpty) {
          final c = found.first;
          final stamps = ((c['stamps'] as num?)?.toInt() ?? 0) + 1;
          final reset = stamps >= freeAfter;
          await rest.securePatch('customers', '${c['id']}', {
            'loyalty_points': ((c['loyalty_points'] as num?)?.toInt() ?? 0) + points,
            'stamps': reset ? 0 : stamps,
            'total_orders': ((c['total_orders'] as num?)?.toInt() ?? 0) + 1,
            'total_spent': ((c['total_spent'] as num?) ?? 0) + price,
          });
          _notify(customerPhone, reset
              ? 'يا هلا ${c['name']}! 🎉 تهانينا! أكملت $freeAfter خدمات وحصلت على خدمتك المجانية القادمة! ✂️ إبرة وخيط الإسكافي'
              : 'يا هلا ${c['name']}! أضفنا $points نقطة لحسابك ($stamps/$freeAfter نحو خدمتك المجانية القادمة) ✂️ إبرة وخيط الإسكافي');
        } else {
          await rest.securePost('customers', {
            'name': customerName,
            'phone': customerPhone,
            'loyalty_points': points,
            'stamps': 1,
            'total_orders': 1,
            'total_spent': price,
          });
          _notify(customerPhone,
              'يا هلا $customerName! سجّلناك ببرنامج الولاء وأضفنا $points نقطة لحسابك (1/$freeAfter نحو خدمتك المجانية القادمة) ✂️ إبرة وخيط الإسكافي');
        }
      } on ApiException catch (e) {
        warning = 'حُفظ الطلب، لكن تعذّر تحديث سجل العميل: ${e.message}';
      }
    }

    // ── إحصائيات الموظف (ثانوية — للمالك/المدير فقط حسب صلاحيات الخادم) ──
    try {
      final emp = await rest.single('employees', me.id, select: 'id,total_orders,total_revenue');
      if (emp != null) {
        await rest.update('employees', me.id, {
          'total_orders': ((emp['total_orders'] as num?)?.toInt() ?? 0) + 1,
          'total_revenue': ((emp['total_revenue'] as num?) ?? 0) + price,
        }, select: 'id');
      }
    } on ApiException {
      // ليست ضرورية لإتمام الطلب
    }

    // ── زاتكا: إصدار الفاتورة الإلكترونية لطلب الإصلاح ──
    String? zatca;
    try {
      final res = await api.request('POST', '/api/zatca/submit', data: {'type': 'order', 'id': order.id});
      if (res is Map) zatca = (res['zatca_status'] ?? (res['alreadySubmitted'] == true ? res['zatca_status'] : null))?.toString();
    } on ApiException catch (e) {
      warning ??= 'حُفظ الطلب — لكن إرسال زاتكا واجه مشكلة: ${e.message}';
      zatca = 'ERROR';
    }
    return NewOrderResult(order, zatca, warning: warning);
  }

  void _notify(String phone, String msg) {
    api.request('POST', '/sb/functions/v1/loyalty-notify', data: {'mode': 'direct', 'phone': phone, 'message': msg}).catchError((_) => null);
  }
}
