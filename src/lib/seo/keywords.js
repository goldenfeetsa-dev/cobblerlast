/**
 * قائمة الكلمات المفتاحية المستهدفة (عربي + إنجليزي) — مرتبة حسب نية الباحث.
 * كل مجموعة مربوطة بصفحة هبوط تستهدفها (انظر services.js) عشان ما تتنافس
 * صفحات الموقع على نفس الكلمة. ملاحظة: بدون أحجام بحث فعلية بعد (تحتاج رصيد
 * OpenSEO) — الترتيب هنا حسب الصلة بخدماتك، مو حسب الحجم.
 */
export const KEYWORDS = {
  ar: {
    'العلامة والإسكافي (الكلمة الأساسية)': [
      'الاسكافي', 'اسكافي الرياض', 'الاسكافي بالرياض', 'اسكافي قريب مني', 'افضل اسكافي في الرياض',
      'محل اسكافي', 'اسكافي جلد', 'ورشة اسكافي', 'اسكافي حقائب واحذية', 'إبرة وخيط الإسكافي', 'ابرة وخيط', 'كوبلرز الرياض',
    ],
    'إصلاح الأحذية': [
      'اصلاح احذية', 'تصليح احذية', 'تصليح احذية الرياض', 'اصلاح احذية الرياض', 'محل تصليح احذية',
      'ترميم احذية', 'ترميم احذية جلد', 'صيانة احذية', 'تجديد احذية', 'تصليح حذاء جلد',
      'تغيير نعل حذاء', 'تغيير نعال الاحذية الرياض', 'تغيير كعب حذاء', 'تصليح كعب حذاء', 'خياطة حذاء',
      'لصق حذاء', 'غراء احذية', 'توسيع حذاء ضيق', 'تغيير بطانة حذاء', 'تغيير جلد حذاء',
      'تصليح حذاء رسمي', 'تصليح حذاء نسائي', 'تصليح جزمة جلد', 'تصليح صندل جلد',
    ],
    'تلميع وتلوين وتنظيف الجلد': [
      'تلميع احذية', 'تلوين احذية جلد', 'صبغ حذاء جلد', 'تنظيف احذية جلد', 'تنظيف احذية بالرياض',
      'تلميع شنط', 'تلوين شنط جلد', 'صبغ شنط جلد', 'تنظيف شنط جلد', 'تجديد لون الجلد',
    ],
    'الأحذية الرياضية والبسطار العسكري': [
      'اصلاح بسطار', 'تصليح بسطار عسكري', 'صيانة بسطار', 'تغيير نعل بسطار', 'خياطة بسطار',
      'تصليح بسطار الرياض', 'تلميع بسطار عسكري', 'تجديد بسطار', 'تصليح بوت جلد',
      'تصليح احذية رياضية', 'تصليح كوتشي', 'تنظيف حذاء رياضي',
    ],
    'إصلاح وصيانة الشنط والحقائب': [
      'اصلاح شنط', 'تصليح شنط الرياض', 'اصلاح شنط جلد', 'اصلاح حقائب', 'تصليح حقائب نسائية',
      'ترميم شنط جلد', 'ترميم حقائب', 'صيانة شنط', 'تجديد شنط جلد', 'تغيير سحاب شنطة',
      'تصليح سحاب حقيبة', 'تغيير سحاب كامل شنطة', 'تغيير هندل شنطة', 'تصليح يد شنطة', 'تغيير مقبض حقيبة',
      'تصليح قاعدة شنطة', 'تلبيس شنط', 'تغيير جلد شنطة', 'تصليح قفل شنطة', 'تصليح مفتاح شنطة', 'تغليف شنطة',
    ],
    'شنط السفر والشنط المدرسية': [
      'اصلاح شنط سفر', 'تصليح شنط سفر الرياض', 'تصليح حقيبة سفر', 'صيانة شنط السفر', 'تغيير عجلات شنطة سفر',
      'تصليح سحاب شنطة سفر', 'تصليح هندل شنطة سفر', 'اصلاح شنط مدرسية', 'تصليح شنطة مدرسة',
      'تغيير سحاب شنطة مدرسة', 'تصليح شنطة ظهر',
    ],
    'ترميم الماركات الفاخرة': [
      'صيانة شنط lv', 'صيانة شنط لويس فيتون', 'ترميم شنط لويس فيتون', 'تصليح شنطة لويس فيتون الرياض',
      'ترميم شنط هيرمس', 'صيانة شنط هيرمس', 'ترميم شنط شانيل', 'صيانة شنط شانيل', 'ترميم شنط غوتشي',
      'صيانة شنط ديور', 'ترميم شنط دولتشي اند غابانا', 'تجديد شنط ماركات', 'ترميم حقائب ماركات فاخرة',
      'صيانة شنط ماركات', 'تصليح احذية ماركات', 'تجديد احذية فاخرة',
    ],
    'نية محلية وخدمة (استلام وتوصيل)': [
      'اسكافي العزيزية', 'تصليح احذية جنوب الرياض', 'تصليح احذية شمال الرياض', 'استلام وتوصيل احذية الرياض',
      'تصليح احذية توصيل', 'خدمة استلام شنط للتصليح', 'تصليح احذية اونلاين', 'اسكافي اونلاين',
    ],
    'الرياض والأحياء (نية محلية)': [
      'تصليح احذية الرياض', 'اسكافي الرياض', 'اسكافي حطين', 'تصليح احذية حطين', 'تصليح شنط حطين', 'اسكافي الملقا', 'تصليح شنط الملقا',
      'اسكافي النرجس', 'اسكافي الياسمين', 'تصليح احذية الياسمين', 'اسكافي النخيل', 'اسكافي العليا', 'تصليح شنط العليا', 'تصليح احذية العليا',
      'اسكافي السليمانية', 'اسكافي الملز', 'اسكافي الروضة', 'اسكافي النسيم', 'تصليح احذية النسيم', 'اسكافي الشفا', 'تصليح احذية الشفا',
      'اسكافي دار البيضاء', 'اسكافي ديراب', 'اسكافي لبن', 'اسكافي نمار', 'اسكافي السويدي', 'اسكافي عرقة',
      'اسكافي شمال الرياض', 'تصليح احذية شمال الرياض', 'اسكافي جنوب الرياض', 'تصليح شنط جنوب الرياض', 'اسكافي شرق الرياض', 'تصليح احذية شرق الرياض',
      'اسكافي غرب الرياض', 'تصليح احذية غرب الرياض', 'اسكافي وسط الرياض', 'تصليح احذية وسط الرياض',
      'اسكافي يستلم من البيت الرياض', 'تصليح شنط ماركات الرياض', 'ترميم شنط لويس فيتون شمال الرياض',
    ],
    'السعودية (الشحن من خارج الرياض)': [
      'تصليح احذية السعودية', 'اسكافي السعودية', 'تصليح شنط السعودية', 'ترميم شنط ماركات السعودية', 'ارسال احذية للتصليح',
      'ارسال شنط للتصليح بالشحن', 'تصليح احذية من خارج الرياض', 'ارسال حذاء للتصليح من جدة', 'ارسال شنطة للتصليح من الدمام', 'تصليح شنط سفر بالشحن',
    ],
    'أسئلة وأسعار (بحث معلوماتي)': [
      'كم سعر تصليح حذاء', 'سعر تغيير نعل حذاء', 'سعر ترميم شنطة جلد', 'اسعار اصلاح الشنط',
      'كم يكلف تغيير سحاب شنطة', 'هل يمكن تصليح شنطة جلد', 'علاج تقشر جلد الشنطة', 'اصلاح جلد متشقق',
      'كيف اعتني بالحذاء الجلد', 'ما هو الاسكافي', 'ضمان تصليح احذية',
    ],
  },
  en: {
    'Brand & cobbler intent': [
      'cobbler Riyadh', 'cobbler near me Riyadh', 'best cobbler in Riyadh', 'shoe repair Riyadh', 'shoe repair near me',
      'shoe repair shop Riyadh', 'shoe repair Saudi Arabia', 'Ebra & Khait Cobbler', 'Needle and Thread Cobbler',
    ],
    'Shoes': [
      'sole replacement Riyadh', 'resoling shoes Riyadh', 'heel repair Riyadh', 'leather shoe repair Riyadh',
      'shoe stretching Riyadh', 'shoe lining replacement', 'shoe polishing Riyadh', 'leather dyeing Riyadh',
      'leather recoloring', 'sneaker repair Riyadh', 'sneaker cleaning Riyadh',
    ],
    'Boots': ['military boots repair Riyadh', 'boot repair Riyadh', 'combat boots resole', 'military boots resoling Saudi Arabia'],
    'Bags & luggage': [
      'bag repair Riyadh', 'handbag repair Riyadh', 'leather bag repair Riyadh', 'leather bag restoration', 'leather restoration Riyadh',
      'luggage repair Riyadh', 'suitcase repair Riyadh', 'travel bag repair', 'suitcase zipper repair', 'suitcase wheel replacement',
      'school bag repair', 'backpack repair Riyadh', 'bag zipper replacement', 'bag handle repair', 'bag strap replacement', 'bag repair Saudi Arabia',
    ],
    'Luxury & designer': [
      'luxury bag repair Riyadh', 'designer bag repair Saudi Arabia', 'designer handbag restoration', 'Louis Vuitton repair Riyadh',
      'Louis Vuitton bag restoration', 'Hermes bag repair Riyadh', 'Chanel bag repair Riyadh', 'Gucci bag repair', 'Dior bag repair',
    ],
    'Riyadh districts & Saudi Arabia': [
      'shoe repair Hittin Riyadh', 'cobbler Al Malqa Riyadh', 'shoe repair Olaya Riyadh', 'bag repair Al Olaya', 'cobbler Al Yasmin Riyadh',
      'cobbler North Riyadh', 'shoe repair North Riyadh', 'cobbler South Riyadh', 'shoe repair South Riyadh', 'cobbler East Riyadh', 'cobbler West Riyadh',
      'shoe repair Al Aziziyah Riyadh', 'shoe repair Al Naseem Riyadh', 'shoe repair Saudi Arabia by mail', 'send shoes for repair Saudi Arabia',
      'send handbag for repair Saudi Arabia', 'luxury bag repair Saudi Arabia', 'shoe repair pickup Riyadh all districts',
    ],
    'Service & questions': [
      'shoe repair pickup and delivery Riyadh', 'how much does shoe repair cost', 'how much to repair a leather bag', 'cracked leather bag repair',
    ],
  },
};
export const ALL_AR = Object.values(KEYWORDS.ar).flat();
export const ALL_EN = Object.values(KEYWORDS.en).flat();
