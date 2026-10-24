/**
 * محرك فهم أوامر محلي (بدون أي خدمة ذكاء صناعي خارجية ولا مفاتيح):
 * يطبّع النص العربي (اللهجات/الأخطاء الإملائية) ثم يحدد النية بكلمات مفتاحية
 * شاملة للسعودي والخليجي والمصري والشامي والسوداني والفصحى.
 */
export function normalize(t = '') {
  return String(t)
    .replace(/[ً-ْـ]/g, '')       // تشكيل وتطويل
    .replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/ؤ/g, 'و').replace(/ئ/g, 'ي')
    .replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d))
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .replace(/\s+/g, ' ').trim().toLowerCase();
}
// مسافة التحرير (لتصحيح أخطاء التعرف الصوتي: «الفواتير» ← «الفواتر»)
function lev(a, b) {
  if (a === b) return 0;
  const m = a.length, n = b.length;
  if (Math.abs(m - n) > 2) return 3;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[n];
}
const has = (t, words) => {
  const toks = t.split(' ');
  return words.some((w) => {
    if (t.includes(w)) return true;
    if (w.includes(' ') || w.length < 4) return false;          // العبارات والكلمات القصيرة: تطابق حرفي فقط
    const base = (x) => x.replace(/^(لل|ال|ل|ب|وال)/, '');
    const bw = base(w);
    if (bw.length < 4) return false;
    const tol = bw.length >= 6 ? 2 : 1;
    return toks.some((k) => { const bk = base(k); return bk.length >= 3 && lev(bk, bw) <= tol; });
  });
};

// ─── معجم الأرقام المنطوقة (اللهجات): «ألف واثنين» ← 1002، «واحد صفر صفر اثنين» ← 1002 ───
const UNITS = { صفر: 0, زيرو: 0, واحد: 1, واحده: 1, وحده: 1, اثنين: 2, اثنان: 2, اثنتين: 2, ثنتين: 2, اتنين: 2, ثلاثه: 3, تلاته: 3, ثلاث: 3, تلات: 3, اربعه: 4, اربع: 4, اربعا: 4, خمسه: 5, خمس: 5, خمسا: 5, سته: 6, ست: 6, سبعه: 7, سبع: 7, سبعا: 7, ثمانيه: 8, تمانيه: 8, ثماني: 8, ثمان: 8, تمان: 8, تسعه: 9, تسع: 9, تسعا: 9 };
const TEENS = { حداشر: 11, احداشر: 11, اتناشر: 12, اطناشر: 12, تلتاشر: 13, تلاتاشر: 13, اربعتاشر: 14, خمستاشر: 15, ستاشر: 16, سبعتاشر: 17, تمنتاشر: 18, تسعتاشر: 19, عشره: 10, عشر: 10, احدعشر: 11, اثنعشر: 12, اطنعشر: 12, ثلاثهعشر: 13, اربعهعشر: 14, خمسهعشر: 15, سبعهعشر: 17, تسعهعشر: 19 };
const TENS = { عشرين: 20, عشرون: 20, ثلاثين: 30, تلاتين: 30, اربعين: 40, خمسين: 50, ستين: 60, سبعين: 70, ثمانين: 80, تمانين: 80, تسعين: 90 };
const HUND = { تلتميه: 300, تلاتميه: 300, ربعميه: 400, اربعميه: 400, خمسميه: 500, ستميه: 600, سبعميه: 700, تمنميه: 800, تسعميه: 900, مئه: 100, ميه: 100, مايه: 100, مائه: 100, مئتين: 200, ميتين: 200, ثلاثمئه: 300, تلتمئه: 300, ثلثمئه: 300, اربعمئه: 400, ربعمئه: 400, خمسمئه: 500, خمسميه: 500, ستمئه: 600, سبعمئه: 700, ثمانمئه: 800, تسعمئه: 900 };
const THOU = { الف: 1000, الفين: 2000, الاف: 1000 };
const NUMW = new Set([...Object.keys(UNITS), ...Object.keys(TEENS), ...Object.keys(TENS), ...Object.keys(HUND), ...Object.keys(THOU)]);
const stripAnd = (w) => (w.startsWith('و') && w.length > 3 && NUMW.has(w.slice(1)) ? w.slice(1) : w);
const valOf = (w) => UNITS[w] ?? TEENS[w] ?? TENS[w] ?? HUND[w] ?? THOU[w];

export function numberWordsToDigits(text) {
  const toks = text.split(' ');
  const out = [];
  for (let i = 0; i < toks.length;) {
    const w0 = stripAnd(toks[i]);
    if (!NUMW.has(w0)) { out.push(toks[i]); i++; continue; }
    // اجمع سلسلة كلمات رقمية
    const run = [];
    while (i < toks.length) {
      const w = stripAnd(toks[i]);
      if (toks[i] === 'و' && NUMW.has(stripAnd(toks[i + 1] || ''))) { i++; continue; }
      if (!NUMW.has(w)) break;
      run.push(w); i++;
    }
    const allUnits = run.every((w) => w in UNITS);
    if (allUnits && run.length >= 2) { out.push(run.map((w) => UNITS[w]).join('')); continue; }   // أرقام متتابعة: واحد صفر صفر اثنين
    let total = 0, cur = 0;
    for (const w of run) {
      if (w === 'الفين') { total += 2000; }
      else if (w in THOU) { total += (cur || 1) * 1000; cur = 0; }
      else cur += valOf(w);
    }
    out.push(String(total + cur));
  }
  return out.join(' ');
}

export const PAGES = [
  { path: '/pos', words: ['لوحه التحكم', 'الرئيسيه', 'الداشبورد', 'dashboard'], label: 'لوحة التحكم' },
  { path: '/new-order', words: ['طلب جديد', 'اضافه طلب', 'سجل طلب', 'اعمل طلب', 'اضيف طلب'], label: 'طلب جديد' },
  { path: '/orders', words: ['الطلبات', 'صفحه الطلبات', 'قائمه الطلبات'], label: 'الطلبات' },
  { path: '/invoices', words: ['الفواتير', 'فواتير'], label: 'الفواتير' },
  { path: '/admin/partners', words: ['الشركات', 'الشركاء', 'حسابات الشركات'], label: 'الشركات' },
  { path: '/customers', words: ['العملاء', 'الزبائن', 'الزباين'], label: 'العملاء' },
  { path: '/calendar', words: ['الجدوله', 'التقويم', 'جدول التواريخ'], label: 'الجدولة' },
  { path: '/scan', words: ['مسح الباركود', 'سكان', 'امسح'], label: 'مسح الباركود' },
  { path: '/sales', words: ['المبيعات', 'المخازن', 'المخزون'], label: 'المبيعات والمخازن' },
  { path: '/returns', words: ['المرتجعات', 'مرتجع'], label: 'المرتجعات' },
  { path: '/financial-reports', words: ['التقارير الماليه', 'التقارير', 'الاقرار الضريبي', 'الضريبه'], label: 'التقارير المالية' },
  { path: '/employees', words: ['الموظفين', 'الموظفون'], label: 'الموظفون' },
  { path: '/settings', words: ['الاعدادات', 'الإعدادات', 'اعدادات'], label: 'الإعدادات' },
];

/** رقم الطلب: ORD-01002 أو "طلب 1002" أو "رقم 1002" */
export function extractOrderNumber(raw) {
  // «اوردر/اورد/ord» منطوقة ← ord ، ثم الأرقام المنطوقة ← أرقام
  const t = numberWordsToDigits(normalize(raw).split(' ').map((k) => (['اوردر', 'اورد', 'اوردار', 'اودر', 'ordr', 'order'].includes(k) ? 'ord' : k)).join(' '));
  let m = t.match(/ord[\s-]?(\d{1,6})/);
  if (!m) m = t.match(/(?:طلب|رقم|الطلب|رقمه)\s*(?:رقم\s*)?(\d{1,6})\b/);
  if (!m) return null;
  return `ORD-${String(parseInt(m[1], 10)).padStart(5, '0')}`;
}

/** يرجع { type, ... } أو { type:'unknown' } */
export function parseCommand(raw) {
  const t = normalize(raw);
  if (!t) return { type: 'empty' };
  const orderNo = extractOrderNumber(raw);

  if (has(t, ['مساعده', 'ساعدني', 'وش تقدر', 'ايش تقدر', 'شو بتقدر', 'اوامر', 'help']) && !orderNo) return { type: 'help' };
  if (has(t, ['هلا', 'مرحبا', 'السلام عليكم', 'اهلا', 'صباح الخير', 'مساء الخير', 'ازيك', 'كيفك', 'شلونك']) && t.split(' ').length <= 4) return { type: 'greet' };

  // تغيير الحالة (يحتاج رقم طلب + تأكيد)
  if (orderNo) {
    if (has(t, ['تم التسليم', 'سلمت', 'سلمته', 'سلمناه', 'اتسلم', 'تسلم', 'استلم العميل', 'استلمه', 'سلم', 'اتسلمت', 'اتسلمه', 'سلمتها', 'العميل خدها', 'العميل خده', 'العميل اخدها', 'العميل اخده', 'شالها العميل', 'استلمها']))
      return { type: 'set_status', order_number: orderNo, status: 'completed', label: 'تم التسليم' };
    if (has(t, ['جاهز', 'جاهزه', 'خلص', 'خلصت', 'خلصان', 'خالص', 'انتهى', 'انتهي', 'تم الانجاز', 'خلصناه', 'خلصتها', 'خلصته', 'خلصها', 'خلص خلاص', 'جهزتها', 'جهزته', 'جهزت', 'تمت', 'خلاص خلصت', 'قد خلص', 'قد خلصت', 'قد جهز', 'بقت جاهزه', 'بقى جاهز', 'بقي جاهز', 'بقت جاهزة']))
      return { type: 'set_status', order_number: orderNo, status: 'ready', label: 'جاهز' };
  }

  // فتح صفحة
  if (has(t, ['افتح', 'فتح', 'روح', 'وديني', 'خذني', 'ورني', 'ودني', 'اعرض', 'اذهب', 'open', 'go to', 'افتحلي', 'وريني', 'فتحلي', 'دخلني', 'طلعلي', 'وصلني', 'هات', 'خلني اشوف'])) {
    if (orderNo) return { type: 'find_orders', query: orderNo };
    for (const pg of PAGES) if (has(t, pg.words.map(normalize))) return { type: 'navigate', path: pg.path, label: pg.label };
  }
  if (has(t, ['طلب جديد', 'اضافه طلب']) && has(t, ['ابي', 'ابغى', 'ابغي', 'عايز', 'عاوز', 'اريد', 'بدي', 'اعمل', 'سجل', 'اضيف', 'اضافه']))
    return { type: 'navigate', path: '/new-order', label: 'طلب جديد' };
  if (has(t, ['اطبع باركود', 'باركود']) && orderNo) return { type: 'barcode', order_number: orderNo };

  // استعلامات
  if (has(t, ['مستحق', 'مديونيه', 'عليها فلوس', 'عليهم فلوس', 'غير مسدد', 'غير المسدد', 'حسابات الشركات', 'الشركات']) && has(t, ['شركه', 'شركات', 'شركاء', 'ريان', 'مستحق', 'مديونيه']))
    return { type: 'tool', tool: 'partners_due', input: {} };
  if (has(t, ['ايراد', 'دخل', 'مبيعات', 'كسبنا', 'ربحنا', 'ايش دخل', 'كم دخل', 'الدخل', 'كم بعنا', 'المبلغ اللي', 'كسبنا كام', 'دخلنا كام', 'بعنا بكام', 'الايراد كام', 'كام الايراد', 'كام دخل', 'ايش الدخل', 'كم الدخل']))
    return { type: 'tool', tool: 'revenue', input: { period: has(t, ['شهر', 'الشهر']) ? 'month' : has(t, ['اسبوع', 'الاسبوع']) ? 'week' : 'today' } };
  if (has(t, ['تسليم', 'تسليمات', 'متاخر', 'متاخره', 'موعد', 'مواعيد', 'تتاخر', 'يتسلم', 'لازم يتسلم', 'اللي عليها', 'اتاخر', 'اتاخرت', 'لسه ما اتسلم', 'لسه متسلمش', 'النهارده يتسلم', 'اللي ورانا', 'مواعيد النهارده', 'ايش المتاخر', 'ايش اللي تاخر']))
    return { type: 'tool', tool: 'deliveries', input: {} };
  if (has(t, ['كم طلب', 'عدد الطلبات', 'كم عندنا', 'كم عدد', 'كام طلب', 'قد ايش', 'كم جاهز', 'كام', 'كام اوردر', 'كام طلب النهارده', 'ايش عدد', 'كم عدد الطلبات']))
    return { type: 'tool', tool: 'counts_today', input: {} };
  if (orderNo) return { type: 'find_orders', query: orderNo };
  if (has(t, ['دور', 'ابحث', 'بحث', 'وين', 'فين', 'ابغى اعرف', 'ابي اعرف', 'ورني', 'شوف', 'عايز اعرف', 'عاوز اعرف', 'بغيت اعرف', 'بغيت اشوف', 'فين الطلب', 'فين الاوردر']))
    return { type: 'find_orders', query: String(raw).replace(/^.*?(دور|ابحث|بحث|وين|فين|شوف|ورني)(\s+(لي|لى|على|عن|عليه|عليها))?/i, '').trim() || '' };
  return { type: 'unknown' };
}

export const STATUS_AR = { pending: 'قيد الانتظار', in_progress: 'قيد التنفيذ', ready: 'جاهز', completed: 'تم التسليم', cancelled: 'ملغى' };
