import React from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Shield } from 'lucide-react';

const GOLD = '#C9A84C';
const TEXT = '#F5EDD8';

function Section({ title, children }) {
  return (
    <div className="mb-10">
      <h2 className="text-xl font-black mb-4 pb-2" style={{ color: GOLD, borderBottom: '1px solid rgba(201,168,76,0.15)' }}>{title}</h2>
      <div className="space-y-3 text-sm leading-relaxed" style={{ color: 'rgba(245,237,216,0.6)' }}>{children}</div>
    </div>
  );
}

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen font-tajawal" style={{ background: '#060300', color: TEXT }}>
      <Helmet>
        <title>سياسة الخصوصية | إبرة وخيط الإسكافي</title>
        <meta name="description" content="سياسة الخصوصية لموقع إبرة وخيط الإسكافي — كيف نتعامل مع بياناتك الشخصية ونحمي خصوصيتك." />
        <link rel="canonical" href="https://cobblerlast.com/privacy" />
        <meta name="robots" content="index, follow" />
      </Helmet>

      {/* Nav */}
      <nav className="fixed top-0 inset-x-0 z-50 h-16 flex items-center px-6"
        style={{ background: 'rgba(6,3,0,0.95)', borderBottom: '1px solid rgba(201,168,76,0.1)', backdropFilter: 'blur(12px)' }}>
        <div className="max-w-4xl mx-auto w-full flex items-center justify-between" dir="rtl">
          <Link to="/" className="text-lg font-black" style={{ color: GOLD }}>إبرة وخيط الإسكافي</Link>
          <Link to="/" className="text-sm hover:text-yellow-400 transition-colors" style={{ color: 'rgba(245,237,216,0.5)' }}>الرئيسية</Link>
        </div>
      </nav>

      <div className="pt-28 pb-20 px-6 max-w-4xl mx-auto" dir="rtl">
        <div className="flex items-center gap-3 mb-10">
          <Shield className="w-8 h-8" style={{ color: GOLD }} />
          <div>
            <h1 className="text-3xl font-black" style={{ color: TEXT }}>سياسة الخصوصية</h1>
            <p className="text-sm mt-1" style={{ color: 'rgba(245,237,216,0.3)' }}>آخر تحديث: يناير 2025</p>
          </div>
        </div>

        <Section title="1. المقدمة">
          <p>تلتزم إبرة وخيط الإسكافي بحماية خصوصيتك وسرية بياناتك الشخصية. تشرح هذه السياسة كيفية جمع معلوماتك واستخدامها وحمايتها عند استخدامك لموقعنا وخدماتنا.</p>
          <p>باستخدامك لموقعنا أو حجز أي خدمة معنا، فأنت توافق على شروط سياسة الخصوصية هذه.</p>
        </Section>

        <Section title="2. المعلومات التي نجمعها">
          <p><strong style={{ color: TEXT }}>معلومات تقدمها أنت:</strong></p>
          <ul className="list-disc list-inside space-y-1 mr-4">
            <li>الاسم ورقم الجوال عند الحجز</li>
            <li>صور القطع التي ترسلها لتقييم الخدمة</li>
            <li>التعليقات والتقييمات التي تتركها</li>
            <li>بيانات الدفع (عبر بوابات دفع آمنة مرخصة)</li>
          </ul>
          <p className="mt-3"><strong style={{ color: TEXT }}>معلومات تُجمع تلقائياً:</strong></p>
          <ul className="list-disc list-inside space-y-1 mr-4">
            <li>عنوان IP (مُشفَّر ومجهول الهوية)</li>
            <li>نوع المتصفح والجهاز</li>
            <li>الصفحات التي زرتها ومدة الزيارة</li>
          </ul>
        </Section>

        <Section title="3. كيف نستخدم معلوماتك">
          <ul className="list-disc list-inside space-y-1 mr-4">
            <li>معالجة وتأكيد حجوزاتك</li>
            <li>التواصل معك بشأن حالة طلبك</li>
            <li>إرسال إشعارات الانتهاء والاستلام</li>
            <li>تحسين جودة خدماتنا</li>
            <li>إرسال عروض ترويجية (بموافقتك فقط)</li>
          </ul>
        </Section>

        <Section title="4. حماية البيانات">
          <p>نستخدم أحدث تقنيات التشفير والحماية لحفظ بياناتك. يتم تخزين بياناتك على خوادم آمنة متوافقة مع معايير حماية البيانات الدولية.</p>
          <p>لا نبيع أو نؤجر أو نشارك بياناتك الشخصية مع أي طرف ثالث لأغراض تجارية.</p>
          <p><strong style={{ color: TEXT }}>صور العملاء:</strong> يتم حذف صور قطعك تلقائياً بعد مرور 14 يوماً من إكمال الطلب، لحماية خصوصيتك.</p>
        </Section>

        <Section title="5. حقوقك">
          <ul className="list-disc list-inside space-y-1 mr-4">
            <li>الحق في الاطلاع على بياناتك المحفوظة</li>
            <li>الحق في تصحيح بياناتك</li>
            <li>الحق في حذف بياناتك نهائياً</li>
            <li>الحق في الاعتراض على معالجة بياناتك</li>
          </ul>
          <p>لممارسة أي من هذه الحقوق، تواصل معنا عبر: <strong style={{ color: GOLD }}>wa.me/966549678191</strong></p>
        </Section>

        <Section title="6. ملفات تعريف الارتباط (Cookies)">
          <p>نستخدم ملفات تعريف الارتباط الضرورية فقط لتحسين تجربتك. لا نستخدم ملفات تتبع إعلانية.</p>
        </Section>

        <Section title="7. التواصل معنا">
          <p>لأي استفسار بشأن سياسة الخصوصية:</p>
          <p>واتساب: <a href="https://wa.me/966549678191" className="hover:text-yellow-400" style={{ color: GOLD }}>+966 54 967 8191</a></p>
          <p>إنستغرام: <a href="https://instagram.com/ebra.kh8" className="hover:text-yellow-400" style={{ color: GOLD }}>@ebra.kh8</a></p>
        </Section>
      </div>

      <footer className="py-6 px-6 border-t text-center text-sm" dir="rtl"
        style={{ borderColor: 'rgba(201,168,76,0.08)', color: 'rgba(245,237,216,0.2)', background: '#060300' }}>
        <div className="flex flex-wrap justify-center gap-4 mb-3">
          <Link to="/" className="hover:text-yellow-400 transition-colors">الرئيسية</Link>
          <Link to="/about" className="hover:text-yellow-400 transition-colors">من نحن</Link>
          <Link to="/privacy" className="hover:text-yellow-400 transition-colors" style={{ color: GOLD }}>سياسة الخصوصية</Link>
          <Link to="/shipping-policy" className="hover:text-yellow-400 transition-colors">سياسة التوصيل</Link>
          <Link to="/repair-policy" className="hover:text-yellow-400 transition-colors">سياسة الإصلاح</Link>
        </div>
        <p>© {new Date().getFullYear()} إبرة وخيط الإسكافي</p>
      </footer>
    </div>
  );
}
