import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/api_client.dart';
import '../../models/order.dart';
import '../../state/auth_controller.dart';
import '../../state/order_service.dart';
import '../pos_ui.dart';
import '../receipt.dart';

/// رسالة واتساب للعميل — نفس buildWhatsAppMessage في الموقع حرفياً.
String whatsappMessage(Order o, String status) {
  final st = whatsappStatusText[status] ?? status;
  return 'السلام عليكم ${o.customerName} 👋\n\nنود إعلامك بتحديث حالة طلبك:\n\n'
      '🔖 رقم الطلب: ${o.number}\n📦 القطعة: ${o.itemLabel}\n📊 الحالة الجديدة: $st\n'
      '💰 المبلغ: ${o.total.toStringAsFixed(2)} ريال\n\nشكراً لثقتك بـ إبرة وخيط الإسكافي 🌟';
}

String? saudiPhone(String? phone) {
  if (phone == null) return null;
  final p = phone.replaceAll(RegExp(r'\D'), '');
  if (p.isEmpty) return null;
  return p.startsWith('0') ? '966${p.substring(1)}' : p.startsWith('966') ? p : '966$p';
}

Future<void> openWhatsApp(BuildContext context, Order o, String status) async {
  final phone = saudiPhone(o.customerPhone);
  if (phone == null) return;
  final uri = Uri.parse('https://wa.me/$phone?text=${Uri.encodeComponent(whatsappMessage(o, status))}');
  if (!await launchUrl(uri, mode: LaunchMode.externalApplication) && context.mounted) {
    toast(context, 'تعذّر فتح واتساب', error: true);
  }
}

class OrderDetailsScreen extends StatefulWidget {
  const OrderDetailsScreen({super.key, required this.orderId, this.justCreated = false});
  final String orderId;

  /// بعد إنشاء الطلب مباشرة: يفتح تبويب الفاتورة ويطبع تلقائياً (مثل الموقع).
  final bool justCreated;

  @override
  State<OrderDetailsScreen> createState() => _OrderDetailsScreenState();
}

class _OrderDetailsScreenState extends State<OrderDetailsScreen> {
  Order? _o;
  String? _error;
  bool _busy = false;
  late bool _receipt = widget.justCreated;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final o = await context.read<OrderService>().get(widget.orderId);
      if (!mounted) return;
      setState(() {
        _o = o;
        _error = o == null ? 'الطلب غير موجود' : null;
      });
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    }
  }

  Future<void> _patch(Map<String, dynamic> patch, String msg, {bool offerWhatsApp = false}) async {
    final me = context.read<AuthController>().employee!;
    setState(() => _busy = true);
    try {
      final o = await context.read<OrderService>().update(me, _o!, patch, page: 'تفاصيل الطلب');
      if (!mounted) return;
      setState(() => _o = Order({..._o!.raw, ...o.raw}));
      ScaffoldMessenger.of(context)
        ..hideCurrentSnackBar()
        ..showSnackBar(SnackBar(
          content: Text(msg),
          duration: Duration(seconds: offerWhatsApp ? 8 : 3),
          action: offerWhatsApp && _o!.customerPhone != null
              ? SnackBarAction(label: '📱 أبلغ العميل واتساب', onPressed: () => openWhatsApp(context, _o!, '${patch['status']}'))
              : null,
        ));
    } on ApiException catch (e) {
      if (mounted) toast(context, 'فشل التحديث: ${e.message}', error: true);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _confirmCancel() async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (c) => AlertDialog(
        title: const Text('إلغاء الفاتورة؟'),
        content: const Text('سيُلغى الطلب ولن يُحتسب في الإيراد.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(c, false), child: const Text('رجوع')),
          FilledButton(
              style: FilledButton.styleFrom(backgroundColor: Pos.destructive),
              onPressed: () => Navigator.pop(c, true),
              child: const Text('تأكيد الإلغاء')),
        ],
      ),
    );
    if (ok == true) _patch({'status': 'cancelled'}, 'تم تنفيذ: إلغاء الفاتورة', offerWhatsApp: true);
  }

  @override
  Widget build(BuildContext context) {
    final me = context.watch<AuthController>().employee!;
    final isAdmin = {'owner', 'admin', 'manager'}.contains(me.role);
    final o = _o;
    return Scaffold(
      backgroundColor: Colors.transparent,
      body: PosBackground(
        child: SafeArea(
          child: Column(children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(8, 6, 16, 0),
              child: Row(children: [
                IconButton(onPressed: () => Navigator.pop(context), icon: const Icon(Icons.arrow_forward_rounded), tooltip: 'رجوع'),
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(o?.number ?? '...', style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w800, fontFeatures: [FontFeature.tabularFigures()])),
                    if (o != null) Text(fmtDateTime(o.createdAt), style: const TextStyle(fontSize: 12.5, color: Pos.muted)),
                  ]),
                ),
                if (_busy) const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2)),
              ]),
            ),
            Expanded(
              child: _error != null
                  ? Padding(padding: const EdgeInsets.all(16), child: LoadError(message: _error!, onRetry: _load))
                  : o == null
                      ? const Center(child: CircularProgressIndicator())
                      : RefreshIndicator(onRefresh: _load, child: _body(o, isAdmin)),
            ),
          ]),
        ),
      ),
    );
  }

  Widget _body(Order o, bool isAdmin) {
    return LayoutBuilder(builder: (context, c) {
      final wide = c.maxWidth >= 900;
      final left = [_photosCard(o)];
      final right = [_customerCard(o), _itemCard(o), _paymentCard(o, isAdmin)];
      final tabs = Align(
        alignment: AlignmentDirectional.centerStart,
        child: Padding(
          padding: const EdgeInsets.only(bottom: 12),
          child: SegmentedButton<bool>(
            segments: const [
              ButtonSegment(value: false, label: Text('التفاصيل')),
              ButtonSegment(value: true, label: Text('الفاتورة والباركود')),
            ],
            selected: {_receipt},
            showSelectedIcon: false,
            onSelectionChanged: (v) => setState(() => _receipt = v.first),
          ),
        ),
      );
      if (_receipt) {
        return ListView(
          padding: const EdgeInsets.fromLTRB(16, 10, 16, 32),
          children: [tabs, ReceiptPanel(order: o, autoPrint: widget.justCreated)],
        );
      }
      return ListView(
        padding: const EdgeInsets.fromLTRB(16, 10, 16, 32),
        physics: const AlwaysScrollableScrollPhysics(),
        children: [
          tabs,
          _statusBar(o, isAdmin),
          if (o.workStartedAt != null || o.workDoneAt != null) _timingCard(o),
          if (wide)
            Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Expanded(child: Column(children: right)),
              const SizedBox(width: 16),
              Expanded(child: Column(children: left)),
            ])
          else ...[...right, ...left],
          _invoiceCard(o),
        ],
      );
    });
  }

  Widget _statusBar(Order o, bool isAdmin) {
    return GlassCard(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      child: Wrap(spacing: 10, runSpacing: 10, crossAxisAlignment: WrapCrossAlignment.center, children: [
        const Text('الحالة:', style: TextStyle(color: Pos.muted, fontSize: 13)),
        DropdownButtonHideUnderline(
          child: DropdownButton<String>(
            value: o.status.db,
            borderRadius: BorderRadius.circular(14),
            items: [
              for (final s in OrderStatus.values)
                if (s != OrderStatus.cancelled || o.status == OrderStatus.cancelled)
                  DropdownMenuItem(
                    value: s.db,
                    child: Row(mainAxisSize: MainAxisSize.min, children: [
                      Icon(s.icon, size: 16, color: s.color),
                      const SizedBox(width: 6),
                      Text(s.label, style: TextStyle(color: s.color, fontWeight: FontWeight.w700)),
                    ]),
                  ),
            ],
            onChanged: _busy || o.status == OrderStatus.cancelled
                ? null
                : (v) {
                    if (v != null && v != o.status.db) _patch({'status': v}, 'تم تحديث الحالة', offerWhatsApp: true);
                  },
          ),
        ),
        if (isAdmin && o.status != OrderStatus.cancelled && !o.isZatcaLocked)
          OutlineSmall(label: 'إلغاء الفاتورة', icon: Icons.cancel_outlined, color: Pos.destructive, onPressed: _busy ? null : _confirmCancel),
      ]),
    );
  }

  Widget _timingCard(Order o) {
    final dur = o.workStartedAt == null ? null : (o.workDoneAt ?? DateTime.now()).difference(o.workStartedAt!);
    return GlassCard(
      margin: const EdgeInsets.only(bottom: 12),
      child: Wrap(spacing: 18, runSpacing: 6, children: [
        _kv('👷 الفني', o.workerName ?? '—'),
        _kv('بدأ', fmtDateTime(o.workStartedAt)),
        _kv('أنجز', o.workDoneAt == null ? 'جارٍ…' : fmtDateTime(o.workDoneAt)),
        _kv('⏱ المدة', fmtDuration(dur)),
      ]),
    );
  }

  Widget _kv(String k, String v) => Text.rich(TextSpan(children: [
        TextSpan(text: '$k: ', style: const TextStyle(color: Pos.muted)),
        TextSpan(text: v, style: const TextStyle(fontWeight: FontWeight.w700)),
      ]), style: const TextStyle(fontSize: 13));

  Widget _row(IconData icon, String label, Widget value) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 6),
        child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Padding(padding: const EdgeInsets.only(top: 2), child: Icon(icon, size: 18, color: Pos.muted)),
          const SizedBox(width: 12),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(label, style: const TextStyle(fontSize: 11.5, color: Pos.muted)),
              const SizedBox(height: 2),
              value,
            ]),
          ),
        ]),
      );

  Widget _customerCard(Order o) {
    return GlassCard(
      margin: const EdgeInsets.only(bottom: 12),
      child: Column(children: [
        Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Expanded(
            child: _row(
              Icons.person_outline_rounded,
              'العميل',
              Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(o.customerName, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
                if (o.customerPhone != null)
                  Directionality(textDirection: TextDirection.ltr, child: Text(o.customerPhone!, style: const TextStyle(color: Pos.muted, fontSize: 13))),
              ]),
            ),
          ),
          if (o.customerPhone != null) ...[
            PrimaryButton(label: 'واتساب', icon: Icons.chat_rounded, color: const Color(0xFF25D366), onPressed: () => openWhatsApp(context, o, o.statusRaw)),
            const SizedBox(width: 6),
            IconButton.filledTonal(
              tooltip: 'اتصال',
              onPressed: () => launchUrl(Uri.parse('tel:${o.customerPhone}')),
              icon: const Icon(Icons.call_rounded, size: 19),
            ),
          ],
        ]),
        _row(Icons.schedule_rounded, 'الموظف', Text(o.employeeName ?? '—', style: const TextStyle(fontWeight: FontWeight.w600))),
      ]),
    );
  }

  Widget _itemCard(Order o) {
    return GlassCard(
      margin: const EdgeInsets.only(bottom: 12),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        _row(Icons.inventory_2_outlined, 'القطعة', Text('${o.itemLabel} × ${o.quantity}', style: const TextStyle(fontWeight: FontWeight.w700))),
        if (o.items.isNotEmpty) ...[
          const Divider(),
          const Text('تفصيل القطع', style: TextStyle(fontSize: 11.5, color: Pos.muted)),
          const SizedBox(height: 6),
          for (var i = 0; i < o.items.length; i++)
            Container(
              margin: const EdgeInsets.only(bottom: 8),
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(color: const Color(0x147882A0), borderRadius: BorderRadius.circular(12)),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Row(children: [
                  Expanded(child: Text('قطعة ${i + 1} — ${itemLabels[o.items[i].itemType] ?? o.items[i].itemType}', style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13.5))),
                  if (o.items[i].technician != null) Text('الفني: ${o.items[i].technician}', style: const TextStyle(fontSize: 12, color: Pos.muted)),
                ]),
                if (o.items[i].services.isNotEmpty) ...[
                  const SizedBox(height: 6),
                  Wrap(spacing: 5, runSpacing: 5, children: [for (final s in o.items[i].services) SoftBadge(s, Pos.primary)]),
                ],
                if ((o.items[i].description ?? '').isNotEmpty) ...[
                  const SizedBox(height: 6),
                  Text(o.items[i].description!, style: const TextStyle(fontSize: 12.5, color: Pos.muted)),
                ],
              ]),
            ),
        ],
        _row(
          Icons.place_outlined,
          'التسليم',
          Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(o.deliveryMethod == 'pickup' ? 'استلام من المحل' : 'توصيل', style: const TextStyle(fontWeight: FontWeight.w700)),
            if ((o.deliveryAddress ?? '').isNotEmpty) Text(o.deliveryAddress!, style: const TextStyle(fontSize: 13, color: Pos.muted)),
            if (o.deliveryMethod == 'delivery')
              o.lat != null && o.lng != null
                  ? TextButton.icon(
                      style: TextButton.styleFrom(padding: EdgeInsets.zero, visualDensity: VisualDensity.compact),
                      onPressed: () => launchUrl(Uri.parse('https://maps.google.com/?q=${o.lat},${o.lng}'), mode: LaunchMode.externalApplication),
                      icon: const Icon(Icons.map_outlined, size: 16),
                      label: const Text('فتح موقع التوصيل على الخريطة'),
                    )
                  : const Text('⚠ لا يوجد موقع محدد على الخريطة لهذا الطلب — فقط عنوان نصي', style: TextStyle(fontSize: 12, color: Pos.amber)),
          ]),
        ),
        _row(
          Icons.event_outlined,
          'تاريخ التسليم',
          Text(o.deliveryDate == null ? 'غير محدد' : '${o.deliveryDate!.year}/${o.deliveryDate!.month}/${o.deliveryDate!.day}',
              style: const TextStyle(fontWeight: FontWeight.w700)),
        ),
        if (o.notes != null) ...[
          const Divider(),
          const Text('ملاحظات', style: TextStyle(fontSize: 11.5, color: Pos.muted)),
          const SizedBox(height: 4),
          Text(o.notes!, style: const TextStyle(fontSize: 13.5)),
        ],
      ]),
    );
  }

  Widget _paymentCard(Order o, bool isAdmin) {
    return GlassCard(
      margin: const EdgeInsets.only(bottom: 12),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        _row(Icons.credit_card_rounded, 'الإجمالي', PosMoney(o.total, size: 24, weight: FontWeight.w800)),
        const SizedBox(height: 6),
        Wrap(spacing: 8, runSpacing: 8, crossAxisAlignment: WrapCrossAlignment.center, children: [
          ActionChip(
            avatar: Text(o.isPaid ? '✅' : '⏳'),
            label: Text(o.isPaid ? 'مدفوع (اضغط للتغيير)' : 'غير مدفوع (اضغط للتغيير)'),
            labelStyle: TextStyle(color: o.isPaid ? Pos.green : Pos.red, fontWeight: FontWeight.w700, fontSize: 12.5),
            backgroundColor: (o.isPaid ? Pos.green : Pos.red).withValues(alpha: .1),
            side: BorderSide(color: (o.isPaid ? Pos.green : Pos.red).withValues(alpha: .3)),
            onPressed: _busy ? null : () => _patch({'payment_status': o.isPaid ? 'unpaid' : 'paid'}, 'تم تحديث حالة الدفع'),
          ),
          if (isAdmin)
            DropdownButton<String>(
              value: {'cash', 'network'}.contains(o.paymentMethod) ? o.paymentMethod : null,
              hint: Text(paymentMethodLabels[o.paymentMethod] ?? 'طريقة الدفع'),
              borderRadius: BorderRadius.circular(14),
              underline: const SizedBox.shrink(),
              items: const [
                DropdownMenuItem(value: 'cash', child: Text('نقد')),
                DropdownMenuItem(value: 'network', child: Text('شبكة')),
              ],
              onChanged: _busy ? null : (v) => v == null ? null : _patch({'payment_method': v}, 'تم تحديث طريقة الدفع'),
            )
          else
            SoftBadge(paymentMethodLabels[o.paymentMethod] ?? (o.paymentMethod ?? '—'), Pos.muted),
        ]),
        const Divider(height: 22),
        Row(children: [
          const Icon(Icons.star_border_rounded, size: 18, color: Pos.primary),
          const SizedBox(width: 6),
          Text('+${o.points} نقطة ولاء مكتسبة', style: const TextStyle(fontSize: 13)),
        ]),
      ]),
    );
  }

  Widget _photosCard(Order o) {
    return GlassCard(
      margin: const EdgeInsets.only(bottom: 12),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        const Text('الصور', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
        const SizedBox(height: 10),
        if (o.photos.isEmpty)
          const Padding(
            padding: EdgeInsets.symmetric(vertical: 22),
            child: Column(children: [
              Text('🗑️', style: TextStyle(fontSize: 28)),
              SizedBox(height: 6),
              Text('لا توجد صور — أو حُذفت تلقائياً بعد إكمال الطلب توفيراً للمساحة',
                  textAlign: TextAlign.center, style: TextStyle(color: Pos.muted, fontSize: 13)),
            ]),
          )
        else
          SizedBox(
            height: 220,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              itemCount: o.photos.length,
              separatorBuilder: (_, __) => const SizedBox(width: 10),
              itemBuilder: (_, i) => GestureDetector(
                onTap: () => showDialog<void>(
                  context: context,
                  builder: (_) => Dialog(
                    backgroundColor: Colors.black,
                    insetPadding: const EdgeInsets.all(12),
                    child: InteractiveViewer(child: Image.network(o.photos[i], fit: BoxFit.contain)),
                  ),
                ),
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(14),
                  child: AspectRatio(
                    aspectRatio: 3 / 4,
                    child: Image.network(o.photos[i], fit: BoxFit.cover,
                        errorBuilder: (_, __, ___) => Container(color: const Color(0x147882A0), child: const Icon(Icons.broken_image_outlined, color: Pos.muted))),
                  ),
                ),
              ),
            ),
          ),
        if (o.photos.isNotEmpty || o.keepPhotos)
          CheckboxListTile(
            contentPadding: EdgeInsets.zero,
            dense: true,
            controlAffinity: ListTileControlAffinity.leading,
            value: o.keepPhotos,
            onChanged: _busy ? null : (v) => _patch({'keep_photos': v == true}, v == true ? 'ستبقى الصور للمعرض' : 'ستُحذف الصور تلقائياً'),
            title: const Text('احتفظ بصور هذا الطلب للمعرض/الشهادة (لا تُحذف تلقائياً)', style: TextStyle(fontSize: 12.5, color: Pos.muted)),
          ),
      ]),
    );
  }

  Widget _invoiceCard(Order o) {
    final sub = o.subtotal ?? (o.vat != null ? o.total - o.vat! : o.total / 1.15);
    final vat = o.vat ?? (o.total - sub);
    Widget line(String k, num v, {bool strong = false}) => Padding(
          padding: const EdgeInsets.symmetric(vertical: 5),
          child: Row(children: [
            Expanded(child: Text(k, style: TextStyle(color: strong ? Pos.fg : Pos.muted, fontWeight: strong ? FontWeight.w700 : FontWeight.w400))),
            PosMoney(v, size: strong ? 16 : 14, weight: strong ? FontWeight.w800 : FontWeight.w500),
          ]),
        );
    return GlassCard(
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        const Text('ملخص الفاتورة', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
        const SizedBox(height: 8),
        line('المبلغ قبل الضريبة', sub),
        line('ضريبة القيمة المضافة 15%', vat),
        const Divider(),
        line('الإجمالي', o.total, strong: true),
        const SizedBox(height: 4),
      ]),
    );
  }
}
