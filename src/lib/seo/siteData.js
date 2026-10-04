/**
 * مصدر الحقائق الموحّد للسيو والـGEO (Generative Engine Optimization)
 * ─────────────────────────────────────────────────────────────────
 * يستخدمه الموقع (قسم الأسئلة الشائعة) وسكربت البناء scripts/seo-build.mjs
 * (البيانات المنظمة JSON-LD + llms.txt + المحتوى الثابت للزواحف) — فمحرّكات
 * البحث والذكاء الاصطناعي تشوف نفس المعلومات بكل مكان بدون تناقض.
 *
 * قاعدة ذهبية: كل رقم/ادعاء هنا لازم يكون موجود فعلاً بصفحات الموقع أو
 * قاعدة البيانات. لا تضيف ادعاء ما تقدر تثبته (سنوات خبرة، تقييمات...).
 */
export const SITE = {
  url: 'https://needlecobbler.com',
  nameAr: 'إبرة وخيط الإسكافي',
  nameEn: 'Ebra & Khait Cobbler',
  slogan: 'تصليح وترميم الأحذية والحقائب الجلدية الفاخرة في الرياض',
  founded: '2013', // من صفحة "من نحن": «بدأنا عام 2013 بورشة صغيرة في الرياض»
  phone: '+966549678191',
  logo: 'https://needlecobbler.com/images/cobblers-app-icon.png',
  image: 'https://needlecobbler.com/og-image.jpg',
  gscVerification: '', // ← ضع هنا رمز التحقق من Google Search Console (content فقط)
  bingVerification: '',
  sameAs: [
    'https://www.instagram.com/ebra.kh8/',
    'https://www.tiktok.com/@cobblersriyad',
  ],
  branch: {
    nameAr: 'فرع العزيزية',
    locality: 'الرياض',
    region: 'منطقة الرياض',
    country: 'SA',
    street: 'حي العزيزية',
    lat: 24.598774, // من خريطة الفرع المضمّنة بالنظام
    lng: 46.759599,
    mapsUrl: 'https://maps.app.goo.gl/dwDGJv8NoGpKPqvDA',
  },
  // ملاحظة: جدول working_hours بقاعدة البيانات فيه قيم متضاربة (22:00 مقابل
  // 18:00، والجمعة 13:00). هذي الساعات هي اللي كانت بالبيانات المنظمة قبل
  // التعديل — راجعها وصحّحها عند التأكد.
  hours: { days: ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday'], opens: '09:00', closes: '22:00' },
  // الأسماء من صفحات الموقع (ترميم/تجديد...) — بدون أسعار هنا عمداً
  services: [
    { name: 'ترميم وتصليح الأحذية الجلدية', desc: 'تغيير نعال، خياطة، تلميع، كعب، بطانة، توسيع وتقصير وتغيير جلد.' },
    { name: 'ترميم وتجديد الحقائب والشنط الجلدية', desc: 'سحاب، مقابض وهندل، قاعدة، تلبيس، تغيير جلد، وتجديد ألوان وخياطة.' },
    { name: 'تلميع وتلوين الجلود', desc: 'ألوان ثابتة وتقنيات أوروبية لإعادة اللون والبريق الأصلي.' },
    { name: 'تصليح الأحذية الرياضية والبسطار العسكري', desc: 'تبديل نعل، خياطة، وصيانة شاملة.' },
  ],
  brands: ['هيرمس', 'لويس فيتون', 'شانيل', 'غوتشي', 'ديور', 'دولتشي آند غابانا'],
};

/** الأسئلة الشائعة — كلها من سياسة الإصلاح وصفحات الموقع الحالية */
export const FAQ = {
  ar: [
    { q: 'كم تستغرق مدة تصليح الحذاء أو الحقيبة؟',
      a: 'تلميع الأحذية من يوم إلى يومين، والترميم البسيط من 3 إلى 5 أيام، والترميم الشامل من 7 إلى 14 يوماً. قد تطول المدة في حالات الترميم المعقدة، والطلبات المستعجلة متاحة برسوم إضافية.' },
    { q: 'هل يوجد ضمان على أعمال الإصلاح؟',
      a: 'نعم، جميع أعمال الإصلاح مضمونة لمدة 30 يوماً من تاريخ الاستلام، وفي حال وجود عيب في العمل يُعاد مجاناً. لا يشمل الضمان التلف الناجم عن الاستخدام غير الطبيعي بعد التسليم.' },
    { q: 'كم سعر تصليح الأحذية والحقائب؟',
      a: 'الأسعار تبدأ من 80 ريال لترميم الأحذية، و150 ريال لتجديد الحقائب الجلدية، و50 ريال للتلميع والتلوين. يُحدَّد السعر النهائي بعد فحص القطعة ولا يبدأ أي عمل قبل موافقتك الصريحة، ويُطلب 50% مقدماً للطلبات التي تتجاوز 300 ريال.' },
    { q: 'هل تستلمون القطعة من موقعي في الرياض؟',
      a: 'نعم، مندوبنا يستلم القطعة من موقعك مباشرة في الرياض. يمكنك أيضاً إرسال صورة للقطعة ليتم تقييمها مجاناً خلال ساعة.' },
    { q: 'هل تتعاملون مع حقائب الماركات الفاخرة؟',
      a: 'نعم، نرمّم ونجدد حقائب الماركات الفاخرة مثل هيرمس ولويس فيتون وشانيل، ونصلح كذلك الأحذية الرياضية والبسطار العسكري.' },
    { q: 'كيف أتابع حالة قطعتي بعد تسليمها؟',
      a: 'من صفحة «أين قطعتك الآن؟» (needlecobbler.com/track) بإدخال رقم الطلب أو رقم الجوال، وتشاهد مرحلة العمل خطوة بخطوة.' },
    { q: 'ما طرق الدفع المتاحة؟',
      a: 'الدفع نقداً أو تحويل بنكي أو Apple Pay أو مدى.' },
    { q: 'أين يقع الإسكافي في الرياض؟',
      a: 'فرعنا في حي العزيزية بالرياض، ويمكنك فتح الموقع على خرائط جوجل من قسم «فروعنا» في الصفحة الرئيسية أو التواصل عبر واتساب 0549678191.' },
  ],
  en: [
    { q: 'How long does shoe or bag repair take?',
      a: 'Shoe polishing takes 1–2 days, simple restoration 3–5 days, and full restoration 7–14 days. Complex restorations can take longer, and rush orders are available for an extra fee.' },
    { q: 'Do you guarantee your repair work?',
      a: 'Yes. All repairs are guaranteed for 30 days from pickup, and any workmanship defect is redone free of charge. Damage from abnormal use after delivery is not covered.' },
    { q: 'How much does shoe and bag repair cost?',
      a: 'Prices start from SAR 80 for shoe restoration, SAR 150 for leather bag renewal, and SAR 50 for polishing and recoloring. The final price is set after inspection and no work starts without your explicit approval; a 50% deposit applies to orders above SAR 300.' },
    { q: 'Do you pick up items from my location in Riyadh?',
      a: 'Yes, our courier collects the item from your location in Riyadh. You can also send a photo for a free assessment within one hour.' },
    { q: 'Do you work on luxury-brand bags?',
      a: 'Yes. We restore and renew luxury bags such as Hermès, Louis Vuitton and Chanel, and also repair sneakers and military boots.' },
    { q: 'How can I track my item?',
      a: 'Use the “Where is your item now?” page (needlecobbler.com/track) with your order number or phone number to see each stage of the work.' },
    { q: 'Which payment methods do you accept?',
      a: 'Cash, bank transfer, Apple Pay and Mada.' },
    { q: 'Where is the shop in Riyadh?',
      a: 'Our branch is in Al Aziziyah district, Riyadh. Open the map from the “Our branches” section on the homepage or contact us on WhatsApp at 0549678191.' },
  ],
};

/** صفحات الموقع العامة القابلة للفهرسة — العنوان/الوصف للصفحات الداخلية */
export const PAGES = [
  { path: '/', priority: '1.0', changefreq: 'weekly',
    title: 'إبرة وخيط الإسكافي | تصليح أحذية وشنط جلدية بالرياض — ترميم الحقائب والأحذية الفاخرة',
    description: 'إبرة وخيط الإسكافي في الرياض: تصليح وترميم الأحذية والحقائب الجلدية الفاخرة (هيرمس، لويس فيتون، شانيل) والبسطار العسكري. استلام من موقعك، ضمان 30 يوماً، وتتبع مباشر لقطعتك.' },
  { path: '/book', priority: '0.9', changefreq: 'weekly',
    title: 'احجز موعد تصليح حذاء أو حقيبة في الرياض | إبرة وخيط الإسكافي',
    description: 'احجز موعدك أونلاين لتصليح الأحذية أو ترميم الحقائب الجلدية في الرياض. اختر الخدمة والوقت، ونستلم قطعتك من موقعك.' },
  { path: '/shop', priority: '0.8', changefreq: 'weekly',
    title: 'متجر إبرة وخيط | منتجات العناية بالأحذية والحقائب الفاخرة - الرياض',
    description: 'تسوق منتجات العناية بالأحذية والحقائب الجلدية الفاخرة والبسطار العسكري — نعال، كريمات تلميع، جلود، وأدوات احترافية. توصيل في الرياض.' },
  { path: '/auction', priority: '0.7', changefreq: 'daily',
    title: 'سوق المزاد | حقائب وأحذية جلدية مجدّدة للمزايدة — إبرة وخيط الإسكافي',
    description: 'قطع جلدية مجدّدة ومرمّمة بأيدي حرفيينا تُعرض للمزايدة المباشرة. شارك بالمزاد أو اعرض قطعتك للبيع.' },
  { path: '/reviews', priority: '0.7', changefreq: 'weekly',
    title: 'آراء العملاء | إبرة وخيط الإسكافي — الرياض',
    description: 'اطلع على تجارب عملائنا مع خدمات تصليح وترميم الأحذية والحقائب الجلدية في إبرة وخيط الإسكافي بالرياض.' },
  { path: '/about', priority: '0.7', changefreq: 'monthly',
    title: 'من نحن | إبرة وخيط الإسكافي — حرفيون سعوديون في الرياض',
    description: 'قصة إبرة وخيط الإسكافي: ورشة سعودية بدأت عام 2013 في الرياض متخصصة في إصلاح وتجديد الأحذية والحقائب الجلدية الفاخرة.' },
  { path: '/repair-policy', priority: '0.6', changefreq: 'monthly',
    title: 'سياسة الإصلاح والضمان | إبرة وخيط الإسكافي — الرياض',
    description: 'مدة التسليم، ضمان الجودة لمدة 30 يوماً، طرق الدفع، وشروط الاستلام والتقييم في إبرة وخيط الإسكافي بالرياض.' },
  { path: '/track', priority: '0.5', changefreq: 'monthly',
    title: 'أين قطعتك الآن؟ تتبّع طلب التصليح | إبرة وخيط الإسكافي',
    description: 'تتبّع مرحلة تصليح حذائك أو حقيبتك خطوة بخطوة برقم الطلب أو رقم الجوال.' },
  { path: '/careers', priority: '0.6', changefreq: 'weekly',
    title: 'وظائف إبرة وخيط الإسكافي | فرص عمل في الرياض',
    description: 'انضم لفريق حرفيينا في الرياض. تعرّف على الوظائف المتاحة في إبرة وخيط الإسكافي.' },
  { path: '/shipping-policy', priority: '0.4', changefreq: 'yearly',
    title: 'سياسة الشحن والتوصيل | إبرة وخيط الإسكافي', description: 'تفاصيل الاستلام والتوصيل داخل الرياض لخدمات إبرة وخيط الإسكافي.' },
  { path: '/privacy', priority: '0.3', changefreq: 'yearly',
    title: 'سياسة الخصوصية | إبرة وخيط الإسكافي', description: 'كيف نجمع بياناتك ونحميها في إبرة وخيط الإسكافي.' },
];
