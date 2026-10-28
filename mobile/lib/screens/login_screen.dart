import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';

import '../state/auth_controller.dart';
import '../theme.dart';

/// دخول بالرمز السري (PIN) — نفس حساب الموظف في الموقع، ونفس التحقق على الخادم.
class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  static const _maxLen = 8;
  static const _minLen = 4;
  String _pin = '';
  final _focus = FocusNode();

  @override
  void dispose() {
    _focus.dispose();
    super.dispose();
  }

  void _press(String d) {
    final busy = context.read<AuthController>().status == AuthStatus.authenticating;
    if (busy || _pin.length >= _maxLen) return;
    HapticFeedback.selectionClick();
    setState(() => _pin += d);
  }

  void _back() {
    if (_pin.isEmpty) return;
    HapticFeedback.selectionClick();
    setState(() => _pin = _pin.substring(0, _pin.length - 1));
  }

  Future<void> _submit() async {
    if (_pin.length < _minLen) return;
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
      final latin = '٠١٢٣٤٥٦٧٨٩'.contains(ch) ? '٠١٢٣٤٥٦٧٨٩'.indexOf(ch).toString() : ch;
      _press(latin);
      return KeyEventResult.handled;
    }
    if (e.logicalKey == LogicalKeyboardKey.backspace) {
      _back();
      return KeyEventResult.handled;
    }
    if (e.logicalKey == LogicalKeyboardKey.enter || e.logicalKey == LogicalKeyboardKey.numpadEnter) {
      _submit();
      return KeyEventResult.handled;
    }
    return KeyEventResult.ignored;
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthController>();
    final busy = auth.status == AuthStatus.authenticating;

    return Scaffold(
      body: Focus(
        focusNode: _focus,
        autofocus: true,
        onKeyEvent: _onKey,
        child: SafeArea(
          child: Center(
            child: SingleChildScrollView(
              padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 28),
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 360),
                child: Column(
                  children: [
                    Image.asset('assets/images/cobblers-official-mark-white.png', height: 78, semanticLabel: 'إبرة وخيط الإسكافي'),
                    const SizedBox(height: 22),
                    const Text('ACCOUNTING CENTRE',
                        style: TextStyle(fontSize: 11, letterSpacing: 2.6, color: AC.gold, fontWeight: FontWeight.w600)),
                    const SizedBox(height: 6),
                    const Text('المركز المحاسبي', style: TextStyle(fontSize: 26, fontWeight: FontWeight.w700)),
                    const SizedBox(height: 6),
                    Text('أدخل رمزك السري — نفس رمز نظام الورشة', style: TextStyle(fontSize: 13, color: AC.mu)),
                    const SizedBox(height: 28),
                    _Dots(length: _pin.length, busy: busy),
                    const SizedBox(height: 18),
                    AnimatedSwitcher(
                      duration: const Duration(milliseconds: 200),
                      child: auth.message == null
                          ? const SizedBox(height: 20)
                          : Text(auth.message!,
                              key: ValueKey(auth.message),
                              textAlign: TextAlign.center,
                              style: const TextStyle(color: AC.neg, fontSize: 13)),
                    ),
                    const SizedBox(height: 18),
                    _Pad(onDigit: _press, onBack: _back, onSubmit: _submit, canSubmit: _pin.length >= _minLen && !busy),
                    const SizedBox(height: 22),
                    Text('للإدارة والمحاسب فقط · الجلسة تنتهي بعد 12 ساعة',
                        style: TextStyle(fontSize: 11.5, color: AC.fa)),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _Dots extends StatelessWidget {
  const _Dots({required this.length, required this.busy});
  final int length;
  final bool busy;

  @override
  Widget build(BuildContext context) {
    if (busy) {
      return const SizedBox(height: 14, width: 14, child: CircularProgressIndicator(strokeWidth: 2));
    }
    final n = length < 4 ? 4 : length;
    return Semantics(
      label: 'تم إدخال $length أرقام',
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          for (var i = 0; i < n; i++)
            AnimatedContainer(
              duration: const Duration(milliseconds: 150),
              margin: const EdgeInsets.symmetric(horizontal: 7),
              width: 12,
              height: 12,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: i < length ? AC.gold : Colors.transparent,
                border: Border.all(color: i < length ? AC.gold : AC.line2, width: 1.4),
              ),
            ),
        ],
      ),
    );
  }
}

class _Pad extends StatelessWidget {
  const _Pad({required this.onDigit, required this.onBack, required this.onSubmit, required this.canSubmit});
  final void Function(String) onDigit;
  final VoidCallback onBack;
  final VoidCallback onSubmit;
  final bool canSubmit;

  @override
  Widget build(BuildContext context) {
    Widget key(Widget child, VoidCallback? onTap, {String? label, bool primary = false}) => Padding(
          padding: const EdgeInsets.all(7),
          child: Semantics(
            button: true,
            label: label,
            child: Material(
              color: primary ? (onTap == null ? AC.s2 : AC.gold) : AC.s1,
              shape: CircleBorder(side: BorderSide(color: primary ? Colors.transparent : AC.line2)),
              child: InkWell(
                customBorder: const CircleBorder(),
                onTap: onTap,
                child: SizedBox(width: 74, height: 74, child: Center(child: child)),
              ),
            ),
          ),
        );

    Text digit(String d) => Text(d, style: const TextStyle(fontSize: 26, fontWeight: FontWeight.w600, fontFeatures: AC.tabular));

    // الأرقام بترتيب لوحة الهاتف (من اليسار لليمين) حتى في واجهة عربية
    return Directionality(
      textDirection: TextDirection.ltr,
      child: Column(children: [
        for (final row in const [
          ['1', '2', '3'],
          ['4', '5', '6'],
          ['7', '8', '9'],
        ])
          Row(mainAxisAlignment: MainAxisAlignment.center, children: [for (final d in row) key(digit(d), () => onDigit(d), label: d)]),
        Row(mainAxisAlignment: MainAxisAlignment.center, children: [
          key(Icon(Icons.backspace_outlined, color: AC.mu, size: 22), onBack, label: 'حذف'),
          key(digit('0'), () => onDigit('0'), label: '0'),
          key(Icon(Icons.arrow_forward_rounded, color: canSubmit ? AC.bg : AC.fa, size: 26), canSubmit ? onSubmit : null,
              label: 'دخول', primary: true),
        ]),
      ]),
    );
  }
}
