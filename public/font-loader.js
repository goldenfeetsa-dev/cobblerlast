// تفعيل خط Tajawal بعد تحميله بدون إيقاف عرض الصفحة — بديل عن onload
// المضمّن بالسمة (inline attribute) عشان نقدر نطبّق CSP صارمة على
// script-src بدون الحاجة لـ 'unsafe-inline'.
document.querySelectorAll('link[rel="preload"][as="style"][data-font-swap]').forEach((link) => {
  const stylesheet = document.createElement('link');
  stylesheet.rel = 'stylesheet';
  stylesheet.href = link.href;
  link.after(stylesheet);
});
