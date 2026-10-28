import 'package:flutter/material.dart';

import '../theme.dart';

/// هوية نظام الكاشير (Liquid Glass) — منقولة من `html.pos` في src/index.css:
/// خلفية فاتحة بتدرجات ملونة، بطاقات زجاجية بيضاء، أزرار زرقاء iOS،
/// وأيقونات ملونة مثل إعدادات iOS (tone-blue / tone-green ...).
class Pos {
  Pos._();

  static const bg = Color(0xFFE8ECF6);
  static const fg = Color(0xFF151B2C); // 224 32% 12%
  static const muted = Color(0xFF5F6575); // 222 10% 42%
  static const primary = Color(0xFF0A84FF);
  static const primaryTop = Color(0xFF3D9BFF);
  static const border = Color(0x2E7882A0); // rgba(120,130,160,.18)
  static const glass = Color(0x94FFFFFF); // .58
  static const glassSoft = Color(0x57FFFFFF); // .34
  static const glassBorder = Color(0xB3FFFFFF); // .7
  static const destructive = Color(0xFFFF453A);

  static const green = Color(0xFF1F9D45);
  static const red = Color(0xFFE5362B);
  static const amber = Color(0xFFD9820A);
  static const blue = Color(0xFF0A6FE0);

  static const radius = 16.0;

  static List<BoxShadow> get shadow => const [
        BoxShadow(color: Color(0x141F2D5A), blurRadius: 30, offset: Offset(0, 8)),
        BoxShadow(color: Color(0x0F1F2D5A), blurRadius: 3, offset: Offset(0, 1)),
      ];

  static ThemeData theme() {
    final base = ThemeData(
      useMaterial3: true,
      brightness: Brightness.light,
      fontFamily: AC.font,
      scaffoldBackgroundColor: bg,
      colorScheme: ColorScheme.fromSeed(seedColor: primary, primary: primary, surface: Colors.white, error: destructive),
    );
    return base.copyWith(
      textTheme: base.textTheme.apply(bodyColor: fg, displayColor: fg, fontFamily: AC.font),
      appBarTheme: const AppBarTheme(backgroundColor: Colors.transparent, foregroundColor: fg, elevation: 0, scrolledUnderElevation: 0),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: const Color(0x8CFFFFFF),
        isDense: true,
        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        hintStyle: const TextStyle(color: muted, fontSize: 13.5),
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: Color(0x477882A0))),
        enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: Color(0x477882A0))),
        focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: primary, width: 1.5)),
      ),
      snackBarTheme: SnackBarThemeData(
        behavior: SnackBarBehavior.floating,
        backgroundColor: fg,
        contentTextStyle: const TextStyle(fontFamily: AC.font, color: Colors.white),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
      ),
      dialogTheme: DialogThemeData(
        backgroundColor: const Color(0xF2FFFFFF),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(22)),
      ),
      bottomSheetTheme: const BottomSheetThemeData(backgroundColor: Color(0xFAFFFFFF), surfaceTintColor: Colors.transparent),
      dividerColor: border,
    );
  }
}

/// ألوان الأيقونات (tone-*) — نفس التدرجات في الموقع.
enum Tone {
  blue(Color(0xFF5AB0FF), Color(0xFF0A84FF)),
  green(Color(0xFF5FE283), Color(0xFF28C04C)),
  orange(Color(0xFFFFBD4A), Color(0xFFFF9500)),
  red(Color(0xFFFF7A70), Color(0xFFFF3B30)),
  purple(Color(0xFFD08CF7), Color(0xFFAF52DE)),
  teal(Color(0xFF5FD8D0), Color(0xFF1FB5AD)),
  pink(Color(0xFFFF7AA5), Color(0xFFFF2D6F)),
  indigo(Color(0xFF8A8CF5), Color(0xFF5856D6)),
  gray(Color(0xFFA2A7B5), Color(0xFF6B7080));

  const Tone(this.light, this.dark);
  final Color light;
  final Color dark;
}

/// أيقونة ملونة بنمط iOS (.ios-tile).
class IosTile extends StatelessWidget {
  const IosTile(this.icon, this.tone, {super.key, this.size = 30});
  final IconData icon;
  final Tone tone;
  final double size;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(size * .3),
        gradient: LinearGradient(begin: Alignment.topRight, end: Alignment.bottomLeft, colors: [tone.light, tone.dark]),
        boxShadow: const [BoxShadow(color: Color(0x24000000), blurRadius: 6, offset: Offset(0, 2))],
      ),
      child: Icon(icon, color: Colors.white, size: size * .55),
    );
  }
}

/// الخلفية بتدرجات الألوان (--pos-bg).
class PosBackground extends StatelessWidget {
  const PosBackground({super.key, required this.child});
  final Widget child;

  @override
  Widget build(BuildContext context) {
    Widget blob(Alignment a, Color c, double r) => Positioned.fill(
          child: DecoratedBox(
            decoration: BoxDecoration(gradient: RadialGradient(center: a, radius: r, colors: [c, c.withValues(alpha: 0)])),
          ),
        );
    return Stack(children: [
      const Positioned.fill(child: ColoredBox(color: Pos.bg)),
      blob(const Alignment(.64, -.84), const Color(0x8C0A84FF), .75),
      blob(const Alignment(-.84, -.64), const Color(0x73BF5AF2), .7),
      blob(const Alignment(.4, .84), const Color(0x6630D158), .75),
      blob(const Alignment(-.9, .76), const Color(0x6BFF9F0A), .65),
      blob(const Alignment(-.1, 0), const Color(0x38FF2D6F), .55),
      Positioned.fill(child: child),
    ]);
  }
}

/// بطاقة زجاجية (.bg-card).
class GlassCard extends StatelessWidget {
  const GlassCard({super.key, required this.child, this.padding = const EdgeInsets.all(16), this.onTap, this.margin, this.color});
  final Widget child;
  final EdgeInsetsGeometry padding;
  final EdgeInsetsGeometry? margin;
  final VoidCallback? onTap;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    final content = Padding(padding: padding, child: child);
    return Container(
      margin: margin,
      decoration: BoxDecoration(
        color: color ?? Pos.glass,
        borderRadius: BorderRadius.circular(Pos.radius),
        border: Border.all(color: Pos.glassBorder),
        boxShadow: Pos.shadow,
      ),
      // Material شفاف حتى تظهر خلفيات ListTile وتأثير اللمس داخل البطاقة
      child: Material(
        type: MaterialType.transparency,
        child: onTap == null ? content : InkWell(borderRadius: BorderRadius.circular(Pos.radius), onTap: onTap, child: content),
      ),
    );
  }
}

/// عنوان الصفحة (أيقونة + عنوان + وصف) — مثل رأس صفحات الموقع.
class PageHeader extends StatelessWidget {
  const PageHeader({super.key, required this.title, this.subtitle, this.icon, this.tone = Tone.blue, this.trailing});
  final String title;
  final String? subtitle;
  final IconData? icon;
  final Tone tone;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 18),
      child: Row(children: [
        if (icon != null) ...[IosTile(icon!, tone, size: 40), const SizedBox(width: 12)],
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(title, style: const TextStyle(fontSize: 23, fontWeight: FontWeight.w700)),
            if (subtitle != null) Text(subtitle!, style: const TextStyle(fontSize: 13, color: Pos.muted)),
          ]),
        ),
        if (trailing != null) trailing!,
      ]),
    );
  }
}

/// شريحة اختيار بيضاوية (أزرار الفترات في لوحة التحكم).
class PillChip extends StatelessWidget {
  const PillChip({super.key, required this.label, required this.selected, required this.onTap});
  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        borderRadius: BorderRadius.circular(999),
        onTap: onTap,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 160),
          padding: const EdgeInsets.symmetric(horizontal: 15, vertical: 7),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(999),
            gradient: selected ? const LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter, colors: [Pos.primaryTop, Pos.primary]) : null,
            color: selected ? null : Pos.glass,
            border: Border.all(color: selected ? Colors.transparent : Pos.glassBorder),
            boxShadow: selected ? const [BoxShadow(color: Color(0x520A84FF), blurRadius: 14, offset: Offset(0, 4))] : null,
          ),
          child: Text(label,
              style: TextStyle(fontSize: 13, fontWeight: selected ? FontWeight.w700 : FontWeight.w500, color: selected ? Colors.white : Pos.fg)),
        ),
      ),
    );
  }
}

/// زر أساسي أزرق متدرج (.bg-primary).
class PrimaryButton extends StatelessWidget {
  const PrimaryButton({super.key, required this.label, required this.onPressed, this.icon, this.color, this.busy = false, this.expand = false});
  final String label;
  final VoidCallback? onPressed;
  final IconData? icon;
  final Color? color;
  final bool busy;
  final bool expand;

  @override
  Widget build(BuildContext context) {
    final c = color ?? Pos.primary;
    final enabled = onPressed != null && !busy;
    final child = Row(mainAxisSize: expand ? MainAxisSize.max : MainAxisSize.min, mainAxisAlignment: MainAxisAlignment.center, children: [
      if (busy)
        const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
      else if (icon != null)
        Icon(icon, size: 17, color: Colors.white),
      if (busy || icon != null) const SizedBox(width: 7),
      Flexible(child: Text(label, overflow: TextOverflow.ellipsis, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 13.5))),
    ]);
    return Opacity(
      opacity: enabled ? 1 : .55,
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(12),
          onTap: enabled ? onPressed : null,
          child: Ink(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 11),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(12),
              gradient: LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter, colors: [Color.lerp(c, Colors.white, .18)!, c]),
              boxShadow: [BoxShadow(color: c.withValues(alpha: .32), blurRadius: 14, offset: const Offset(0, 4))],
            ),
            child: child,
          ),
        ),
      ),
    );
  }
}

/// زر حدودي صغير (variant="outline").
class OutlineSmall extends StatelessWidget {
  const OutlineSmall({super.key, required this.label, required this.onPressed, this.icon, this.color = Pos.fg});
  final String label;
  final VoidCallback? onPressed;
  final IconData? icon;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return OutlinedButton.icon(
      onPressed: onPressed,
      icon: icon == null ? const SizedBox.shrink() : Icon(icon, size: 15, color: color),
      label: Text(label, style: TextStyle(fontSize: 12.5, color: color, fontWeight: FontWeight.w600)),
      style: OutlinedButton.styleFrom(
        visualDensity: VisualDensity.compact,
        backgroundColor: Pos.glass,
        side: BorderSide(color: color == Pos.fg ? const Color(0x477882A0) : color.withValues(alpha: .35)),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        padding: const EdgeInsets.symmetric(horizontal: 12),
      ),
    );
  }
}

/// شارة ملونة (Badge variant="outline" بألوان الحالة).
class SoftBadge extends StatelessWidget {
  const SoftBadge(this.text, this.color, {super.key, this.icon});
  final String text;
  final Color color;
  final IconData? icon;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2.5),
      decoration: BoxDecoration(
        color: color.withValues(alpha: .12),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: color.withValues(alpha: .3)),
      ),
      child: Row(mainAxisSize: MainAxisSize.min, children: [
        if (icon != null) ...[Icon(icon, size: 12, color: color), const SizedBox(width: 3)],
        Text(text, style: TextStyle(fontSize: 11, color: color, fontWeight: FontWeight.w600)),
      ]),
    );
  }
}

/// مبلغ بالريال بألوان النظام الفاتح.
class PosMoney extends StatelessWidget {
  const PosMoney(this.value, {super.key, this.size = 14, this.weight = FontWeight.w600, this.color = Pos.fg, this.decimals = 2});
  final num value;
  final double size;
  final FontWeight weight;
  final Color color;
  final int decimals;

  @override
  Widget build(BuildContext context) {
    final v = decimals == 0 ? value.roundToDouble() : value.toDouble();
    return Directionality(
      textDirection: TextDirection.ltr,
      child: Text.rich(
        TextSpan(children: [
          TextSpan(text: '#', style: TextStyle(fontFamily: AC.riyalFont, fontSize: size * .92)),
          const TextSpan(text: ' '),
          TextSpan(text: decimals == 0 ? v.toStringAsFixed(0) : money(v)),
        ]),
        maxLines: 1,
        style: TextStyle(fontSize: size, fontWeight: weight, color: color, fontFeatures: AC.tabular),
      ),
    );
  }
}

/// حالة فارغة.
class EmptyState extends StatelessWidget {
  const EmptyState({super.key, required this.icon, required this.text, this.sub});
  final IconData icon;
  final String text;
  final String? sub;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 56),
      child: Column(children: [
        Icon(icon, size: 46, color: Pos.muted.withValues(alpha: .35)),
        const SizedBox(height: 10),
        Text(text, style: const TextStyle(color: Pos.muted, fontWeight: FontWeight.w600)),
        if (sub != null) ...[const SizedBox(height: 4), Text(sub!, style: const TextStyle(color: Pos.muted, fontSize: 12.5))],
      ]),
    );
  }
}

/// خطأ تحميل مع إعادة المحاولة.
class LoadError extends StatelessWidget {
  const LoadError({super.key, required this.message, required this.onRetry});
  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return GlassCard(
      margin: const EdgeInsets.only(bottom: 14),
      color: const Color(0xFFFFF1F0),
      child: Row(children: [
        const Icon(Icons.error_outline_rounded, color: Pos.red),
        const SizedBox(width: 10),
        Expanded(child: Text(message, style: const TextStyle(fontSize: 13.5))),
        TextButton(onPressed: onRetry, child: const Text('إعادة المحاولة')),
      ]),
    );
  }
}

void toast(BuildContext context, String msg, {bool error = false}) {
  ScaffoldMessenger.of(context)
    ..hideCurrentSnackBar()
    ..showSnackBar(SnackBar(
      content: Text(msg),
      backgroundColor: error ? Pos.red : Pos.fg,
    ));
}
