import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

/// هوية المركز المحاسبي — نفس قيم CSS في src/pages/AccountingCenter.jsx حرفياً
/// (--ac-bg, --ac-s1, --ac-gold ...) حتى يتطابق الموقع والتطبيق.
class AC {
  AC._();

  static const bg = Color(0xFF0B0B0C);
  static const s1 = Color(0xFF121213);
  static const s2 = Color(0xFF18181A);
  static const tx = Color(0xFFECE8DF);
  static const gold = Color(0xFFC9A84C);
  static const neg = Color(0xFFD98B7A);

  static Color get line => tx.withValues(alpha: .09);
  static Color get line2 => tx.withValues(alpha: .16);
  static Color get mu => tx.withValues(alpha: .58);
  static Color get fa => tx.withValues(alpha: .38);
  static Color get goldSoft => gold.withValues(alpha: .14);

  static const font = 'IBMPlexSansArabic';
  static const riyalFont = 'SaudiRiyal';

  static const radius = 14.0;
  static const pad = 20.0;

  static const tabular = [FontFeature.tabularFigures(), FontFeature.liningFigures()];

  static ThemeData theme() {
    final base = ThemeData(
      useMaterial3: true,
      brightness: Brightness.dark,
      fontFamily: font,
      scaffoldBackgroundColor: bg,
      colorScheme: ColorScheme.fromSeed(
        seedColor: gold,
        brightness: Brightness.dark,
        surface: bg,
        primary: gold,
        onPrimary: bg,
        error: neg,
      ),
    );
    return base.copyWith(
      textTheme: base.textTheme.apply(bodyColor: tx, displayColor: tx, fontFamily: font),
      dividerColor: line,
      splashFactory: InkSparkle.splashFactory,
      appBarTheme: const AppBarTheme(backgroundColor: bg, foregroundColor: tx, elevation: 0, scrolledUnderElevation: 0),
      navigationBarTheme: NavigationBarThemeData(
        backgroundColor: s1,
        indicatorColor: goldSoft,
        surfaceTintColor: Colors.transparent,
        height: 66,
        labelTextStyle: WidgetStateProperty.resolveWith((s) => TextStyle(
              fontFamily: font,
              fontSize: 11.5,
              fontWeight: s.contains(WidgetState.selected) ? FontWeight.w700 : FontWeight.w400,
              color: s.contains(WidgetState.selected) ? gold : mu,
            )),
        iconTheme: WidgetStateProperty.resolveWith(
            (s) => IconThemeData(color: s.contains(WidgetState.selected) ? gold : mu, size: 22)),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: s2,
        labelStyle: TextStyle(color: mu),
        hintStyle: TextStyle(color: fa),
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide(color: line2)),
        enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide(color: line2)),
        focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: gold)),
      ),
      snackBarTheme: SnackBarThemeData(
        backgroundColor: s2,
        contentTextStyle: const TextStyle(fontFamily: font, color: tx),
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12), side: BorderSide(color: line2)),
      ),
      datePickerTheme: const DatePickerThemeData(backgroundColor: s1, headerBackgroundColor: s2),
      bottomSheetTheme: const BottomSheetThemeData(backgroundColor: s1, surfaceTintColor: Colors.transparent),
      progressIndicatorTheme: const ProgressIndicatorThemeData(color: gold),
    );
  }
}

/// تنسيق الأرقام — مطابق لـ money() في src/lib/accounting.js (أرقام لاتينية، منزلتان).
final _money = NumberFormat('#,##0.00', 'en_US');
String money(num v) => _money.format(v);

String moneyShort(num v) {
  final a = v.abs();
  if (a >= 1e6) return '${(v / 1e6).toStringAsFixed(2)}M';
  if (a >= 1e4) return '${(v / 1e3).toStringAsFixed(1)}K';
  return money(v);
}

const monthsAr = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];

String monthLabel(String ym) {
  final m = int.tryParse(ym.split('-').last) ?? 1;
  return monthsAr[(m - 1).clamp(0, 11)];
}

String ymd(DateTime d) => DateFormat('yyyy-MM-dd', 'en_US').format(d);

/// نفس LEDGER_KINDS في الموقع.
const ledgerKinds = <String, String>{
  'repair': 'إيراد إصلاح',
  'product': 'مبيعات منتجات',
  'partner': 'فاتورة شركة',
  'credit_note': 'إشعار دائن',
  'debit_note': 'إشعار مدين',
  'expense': 'مصروف',
  'purchase': 'مشتريات مخزون',
};

/// نفس قيم expense_category في قاعدة البيانات.
const expenseCategories = <String, String>{
  'rent': 'إيجار',
  'salaries': 'رواتب',
  'electricity': 'كهرباء',
  'water': 'مياه',
  'internet': 'إنترنت واتصالات',
  'supplies': 'مستلزمات',
  'maintenance': 'صيانة',
  'marketing': 'تسويق',
  'transportation': 'نقل ومواصلات',
  'other': 'أخرى',
};
