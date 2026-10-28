import 'package:flutter/material.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import 'package:provider/provider.dart';

import '../../core/api_client.dart';
import '../../core/rest.dart';
import '../../state/auth_controller.dart';
import '../pos_ui.dart';
import 'order_details_screen.dart';
import 'staff_screens.dart';

/// مسح الباركود — نفس /scan: قارئ الباركود (لوحة مفاتيح) أو الكتابة يدوياً،
/// وفي الجوال/التابلت أيضاً بالكاميرا.
class ScanScreen extends StatefulWidget {
  const ScanScreen({super.key});

  @override
  State<ScanScreen> createState() => _ScanScreenState();
}

class _ScanScreenState extends State<ScanScreen> {
  final _code = TextEditingController();
  bool _loading = false;

  @override
  void dispose() {
    _code.dispose();
    super.dispose();
  }

  Future<void> _find([String? raw]) async {
    // يشيل رقم القطعة الفرعي إن وجد (NT123-2 → NT123)
    final code = (raw ?? _code.text).trim().replaceAll(RegExp(r'-\d+$'), '');
    if (code.isEmpty || _loading) return;
    final rest = context.read<Rest>();
    final isStaff = context.read<AuthController>().employee?.role == 'staff';
    setState(() => _loading = true);
    try {
      final rows = await rest.select('orders', select: 'id', filters: {'order_number': 'eq.$code'}, order: 'created_at.desc', limit: 1);
      if (!mounted) return;
      if (rows.isEmpty) {
        toast(context, 'لم يتم العثور على طلب بهذا الباركود', error: true);
      } else {
        final id = '${rows.first['id']}';
        _code.clear();
        await Navigator.of(context).push(MaterialPageRoute(
            builder: (_) => isStaff ? StaffOrderDetailScreen(orderId: id) : OrderDetailsScreen(orderId: id)));
      }
    } on ApiException {
      if (mounted) toast(context, 'تعذّر البحث، تحقق من الاتصال', error: true);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _camera() async {
    final code = await Navigator.of(context).push<String>(MaterialPageRoute(builder: (_) => const _CameraScanner()));
    if (code != null && mounted) {
      _code.text = code;
      _find(code);
    }
  }

  @override
  Widget build(BuildContext context) {
    final canCamera = Theme.of(context).platform == TargetPlatform.android || Theme.of(context).platform == TargetPlatform.iOS;
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 60, 16, 40),
      children: [
        Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 480),
            child: Column(children: [
              const IosTile(Icons.qr_code_scanner_rounded, Tone.gray, size: 76),
              const SizedBox(height: 16),
              const Text('مسح الباركود', style: TextStyle(fontSize: 23, fontWeight: FontWeight.w700)),
              const SizedBox(height: 4),
              const Text('امسح أو اكتب رقم باركود الطلب', style: TextStyle(color: Pos.muted)),
              const SizedBox(height: 28),
              GlassCard(
                padding: const EdgeInsets.all(20),
                child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                  TextField(
                    controller: _code,
                    autofocus: true,
                    textDirection: TextDirection.ltr,
                    textInputAction: TextInputAction.search,
                    onSubmitted: _find,
                    onChanged: (_) => setState(() {}),
                    style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w600, letterSpacing: 1),
                    decoration: const InputDecoration(hintText: 'امسح الباركود أو اكتب رقم الطلب...', prefixIcon: Icon(Icons.search_rounded)),
                  ),
                  const SizedBox(height: 14),
                  PrimaryButton(
                    label: _loading ? 'جارٍ البحث...' : 'بحث عن الطلب',
                    expand: true,
                    busy: _loading,
                    onPressed: _code.text.trim().isEmpty ? null : _find,
                  ),
                  if (canCamera) ...[
                    const SizedBox(height: 10),
                    OutlineSmall(label: 'المسح بالكاميرا', icon: Icons.photo_camera_outlined, onPressed: _camera),
                  ],
                  const SizedBox(height: 12),
                  const Text('استخدم ماسح الباركود أو أدخل رقم الطلب يدوياً (مثال: NT2604XXXX)',
                      textAlign: TextAlign.center, style: TextStyle(fontSize: 12, color: Pos.muted)),
                ]),
              ),
            ]),
          ),
        ),
      ],
    );
  }
}

class _CameraScanner extends StatefulWidget {
  const _CameraScanner();

  @override
  State<_CameraScanner> createState() => _CameraScannerState();
}

class _CameraScannerState extends State<_CameraScanner> {
  final _ctl = MobileScannerController(formats: const [BarcodeFormat.code128, BarcodeFormat.qrCode, BarcodeFormat.code39, BarcodeFormat.ean13]);
  bool _done = false;

  @override
  void dispose() {
    _ctl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(backgroundColor: Colors.black, foregroundColor: Colors.white, title: const Text('وجّه الكاميرا للباركود')),
      body: Stack(children: [
        MobileScanner(
          controller: _ctl,
          onDetect: (cap) {
            if (_done) return;
            final v = cap.barcodes.map((b) => b.rawValue).whereType<String>().firstOrNull;
            if (v == null || v.isEmpty) return;
            _done = true;
            Navigator.of(context).pop(v);
          },
        ),
        Center(
          child: Container(
            width: 280,
            height: 160,
            decoration: BoxDecoration(border: Border.all(color: Colors.white, width: 2), borderRadius: BorderRadius.circular(16)),
          ),
        ),
      ]),
    );
  }
}
