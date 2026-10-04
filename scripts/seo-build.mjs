/**
 * scripts/seo-build.mjs — يشتغل بعد `vite build` (انظر package.json)
 * ─────────────────────────────────────────────────────────────────
 * المشكلة: الموقع SPA — كل رابط يرجّع نفس index.html (نفس العنوان والوصف
 * والـcanonical للصفحة الرئيسية) والمحتوى يظهر بعد تشغيل JavaScript. زواحف
 * الذكاء الاصطناعي (GPTBot, ClaudeBot, PerplexityBot...) ومعاينات المشاركة
 * ما تشغّل JavaScript، فكانت ترى كل الصفحات كأنها الصفحة الرئيسية.
 *
 * الحل (بدون تغيير بنية الموقع): لكل صفحة عامة نولّد dist/<route>/index.html
 * فيه: عنوان/وصف/canonical/OG خاص بالصفحة + JSON-LD (LocalBusiness, FAQPage,
 * BreadcrumbList...) + محتوى نصي دلالي داخل #root (يستبدله React عند التشغيل).
 * كما نولّد sitemap.xml (بتواريخ حقيقية) + llms.txt + llms-full.txt.
 *
 * أمان النشر: هذا السكربت لا يفشّل البناء أبداً — أي خطأ يُسجَّل ويُتجاوَز،
 * فيبقى الموقع كما كان (نفس درس تعطّل النشر سابقاً بسبب تجاوز حدود Vercel).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SITE, FAQ, PAGES } from '../src/lib/seo/siteData.js';
import { translations } from '../src/lib/i18n/translations.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
const ar = translations.ar;
const today = new Date().toISOString().slice(0, 10);

const esc = (s = '') => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const jsonLd = (obj) => `<script type="application/ld+json">${JSON.stringify(obj).replace(/</g, '\\u003c')}</script>`;
const urlOf = (p) => (p === '/' ? SITE.url + '/' : SITE.url + p);

// ───────────── JSON-LD ─────────────
const BUSINESS_ID = `${SITE.url}/#business`;
function businessNode() {
  const b = SITE.branch;
  return {
    '@type': 'LocalBusiness',
    '@id': BUSINESS_ID,
    name: SITE.nameAr,
    alternateName: [SITE.nameEn, 'Cobblers'],
    description: 'ورشة سعودية في الرياض متخصصة في تصليح وترميم وتجديد الأحذية والحقائب الجلدية الفاخرة والبسطار العسكري.',
    url: SITE.url + '/',
    logo: SITE.logo,
    image: [SITE.image],
    telephone: SITE.phone,
    foundingDate: SITE.founded,
    priceRange: '$$',
    address: { '@type': 'PostalAddress', streetAddress: b.street, addressLocality: b.locality, addressRegion: b.region, addressCountry: b.country },
    geo: { '@type': 'GeoCoordinates', latitude: b.lat, longitude: b.lng },
    hasMap: b.mapsUrl,
    areaServed: { '@type': 'City', name: 'الرياض' },
    openingHoursSpecification: [{ '@type': 'OpeningHoursSpecification', dayOfWeek: SITE.hours.days, opens: SITE.hours.opens, closes: SITE.hours.closes }],
    contactPoint: [{ '@type': 'ContactPoint', telephone: SITE.phone, contactType: 'customer service', areaServed: 'SA', availableLanguage: ['ar', 'en'] }],
    sameAs: SITE.sameAs,
    knowsAbout: ['تصليح الأحذية', 'ترميم الحقائب الجلدية', 'تلميع وتلوين الجلود', 'تغيير النعال', 'ترميم حقائب الماركات الفاخرة', ...SITE.brands],
    hasOfferCatalog: {
      '@type': 'OfferCatalog',
      name: 'خدمات تصليح الأحذية والحقائب',
      itemListElement: SITE.services.map((s) => ({
        '@type': 'Offer',
        itemOffered: { '@type': 'Service', name: s.name, description: s.desc, areaServed: 'الرياض', provider: { '@id': BUSINESS_ID } },
      })),
    },
  };
}
const websiteNode = () => ({ '@type': 'WebSite', '@id': `${SITE.url}/#website`, url: SITE.url + '/', name: SITE.nameAr, alternateName: SITE.nameEn, inLanguage: ['ar', 'en'], publisher: { '@id': BUSINESS_ID } });
const faqNode = () => ({
  '@type': 'FAQPage', '@id': `${SITE.url}/#faq`, inLanguage: 'ar',
  mainEntity: FAQ.ar.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
});
function graphFor(page) {
  const url = urlOf(page.path);
  if (page.path === '/') return { '@context': 'https://schema.org', '@graph': [businessNode(), websiteNode(), faqNode()] };
  const type = page.path === '/about' ? 'AboutPage' : page.path === '/shop' ? 'CollectionPage' : 'WebPage';
  return {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': type, '@id': `${url}#webpage`, url, name: page.title, description: page.description, inLanguage: 'ar', isPartOf: { '@id': `${SITE.url}/#website` }, about: { '@id': BUSINESS_ID } },
      { '@type': 'BreadcrumbList', itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'الرئيسية', item: SITE.url + '/' },
        { '@type': 'ListItem', position: 2, name: page.title.split('|')[0].trim(), item: url },
      ] },
      { '@type': 'LocalBusiness', '@id': BUSINESS_ID, name: SITE.nameAr, url: SITE.url + '/' },
    ],
  };
}

// ───────────── المحتوى الثابت (نص حقيقي من الموقع، يستبدله React) ─────────────
const li = (arr) => `<ul>${arr.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>`;
function faqHtml() {
  return `<h2>الأسئلة الشائعة</h2>${FAQ.ar.map((f) => `<h3>${esc(f.q)}</h3><p>${esc(f.a)}</p>`).join('')}`;
}
function contactHtml() {
  const b = SITE.branch;
  return `<h2>الموقع والتواصل</h2><p>${esc(SITE.nameAr)} — ${esc(b.nameAr)}، ${esc(b.street)}، ${esc(b.locality)}، المملكة العربية السعودية.</p>` +
    `<p>الهاتف / واتساب: <a href="tel:${SITE.phone}">0549678191</a> — <a href="${b.mapsUrl}">الموقع على خرائط جوجل</a></p>` +
    `<p>${SITE.sameAs.map((u) => `<a href="${u}">${esc(u.replace(/^https?:\/\/(www\.)?/, ''))}</a>`).join(' · ')}</p>`;
}
const navHtml = () => `<nav><a href="/">الرئيسية</a> · <a href="/book">احجز موعد</a> · <a href="/shop">المتجر</a> · <a href="/auction">سوق المزاد</a> · <a href="/track">تتبّع قطعتك</a> · <a href="/about">من نحن</a> · <a href="/repair-policy">سياسة الإصلاح</a> · <a href="/reviews">آراء العملاء</a></nav>`;

function bodyFor(page) {
  const h = (t) => `<h1>${esc(t)}</h1>`;
  const sp = ar.shippingPolicy, pv = ar.privacyPolicy, st = ar.home.track?.status || {};
  let inner;
  if (page.path === '/') {
    inner = h('إبرة وخيط الإسكافي — تصليح أحذية وشنط جلدية في الرياض') +
      `<p>${esc(ar.home.hero.desc)}</p><p>${esc(ar.home.hero.seoSubtitle)}.</p>` +
      `<h2>خدماتنا</h2><ul>${SITE.services.map((s) => `<li><strong>${esc(s.name)}</strong> — ${esc(s.desc)}</li>`).join('')}</ul>` +
      `<h2>${esc(ar.home.services.howItWorksTitle)}</h2><ol>${ar.home.services.steps.map((s) => `<li><strong>${esc(s.t)}:</strong> ${esc(s.d)}</li>`).join('')}</ol>` +
      `<h2>الماركات التي نتعامل معها</h2><p>${SITE.brands.map(esc).join('، ')}.</p>` +
      faqHtml() + contactHtml();
  } else if (page.path === '/repair-policy') {
    inner = h('سياسة الإصلاح والضمان') + ar.repairPolicy.sections.map((s) =>
      `<h2>${esc(s.title)}</h2>` + (s.items ? li(s.items) : '') +
      (s.durations ? li(s.durations.map((d) => `${d.type}: ${d.time}`)) : '') + (s.note ? `<p>${esc(s.note)}</p>` : '') +
      (s.methods ? `<p>طرق الدفع: ${s.methods.map(esc).join('، ')}.</p>` : '')).join('');
  } else if (page.path === '/about') {
    inner = h('من نحن — إبرة وخيط الإسكافي') + `<p>${esc(ar.about.heroDesc)}</p>` +
      ar.about.storyParas.map((p) => `<p>${esc(p)}</p>`).join('') +
      `<h2>${esc(ar.about.valuesTitle)}</h2><ul>${ar.about.values.map((v) => `<li><strong>${esc(v.title)}:</strong> ${esc(v.desc)}</li>`).join('')}</ul>` + contactHtml();
  } else if (page.path === '/shipping-policy') {
    inner = h(sp.title) + `<p>${esc(sp.subtitle)}</p>` +
      `<h2>خطوات الخدمة</h2><ol>${sp.steps.map((x) => `<li><strong>${esc(x.title)}:</strong> ${esc(x.desc)}</li>`).join('')}</ol>` +
      `<h2>${esc(sp.coverageTitle)}</h2><p><strong>${esc(sp.coverageInside)}</strong> ${esc(sp.coverageInsideDesc)}</p><p><strong>${esc(sp.coverageOutside)}</strong> ${esc(sp.coverageOutsideDesc)}</p>` +
      `<h2>${esc(sp.timesTitle)}</h2><ul><li><strong>${esc(sp.workDays)}</strong> ${esc(sp.workDaysDesc)}</li><li><strong>${esc(sp.responseTime)}</strong> ${esc(sp.responseTimeDesc)}</li><li><strong>${esc(sp.completionTime)}</strong> ${esc(sp.completionTimeDesc)}</li></ul>` +
      `<h2>${esc(sp.feesTitle)}</h2>${li(sp.fees.map((f) => `${f.zone}: ${f.price}`))}` +
      `<h2>${esc(sp.trackTitle)}</h2><p>${esc(sp.trackDesc)}</p>${li(sp.trackItems)}` + contactHtml();
  } else if (page.path === '/privacy') {
    inner = h(pv.title) + (pv.lastUpdate ? `<p>${esc(pv.lastUpdate)}</p>` : '') + pv.sections.map((s) =>
      `<h2>${esc(s.title)}</h2>` + (s.body || []).map((b) => `<p>${esc(b)}</p>`).join('') +
      (s.intro ? `<p>${esc(s.intro)}</p>` : '') + (s.items ? li(s.items) : '') +
      (s.intro2 ? `<p>${esc(s.intro2)}</p>` : '') + (s.items2 ? li(s.items2) : '')).join('') + contactHtml();
  } else if (page.path === '/shop') {
    inner = h('متجر إبرة وخيط — مستلزمات العناية بالأحذية والحقائب') + `<p>${esc(ar.shop.subtitle)}.</p>` +
      `<h2>أقسام المتجر</h2>${li(ar.shop.categories.filter((c) => c.key !== 'all').map((c) => c.label))}` +
      `<p>الطلب يتم عبر السلة ثم واتساب، والتوصيل داخل الرياض (مجاني للطلبات فوق 200 ريال). ${esc(ar.shop.needSomethingElse)}.</p>` + contactHtml();
  } else if (page.path === '/book') {
    inner = h('احجز موعد تصليح حذاء أو حقيبة في الرياض') +
      `<p>اختر الخدمة والتاريخ ونوع الخدمة (استلام من موقعك أو زيارة الفرع)، ونؤكد معك التفاصيل.</p>` +
      `<h2>خدماتنا</h2><ul>${SITE.services.map((s) => `<li><strong>${esc(s.name)}</strong> — ${esc(s.desc)}</li>`).join('')}</ul>` +
      `<h2>${esc(ar.home.services.howItWorksTitle)}</h2><ol>${ar.home.services.steps.map((s) => `<li><strong>${esc(s.t)}:</strong> ${esc(s.d)}</li>`).join('')}</ol>` +
      `<p>الأسعار تبدأ من 80 ريال لترميم الأحذية و150 ريال لتجديد الحقائب و50 ريال للتلميع والتلوين، والسعر النهائي يُحدَّد بعد فحص القطعة وبموافقتك.</p>` + contactHtml();
  } else if (page.path === '/auction') {
    inner = h('سوق المزاد — قطع جلدية مجدّدة للمزايدة') +
      `<p>نعرض حقائب وأحذية جلدية رمّمناها وجدّدناها بأيدي حرفيينا للمزايدة المباشرة. كل مزاد له عدّاد تنازلي لوقت الانتهاء، وأقل مزايدة مسموحة تظهر على كل قطعة.</p>` +
      `<h2>كيف تشارك؟</h2><ol><li>اختر القطعة وتصفّح حالتها وصورها قبل وبعد الترميم.</li><li>اضغط «زايد الآن» وأدخل اسمك وجوالك ومبلغ المزايدة.</li><li>صاحب أعلى مزايدة عند انتهاء المزاد يفوز بالقطعة.</li></ol>` +
      `<h2>اعرض قطعتك للبيع</h2><p>تقدر ترسل قطعتك عبر زر «بيع قطعتك»، وفريقنا يراجعها ويتواصل معك لتحديد سعر البداية ووقت الانتهاء قبل نشرها.</p>` +
      `<h2>تصفّح حسب الماركة</h2><p>${SITE.brands.map(esc).join('، ')}.</p>` + contactHtml();
  } else if (page.path === '/track') {
    const stages = ['pending', 'in_progress', 'ready', 'completed'].map((k) => st[k]).filter(Boolean);
    inner = h('أين قطعتك الآن؟ تتبّع طلب التصليح') +
      `<p>أدخل رقم الطلب (المكتوب على الفاتورة) أو رقم جوالك لتعرف مرحلة تصليح حذائك أو حقيبتك لحظة بلحظة.</p>` +
      (stages.length ? `<h2>مراحل الطلب</h2><ol>${stages.map((x) => `<li>${esc(x)}</li>`).join('')}</ol>` : '') +
      `<p>يمكن أيضاً متابعة الطلب عبر رسائل واتساب التلقائية عند كل مرحلة أو بالتواصل المباشر مع فريقنا.</p>` + contactHtml();
  } else if (page.path === '/reviews') {
    inner = h('آراء عملاء إبرة وخيط الإسكافي') + `<p>${esc(ar.reviews.subtitle)}.</p>` +
      `<p>عملاؤنا يشاركون تجربتهم مع تصليح الأحذية وترميم الحقائب الجلدية في الرياض. تقدر تضيف تقييمك بإدخال اسمك والخدمة ورقم طلبك.</p>` + contactHtml();
  } else if (page.path === '/careers') {
    inner = h('وظائف إبرة وخيط الإسكافي') +
      `<p>نبحث عن حرفيين وفنيين متخصصين في إصلاح الأحذية والحقائب الجلدية للانضمام لفريقنا في الرياض. تصفّح الوظائف المتاحة وقدّم مباشرة من الصفحة.</p>` +
      `<p>ورشة سعودية بدأت عام ${SITE.founded} في قلب الرياض، وتعمل مع علامات فاخرة مثل ${SITE.brands.slice(0, 3).map(esc).join('، ')}.</p>` + contactHtml();
  } else {
    inner = h(page.title.split('|')[0].trim()) + `<p>${esc(page.description)}</p>` + contactHtml();
  }
  return `<main id="seo-static" dir="rtl" lang="ar" style="max-width:760px;margin:0 auto;padding:32px 20px;font-family:Almarai,Tahoma,Arial,sans-serif;line-height:1.9;color:#2a170b;background:#f6efe4">${inner}${navHtml()}</main>`;
}

// ───────────── توليد صفحة من القالب ─────────────
function render(template, page) {
  const url = urlOf(page.path);
  const short = page.title.split('|')[0].trim();
  let h = template;
  h = h.replace(/<title>[\s\S]*?<\/title>/, () => `<title>${esc(page.title)}</title>`);
  h = h.replace(/<meta name="description" content="[^"]*"\s*\/?>/, () => `<meta name="description" content="${esc(page.description)}" />`);
  h = h.replace(/<link rel="canonical" href="[^"]*"\s*\/?>/, () => `<link rel="canonical" href="${url}" />`);
  h = h.replace(/\s*<link rel="alternate" hreflang="[^"]*" href="[^"]*"\s*\/?>/g, '');
  h = h.replace('</title>', () => `</title>\n    <link rel="alternate" hreflang="ar" href="${url}" />\n    <link rel="alternate" hreflang="x-default" href="${url}" />`);
  const setMeta = (attr, key, val) => {
    const re = new RegExp(`<meta ${attr}="${key}" content="[^"]*"\\s*\\/?>`);
    h = h.replace(re, () => `<meta ${attr}="${key}" content="${esc(val)}" />`);
  };
  setMeta('property', 'og:url', url); setMeta('property', 'og:title', short + ' | ' + SITE.nameAr);
  setMeta('property', 'og:description', page.description);
  setMeta('name', 'twitter:url', url); setMeta('name', 'twitter:title', short + ' | ' + SITE.nameAr);
  setMeta('name', 'twitter:description', page.description);
  h = h.replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/, () => jsonLd(graphFor(page)));
  const verif = [SITE.gscVerification && `<meta name="google-site-verification" content="${esc(SITE.gscVerification)}" />`,
    SITE.bingVerification && `<meta name="msvalidate.01" content="${esc(SITE.bingVerification)}" />`].filter(Boolean).join('\n    ');
  if (verif) h = h.replace('</head>', () => `    ${verif}\n  </head>`);
  h = h.replace('<div id="root"></div>', () => `<div id="root">${bodyFor(page)}</div>`);
  return h;
}

// ───────────── sitemap / llms ─────────────
function sitemap() {
  const rows = PAGES.map((p) => `  <url>\n    <loc>${urlOf(p.path)}</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>${p.changefreq}</changefreq>\n    <priority>${p.priority}</priority>\n  </url>`);
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${rows.join('\n')}\n</urlset>\n`;
}
function llmsTxt() {
  const b = SITE.branch;
  return `# ${SITE.nameAr} (${SITE.nameEn})

> ${SITE.slogan}. ورشة سعودية بدأت عام ${SITE.founded}، تصلح وترمم الأحذية والحقائب الجلدية الفاخرة (هيرمس، لويس فيتون، شانيل وغيرها) والأحذية الرياضية والبسطار العسكري، مع استلام من موقع العميل داخل الرياض وضمان 30 يوماً على الإصلاح.
> Saudi cobbler workshop in Riyadh repairing and restoring luxury leather shoes and handbags, sneakers and military boots. Pickup from your location in Riyadh, 30-day repair guarantee, live order tracking.

## الخدمات
${SITE.services.map((s) => `- ${s.name}: ${s.desc}`).join('\n')}

## الحقائق السريعة
- الموقع: ${b.nameAr}، ${b.street}، ${b.locality}، السعودية — خريطة: ${b.mapsUrl}
- الهاتف / واتساب: 0549678191 (${SITE.phone})
- الضمان: 30 يوماً من تاريخ الاستلام على أعمال الإصلاح
- مدة التنفيذ: تلميع 1–2 يوم، ترميم بسيط 3–5 أيام، ترميم شامل 7–14 يوماً (المستعجل برسوم إضافية)
- الدفع: نقداً، تحويل بنكي، Apple Pay، مدى
- الأسعار تبدأ من: ترميم الأحذية 80 ريال، تجديد الحقائب 150 ريال، التلميع والتلوين 50 ريال (السعر النهائي بعد الفحص)

## صفحات مهمة
- [الرئيسية](${SITE.url}/): الخدمات وطريقة العمل والأسئلة الشائعة
- [احجز موعد](${SITE.url}/book): حجز موعد تصليح أونلاين
- [سياسة الإصلاح والضمان](${SITE.url}/repair-policy): مدد التنفيذ والضمان والدفع
- [من نحن](${SITE.url}/about): قصة الورشة
- [المتجر](${SITE.url}/shop): منتجات العناية بالأحذية والحقائب
- [سوق المزاد](${SITE.url}/auction): قطع جلدية مجدّدة للمزايدة
- [تتبّع طلبك](${SITE.url}/track): تتبع مرحلة التصليح برقم الطلب أو الجوال
- [آراء العملاء](${SITE.url}/reviews)

## Optional
- [llms-full.txt](${SITE.url}/llms-full.txt): نسخة موسّعة (سياسة الإصلاح الكاملة والأسئلة الشائعة بالعربية والإنجليزية)
`;
}
function llmsFull() {
  const pol = ar.repairPolicy.sections.map((s) => `### ${s.title}\n` + [
    ...(s.items || []).map((i) => `- ${i}`), ...(s.durations || []).map((d) => `- ${d.type}: ${d.time}`),
    ...(s.note ? [`- ${s.note}`] : []), ...(s.methods ? [`- طرق الدفع: ${s.methods.join('، ')}`] : []),
  ].join('\n')).join('\n\n');
  return `${llmsTxt().split('## Optional')[0]}
## سياسة الإصلاح والضمان
${pol}

## الأسئلة الشائعة
${FAQ.ar.map((f) => `**${f.q}**\n${f.a}`).join('\n\n')}

## FAQ (English)
${FAQ.en.map((f) => `**${f.q}**\n${f.a}`).join('\n\n')}
`;
}

// ───────────── التنفيذ (آمن: لا يفشّل البناء) ─────────────
function main() {
  const tplPath = path.join(DIST, 'index.html');
  if (!fs.existsSync(tplPath)) { console.warn('[seo-build] dist/index.html غير موجود — تخطّي'); return; }
  const template = fs.readFileSync(tplPath, 'utf8');
  let n = 0;
  for (const page of PAGES) {
    const out = page.path === '/' ? tplPath : path.join(DIST, page.path, 'index.html');
    fs.mkdirSync(path.dirname(out), { recursive: true });
    const html = render(template, page);
    if (!html.includes('id="seo-static"')) throw new Error('فشل حقن المحتوى بصفحة ' + page.path);
    fs.writeFileSync(out, html); n++;
  }
  fs.writeFileSync(path.join(DIST, 'sitemap.xml'), sitemap());
  fs.writeFileSync(path.join(DIST, 'llms.txt'), llmsTxt());
  fs.writeFileSync(path.join(DIST, 'llms-full.txt'), llmsFull());
  console.log(`[seo-build] ✓ ${n} صفحة + sitemap.xml + llms.txt + llms-full.txt`);
}
try { main(); } catch (e) { console.warn('[seo-build] تم التخطّي بسبب خطأ (البناء لم يتأثر):', e.message); }
