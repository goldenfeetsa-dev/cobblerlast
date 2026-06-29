import React from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Truck, Clock, MapPin, Package, CheckCircle, Phone } from 'lucide-react';

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

export default function ShippingPolicy() {
  const steps = [
    { icon: Phone, title: 'التواصل والتقييم', desc: 'أرسل صوراً لقطعتك عبر الواتساب وسنقيّمها مجاناً خلال ساعة.' },
    { icon: Truck, title: 'الاستلام من منزلك', desc: 'نرسل مندوبنا لاستلام القطعة من موقعك مباشرة داخل الرياض.' },
    { icon: Package, title: 'الإصلاح والتجديد', desc: 'يبدأ فريقنا العمل فور الاستلام. نُبلغك بكل مرحلة.' },
    { icon: CheckCircle, title: 'التسليم لبابك', desc: 'نعيد قطعتك كالجديدة تماماً مع ضمان كامل على الخدمة.' },
  ];

  return (
    <div className="min-h-screen font-tajawal" style={{ background: '#060300', color: TEXT }}>
      <Helmet>
        <title>سياسة التوصيل والاستلام | إبرة وخيط الإسكافي</title>
        <meta name="description" content="تعرف على سياسة التوصيل والاستلام في إبرة وخيط الإسكافي — نستلم من موقعك ونوصل لبابك داخل الرياض." />
        <link rel="canonical" href="https://cobblerlast.com/shipping-policy" />
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
          <Truck className="w-8 h-8" style={{ color: GOLD }} />
          <div>
            <h1 className="text-3xl font-black" style={{ color: TEXT }}>سياسة التوصيل والاستلام</h1>
            <p className="text-sm mt-1" style={{ color: 'rgba(245,237,216,0.3)' }}>نصل إليك أينما كنت في الرياض</p>
          </div>
        </div>

        {/* Steps */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-14">
          {steps.map((s, i) => (
            <div key={i} className="p-5 rounded-2xl flex gap-4" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(201,168,76,0.1)' }}>
              <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ background: 'rgba(201,168,76,0.1)' }}>
                <s.icon className="w-5 h-5" style={{ color: GOLD }} />
              </div>
              <div>
                <h3 className="font-black mb-1" style={{ color: TEXT }}>{i + 1}. {s.title}</h3>
                <p className="text-sm" style={{ color: 'rgba(245,237,216,0.5)' }}>{s.desc}</p>
              </div>
            </div>
          ))}
        </div>

        <Section title="منطقة التغطية">
          <div className="flex items-start gap-2">
            <MapPin className="w-4 h-4 mt-0.5 shrink-0" style={{ color: GOLD }} />
            <div>
              <p><strong style={{ color: TEXT }}>داخل الرياض:</strong> خدمة الاستلام والتوصيل متاحة في جميع أحياء الرياض.</p>
              <p><strong style={{ color: TEXT }}>خارج الرياض:</strong> يمكن إرسال القطع عبر أرامكس أو شركات الشحن. التواصل مسبقاً ضروري.</p>
            </div>
          </div>
        </Section>

        <Section title="مواعيد الاستلام والتوصيل">
          <div className="flex items-start gap-2">
            <Clock className="w-4 h-4 mt-0.5 shrink-0" style={{ color: GOLD }} />
            <div>
              <p><strong style={{ color: TEXT }}>أيام العمل:</strong> السبت — الخميس (9 صباحاً — 10 مساءً)</p>
              <p><strong style={{ color: TEXT }}>وقت الاستجابة:</strong> يتم التنسيق لموعد الاستلام خلال ساعتين من التواصل.</p>
              <p><strong style={{ color: TEXT }}>وقت الإنجاز:</strong> يعتمد على نوع الخدمة — من يوم واحد حتى 7 أيام.</p>
            </div>
          </div>
        </Section>

        <Section title="رسوم التوصيل">
          <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(201,168,76,0.1)' }}>
            {[
              { zone: 'داخل الرياض (شمال وجنوب)', price: 'مجاناً عند الطلبات فوق 200 ر.س' },
              { zone: 'داخل الرياض (أقل من 200 ر.س)', price: '30 ر.س' },
              { zone: 'خارج الرياض', price: 'حسب شركة الشحن' },
            ].map((r, i) => (
              <div key={i} className="flex justify-between items-center px-5 py-3 text-sm"
                style={{ background: i % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent', borderBottom: '1px solid rgba(201,168,76,0.06)' }}>
                <span style={{ color: 'rgba(245,237,216,0.6)' }}>{r.zone}</span>
                <span className="font-bold" style={{ color: GOLD }}>{r.price}</span>
              </div>
            ))}
          </div>
        </Section>

        <Section title="تتبع الطلب">
          <p>يمكنك متابعة حالة طلبك في أي وقت من خلال:</p>
          <ul className="list-disc list-inside space-y-1 mr-4">
            <li>صفحة تتبع الطلبات على موقعنا</li>
            <li>رسائل واتساب التلقائية عند كل مرحلة</li>
            <li>التواصل المباشر مع فريقنا</li>
          </ul>
        </Section>

        <Section title="التواصل معنا">
          <p>لأي استفسار بشأن التوصيل أو تحديد موعد استلام:</p>
          <div className="flex flex-wrap gap-3 mt-3">
            <a href="https://wa.me/966549678191" target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold"
              style={{ background: 'rgba(37,211,102,0.15)', color: '#25D366', border: '1px solid rgba(37,211,102,0.2)' }}>
              واتساب: 0549678191
            </a>
          </div>
        </Section>
      </div>

      <footer className="py-6 px-6 border-t text-center text-sm" dir="rtl"
        style={{ borderColor: 'rgba(201,168,76,0.08)', color: 'rgba(245,237,216,0.2)', background: '#060300' }}>
        <div className="flex flex-wrap justify-center gap-4 mb-3">
          <Link to="/" className="hover:text-yellow-400 transition-colors">الرئيسية</Link>
          <Link to="/about" className="hover:text-yellow-400 transition-colors">من نحن</Link>
          <Link to="/privacy" className="hover:text-yellow-400 transition-colors">سياسة الخصوصية</Link>
          <Link to="/shipping-policy" className="hover:text-yellow-400 transition-colors" style={{ color: GOLD }}>سياسة التوصيل</Link>
          <Link to="/repair-policy" className="hover:text-yellow-400 transition-colors">سياسة الإصلاح</Link>
        </div>
        <p>© {new Date().getFullYear()} إبرة وخيط الإسكافي</p>
      </footer>
    </div>
  );
}
