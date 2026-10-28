import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';

import '../pos/pos_ui.dart';
import '../state/auth_controller.dart';

/// دخول بالرمز السري — نسخة مطابقة لصفحة /login في الموقع (PinPad.jsx):
/// 4 خانات، يدخل تلقائياً عند اكتمال الرقم، ونفس التحقق على الخادم.
class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  static const _len = 4;
  String _pin = '';
  final _focus = FocusNode();

  @override
  void dispose() {
    _focus.dispose();
    super.dispose();
  }

  bool get _busy => context.read<AuthController>().status == AuthStatus.authenticating;

  void _press(String d) {
    if (_busy || _pin.length >= _len) return;
    HapticFeedback.selectionClick();
    setState(() => _pin += d);
    if (_pin.length == _len) _submit();
  }

  void _back() {
    if (_busy || _pin.isEmpty) return;
    setState(() => _pin = _pin.substring(0, _pin.length - 1));
  }

  Future<void> _submit() async {
    final ok = await context.read<AuthController>().login(_pin);
    if (!mounted) return;
    if (!ok) {
      HapticFeedback.heavyImpact();
      setState(() => _pin = '');
    }
  }

  KeyEventResult _onKey(FocusNode _, KeyEvent e) {
    if (e is! KeyDownEvent) return KeyEventResult.ignored;
    final ch = e.character;
    if (ch != null && RegExp(r'^[0-9٠-٩]$').hasMatch(ch)) {
      _press('٠١٢٣٤٥٦٧٨٩'.contains(ch) ? '٠١٢٣٤٥٦٧٨٩'.indexOf(ch).toString() : ch);
      return KeyEventResult.handled;
    }
    if (e.logicalKey == LogicalKeyboardKey.backspace) {
      _back();
      return KeyEventResult.handled;
    }
    return KeyEventResult.ignored;
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthController>();
    final busy = auth.status == AuthStatus.authenticating;

    return Scaffold(
      backgroundColor: const Color(0xFFF2F3F5),
      body: Focus(
        focusNode: _focus,
        autofocus: true,
        onKeyEvent: _onKey,
        child: SafeArea(
          child: Center(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(24),
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 300),
                child: Column(children: [
                  const Text('إبرة وخيط الإسكافي', style: TextStyle(fontSize: 24, fontWeight: FontWeight.w800, color: Pos.fg)),
                  const SizedBox(height: 4),
                  const Text('أدخل رقم PIN للدخول', style: TextStyle(fontSize: 13.5, color: Pos.muted)),
                  const SizedBox(height: 24),
                  Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                    for (var i = 0; i < _len; i++)
                      AnimatedScale(
                        duration: const Duration(milliseconds: 120),
                        scale: _pin.length > i ? 1.08 : 1,
                        child: Container(
                          width: 54,
                          height: 54,
                          margin: const EdgeInsets.symmetric(horizontal: 6),
                          alignment: Alignment.center,
                          decoration: BoxDecoration(
                            color: Colors.white,
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(color: _pin.length > i ? Pos.primary : const Color(0xFFE2E5EA), width: 2),
                          ),
                          child: Text(_pin.length > i ? '●' : '', style: const TextStyle(fontSize: 22, color: Pos.fg)),
                        ),
                      ),
                  ]),
                  SizedBox(
                    height: 46,
                    child: Center(
                      child: busy
                          ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2))
                          : auth.message == null
                              ? null
                              : Text(auth.message!, textAlign: TextAlign.center, style: const TextStyle(color: Pos.red, fontSize: 13)),
                    ),
                  ),
                  GridView.count(
                    crossAxisCount: 3,
                    shrinkWrap: true,
                    physics: const NeverScrollableScrollPhysics(),
                    mainAxisSpacing: 12,
                    crossAxisSpacing: 12,
                    childAspectRatio: 1.32,
                    children: [
                      for (final d in ['1', '2', '3', '4', '5', '6', '7', '8', '9']) _key(Text(d, style: _digit), () => _press(d), label: d),
                      const SizedBox.shrink(),
                      _key(const Text('0', style: _digit), () => _press('0'), label: '0'),
                      _key(const Icon(Icons.backspace_outlined, size: 20, color: Pos.muted), _pin.isEmpty ? null : _back, label: 'حذف'),
                    ],
                  ),
                ]),
              ),
            ),
          ),
        ),
      ),
    );
  }

  static const _digit = TextStyle(fontSize: 20, fontWeight: FontWeight.w600, color: Pos.fg);

  Widget _key(Widget child, VoidCallback? onTap, {required String label}) => Semantics(
        button: true,
        label: label,
        child: Opacity(
          opacity: onTap == null ? .45 : 1,
          child: Material(
            color: const Color(0xFFF4F5F7),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12), side: const BorderSide(color: Color(0xFFDDE0E5))),
            child: InkWell(borderRadius: BorderRadius.circular(12), onTap: onTap, child: Center(child: child)),
          ),
        ),
      );
}
