/// محرك فهم الأوامر المحلي — نسخة مطابقة لـ src/lib/assistantNlu.js
/// (تطبيع اللهجات، الأرقام المنطوقة، النوايا) بدون أي خدمة خارجية.
library;

String normalizeAr(String t) {
  var s = t
      .replaceAll(RegExp('[ً-ْـ]'), '')
      .replaceAll(RegExp('[أإآ]'), 'ا')
      .replaceAll('ى', 'ي')
      .replaceAll('ة', 'ه')
      .replaceAll('ؤ', 'و')
      .replaceAll('ئ', 'ي');
  s = s.replaceAllMapped(RegExp('[٠-٩]'), (m) => '${m[0]!.codeUnitAt(0) - 0x0660}');
  s = s.replaceAll(RegExp(r'[^\p{L}\p{N}\s-]', unicode: true), ' ');
  return s.replaceAll(RegExp(r'\s+'), ' ').trim().toLowerCase();
}

int _lev(String a, String b) {
  if (a == b) return 0;
  final m = a.length, n = b.length;
  if ((m - n).abs() > 2) return 3;
  var prev = List<int>.generate(n + 1, (j) => j);
  for (var i = 1; i <= m; i++) {
    final cur = List<int>.filled(n + 1, 0)..[0] = i;
    for (var j = 1; j <= n; j++) {
      final c = prev[j - 1] + (a[i - 1] == b[j - 1] ? 0 : 1);
      cur[j] = [prev[j] + 1, cur[j - 1] + 1, c].reduce((x, y) => x < y ? x : y);
    }
    prev = cur;
  }
  return prev[n];
}

String _base(String x) => x.replaceFirst(RegExp(r'^(لل|ال|ل|ب|وال)'), '');

bool _has(String t, List<String> words) {
  final toks = t.split(' ');
  return words.any((w) {
    if (t.contains(w)) return true;
    if (w.contains(' ') || w.length < 4) return false;
    final bw = _base(w);
    if (bw.length < 4) return false;
    final tol = bw.length >= 6 ? 2 : 1;
    return toks.any((k) {
      final bk = _base(k);
      return bk.length >= 3 && _lev(bk, bw) <= tol;
    });
  });
}

const _units = {'صفر': 0, 'زيرو': 0, 'واحد': 1, 'واحده': 1, 'وحده': 1, 'اثنين': 2, 'اثنان': 2, 'اثنتين': 2, 'ثنتين': 2, 'اتنين': 2, 'ثلاثه': 3, 'تلاته': 3, 'ثلاث': 3, 'تلات': 3, 'اربعه': 4, 'اربع': 4, 'اربعا': 4, 'خمسه': 5, 'خمس': 5, 'خمسا': 5, 'سته': 6, 'ست': 6, 'سبعه': 7, 'سبع': 7, 'سبعا': 7, 'ثمانيه': 8, 'تمانيه': 8, 'ثماني': 8, 'ثمان': 8, 'تمان': 8, 'تسعه': 9, 'تسع': 9, 'تسعا': 9};
const _teens = {'حداشر': 11, 'احداشر': 11, 'اتناشر': 12, 'اطناشر': 12, 'تلتاشر': 13, 'تلاتاشر': 13, 'اربعتاشر': 14, 'خمستاشر': 15, 'ستاشر': 16, 'سبعتاشر': 17, 'تمنتاشر': 18, 'تسعتاشر': 19, 'عشره': 10, 'عشر': 10, 'احدعشر': 11, 'اثنعشر': 12, 'اطنعشر': 12, 'ثلاثهعشر': 13, 'اربعهعشر': 14, 'خمسهعشر': 15, 'سبعهعشر': 17, 'تسعهعشر': 19};
const _tens = {'عشرين': 20, 'عشرون': 20, 'ثلاثين': 30, 'تلاتين': 30, 'اربعين': 40, 'خمسين': 50, 'ستين': 60, 'سبعين': 70, 'ثمانين': 80, 'تمانين': 80, 'تسعين': 90};
const _hund = {'تلتميه': 300, 'تلاتميه': 300, 'ربعميه': 400, 'اربعميه': 400, 'خمسميه': 500, 'ستميه': 600, 'سبعميه': 700, 'تمنميه': 800, 'تسعميه': 900, 'مئه': 100, 'ميه': 100, 'مايه': 100, 'مائه': 100, 'مئتين': 200, 'ميتين': 200, 'ثلاثمئه': 300, 'تلتمئه': 300, 'ثلثمئه': 300, 'اربعمئه': 400, 'ربعمئه': 400, 'خمسمئه': 500, 'ستمئه': 600, 'سبعمئه': 700, 'ثمانمئه': 800, 'تسعمئه': 900};
const _thou = {'الف': 1000, 'الفين': 2000, 'الاف': 1000};
final _numw = {..._units.keys, ..._teens.keys, ..._tens.keys, ..._hund.keys, ..._thou.keys};
String _stripAnd(String w) => w.startsWith('و') && w.length > 3 && _numw.contains(w.substring(1)) ? w.substring(1) : w;
int _val(String w) => _units[w] ?? _teens[w] ?? _tens[w] ?? _hund[w] ?? _thou[w] ?? 0;

String numberWordsToDigits(String text) {
  final toks = text.split(' ');
  final out = <String>[];
  var i = 0;
  while (i < toks.length) {
    final w0 = _stripAnd(toks[i]);
    if (!_numw.contains(w0)) {
      out.add(toks[i]);
      i++;
      continue;
    }
    final run = <String>[];
    while (i < toks.length) {
      final w = _stripAnd(toks[i]);
      if (toks[i] == 'و' && i + 1 < toks.length && _numw.contains(_stripAnd(toks[i + 1]))) {
        i++;
        continue;
      }
      if (!_numw.contains(w)) break;
      run.add(w);
      i++;
    }
    if (run.length >= 2 && run.every(_units.containsKey)) {
      out.add(run.map((w) => _units[w]).join());
      continue;
    }
    var total = 0, cur = 0;
    for (final w in run) {
      if (w == 'الفين') {
        total += 2000;
      } else if (_thou.containsKey(w)) {
        total += (cur == 0 ? 1 : cur) * 1000;
        cur = 0;
      } else {
        cur += _val(w);
      }
    }
    out.add('${total + cur}');
  }
  return out.join(' ');
}

/// الصفحات: معرّف القسم في التطبيق + كلمات النداء (نفس PAGES بالموقع).
const assistantPages = [
  ('pos', ['لوحه التحكم', 'الرئيسيه', 'الداشبورد', 'dashboard'], 'لوحة التحكم'),
  ('new-order', ['طلب جديد', 'اضافه طلب', 'سجل طلب', 'اعمل طلب', 'اضيف طلب'], 'طلب جديد'),
  ('orders', ['الطلبات', 'صفحه الطلبات', 'قائمه الطلبات'], 'الطلبات'),
  ('invoices', ['الفواتير', 'فواتير'], 'الفواتير'),
  ('partners', ['الشركات', 'الشركاء', 'حسابات الشركات'], 'الشركات'),
  ('customers', ['العملاء', 'الزبائن', 'الزباين'], 'العملاء'),
  ('calendar', ['الجدوله', 'التقويم', 'جدول التواريخ'], 'الجدولة'),
  ('scan', ['مسح الباركود', 'سكان', 'امسح'], 'مسح الباركود'),
  ('sales', ['المبيعات', 'المخازن', 'المخزون'], 'المبيعات والمخازن'),
  ('returns', ['المرتجعات', 'مرتجع'], 'المرتجعات'),
  ('accounting', ['التقارير الماليه', 'التقارير', 'الاقرار الضريبي', 'الضريبه'], 'التقارير المالية'),
  ('employees', ['الموظفين', 'الموظفون'], 'الموظفون'),
  ('settings', ['الاعدادات', 'الإعدادات', 'اعدادات'], 'الإعدادات'),
];

/// تحويل مسار صفحة بالموقع (من ردود الذكاء) إلى معرّف قسم بالتطبيق.
String? pathToSection(String path) {
  const m = {
    '/pos': 'pos', '/new-order': 'new-order', '/orders': 'orders', '/invoices': 'invoices', '/admin/partners': 'partners',
    '/customers': 'customers', '/calendar': 'calendar', '/scan': 'scan', '/sales': 'sales', '/returns': 'returns',
    '/financial-reports': 'accounting', '/accounting': 'accounting', '/tax-dashboard': 'accounting', '/employees': 'employees',
    '/settings': 'settings', '/staff': 'staff', '/suppliers': 'suppliers', '/purchasing': 'purchasing', '/leaderboard': 'leaderboard',
    '/audit': 'audit', '/admin/bookings': 'bookings', '/loyalty': 'loyalty', '/loyalty-members': 'loyalty-members', '/zatca': 'zatca',
  };
  return m[path.split('?').first];
}

String? extractOrderNumber(String raw) {
  const ordWords = {'اوردر', 'اورد', 'اوردار', 'اودر', 'ordr', 'order'};
  final t = numberWordsToDigits(normalizeAr(raw).split(' ').map((k) => ordWords.contains(k) ? 'ord' : k).join(' '));
  var m = RegExp(r'ord[\s-]?(\d{1,6})').firstMatch(t);
  m ??= RegExp(r'(?:طلب|رقم|الطلب|رقمه)\s*(?:رقم\s*)?(\d{1,6})(?!\d)').firstMatch(t);
  if (m == null) return null;
  return 'ORD-${int.parse(m.group(1)!).toString().padLeft(5, '0')}';
}

/// يرجع خريطة فيها type وبقية الحقول (نفس parseCommand).
Map<String, dynamic> parseCommand(String raw) {
  final t = normalizeAr(raw);
  if (t.isEmpty) return {'type': 'empty'};
  final no = extractOrderNumber(raw);

  if (_has(t, ['مساعده', 'ساعدني', 'وش تقدر', 'ايش تقدر', 'شو بتقدر', 'اوامر', 'help']) && no == null) return {'type': 'help'};
  if (_has(t, ['هلا', 'مرحبا', 'السلام عليكم', 'اهلا', 'صباح الخير', 'مساء الخير', 'ازيك', 'كيفك', 'شلونك']) && t.split(' ').length <= 4) return {'type': 'greet'};

  if (no != null) {
    if (_has(t, ['تم التسليم', 'سلمت', 'سلمته', 'سلمناه', 'اتسلم', 'تسلم', 'استلم العميل', 'استلمه', 'سلم', 'اتسلمت', 'اتسلمه', 'سلمتها', 'العميل خدها', 'العميل خده', 'العميل اخدها', 'العميل اخده', 'شالها العميل', 'استلمها'])) {
      return {'type': 'set_status', 'order_number': no, 'status': 'completed', 'label': 'تم التسليم'};
    }
    if (_has(t, ['جاهز', 'جاهزه', 'خلص', 'خلصت', 'خلصان', 'خالص', 'انتهى', 'انتهي', 'تم الانجاز', 'خلصناه', 'خلصتها', 'خلصته', 'خلصها', 'خلص خلاص', 'جهزتها', 'جهزته', 'جهزت', 'تمت', 'خلاص خلصت', 'قد خلص', 'قد خلصت', 'قد جهز', 'بقت جاهزه', 'بقى جاهز', 'بقي جاهز'])) {
      return {'type': 'set_status', 'order_number': no, 'status': 'ready', 'label': 'جاهز'};
    }
  }

  if (_has(t, ['افتح', 'فتح', 'روح', 'وديني', 'خذني', 'ورني', 'ودني', 'اعرض', 'اذهب', 'open', 'go to', 'افتحلي', 'وريني', 'فتحلي', 'دخلني', 'طلعلي', 'وصلني', 'هات', 'خلني اشوف'])) {
    if (no != null) return {'type': 'find_orders', 'query': no};
    for (final p in assistantPages) {
      if (_has(t, p.$2.map(normalizeAr).toList())) return {'type': 'navigate', 'section': p.$1, 'label': p.$3};
    }
  }
  if (_has(t, ['طلب جديد', 'اضافه طلب']) && _has(t, ['ابي', 'ابغى', 'ابغي', 'عايز', 'عاوز', 'اريد', 'بدي', 'اعمل', 'سجل', 'اضيف', 'اضافه'])) {
    return {'type': 'navigate', 'section': 'new-order', 'label': 'طلب جديد'};
  }

  if (_has(t, ['مستحق', 'مديونيه', 'عليها فلوس', 'عليهم فلوس', 'غير مسدد', 'غير المسدد', 'حسابات الشركات', 'الشركات']) && _has(t, ['شركه', 'شركات', 'شركاء', 'ريان', 'مستحق', 'مديونيه'])) {
    return {'type': 'tool', 'tool': 'partners_due', 'input': <String, dynamic>{}};
  }
  if (_has(t, ['ايراد', 'دخل', 'مبيعات', 'كسبنا', 'ربحنا', 'ايش دخل', 'كم دخل', 'الدخل', 'كم بعنا', 'المبلغ اللي', 'كسبنا كام', 'دخلنا كام', 'بعنا بكام', 'الايراد كام', 'كام الايراد', 'كام دخل', 'ايش الدخل', 'كم الدخل'])) {
    return {
      'type': 'tool',
      'tool': 'revenue',
      'input': {'period': _has(t, ['شهر', 'الشهر']) ? 'month' : _has(t, ['اسبوع', 'الاسبوع']) ? 'week' : 'today'},
    };
  }
  if (_has(t, ['تسليم', 'تسليمات', 'متاخر', 'متاخره', 'موعد', 'مواعيد', 'تتاخر', 'يتسلم', 'لازم يتسلم', 'اللي عليها', 'اتاخر', 'اتاخرت', 'لسه ما اتسلم', 'لسه متسلمش', 'النهارده يتسلم', 'اللي ورانا', 'مواعيد النهارده', 'ايش المتاخر', 'ايش اللي تاخر'])) {
    return {'type': 'tool', 'tool': 'deliveries', 'input': <String, dynamic>{}};
  }
  if (_has(t, ['كم طلب', 'عدد الطلبات', 'كم عندنا', 'كم عدد', 'كام طلب', 'قد ايش', 'كم جاهز', 'كام', 'كام اوردر', 'كام طلب النهارده', 'ايش عدد', 'كم عدد الطلبات'])) {
    return {'type': 'tool', 'tool': 'counts_today', 'input': <String, dynamic>{}};
  }
  if (no != null) return {'type': 'find_orders', 'query': no};
  if (_has(t, ['دور', 'ابحث', 'بحث', 'وين', 'فين', 'ابغى اعرف', 'ابي اعرف', 'ورني', 'شوف', 'عايز اعرف', 'عاوز اعرف', 'بغيت اعرف', 'بغيت اشوف', 'فين الطلب', 'فين الاوردر'])) {
    final q = raw.replaceFirst(RegExp(r'^.*?(دور|ابحث|بحث|وين|فين|شوف|ورني)(\s+(لي|لى|على|عن|عليه|عليها))?'), '').trim();
    return {'type': 'find_orders', 'query': q};
  }
  return {'type': 'unknown'};
}

const assistantStatusAr = {'pending': 'قيد الانتظار', 'in_progress': 'قيد التنفيذ', 'ready': 'جاهز', 'completed': 'تم التسليم', 'cancelled': 'ملغى'};
