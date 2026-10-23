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
const has = (t, words) => words.some((w) => t.includes(w));

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
  const t = normalize(raw);
  let m = t.match(/ord[\s-]?(\d{1,6})/);
  if (!m) m = t.match(/(?:طلب|رقم|الطلب|رقمه)\s*(?:رقم\s*)?(\d{1,6})\b/);
  if (!m) return null;
  return `ORD-${String(m[1]).padStart(5, '0')}`;
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
    if (has(t, ['تم التسليم', 'سلمت', 'سلمته', 'سلمناه', 'اتسلم', 'تسلم', 'استلم العميل', 'استلمه', 'سلم']))
      return { type: 'set_status', order_number: orderNo, status: 'completed', label: 'تم التسليم' };
    if (has(t, ['جاهز', 'جاهزه', 'خلص', 'خلصت', 'خلصان', 'خالص', 'انتهى', 'انتهي', 'تم الانجاز', 'خلصناه']))
      return { type: 'set_status', order_number: orderNo, status: 'ready', label: 'جاهز' };
  }

  // فتح صفحة
  if (has(t, ['افتح', 'فتح', 'روح', 'وديني', 'خذني', 'ورني', 'ودني', 'اعرض', 'اذهب', 'open', 'go to'])) {
    if (orderNo) return { type: 'find_orders', query: orderNo };
    for (const pg of PAGES) if (has(t, pg.words.map(normalize))) return { type: 'navigate', path: pg.path, label: pg.label };
  }
  if (has(t, ['طلب جديد', 'اضافه طلب']) && has(t, ['ابي', 'ابغى', 'ابغي', 'عايز', 'عاوز', 'اريد', 'بدي', 'اعمل', 'سجل', 'اضيف', 'اضافه']))
    return { type: 'navigate', path: '/new-order', label: 'طلب جديد' };
  if (has(t, ['اطبع باركود', 'باركود']) && orderNo) return { type: 'barcode', order_number: orderNo };

  // استعلامات
  if (has(t, ['مستحق', 'مديونيه', 'عليها فلوس', 'عليهم فلوس', 'غير مسدد', 'غير المسدد', 'حسابات الشركات', 'الشركات']) && has(t, ['شركه', 'شركات', 'شركاء', 'ريان', 'مستحق', 'مديونيه']))
    return { type: 'tool', tool: 'partners_due', input: {} };
  if (has(t, ['ايراد', 'دخل', 'مبيعات', 'كسبنا', 'ربحنا', 'ايش دخل', 'كم دخل', 'الدخل', 'كم بعنا', 'المبلغ اللي']))
    return { type: 'tool', tool: 'revenue', input: { period: has(t, ['شهر', 'الشهر']) ? 'month' : has(t, ['اسبوع', 'الاسبوع']) ? 'week' : 'today' } };
  if (has(t, ['تسليم', 'تسليمات', 'متاخر', 'متاخره', 'موعد', 'مواعيد', 'تتاخر', 'يتسلم', 'لازم يتسلم', 'اللي عليها']))
    return { type: 'tool', tool: 'deliveries', input: {} };
  if (has(t, ['كم طلب', 'عدد الطلبات', 'كم عندنا', 'كم عدد', 'كام طلب', 'قد ايش', 'كم جاهز', 'كام']))
    return { type: 'tool', tool: 'counts_today', input: {} };
  if (orderNo) return { type: 'find_orders', query: orderNo };
  if (has(t, ['دور', 'ابحث', 'بحث', 'وين', 'فين', 'ابغى اعرف', 'ابي اعرف', 'ورني', 'شوف']))
    return { type: 'find_orders', query: String(raw).replace(/^.*?(دور|ابحث|بحث|وين|فين|شوف|ورني)(\s+(لي|لى|على|عن|عليه|عليها))?/i, '').trim() || '' };
  return { type: 'unknown' };
}

export const STATUS_AR = { pending: 'قيد الانتظار', in_progress: 'قيد التنفيذ', ready: 'جاهز', completed: 'تم التسليم', cancelled: 'ملغى' };
