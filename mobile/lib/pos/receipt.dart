import 'dart:convert';
import 'dart:typed_data';
import 'dart:ui' as ui;

import 'package:barcode_widget/barcode_widget.dart';
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;
import 'package:printing/printing.dart';
import 'package:provider/provider.dart';
import 'package:qr_flutter/qr_flutter.dart';

import '../core/rest.dart';
import '../models/order.dart';
import '../theme.dart';
import 'pos_ui.dart';

/// رمز QR للمرحلة الأولى من زاتكا (TLV بصيغة Base64) — نفس buildZatcaTLV في الموقع.
String buildZatcaTlv({required String seller, required String vat, required DateTime date, required double total, required double vatAmount}) {
  List<int> enc(int tag, String v) {
    final b = utf8.encode(v);
    return [tag, b.length, ...b];
  }

  final u = date.toUtc();
  String two(int n) => n.toString().padLeft(2, '0');
  final ms = u.millisecond == 0 ? '' : '.${u.millisecond.toString().padLeft(3, '0')}';
  final ts = '${u.year}-${two(u.month)}-${two(u.day)}T${two(u.hour)}:${two(u.minute)}:${two(u.second)}${ms}Z';
  return base64.encode([
    ...enc(1, seller),
    ...enc(2, vat),
    ...enc(3, ts),
    ...enc(4, total.toStringAsFixed(2)),
    ...enc(5, vatAmount.toStringAsFixed(2)),
  ]);
}

class ShopInfo {
  const ShopInfo({required this.name, required this.vat, required this.cr});
  final String name, vat, cr;

  static const fallback = ShopInfo(name: 'مؤسسة إبرة وخيط الإسكافي للتجارة', vat: '314151483700003', cr: '7051288830');

  static Future<ShopInfo> load(Rest rest) async {
    try {
      final r = await rest.select('app_settings', select: 'shop_name,vat_number,cr_number', limit: 1);
      if (r.isEmpty) return fallback;
      String pick(String k, String d) => (r.first[k] ?? '').toString().trim().isEmpty ? d : '${r.first[k]}';
      return ShopInfo(name: pick('shop_name', fallback.name), vat: pick('vat_number', fallback.vat), cr: pick('cr_number', fallback.cr));
    } catch (_) {
      return fallback;
    }
  }
}

/// الفاتورة الحرارية 72mm — نسخة طبق الأصل من ReceiptView.jsx.
class Receipt extends StatelessWidget {
  const Receipt({super.key, required this.order, required this.shop});
  final Order order;
  final ShopInfo shop;

  static const _black = Color(0xFF000000);

  @override
  Widget build(BuildContext context) {
    final o = order;
    final sub = o.subtotal ?? double.parse((o.total / 1.15).toStringAsFixed(2));
    final vat = o.vat ?? double.parse((o.total - sub).toStringAsFixed(2));
    final created = o.createdAt ?? DateTime.now();
    final qr = (o.raw['zatca_qr'] ?? '').toString().isNotEmpty
        ? '${o.raw['zatca_qr']}'
        : buildZatcaTlv(seller: shop.name, vat: shop.vat, date: created, total: o.total, vatAmount: vat);
    final b2b = o.raw['is_b2b'] == true;
    String two(int n) => n.toString().padLeft(2, '0');
    final dt = '${two(created.day)}/${two(created.month)}/${created.year} — ${two(created.hour)}:${two(created.minute)}:${two(created.second)}';
    final z = o.zatcaStatus;
    // فاتورة منتج (من المبيعات) لها أصناف متعددة بخلاف فاتورة الإصلاح
    final items = (o.raw['items'] is List) ? (o.raw['items'] as List).whereType<Map>().toList() : const <Map>[];
    final isProduct = items.isNotEmpty;

    Widget row(String l, String v, {bool bold = false, bool large = false}) => Padding(
          padding: const EdgeInsets.only(bottom: 3),
          child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Expanded(child: Text(l, style: TextStyle(fontSize: large ? 12 : 10, fontWeight: FontWeight.w600, color: _black))),
            const SizedBox(width: 6),
            Flexible(
              child: Text(v,
                  textAlign: TextAlign.left,
                  style: TextStyle(fontSize: large ? 13 : 10, fontWeight: bold ? FontWeight.w900 : FontWeight.w700, color: _black)),
            ),
          ]),
        );
    Widget money(double v, {double size = 10, FontWeight w = FontWeight.w700}) => Directionality(
          textDirection: TextDirection.ltr,
          child: Text.rich(TextSpan(children: [
            TextSpan(text: '#', style: TextStyle(fontFamily: AC.riyalFont, fontSize: size * .95)),
            const TextSpan(text: ' '),
            TextSpan(text: v.toStringAsFixed(2)),
          ]), style: TextStyle(fontSize: size, fontWeight: w, color: _black)),
        );
    Widget moneyRow(String l, double v) => Padding(
          padding: const EdgeInsets.only(bottom: 3),
          child: Row(children: [
            Expanded(child: Text(l, style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w600, color: _black))),
            money(v),
          ]),
        );
    const dashed = _Dashed();
    const title = TextStyle(fontSize: 9, fontWeight: FontWeight.w700, color: _black, letterSpacing: .5);

    return Container(
      width: 290,
      padding: const EdgeInsets.fromLTRB(16, 20, 16, 20),
      color: Colors.white,
      child: DefaultTextStyle(
        style: const TextStyle(fontFamily: AC.font, color: _black, fontWeight: FontWeight.w500),
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Image.asset('assets/images/logo-cobblers-receipt.png', width: 260, fit: BoxFit.contain),
          const SizedBox(height: 8),
          Text(shop.name, textAlign: TextAlign.center, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w900)),
          const Text('خدمات التصليح والخياطة للأحذية والحقائب الجلدية', textAlign: TextAlign.center, style: TextStyle(fontSize: 9)),
          const SizedBox(height: 6),
          Text('السجل التجاري / CR No: ${shop.cr}', textAlign: TextAlign.center, style: const TextStyle(fontSize: 9, height: 1.7)),
          Text('الرقم الضريبي / VAT No: ${shop.vat}', textAlign: TextAlign.center, style: const TextStyle(fontSize: 9, height: 1.7)),
          const SizedBox(height: 6),
          Center(
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 2),
              decoration: BoxDecoration(border: Border.all(color: const Color(0xFF111111)), borderRadius: BorderRadius.circular(4)),
              child: Text(
                'فاتورة ضريبية ${b2b ? '(شركات)' : 'مبسطة'} — ${b2b ? 'Tax Invoice (B2B)' : 'Simplified Tax Invoice'}',
                style: const TextStyle(fontSize: 9, fontWeight: FontWeight.w700),
              ),
            ),
          ),
          dashed,
          row('رقم الفاتورة / Invoice No', o.number, bold: true),
          row('نوع الفاتورة', isProduct ? 'بيع منتج' : 'خدمة إصلاح'),
          row('التاريخ والوقت / Date & Time', dt),
          row('الموظف', o.employeeName ?? '—'),
          if ((o.raw['branch_name'] ?? '').toString().isNotEmpty) row('الفرع', '${o.raw['branch_name']}'),
          dashed,
          const Text('بيانات العميل', style: title),
          const SizedBox(height: 4),
          row('الاسم', o.customerName, bold: true),
          if (o.customerPhone != null && o.customerPhone!.isNotEmpty) row('الجوال', o.customerPhone!),
          if (!isProduct && o.deliveryDate != null)
            Container(
              margin: const EdgeInsets.symmetric(vertical: 3),
              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 3),
              decoration: BoxDecoration(border: Border.all(color: _black), borderRadius: BorderRadius.circular(4)),
              child: Row(children: [
                const Expanded(child: Text('تاريخ التسليم', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700))),
                Text('${two(o.deliveryDate!.day)}/${two(o.deliveryDate!.month)}/${o.deliveryDate!.year}',
                    style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700)),
              ]),
            ),
          if (b2b)
            Container(
              margin: const EdgeInsets.only(top: 6),
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(color: const Color(0xFFF3F4F6), borderRadius: BorderRadius.circular(6), border: Border.all(color: const Color(0xFF4B5563))),
              child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                const Text('فاتورة صادرة لمنشأة / Tax Invoice for a Business (B2B)', style: TextStyle(fontSize: 9, fontWeight: FontWeight.w700)),
                const SizedBox(height: 3),
                row('اسم الشركة', '${o.raw['buyer_company_name'] ?? '—'}', bold: true),
                row('الرقم الضريبي للمشتري', '${o.raw['buyer_vat_number'] ?? '—'}'),
                if ((o.raw['buyer_cr_number'] ?? '').toString().isNotEmpty) row('السجل التجاري للمشتري', '${o.raw['buyer_cr_number']}'),
                if ((o.raw['buyer_address'] ?? '').toString().isNotEmpty) row('عنوان الشركة', '${o.raw['buyer_address']}'),
              ]),
            ),
          dashed,
          Text(isProduct ? 'الأصناف المباعة' : 'تفاصيل الخدمة', style: title),
          const SizedBox(height: 4),
          Container(
            padding: const EdgeInsets.only(bottom: 3),
            margin: const EdgeInsets.only(bottom: 4),
            decoration: const BoxDecoration(border: Border(bottom: BorderSide(color: _black))),
            child: const Row(children: [
              Expanded(flex: 3, child: Text('الصنف / الخدمة', style: TextStyle(fontSize: 9, fontWeight: FontWeight.w700))),
              Expanded(child: Text('الكمية', textAlign: TextAlign.center, style: TextStyle(fontSize: 9, fontWeight: FontWeight.w700))),
              Expanded(flex: 2, child: Text('السعر', textAlign: TextAlign.left, style: TextStyle(fontSize: 9, fontWeight: FontWeight.w700))),
            ]),
          ),
          if (isProduct)
            for (final it in items)
              Padding(
                padding: const EdgeInsets.only(bottom: 4),
                child: Row(children: [
                  Expanded(flex: 3, child: Text('${it['item_name'] ?? ''}', style: const TextStyle(fontSize: 10))),
                  Expanded(child: Text('${it['qty'] ?? 1}', textAlign: TextAlign.center, style: const TextStyle(fontSize: 10))),
                  Expanded(
                    flex: 2,
                    child: Align(
                      alignment: Alignment.centerLeft,
                      child: money(((it['sell_price'] as num?) ?? 0).toDouble() * ((it['qty'] as num?) ?? 1).toDouble()),
                    ),
                  ),
                ]),
              )
          else
            Row(children: [
              Expanded(flex: 3, child: Text(o.itemLabel, style: const TextStyle(fontSize: 10))),
              Expanded(child: Text('${o.quantity}', textAlign: TextAlign.center, style: const TextStyle(fontSize: 10))),
              Expanded(flex: 2, child: Align(alignment: Alignment.centerLeft, child: money(sub))),
            ]),
          if (o.deliveryMethod == 'delivery')
            const Padding(
              padding: EdgeInsets.only(top: 4),
              child: Row(children: [
                Expanded(flex: 3, child: Text('رسوم التوصيل', style: TextStyle(fontSize: 10))),
                Expanded(child: Text('1', textAlign: TextAlign.center, style: TextStyle(fontSize: 10))),
                Expanded(flex: 2, child: Text('—', textAlign: TextAlign.left, style: TextStyle(fontSize: 10))),
              ]),
            ),
          dashed,
          moneyRow('المجموع قبل الضريبة', sub),
          moneyRow('ضريبة القيمة المضافة (15%)', vat),
          Container(
            margin: const EdgeInsets.only(top: 6),
            padding: const EdgeInsets.only(top: 6),
            decoration: const BoxDecoration(border: Border(top: BorderSide(color: _black, width: 2))),
            child: Row(children: [
              const Expanded(child: Text('الإجمالي شامل الضريبة', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w900))),
              money(o.total, size: 14, w: FontWeight.w900),
            ]),
          ),
          const SizedBox(height: 6),
          if (o.paymentMethod != null)
            row('طريقة الدفع', o.paymentMethod == 'cash' ? 'نقد' : o.paymentMethod == 'network' ? 'شبكة / بطاقة' : paymentMethodLabels[o.paymentMethod] ?? o.paymentMethod!),
          row('التسليم', o.deliveryMethod == 'delivery' ? 'توصيل' : 'استلام من المحل'),
          if (o.notes != null) ...[
            dashed,
            Text.rich(TextSpan(children: [
              const TextSpan(text: 'ملاحظات: ', style: TextStyle(fontWeight: FontWeight.w700)),
              TextSpan(text: o.notes),
            ]), style: const TextStyle(fontSize: 9)),
          ],
          dashed,
          const Center(child: Text('باركود الطلب', style: TextStyle(fontSize: 10))),
          const SizedBox(height: 4),
          Center(
            child: BarcodeWidget(barcode: Barcode.code128(), data: o.number, width: 200, height: 45, drawText: false),
          ),
          const SizedBox(height: 2),
          Center(child: Text(o.number, style: const TextStyle(fontSize: 9, fontWeight: FontWeight.w700, letterSpacing: 1))),
          const SizedBox(height: 8),
          const Center(child: Text('رمز QR — التحقق من الفاتورة (ZATCA)', style: TextStyle(fontSize: 10))),
          const SizedBox(height: 4),
          Center(child: QrImageView(data: qr, size: 96, padding: EdgeInsets.zero, errorCorrectionLevel: QrErrorCorrectLevel.M, backgroundColor: Colors.white)),
          if (z != null && z.isNotEmpty)
            Center(
              child: Container(
                margin: const EdgeInsets.only(top: 4),
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(99),
                  color: z == 'REPORTED' || z == 'CLEARED' ? const Color(0xFFDCFCE7) : z == 'REJECTED' ? const Color(0xFFFEE2E2) : const Color(0xFFFEF9C3),
                ),
                child: Text(
                  z == 'REPORTED' || z == 'CLEARED' ? 'معتمدة من زاتكا' : z == 'REJECTED' ? 'مرفوضة من زاتكا' : 'بانتظار الإرسال',
                  style: TextStyle(
                      fontSize: 9,
                      color: z == 'REPORTED' || z == 'CLEARED' ? const Color(0xFF15803D) : z == 'REJECTED' ? const Color(0xFFB91C1C) : const Color(0xFF92400E)),
                ),
              ),
            ),
          const SizedBox(height: 3),
          const Center(
            child: SizedBox(
              width: 200,
              child: Text('امسح الرمز للتحقق من صحة الفاتورة الضريبية وفق متطلبات هيئة الزكاة والضريبة والجمارك',
                  textAlign: TextAlign.center, style: TextStyle(fontSize: 9, height: 1.4)),
            ),
          ),
          dashed,
          const Center(child: Text('شكراً لثقتكم بنا — نسعد بخدمتكم دائماً', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700))),
        ]),
      ),
    );
  }
}

class _Dashed extends StatelessWidget {
  const _Dashed();

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 10),
      child: LayoutBuilder(builder: (context, c) {
        final n = (c.maxWidth / 6).floor();
        return Row(children: [for (var i = 0; i < n; i++) Expanded(child: Container(height: 1, margin: const EdgeInsets.symmetric(horizontal: 1.5), color: const Color(0xFF4B5563)))]);
      }),
    );
  }
}

/// معاينة الفاتورة + طباعة (أي طابعة متصلة بالجهاز: حرارية، AirPrint، شبكة) + مشاركة.
class ReceiptPanel extends StatefulWidget {
  const ReceiptPanel({super.key, required this.order, this.autoPrint = false});
  final Order order;
  final bool autoPrint;

  @override
  State<ReceiptPanel> createState() => _ReceiptPanelState();
}

class _ReceiptPanelState extends State<ReceiptPanel> {
  final _key = GlobalKey();
  ShopInfo? _shop;
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    ShopInfo.load(context.read<Rest>()).then((s) {
      if (!mounted) return;
      setState(() => _shop = s);
      if (widget.autoPrint) WidgetsBinding.instance.addPostFrameCallback((_) => Future.delayed(const Duration(milliseconds: 600), _print));
    });
  }

  Future<Uint8List?> _png() async {
    final boundary = _key.currentContext?.findRenderObject() as RenderRepaintBoundary?;
    if (boundary == null) return null;
    final img = await boundary.toImage(pixelRatio: 3);
    final data = await img.toByteData(format: ui.ImageByteFormat.png);
    return data?.buffer.asUint8List();
  }

  Future<Uint8List> _pdf(Uint8List png) async {
    final doc = pw.Document();
    final image = pw.MemoryImage(png);
    const w = 72 * PdfPageFormat.mm;
    final ratio = (image.height ?? 1) / (image.width ?? 1);
    doc.addPage(pw.Page(
      pageFormat: PdfPageFormat(w, w * ratio, marginAll: 0),
      build: (_) => pw.Image(image, width: w),
    ));
    return doc.save();
  }

  Future<void> _print() async {
    if (_busy) return;
    setState(() => _busy = true);
    try {
      final png = await _png();
      if (png == null) return;
      final pdf = await _pdf(png);
      await Printing.layoutPdf(name: 'فاتورة-${widget.order.number}', onLayout: (_) async => pdf);
    } catch (e) {
      if (mounted) toast(context, 'تعذّرت الطباعة: $e', error: true);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _share() async {
    final png = await _png();
    if (png == null) return;
    await Printing.sharePdf(bytes: await _pdf(png), filename: 'فاتورة-${widget.order.number}.pdf');
  }

  @override
  Widget build(BuildContext context) {
    final shop = _shop;
    return Column(children: [
      if (shop == null)
        const Padding(padding: EdgeInsets.all(40), child: CircularProgressIndicator())
      else
        DecoratedBox(
          decoration: BoxDecoration(boxShadow: Pos.shadow, border: Border.all(color: const Color(0xFFE5E7EB)), borderRadius: BorderRadius.circular(12)),
          child: ClipRRect(
            borderRadius: BorderRadius.circular(12),
            child: RepaintBoundary(key: _key, child: Receipt(order: widget.order, shop: shop)),
          ),
        ),
      const SizedBox(height: 14),
      Wrap(spacing: 10, runSpacing: 10, alignment: WrapAlignment.center, children: [
        PrimaryButton(label: widget.autoPrint ? 'اطبع الفاتورة الآن' : 'طباعة', icon: Icons.print_rounded, busy: _busy, onPressed: shop == null ? null : _print),
        OutlineSmall(label: 'مشاركة PDF', icon: Icons.ios_share_rounded, onPressed: shop == null ? null : _share),
      ]),
    ]);
  }
}
