import React from 'react';
import { Link } from 'react-router-dom';

export const INK = '#ece8df';
export const HAIR = 'rgba(255,255,255,0.1)';
export const SITE = 'https://www.needlecobbler.com';

export const EMP = {
  ar: { full_time: 'دوام كامل', part_time: 'دوام جزئي', contract: 'عقد مؤقت' },
  en: { full_time: 'Full-time', part_time: 'Part-time', contract: 'Contract' },
};
export const SCHEMA_EMP = { full_time: 'FULL_TIME', part_time: 'PART_TIME', contract: 'CONTRACTOR' };

export const ABOUT = {
  ar: {
    h: 'عن إبرة وخيط الإسكافي',
    p: 'ورشة سعودية في الرياض متخصصة في ترميم وإصلاح الأحذية والحقائب الجلدية الفاخرة. نعمل بأيدي حرفيين يجمعون بين إتقان الصنعة التقليدية ومعايير جودة صارمة، ونتعامل مع قطع تحمل قيمة وذكرى لأصحابها. نبحث عن أشخاص يشاركوننا الشغف بالتفاصيل والاحترام للصنعة.',
    values: ['إتقان الحرفة', 'الأمانة مع كل قطعة', 'الالتزام بالمواعيد', 'تطوير مستمر للمهارات'],
  },
  en: {
    h: 'About Ebra & Khait Cobbler',
    p: 'A Saudi workshop in Riyadh specialising in the restoration and repair of luxury leather shoes and handbags. Our craftsmen combine traditional skill with strict quality standards, caring for pieces that carry real value and memories for their owners. We look for people who share our passion for detail and respect for the craft.',
    values: ['Mastery of the craft', 'Trust with every piece', 'Punctual delivery', 'Continuous skill growth'],
  },
};

export const jobTitle = (j, isAr) => (isAr ? j.title : j.title_en || j.title);
export const jobTasks = (j, isAr) => String((isAr ? j.description : j.description_en || j.description) || '').split('\n').map((s) => s.trim()).filter(Boolean);

export function LogoBar({ isAr, prefix }) {
  return (
    <header className="flex items-center justify-between max-w-5xl mx-auto px-5 h-16">
      <Link to={prefix || '/'} className="text-sm" style={{ color: '#bdb8ad' }}>{isAr ? '← الرئيسية' : '← Home'}</Link>
      <img src="/images/cobblers-official-mark-white.png" alt="Ebra & Khait Cobbler — إبرة وخيط الإسكافي" className="h-9 w-auto" />
      <Link to={isAr ? '/en/careers' : '/careers'} className="text-sm" style={{ color: '#bdb8ad' }} hrefLang={isAr ? 'en' : 'ar'}>{isAr ? 'English' : 'العربية'}</Link>
    </header>
  );
}
