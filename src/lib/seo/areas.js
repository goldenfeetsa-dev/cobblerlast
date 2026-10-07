/**
 * صفحات التغطية الجغرافية (الرياض + السعودية) — عربي/إنجليزي.
 * ─────────────────────────────────────────────────────────────────
 * أساس الحقائق (من سياسة الشحن والتوصيل بالموقع):
 *  • الاستلام والتوصيل متاح في جميع أحياء الرياض (شمال وجنوب).
 *  • التوصيل مجاني داخل الرياض للطلبات فوق 200 ريال، و30 ريال لما دونها.
 *  • خارج الرياض: إرسال القطع عبر أرامكس أو شركات الشحن بعد التواصل المسبق،
 *    والرسوم حسب شركة الشحن.
 *  • الفرع الوحيد: حي العزيزية (جنوب الرياض).
 * ممنوع هنا: ادعاء فرع بغير العزيزية، أو "الأقرب" لأي حي خارج الجنوب.
 * عدد الصفحات محدود عمداً (جهات + أحياء رئيسية) لتفادي صفحات "بوابة" مكررة.
 */
import { SERVICE_PAGES } from './services.js';

export const SECTORS = [
  { slug: 'north-riyadh', ar: 'شمال الرياض', en: 'North Riyadh' },
  { slug: 'south-riyadh', ar: 'جنوب الرياض', en: 'South Riyadh' },
  { slug: 'east-riyadh', ar: 'شرق الرياض', en: 'East Riyadh' },
  { slug: 'west-riyadh', ar: 'غرب الرياض', en: 'West Riyadh' },
  { slug: 'central-riyadh', ar: 'وسط الرياض', en: 'Central Riyadh' },
];
const S = Object.fromEntries(SECTORS.map((s) => [s.slug.split('-')[0], s]));

// [slug, عربي (بدون "حي"), English, sector]
const D = [
  ['hittin', 'حطين', 'Hittin', 'north'], ['malqa', 'الملقا', 'Al Malqa', 'north'], ['narjis', 'النرجس', 'Al Narjis', 'north'],
  ['yasmin', 'الياسمين', 'Al Yasmin', 'north'], ['sahafa', 'الصحافة', 'Al Sahafa', 'north'], ['qirawan', 'القيروان', 'Al Qirawan', 'north'],
  ['arid', 'العارض', 'Al Arid', 'north'], ['ghadir', 'الغدير', 'Al Ghadir', 'north'], ['nakheel', 'النخيل', 'Al Nakheel', 'north'],
  ['olaya', 'العليا', 'Al Olaya', 'central'], ['sulaimaniyah', 'السليمانية', 'Al Sulaimaniyah', 'central'], ['wurud', 'الورود', 'Al Wurud', 'central'], ['malaz', 'الملز', 'Al Malaz', 'central'],
  ['rawdah', 'الروضة', 'Al Rawdah', 'east'], ['naseem', 'النسيم', 'Al Naseem', 'east'], ['qurtubah', 'قرطبة', 'Qurtubah', 'east'],
  ['yarmouk', 'اليرموك', 'Al Yarmouk', 'east'], ['hamra', 'الحمراء', 'Al Hamra', 'east'], ['khaleej', 'الخليج', 'Al Khaleej', 'east'], ['nahdah', 'النهضة', 'Al Nahdah', 'east'],
  ['aziziyah', 'العزيزية', 'Al Aziziyah', 'south'], ['shifa', 'الشفا', 'Al Shifa', 'south'], ['dar-al-baida', 'دار البيضاء', 'Dar Al Baida', 'south'],
  ['dirab', 'ديراب', 'Dirab', 'south'], ['uraija', 'العريجاء', 'Al Uraija', 'south'],
  ['laban', 'لبن', 'Laban', 'west'], ['namar', 'نمار', 'Namar', 'west'], ['suwaidi', 'السويدي', 'Al Suwaidi', 'west'], ['irqah', 'عرقة', 'Irqah', 'west'],
];
export const DISTRICTS = D.map(([slug, ar, en, sec]) => ({ slug, ar, en, sector: S[sec].slug }));

export const AREA_SLUGS = ['riyadh', 'saudi-arabia', ...SECTORS.map((s) => s.slug), ...DISTRICTS.map((d) => d.slug)];
export const areaKind = (slug) => (slug === 'riyadh' ? 'city' : slug === 'saudi-arabia' ? 'country' : SECTORS.some((s) => s.slug === slug) ? 'sector' : DISTRICTS.some((d) => d.slug === slug) ? 'district' : null);

const J = { ar: '، ', en: ', ' };
const SA_CITIES = {
  ar: ['جدة', 'مكة المكرمة', 'المدينة المنورة', 'الدمام', 'الخبر', 'الظهران', 'الطائف', 'بريدة', 'أبها', 'تبوك', 'حائل', 'الجبيل', 'ينبع', 'الأحساء'],
  en: ['Jeddah', 'Makkah', 'Madinah', 'Dammam', 'Khobar', 'Dhahran', 'Taif', 'Buraidah', 'Abha', 'Tabuk', 'Hail', 'Jubail', 'Yanbu', 'Al Ahsa'],
};
const FEES = {
  ar: 'التوصيل داخل الرياض مجاني للطلبات فوق 200 ريال و30 ريالاً للطلبات الأقل.',
  en: 'Delivery inside Riyadh is free for orders above SAR 200 and SAR 30 for smaller orders.',
};
const WHAT = {
  ar: 'أحذية جلدية ورياضية وبسطار عسكري، وشنط وحقائب (سفر ومدرسية ونسائية)، وحقائب الماركات الفاخرة مثل لويس فيتون (LV) وهيرمس وشانيل.',
  en: 'leather and sports shoes, military boots, bags and handbags (travel, school and women’s), and luxury-brand bags such as Louis Vuitton (LV), Hermès and Chanel.',
};
const SECTOR_NOTE = {
  north: { ar: (n) => `${n} من أحياء شمال الرياض، ونخدمها بالاستلام والتوصيل: مندوبنا يستلم القطعة من موقعك فلا تحتاج تزور الورشة.`, en: (n) => `${n} is in North Riyadh. We serve it with pickup and delivery: our courier collects the item from your location so you never need to visit the workshop.` },
  central: { ar: (n) => `${n} من أحياء وسط الرياض، ونخدمها بالاستلام والتوصيل من موقعك مباشرة سواء من البيت أو المكتب.`, en: (n) => `${n} is in Central Riyadh. We serve it with pickup and delivery straight from your location, whether home or office.` },
  east: { ar: (n) => `${n} من أحياء شرق الرياض، ونخدمها بالاستلام والتوصيل: نستلم القطعة من موقعك ونعيدها لك بعد الإصلاح.`, en: (n) => `${n} is in East Riyadh. We serve it with pickup and delivery: we collect the item from your location and bring it back after repair.` },
  west: { ar: (n) => `${n} من أحياء غرب الرياض، ونخدمها بالاستلام والتوصيل من موقعك بدون ما تحتاج تزور الفرع.`, en: (n) => `${n} is in West Riyadh. We serve it with pickup and delivery from your location without a visit to the branch.` },
  south: { ar: (n) => `${n} من أحياء جنوب الرياض، وفرعنا في حي العزيزية بجنوب الرياض، فتقدر تزور الفرع أو تطلب الاستلام من موقعك.`, en: (n) => `${n} is in South Riyadh, the same side of the city as our Al Aziziyah branch, so you can visit the branch or request pickup from your location.` },
};

const sectorOf = (d) => SECTORS.find((s) => s.slug === d.sector);
const districtsOf = (secSlug) => DISTRICTS.filter((d) => d.sector === secSlug);
const pre = (lang, p) => (lang === 'ar' ? p : '/en' + p);

/** المحتوى الكامل لصفحة منطقة — يستخدمه React وسكربت البناء (نفس المصدر) */
export function areaContent(slug, lang) {
  const kind = areaKind(slug);
  if (!kind) return null;
  const ar = lang === 'ar';
  const brand = ar ? 'إبرة وخيط الإسكافي' : 'Ebra & Khait Cobbler';
  const services = SERVICE_PAGES.map((s) => ({ name: s[lang].name, href: pre(lang, `/services/${s.slug}`) }));
  const base = { kind, slug, services, fees: FEES[lang], what: WHAT[lang], hours: ar ? 'السبت — الخميس، 9 صباحاً — 10 مساءً' : 'Saturday – Thursday, 9 AM – 10 PM' };

  if (kind === 'district') {
    const d = DISTRICTS.find((x) => x.slug === slug), sec = sectorOf(d), n = ar ? d.ar : d.en, sn = ar ? sec.ar : sec.en;
    const nameFull = ar ? `حي ${n}` : n;
    const near = districtsOf(d.sector).filter((x) => x.slug !== slug).map((x) => ({ name: ar ? `حي ${x.ar}` : x.en, href: pre(lang, `/areas/${x.slug}`) }));
    return { ...base, name: nameFull, parent: { name: sn, href: pre(lang, `/areas/${sec.slug}`) }, near,
      title: ar ? `تصليح احذية وشنط ${nameFull} الرياض | ${brand}` : `Shoe & Bag Repair in ${n}, Riyadh | ${brand}`,
      description: ar ? `استلام وتوصيل لتصليح الأحذية والحقائب الجلدية في ${nameFull} بالرياض: ترميم، تلميع، سحاب وهندل. مجاني فوق 200 ريال وضمان 30 يوماً.`
        : `Pickup and delivery for shoe and leather bag repair in ${n}, Riyadh: restoration, polishing, zippers and handles. Free above SAR 200, 30-day guarantee.`,
      h1: ar ? `تصليح أحذية وشنط في ${nameFull}، الرياض` : `Shoe & Bag Repair in ${n}, Riyadh`,
      intro: (ar ? SECTOR_NOTE[sec.slug.split('-')[0]].ar(nameFull) : SECTOR_NOTE[sec.slug.split('-')[0]].en(n)) + (ar ? ` نصلح ونرمّم ${WHAT.ar}` : ` We repair and restore ${WHAT.en}`),
      faq: ar ? [
        { q: `هل تستلمون القطع من ${nameFull}؟`, a: `نعم، خدمة الاستلام والتوصيل متاحة في جميع أحياء الرياض ومنها ${nameFull}. يستلم مندوبنا القطعة من موقعك، ويمكنك أيضاً إرسال صورة للقطعة ليتم تقييمها مجاناً خلال ساعة.` },
        { q: `كم رسوم التوصيل إلى ${nameFull}؟`, a: FEES.ar },
        { q: `ماذا تصلحون لسكان ${nameFull}؟`, a: `نصلح أحذية الرجال والنساء وشنط السفر والحقائب الفاخرة لسكان ${nameFull}، وكل الأعمال مضمونة 30 يوماً.` },
      ] : [
        { q: `Do you pick up items from ${n}?`, a: `Yes. Pickup and delivery are available in all Riyadh districts, including ${n}. Our courier collects the item from your location, and you can also send a photo for a free assessment within one hour.` },
        { q: `What are the delivery fees to ${n}?`, a: FEES.en },
        { q: `What do you repair for ${n} residents?`, a: `We repair men’s and women’s shoes, travel bags and luxury handbags for ${n} residents, and all work carries a 30-day guarantee.` },
      ] };
  }

  if (kind === 'sector') {
    const sec = SECTORS.find((s) => s.slug === slug), n = ar ? sec.ar : sec.en, ds = districtsOf(slug);
    const dl = ds.map((x) => ({ name: ar ? `حي ${x.ar}` : x.en, href: pre(lang, `/areas/${x.slug}`) }));
    const names = ds.slice(0, 3).map((x) => (ar ? x.ar : x.en)).join(J[lang]);
    const south = slug === 'south-riyadh';
    return { ...base, name: n, parent: { name: ar ? 'الرياض' : 'Riyadh', href: pre(lang, '/areas/riyadh') }, districts: dl,
      title: ar ? `تصليح احذية وشنط ${n} | ${brand}` : `Shoe & Bag Repair in ${n} | ${brand}`,
      description: ar ? `تصليح وترميم الأحذية والحقائب الجلدية في ${n}: استلام وتوصيل لأحياء ${names} وغيرها. ضمان 30 يوماً ومجاني فوق 200 ريال.`
        : `Shoe and leather bag repair in ${n}: pickup and delivery for ${names} and more. 30-day guarantee, free above SAR 200.`,
      h1: ar ? `تصليح احذية وشنط في ${n}` : `Shoe & Bag Repair in ${n}`,
      intro: ar ? `${south ? 'فرعنا في حي العزيزية بجنوب الرياض، ونخدم أيضاً كل أحياء جنوب الرياض بالاستلام والتوصيل.' : `نخدم أحياء ${n} بالاستلام والتوصيل من موقعك، بدون ما تحتاج تزور الورشة.`} نصلح ونرمّم ${WHAT.ar}`
        : `${south ? 'Our branch is in Al Aziziyah, South Riyadh, and we also serve every South Riyadh district with pickup and delivery.' : `We serve ${n} districts with pickup and delivery from your location, so you never need to visit the workshop.`} We repair and restore ${WHAT.en}`,
      faq: ar ? [
        { q: `هل تخدمون ${n}؟`, a: `نعم، الاستلام والتوصيل متاح في جميع أحياء الرياض ومنها أحياء ${n}.${south ? ' وفرعنا في حي العزيزية بجنوب الرياض.' : ''}` },
        { q: `كم رسوم التوصيل في ${n}؟`, a: FEES.ar },
      ] : [
        { q: `Do you serve ${n}?`, a: `Yes. Pickup and delivery are available in all Riyadh districts, including ${n}.${south ? ' Our branch is in Al Aziziyah, South Riyadh.' : ''}` },
        { q: `What are the delivery fees in ${n}?`, a: FEES.en },
      ] };
  }

  if (kind === 'city') {
    return { ...base, name: ar ? 'الرياض' : 'Riyadh', parent: null,
      sectors: SECTORS.map((s) => ({ name: ar ? s.ar : s.en, href: pre(lang, `/areas/${s.slug}`), districts: districtsOf(s.slug).map((x) => ({ name: ar ? `حي ${x.ar}` : x.en, href: pre(lang, `/areas/${x.slug}`) })) })),
      title: ar ? `تصليح احذية وشنط في الرياض | كل الأحياء — ${brand}` : `Shoe & Bag Repair in Riyadh | All Districts — ${brand}`,
      description: ar ? 'تصليح وترميم الأحذية والحقائب الجلدية في الرياض: استلام وتوصيل لجميع الأحياء من حطين والملقا والعليا إلى العزيزية والنسيم. ضمان 30 يوماً.'
        : 'Shoe and leather bag repair in Riyadh: pickup and delivery to every district from Hittin, Al Malqa and Al Olaya to Al Aziziyah and Al Naseem. 30-day guarantee.',
      h1: ar ? 'تصليح احذية وشنط في الرياض — نخدم كل الأحياء' : 'Shoe & Bag Repair in Riyadh — We Serve Every District',
      intro: ar ? `إبرة وخيط الإسكافي ورشة سعودية في الرياض، فرعنا في حي العزيزية، وخدمة الاستلام والتوصيل تغطي جميع أحياء الرياض شمالها وجنوبها وشرقها وغربها ووسطها. نصلح ونرمّم ${WHAT.ar}`
        : `Ebra & Khait Cobbler is a Saudi workshop in Riyadh with a branch in Al Aziziyah, and our pickup and delivery service covers every district in the north, south, east, west and centre of the city. We repair and restore ${WHAT.en}`,
      faq: ar ? [
        { q: 'هل تخدمون جميع أحياء الرياض؟', a: 'نعم، خدمة الاستلام والتوصيل متاحة في جميع أحياء الرياض: شمالها (حطين، الملقا، النرجس، الياسمين)، ووسطها (العليا، السليمانية، الملز)، وشرقها (النسيم، الروضة)، وغربها (لبن، نمار)، وجنوبها (العزيزية، الشفا، دار البيضاء).' },
        { q: 'أين فرعكم في الرياض؟', a: 'فرعنا في حي العزيزية بجنوب الرياض.' }, { q: 'كم رسوم التوصيل؟', a: FEES.ar },
      ] : [
        { q: 'Do you serve every district in Riyadh?', a: 'Yes. Pickup and delivery cover all Riyadh districts: the north (Hittin, Al Malqa, Al Narjis, Al Yasmin), centre (Al Olaya, Al Sulaimaniyah, Al Malaz), east (Al Naseem, Al Rawdah), west (Laban, Namar) and south (Al Aziziyah, Al Shifa, Dar Al Baida).' },
        { q: 'Where is your branch in Riyadh?', a: 'Our branch is in Al Aziziyah district, South Riyadh.' }, { q: 'What are the delivery fees?', a: FEES.en },
      ] };
  }

  // country
  const cities = SA_CITIES[lang].join(J[lang]);
  return { ...base, name: ar ? 'السعودية' : 'Saudi Arabia', parent: { name: ar ? 'الرياض' : 'Riyadh', href: pre(lang, '/areas/riyadh') }, cities: SA_CITIES[lang],
    title: ar ? `تصليح احذية وشنط في السعودية بالشحن | ${brand}` : `Shoe & Bag Repair Across Saudi Arabia | ${brand}`,
    description: ar ? 'أرسل حذاءك أو حقيبتك للتصليح من أي مدينة في السعودية عبر أرامكس أو شركات الشحن، وترمّمها أيدي حرفيينا في الرياض. تواصل معنا أولاً.'
      : 'Send your shoes or bags for repair from any city in Saudi Arabia via Aramex or other carriers, restored by our craftsmen in Riyadh. Contact us first.',
    h1: ar ? 'تصليح احذية وشنط في السعودية — أرسل قطعتك من أي مدينة' : 'Shoe & Bag Repair Across Saudi Arabia — Send Your Item From Any City',
    intro: ar ? `ورشتنا في الرياض، ونستقبل القطع من خارج الرياض عبر أرامكس أو شركات الشحن بعد التواصل معنا مسبقاً، سواء كنت في ${cities} أو أي مدينة ثانية بالمملكة. نصلح ونرمّم ${WHAT.ar}`
      : `Our workshop is in Riyadh, and we receive items from outside Riyadh through Aramex or other carriers after you contact us first — whether you are in ${cities} or any other city in the Kingdom. We repair and restore ${WHAT.en}`,
    steps: ar ? ['تواصل معنا واتساب 0549678191 وأرسل صوراً لقطعتك لتقييمها مجاناً.', 'نتفق على السعر وطريقة الشحن (أرامكس أو شركة شحن ثانية).', 'تشحن القطعة للرياض ونصلحها ونبلغك بكل مرحلة.', 'تُعاد لك بعد الإصلاح مع ضمان 30 يوماً على العمل.']
      : ['Contact us on WhatsApp 0549678191 and send photos of your item for a free assessment.', 'We agree on the price and the shipping method (Aramex or another carrier).', 'You ship the item to Riyadh, we repair it and update you at every stage.', 'It is returned to you after repair with a 30-day guarantee on the work.'],
    faq: ar ? [
      { q: 'هل تستقبلون قطع من خارج الرياض؟', a: 'نعم، يمكن إرسال القطع عبر أرامكس أو شركات الشحن، والتواصل المسبق معنا ضروري. رسوم الشحن حسب شركة الشحن.' },
      { q: 'كم رسوم الشحن من خارج الرياض؟', a: 'حسب شركة الشحن التي تختارها، ونرتب معك التفاصيل قبل الإرسال.' },
    ] : [
      { q: 'Do you accept items from outside Riyadh?', a: 'Yes. Items can be sent through Aramex or other carriers, and contacting us first is required. Shipping fees depend on the carrier.' },
      { q: 'What are the shipping fees from outside Riyadh?', a: 'They depend on the carrier you choose, and we arrange the details with you before you send anything.' },
    ] };
}

export const ALL_AREAS = AREA_SLUGS.map((slug) => ({ slug, kind: areaKind(slug) }));
