/**
 * scripts/seo-build.mjs — يشتغل بعد `vite build` (انظر package.json)
 * ─────────────────────────────────────────────────────────────────
 * المشكلة: الموقع SPA — كل رابط يرجّع نفس index.html والمحتوى يظهر بعد
 * JavaScript. زواحف الذكاء الاصطناعي ومعاينات المشاركة ما تشغّل JS.
 *
 * الحل: لكل صفحة عامة × لغتين (عربي على الجذر، إنجليزي على /en) نولّد
 * dist/<route>/index.html فيه: title/description/canonical/hreflang/OG +
 * JSON-LD + محتوى نصي دلالي داخل #root (يستبدله React عند التشغيل).
 * + sitemap.xml (مع hreflang البديل) + llms.txt + llms-full.txt.
 *
 * أمان النشر: لا يفشّل البناء أبداً — أي خطأ يُسجَّل ويُتجاوَز.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SITE, SITE_EN, FAQ, PAGES } from '../src/lib/seo/siteData.js';
import { SERVICE_PAGES } from '../src/lib/seo/services.js';
import { ALL_AREAS, areaContent, SECTORS, DISTRICTS } from '../src/lib/seo/areas.js';
import { translations } from '../src/lib/i18n/translations.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
const today = new Date().toISOString().slice(0, 10);
const LANGS = ['ar', 'en'];

const esc = (s = '') => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const jsonLd = (obj) => `<script type="application/ld+json">${JSON.stringify(obj).replace(/</g, '\\u003c')}</script>`;
const li = (arr) => `<ul>${arr.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>`;

// ───────────── سجل الصفحات (ثابتة + خدمات) ─────────────
const REG = [
  ...PAGES.map((p) => ({ path: p.path, priority: p.priority, changefreq: p.changefreq, kind: 'page', ar: { title: p.title, description: p.description }, en: p.en })),
  ...SERVICE_PAGES.map((s) => ({ path: `/services/${s.slug}`, priority: '0.8', changefreq: 'monthly', kind: 'service', svc: s,
    ar: { title: s.ar.title, description: s.ar.description }, en: { title: s.en.title, description: s.en.description } })),
  ...ALL_AREAS.map((a) => ({ path: `/areas/${a.slug}`, priority: a.kind === 'city' ? '0.8' : a.kind === 'sector' ? '0.7' : a.kind === 'country' ? '0.6' : '0.6',
    changefreq: 'monthly', kind: 'area', area: a,
    ar: { title: areaContent(a.slug, 'ar').title, description: areaContent(a.slug, 'ar').description },
    en: { title: areaContent(a.slug, 'en').title, description: areaContent(a.slug, 'en').description } })),
];
const pathOf = (p, lang) => (lang === 'ar' ? p : p === '/' ? '/en' : '/en' + p);
const urlOf = (p, lang) => { const x = pathOf(p, lang); return x === '/' ? SITE.url + '/' : SITE.url + x; };

// ───────────── نصوص حسب اللغة ─────────────
const S = {
  ar: {
    name: SITE.nameAr, brands: SITE.brands, services: SITE.services, faq: FAQ.ar, branch: SITE.branch.nameAr, street: SITE.branch.street, loc: SITE.branch.locality,
    home: 'الرئيسية', services_h: 'خدماتنا', brands_h: 'الماركات التي نتعامل معها', faq_h: 'الأسئلة الشائعة', contact_h: 'الموقع والتواصل',
    phone_l: 'الهاتف / واتساب', map_l: 'الموقع على خرائط جوجل', covers_h: 'ماذا نصلح ونجدد', other_h: 'خدمات أخرى',
    nav: [['/', 'الرئيسية'], ['/book', 'احجز موعد'], ['/shop', 'المتجر'], ['/auction', 'سوق المزاد'], ['/track', 'تتبّع قطعتك'], ['/about', 'من نحن'], ['/repair-policy', 'سياسة الإصلاح'], ['/reviews', 'آراء العملاء']],
    h1home: 'إبرة وخيط الإسكافي — تصليح أحذية وشنط جلدية في الرياض',
    business: 'ورشة سعودية في الرياض متخصصة في تصليح وترميم وتجديد الأحذية والحقائب الجلدية الفاخرة والبسطار العسكري.',
    locale: 'ar_SA', dir: 'rtl',
  },
  en: {
    name: SITE.nameEn, brands: SITE_EN.brands, services: SITE_EN.services, faq: FAQ.en, branch: SITE_EN.branchName, street: SITE_EN.street, loc: SITE_EN.locality,
    home: 'Home', services_h: 'Our services', brands_h: 'Brands we work with', faq_h: 'Frequently asked questions', contact_h: 'Location & contact',
    phone_l: 'Phone / WhatsApp', map_l: 'Open in Google Maps', covers_h: 'What we repair', other_h: 'Other services',
    nav: [['/', 'Home'], ['/book', 'Book a repair'], ['/shop', 'Shop'], ['/auction', 'Auction'], ['/track', 'Track your item'], ['/about', 'About us'], ['/repair-policy', 'Repair policy'], ['/reviews', 'Reviews']],
    h1home: 'Ebra & Khait Cobbler — Shoe & Leather Bag Repair in Riyadh',
    business: SITE_EN.description,
    locale: 'en_US', dir: 'ltr',
  },
};

// ───────────── JSON-LD ─────────────
const BUSINESS_ID = `${SITE.url}/#business`;
function businessNode(lang) {
  const b = SITE.branch, T = S[lang];
  return {
    '@type': 'LocalBusiness', '@id': BUSINESS_ID,
    name: SITE.nameAr, alternateName: [SITE.nameEn, 'Needle and Thread Cobbler', 'Cobblers'],
    description: T.business, url: SITE.url + '/', logo: SITE.logo, image: [SITE.image], telephone: SITE.phone,
    foundingDate: SITE.founded, priceRange: '$$', inLanguage: ['ar', 'en'],
    address: { '@type': 'PostalAddress', streetAddress: T.street, addressLocality: T.loc, addressRegion: lang === 'ar' ? b.region : 'Riyadh Region', addressCountry: b.country },
    geo: { '@type': 'GeoCoordinates', latitude: b.lat, longitude: b.lng }, hasMap: b.mapsUrl,
    areaServed: { '@type': 'City', name: lang === 'ar' ? 'الرياض' : 'Riyadh' },
    openingHoursSpecification: [{ '@type': 'OpeningHoursSpecification', dayOfWeek: SITE.hours.days, opens: SITE.hours.opens, closes: SITE.hours.closes }],
    contactPoint: [{ '@type': 'ContactPoint', telephone: SITE.phone, contactType: 'customer service', areaServed: 'SA', availableLanguage: ['ar', 'en'] }],
    sameAs: SITE.sameAs,
    knowsAbout: lang === 'ar'
      ? ['تصليح الأحذية', 'ترميم الحقائب الجلدية', 'إصلاح شنط السفر', 'إصلاح البسطار العسكري', 'تلميع وتلوين الجلود', 'ترميم حقائب الماركات الفاخرة', ...SITE.brands]
      : ['Shoe repair', 'Leather bag restoration', 'Travel bag and suitcase repair', 'Military boots repair', 'Leather polishing and dyeing', 'Luxury handbag restoration', ...SITE_EN.brands],
    hasOfferCatalog: { '@type': 'OfferCatalog', name: lang === 'ar' ? 'خدمات تصليح الأحذية والحقائب' : 'Shoe and bag repair services',
      itemListElement: T.services.map((s) => ({ '@type': 'Offer', itemOffered: { '@type': 'Service', name: s.name, description: s.desc, areaServed: lang === 'ar' ? 'الرياض' : 'Riyadh', provider: { '@id': BUSINESS_ID } } })) },
  };
}
const websiteNode = (lang) => ({ '@type': 'WebSite', '@id': `${SITE.url}/#website`, url: SITE.url + '/', name: SITE.nameAr, alternateName: SITE.nameEn, inLanguage: ['ar', 'en'], publisher: { '@id': BUSINESS_ID } });
const faqNode = (lang, items, id) => ({ '@type': 'FAQPage', '@id': id, inLanguage: lang, mainEntity: items.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) });
function graphFor(page, lang) {
  const url = urlOf(page.path, lang), T = S[lang];
  const crumbs = [{ '@type': 'ListItem', position: 1, name: T.home, item: urlOf('/', lang) }];
  if (page.path === '/') return { '@context': 'https://schema.org', '@graph': [businessNode(lang), websiteNode(lang), faqNode(lang, T.faq, `${url}#faq`)] };
  const meta = page[lang];
  const title = meta.title.split('|')[0].trim();
  crumbs.push({ '@type': 'ListItem', position: 2, name: page.kind === 'service' ? page.svc[lang].name : title, item: url });
  const webType = page.path === '/about' ? 'AboutPage' : page.path === '/shop' ? 'CollectionPage' : 'WebPage';
  const nodes = [{ '@type': webType, '@id': `${url}#webpage`, url, name: meta.title, description: meta.description, inLanguage: lang, isPartOf: { '@id': `${SITE.url}/#website` }, about: { '@id': BUSINESS_ID } },
    { '@type': 'BreadcrumbList', itemListElement: crumbs }, { '@type': 'LocalBusiness', '@id': BUSINESS_ID, name: SITE.nameAr, url: SITE.url + '/' }];
  if (page.kind === 'area') {
    const c = areaContent(page.area.slug, lang);
    crumbs.length = 1;
    if (c.parent) crumbs.push({ '@type': 'ListItem', position: 2, name: c.parent.name, item: SITE.url + c.parent.href });
    crumbs.push({ '@type': 'ListItem', position: crumbs.length + 1, name: c.name, item: url });
    nodes[1] = { '@type': 'BreadcrumbList', itemListElement: crumbs };
    nodes.push({ '@type': 'Service', '@id': `${url}#service`, name: c.h1, description: c.description, serviceType: lang === 'ar' ? 'تصليح وترميم الأحذية والحقائب الجلدية' : 'Shoe and leather bag repair', inLanguage: lang,
      areaServed: c.kind === 'country' ? { '@type': 'Country', name: lang === 'ar' ? 'المملكة العربية السعودية' : 'Saudi Arabia' }
        : { '@type': 'Place', name: lang === 'ar' ? `${c.name}، الرياض` : `${c.name}, Riyadh`, containedInPlace: { '@type': 'City', name: lang === 'ar' ? 'الرياض' : 'Riyadh' } },
      provider: { '@id': BUSINESS_ID }, url });
    nodes.push(faqNode(lang, c.faq, `${url}#faq`));
  }
  if (page.kind === 'service') {
    const c = page.svc[lang];
    nodes.push({ '@type': 'Service', '@id': `${url}#service`, name: c.h1, description: c.description, serviceType: c.name, inLanguage: lang,
      areaServed: { '@type': 'City', name: lang === 'ar' ? 'الرياض' : 'Riyadh' }, provider: { '@id': BUSINESS_ID }, url });
    nodes.push(faqNode(lang, c.faq, `${url}#faq`));
  }
  return { '@context': 'https://schema.org', '@graph': nodes };
}

// ───────────── المحتوى الثابت ─────────────
const faqHtml = (lang) => `<h2>${S[lang].faq_h}</h2>${S[lang].faq.map((f) => `<h3>${esc(f.q)}</h3><p>${esc(f.a)}</p>`).join('')}`;
function contactHtml(lang) {
  const b = SITE.branch, T = S[lang];
  return `<h2>${T.contact_h}</h2><p>${esc(T.name)} — ${esc(T.branch)}, ${esc(T.street)}, ${esc(T.loc)}.</p>` +
    `<p>${T.phone_l}: <a href="tel:${SITE.phone}">0549678191</a> — <a href="${b.mapsUrl}">${T.map_l}</a></p>` +
    `<p>${SITE.sameAs.map((u) => `<a href="${u}">${esc(u.replace(/^https?:\/\/(www\.)?/, ''))}</a>`).join(' · ')}</p>`;
}
const navHtml = (lang) => `<nav>${S[lang].nav.map(([p, l]) => `<a href="${pathOf(p, lang)}">${esc(l)}</a>`).join(' · ')}</nav>` +
  `<p><a href="${pathOf('/areas/riyadh', lang)}">${lang === 'ar' ? 'مناطق الخدمة في الرياض' : 'Riyadh service areas'}</a> · <a href="${pathOf('/areas/saudi-arabia', lang)}">${lang === 'ar' ? 'الشحن من أنحاء السعودية' : 'Shipping across Saudi Arabia'}</a></p>` +
  `<p>${REG.filter((r) => r.kind === 'service').map((r) => `<a href="${pathOf(r.path, lang)}">${esc(r.svc[lang].name)}</a>`).join(' · ')}</p>` +
  `<p><a href="${urlOf('/', lang === 'ar' ? 'en' : 'ar')}" hreflang="${lang === 'ar' ? 'en' : 'ar'}" lang="${lang === 'ar' ? 'en' : 'ar'}">${lang === 'ar' ? 'English' : 'العربية'}</a></p>`;

function bodyFor(page, lang) {
  const tr = translations[lang], T = S[lang], h = (t) => `<h1>${esc(t)}</h1>`;
  const sp = tr.shippingPolicy, pv = tr.privacyPolicy, st = tr.home.track?.status || {}, ar = lang === 'ar';
  const steps = (arr) => `<ol>${arr.map((s) => `<li><strong>${esc(s.t || s.title)}:</strong> ${esc(s.d || s.desc)}</li>`).join('')}</ol>`;
  let inner;
  if (page.kind === 'area') {
    const c = areaContent(page.area.slug, lang), link = (x) => `<a href="${x.href}">${esc(x.name)}</a>`;
    inner = h(c.h1) + `<p>${esc(c.intro)}</p><p>${esc(c.fees)} ${ar ? 'ساعات العمل' : 'Working hours'}: ${esc(c.hours)}.</p>`;
    if (c.kind === 'city') inner += c.sectors.map((s) => `<h2>${link(s)}</h2><p>${s.districts.map(link).join(' · ')}</p>`).join('');
    if (c.kind === 'sector') inner += `<h2>${ar ? 'الأحياء' : 'Districts'}</h2><p>${c.districts.map(link).join(' · ')}</p>`;
    if (c.kind === 'district') inner += `<p>${ar ? 'ضمن' : 'Part of'} ${link(c.parent)}.</p>` + (c.near.length ? `<h2>${ar ? 'أحياء قريبة' : 'Nearby districts'}</h2><p>${c.near.map(link).join(' · ')}</p>` : '');
    if (c.kind === 'country') inner += `<h2>${ar ? 'خطوات الإرسال من خارج الرياض' : 'How to send items from outside Riyadh'}</h2><ol>${c.steps.map((x) => `<li>${esc(x)}</li>`).join('')}</ol><p>${c.cities.map(esc).join(ar ? '، ' : ', ')}.</p>`;
    inner += `<h2>${ar ? 'خدماتنا' : 'Our services'}</h2><ul>${c.services.map((x) => `<li>${link(x)}</li>`).join('')}</ul>` +
      (['city', 'country'].includes(c.kind) ? `<h2>${esc(tr.home.services.howItWorksTitle)}</h2>${steps(tr.home.services.steps)}` : '') +
      `<h2>${ar ? 'أسئلة شائعة' : 'FAQ'}</h2>${c.faq.map((f) => `<h3>${esc(f.q)}</h3><p>${esc(f.a)}</p>`).join('')}` +
      `<p><a href="${pathOf('/book', lang)}">${ar ? 'احجز موعدك' : 'Book your repair'}</a></p>` + contactHtml(lang);
  } else if (page.kind === 'service') {
    const c = page.svc[lang], others = SERVICE_PAGES.filter((s) => s.slug !== page.svc.slug);
    inner = h(c.h1) + `<p>${esc(c.intro)}</p><h2>${T.covers_h}</h2>${li(c.covers)}<p>${esc(c.extra)}</p>` +
      `<h2>${esc(tr.home.services.howItWorksTitle)}</h2>${steps(tr.home.services.steps)}` +
      `<h2>${ar ? 'أسئلة شائعة' : 'FAQ'}</h2>${c.faq.map((f) => `<h3>${esc(f.q)}</h3><p>${esc(f.a)}</p>`).join('')}` +
      `<p><a href="${pathOf('/book', lang)}">${ar ? 'احجز موعدك' : 'Book your repair'}</a></p>` +
      `<h2>${T.other_h}</h2><ul>${others.map((s) => `<li><a href="${pathOf('/services/' + s.slug, lang)}">${esc(s[lang].name)}</a></li>`).join('')}</ul>` + contactHtml(lang);
  } else if (page.path === '/') {
    inner = h(T.h1home) + `<p>${esc(tr.home.hero.desc)}</p><p>${esc(tr.home.hero.seoSubtitle)}.</p>` +
      `<h2>${T.services_h}</h2><ul>${T.services.map((s) => `<li><strong>${esc(s.name)}</strong> — ${esc(s.desc)}</li>`).join('')}</ul>` +
      `<ul>${SERVICE_PAGES.map((s) => `<li><a href="${pathOf('/services/' + s.slug, lang)}">${esc(s[lang].h1)}</a></li>`).join('')}</ul>` +
      `<h2>${esc(tr.home.services.howItWorksTitle)}</h2>${steps(tr.home.services.steps)}` +
      `<h2>${T.brands_h}</h2><p>${T.brands.map(esc).join(ar ? '، ' : ', ')}.</p>` + faqHtml(lang) + contactHtml(lang);
  } else if (page.path === '/repair-policy') {
    inner = h(tr.repairPolicy.title && ar ? 'سياسة الإصلاح والضمان' : 'Repair & Warranty Policy') + tr.repairPolicy.sections.map((s) =>
      `<h2>${esc(s.title)}</h2>` + (s.items ? li(s.items) : '') + (s.durations ? li(s.durations.map((d) => `${d.type}: ${d.time}`)) : '') +
      (s.note ? `<p>${esc(s.note)}</p>` : '') + (s.methods ? `<p>${ar ? 'طرق الدفع' : 'Payment methods'}: ${s.methods.map(esc).join(ar ? '، ' : ', ')}.</p>` : '')).join('');
  } else if (page.path === '/about') {
    inner = h(ar ? 'من نحن — إبرة وخيط الإسكافي' : 'About Us — Ebra & Khait Cobbler') + `<p>${esc(tr.about.heroDesc)}</p>` + tr.about.storyParas.map((p) => `<p>${esc(p)}</p>`).join('') +
      `<h2>${esc(tr.about.valuesTitle)}</h2><ul>${tr.about.values.map((v) => `<li><strong>${esc(v.title)}:</strong> ${esc(v.desc)}</li>`).join('')}</ul>` + contactHtml(lang);
  } else if (page.path === '/shipping-policy') {
    inner = h(sp.title) + `<p>${esc(sp.subtitle)}</p><h2>${ar ? 'خطوات الخدمة' : 'How it works'}</h2>${steps(sp.steps)}` +
      `<h2>${esc(sp.coverageTitle)}</h2><p><strong>${esc(sp.coverageInside)}</strong> ${esc(sp.coverageInsideDesc)}</p><p><strong>${esc(sp.coverageOutside)}</strong> ${esc(sp.coverageOutsideDesc)}</p>` +
      `<h2>${esc(sp.timesTitle)}</h2><ul><li><strong>${esc(sp.workDays)}</strong> ${esc(sp.workDaysDesc)}</li><li><strong>${esc(sp.responseTime)}</strong> ${esc(sp.responseTimeDesc)}</li><li><strong>${esc(sp.completionTime)}</strong> ${esc(sp.completionTimeDesc)}</li></ul>` +
      `<h2>${esc(sp.feesTitle)}</h2>${li(sp.fees.map((f) => `${f.zone}: ${f.price}`))}<h2>${esc(sp.trackTitle)}</h2><p>${esc(sp.trackDesc)}</p>${li(sp.trackItems)}` + contactHtml(lang);
  } else if (page.path === '/privacy') {
    inner = h(pv.title) + (pv.lastUpdate ? `<p>${esc(pv.lastUpdate)}</p>` : '') + pv.sections.map((s) => `<h2>${esc(s.title)}</h2>` + (s.body || []).map((b) => `<p>${esc(b)}</p>`).join('') +
      (s.intro ? `<p>${esc(s.intro)}</p>` : '') + (s.items ? li(s.items) : '') + (s.intro2 ? `<p>${esc(s.intro2)}</p>` : '') + (s.items2 ? li(s.items2) : '')).join('') + contactHtml(lang);
  } else if (page.path === '/shop') {
    inner = h(ar ? 'متجر إبرة وخيط — مستلزمات العناية بالأحذية والحقائب' : "Cobbler's Shop — Shoe & Bag Care Supplies") + `<p>${esc(tr.shop.subtitle)}.</p>` +
      `<h2>${ar ? 'أقسام المتجر' : 'Shop categories'}</h2>${li(tr.shop.categories.filter((c) => c.key !== 'all').map((c) => c.label))}` +
      `<p>${ar ? 'الطلب يتم عبر السلة ثم واتساب، والتوصيل داخل الرياض (مجاني للطلبات فوق 200 ريال).' : 'Order through the cart and WhatsApp; delivery in Riyadh is free for orders above SAR 200.'} ${esc(tr.shop.needSomethingElse)}.</p>` + contactHtml(lang);
  } else if (page.path === '/book') {
    inner = h(ar ? 'احجز موعد تصليح حذاء أو حقيبة في الرياض' : 'Book a shoe or bag repair in Riyadh') +
      `<p>${ar ? 'اختر الخدمة والتاريخ ونوع الخدمة (استلام من موقعك أو زيارة الفرع)، ونؤكد معك التفاصيل.' : 'Choose the service, date and service type (pickup from your location or branch visit) and we confirm the details with you.'}</p>` +
      `<h2>${T.services_h}</h2><ul>${T.services.map((s) => `<li><strong>${esc(s.name)}</strong> — ${esc(s.desc)}</li>`).join('')}</ul><h2>${esc(tr.home.services.howItWorksTitle)}</h2>${steps(tr.home.services.steps)}` +
      `<p>${ar ? 'الأسعار تبدأ من 80 ريال لترميم الأحذية و150 ريال لتجديد الحقائب و50 ريال للتلميع والتلوين، والسعر النهائي بعد فحص القطعة وبموافقتك.' : 'Prices start from SAR 80 for shoe restoration, SAR 150 for bag renewal and SAR 50 for polishing and recoloring; the final price follows inspection and your approval.'}</p>` + contactHtml(lang);
  } else if (page.path === '/auction') {
    inner = h(ar ? 'سوق المزاد — قطع جلدية مجدّدة للمزايدة' : 'Auction Market — Restored Leather Pieces') +
      `<p>${ar ? 'نعرض حقائب وأحذية جلدية رمّمناها وجدّدناها بأيدي حرفيينا للمزايدة المباشرة. لكل مزاد عدّاد تنازلي لوقت الانتهاء، وأقل مزايدة مسموحة تظهر على كل قطعة.' : 'Leather bags and shoes restored by our craftsmen are open for live bidding. Each auction has a countdown to its end time and shows the minimum allowed bid.'}</p>` +
      `<h2>${ar ? 'كيف تشارك؟' : 'How to bid'}</h2><ol>${(ar ? ['اختر القطعة وتصفّح حالتها وصورها قبل وبعد الترميم.', 'اضغط «زايد الآن» وأدخل اسمك وجوالك ومبلغ المزايدة.', 'صاحب أعلى مزايدة عند انتهاء المزاد يفوز بالقطعة.'] : ['Pick a piece and view its before/after restoration photos.', 'Press “Bid now” and enter your name, phone and bid amount.', 'The highest bidder when the auction ends wins the piece.']).map((x) => `<li>${x}</li>`).join('')}</ol>` +
      `<h2>${ar ? 'اعرض قطعتك للبيع' : 'Sell your piece'}</h2><p>${ar ? 'ترسل قطعتك عبر زر «بيع قطعتك»، وفريقنا يراجعها ويتواصل معك لتحديد سعر البداية ووقت الانتهاء قبل نشرها.' : 'Submit your piece with the “Sell your piece” button; our team reviews it and contacts you to set the starting price and end time before publishing.'}</p>` +
      `<h2>${T.brands_h}</h2><p>${T.brands.map(esc).join(ar ? '، ' : ', ')}.</p>` + contactHtml(lang);
  } else if (page.path === '/track') {
    const stages = ['pending', 'in_progress', 'ready', 'completed'].map((k) => st[k]).filter(Boolean);
    inner = h(ar ? 'أين قطعتك الآن؟ تتبّع طلب التصليح' : 'Where is your item now? Track your repair') +
      `<p>${ar ? 'أدخل رقم الطلب (المكتوب على الفاتورة) أو رقم جوالك لتعرف مرحلة تصليح حذائك أو حقيبتك لحظة بلحظة.' : 'Enter your order number (printed on the invoice) or your phone number to see each stage of your shoe or bag repair.'}</p>` +
      (stages.length ? `<h2>${ar ? 'مراحل الطلب' : 'Order stages'}</h2><ol>${stages.map((x) => `<li>${esc(x)}</li>`).join('')}</ol>` : '') + contactHtml(lang);
  } else if (page.path === '/reviews') {
    inner = h(ar ? 'آراء عملاء إبرة وخيط الإسكافي' : 'Ebra & Khait Cobbler Customer Reviews') + `<p>${esc(tr.reviews.subtitle)}.</p>` + contactHtml(lang);
  } else if (page.path === '/careers') {
    inner = h(ar ? 'وظائف إبرة وخيط الإسكافي' : 'Careers at Ebra & Khait Cobbler') +
      `<p>${ar ? 'نبحث عن حرفيين وفنيين متخصصين في إصلاح الأحذية والحقائب الجلدية للانضمام لفريقنا في الرياض. تصفّح الوظائف المتاحة وقدّم مباشرة من الصفحة.' : 'We are looking for skilled craftsmen and technicians in shoe and leather bag repair to join our team in Riyadh. Browse open positions and apply directly on the page.'}</p>` + contactHtml(lang);
  } else {
    inner = h(page[lang].title.split('|')[0].trim()) + `<p>${esc(page[lang].description)}</p>` + contactHtml(lang);
  }
  return `<main id="seo-static" dir="${T.dir}" lang="${lang}" style="max-width:760px;margin:0 auto;padding:32px 20px;font-family:Almarai,Tahoma,Arial,sans-serif;line-height:1.9;color:#2a170b;background:#f6efe4">${inner}${navHtml(lang)}</main>`;
}

// ───────────── توليد صفحة من القالب ─────────────
function render(template, page, lang) {
  const url = urlOf(page.path, lang), meta = page[lang], T = S[lang];
  const short = meta.title.split('|')[0].trim();
  let h = template;
  h = h.replace(/<html lang="[^"]*" dir="[^"]*">/, () => `<html lang="${lang}" dir="${T.dir}">`);
  h = h.replace(/<title>[\s\S]*?<\/title>/, () => `<title>${esc(meta.title)}</title>`);
  h = h.replace(/<meta name="description" content="[^"]*"\s*\/?>/, () => `<meta name="description" content="${esc(meta.description)}" />`);
  h = h.replace(/<link rel="canonical" href="[^"]*"\s*\/?>/, () => `<link rel="canonical" href="${url}" />`);
  h = h.replace(/\s*<link rel="alternate" hreflang="[^"]*" href="[^"]*"\s*\/?>/g, '');
  const alt = `\n    <link rel="alternate" hreflang="ar" href="${urlOf(page.path, 'ar')}" />\n    <link rel="alternate" hreflang="en" href="${urlOf(page.path, 'en')}" />\n    <link rel="alternate" hreflang="x-default" href="${urlOf(page.path, 'ar')}" />`;
  h = h.replace('</title>', () => `</title>${alt}`);
  const setMeta = (attr, key, val) => { h = h.replace(new RegExp(`<meta ${attr}="${key}" content="[^"]*"\\s*\\/?>`), () => `<meta ${attr}="${key}" content="${esc(val)}" />`); };
  setMeta('property', 'og:url', url); setMeta('property', 'og:title', short + ' | ' + T.name); setMeta('property', 'og:description', meta.description);
  setMeta('property', 'og:locale', T.locale);
  setMeta('name', 'twitter:url', url); setMeta('name', 'twitter:title', short + ' | ' + T.name); setMeta('name', 'twitter:description', meta.description);
  h = h.replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/, () => jsonLd(graphFor(page, lang)));
  const verif = [SITE.gscVerification && `<meta name="google-site-verification" content="${esc(SITE.gscVerification)}" />`,
    SITE.bingVerification && `<meta name="msvalidate.01" content="${esc(SITE.bingVerification)}" />`].filter(Boolean).join('\n    ');
  if (verif) h = h.replace('</head>', () => `    ${verif}\n  </head>`);
  h = h.replace('<div id="root"></div>', () => `<div id="root">${bodyFor(page, lang)}</div>`);
  return h;
}

// ───────────── sitemap / llms ─────────────
function sitemap() {
  const rows = [];
  for (const p of REG) for (const lang of LANGS) {
    rows.push(`  <url>\n    <loc>${urlOf(p.path, lang)}</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>${p.changefreq}</changefreq>\n    <priority>${p.priority}</priority>\n` +
      `    <xhtml:link rel="alternate" hreflang="ar" href="${urlOf(p.path, 'ar')}"/>\n    <xhtml:link rel="alternate" hreflang="en" href="${urlOf(p.path, 'en')}"/>\n    <xhtml:link rel="alternate" hreflang="x-default" href="${urlOf(p.path, 'ar')}"/>\n  </url>`);
  }
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${rows.join('\n')}\n</urlset>\n`;
}
function llmsTxt() {
  const b = SITE.branch;
  return `# ${SITE.nameAr} (${SITE.nameEn})

> ${SITE.slogan}. ورشة سعودية بدأت عام ${SITE.founded}، تصلح وترمم الأحذية والحقائب الجلدية الفاخرة (هيرمس، لويس فيتون LV، شانيل وغيرها) وشنط السفر والمدرسية والأحذية الرياضية والبسطار العسكري، مع استلام من موقع العميل داخل الرياض وضمان 30 يوماً على الإصلاح.
> ${SITE_EN.description} Pickup from your location in Riyadh, 30-day repair guarantee, live order tracking.

## الخدمات / Services
${REG.filter((r) => r.kind === 'service').map((r) => `- [${r.svc.ar.name}](${urlOf(r.path, 'ar')}) · [${r.svc.en.name}](${urlOf(r.path, 'en')})`).join('\n')}

## الحقائق السريعة / Quick facts
- الموقع / Location: ${b.nameAr} (${SITE_EN.branchName}), ${b.street}, ${b.locality}, السعودية / Saudi Arabia — ${b.mapsUrl}
- الهاتف / واتساب · Phone / WhatsApp: 0549678191 (${SITE.phone})
- الضمان / Guarantee: 30 يوماً / 30 days on repair work
- مدة التنفيذ / Turnaround: تلميع 1–2 يوم · ترميم بسيط 3–5 أيام · ترميم شامل 7–14 يوماً (المستعجل برسوم إضافية) · polishing 1–2 days · simple restoration 3–5 days · full restoration 7–14 days
- الدفع / Payment: نقداً، تحويل بنكي، Apple Pay، مدى · cash, bank transfer, Apple Pay, Mada
- الأسعار تبدأ من / Prices start from: ترميم الأحذية 80 ريال · تجديد الحقائب 150 ريال · التلميع والتلوين 50 ريال (السعر النهائي بعد الفحص / final price after inspection)
- التوصيل / Delivery: مجاني داخل الرياض فوق 200 ريال، 30 ريال دونها · free in Riyadh above SAR 200, SAR 30 below

## التغطية الجغرافية / Coverage
- الرياض (كل الأحياء بالاستلام والتوصيل) / Riyadh, all districts with pickup and delivery: ${urlOf('/areas/riyadh', 'ar')} · ${urlOf('/areas/riyadh', 'en')}
- الجهات / Sectors: ${SECTORS.map((s) => `[${s.ar}](${urlOf('/areas/' + s.slug, 'ar')})`).join('، ')}
- أحياء / Districts: ${DISTRICTS.map((d) => d.ar).join('، ')} (${DISTRICTS.map((d) => d.en).join(', ')})
- السعودية (من خارج الرياض بالشحن عبر أرامكس) / Saudi Arabia by courier: ${urlOf('/areas/saudi-arabia', 'ar')} · ${urlOf('/areas/saudi-arabia', 'en')}

## صفحات مهمة / Key pages
${REG.filter((r) => r.kind === 'page' && ['/', '/book', '/repair-policy', '/about', '/shop', '/auction', '/track', '/reviews', '/shipping-policy'].includes(r.path)).map((r) => `- [${r.ar.title.split('|')[0].trim()}](${urlOf(r.path, 'ar')}) · [EN](${urlOf(r.path, 'en')})`).join('\n')}

## Optional
- [llms-full.txt](${SITE.url}/llms-full.txt): النسخة الموسّعة (سياسة الإصلاح والأسئلة الشائعة بالعربية والإنجليزية)
`;
}
function llmsFull() {
  const ar = translations.ar;
  const pol = ar.repairPolicy.sections.map((s) => `### ${s.title}\n` + [...(s.items || []).map((i) => `- ${i}`), ...(s.durations || []).map((d) => `- ${d.type}: ${d.time}`), ...(s.note ? [`- ${s.note}`] : []), ...(s.methods ? [`- طرق الدفع: ${s.methods.join('، ')}`] : [])].join('\n')).join('\n\n');
  const svc = SERVICE_PAGES.map((s) => `### ${s.ar.name} / ${s.en.name}\n${s.ar.intro}\n${s.en.intro}\nيشمل / Covers: ${s.ar.covers.join('، ')} | ${s.en.covers.join(', ')}`).join('\n\n');
  return `${llmsTxt().split('## Optional')[0]}
## تفاصيل الخدمات / Service details
${svc}

## سياسة الإصلاح والضمان
${pol}

## الأسئلة الشائعة
${FAQ.ar.map((f) => `**${f.q}**\n${f.a}`).join('\n\n')}

## FAQ (English)
${FAQ.en.map((f) => `**${f.q}**\n${f.a}`).join('\n\n')}
`;
}

// ───────────── IndexNow: إخطار Bing/Yandex فور النشر ─────────────
// جوجل ما يدعم IndexNow (يحتاج Search Console)، لكن Bing هو اللي يغذّي بحث
// ChatGPT وCopilot وجزءاً من DuckDuckGo/Yahoo. يشتغل فقط ببناء الإنتاج على
// Vercel، وبأقصى مهلة 8 ثواني، وأي فشل يُتجاهل (لا يؤثر على النشر أبداً).
async function pingIndexNow() {
  if (process.env.VERCEL_ENV !== 'production' || !SITE.indexNowKey) { console.log('[seo-build] IndexNow: تخطّي (ليس بناء إنتاج)'); return; }
  const urlList = REG.flatMap((p) => LANGS.map((l) => urlOf(p.path, l)));
  const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await fetch('https://api.indexnow.org/indexnow', {
      method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' }, signal: ctrl.signal,
      body: JSON.stringify({ host: new URL(SITE.url).host, key: SITE.indexNowKey, keyLocation: `${SITE.url}/${SITE.indexNowKey}.txt`, urlList }),
    });
    console.log(`[seo-build] IndexNow: أُرسل ${urlList.length} رابط → HTTP ${res.status}`);
  } catch (e) { console.warn('[seo-build] IndexNow فشل (تم تجاهله):', e.message); } finally { clearTimeout(t); }
}

// ───────────── التنفيذ (آمن: لا يفشّل البناء) ─────────────
function main() {
  const tplPath = path.join(DIST, 'index.html');
  if (!fs.existsSync(tplPath)) { console.warn('[seo-build] dist/index.html غير موجود — تخطّي'); return; }
  const template = fs.readFileSync(tplPath, 'utf8');
  const pending = [];
  for (const page of REG) for (const lang of LANGS) {
    const rel = pathOf(page.path, lang);
    const out = rel === '/' ? tplPath : path.join(DIST, rel, 'index.html');
    const html = render(template, page, lang);
    if (!html.includes('id="seo-static"')) throw new Error('فشل حقن المحتوى: ' + rel);
    pending.push([out, html]);
  }
  // الكتابة بعد نجاح توليد كل الصفحات (الصفحة الرئيسية هي القالب نفسه — تُكتب آخراً)
  pending.sort((a) => (a[0] === tplPath ? 1 : -1));
  for (const [out, html] of pending) { fs.mkdirSync(path.dirname(out), { recursive: true }); fs.writeFileSync(out, html); }
  fs.writeFileSync(path.join(DIST, 'sitemap.xml'), sitemap());
  fs.writeFileSync(path.join(DIST, 'llms.txt'), llmsTxt());
  fs.writeFileSync(path.join(DIST, 'llms-full.txt'), llmsFull());
  console.log(`[seo-build] ✓ ${pending.length} صفحة (${REG.length} × ${LANGS.length} لغة) + sitemap.xml + llms.txt + llms-full.txt`);
}
try { main(); await pingIndexNow(); } catch (e) { console.warn('[seo-build] تم التخطّي بسبب خطأ (البناء لم يتأثر):', e.message); }
