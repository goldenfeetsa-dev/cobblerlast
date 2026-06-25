import React from 'react';
import { Link } from 'react-router-dom';
import { Shield, Clock, CheckCircle, AlertCircle, CreditCard, Package, Scissors, ChevronLeft } from 'lucide-react';
import { motion } from 'framer-motion';

const GOLD = '#C9A84C';
const BG = '#120A00';

function PolicyCard({ number, title, icon: Icon, children }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6 }}
      className="rounded-2xl p-8"
      style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(201,168,76,0.12)' }}
    >
      <div className="flex items-center gap-4 mb-6">
        <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: 'rgba(201,168,76,0.08)', border: '1px solid rgba(201,168,76,0.2)' }}>
          <Icon className="w-6 h-6" style={{ color: GOLD }} />
        </div>
        <div>
          <span className="text-xs font-bold tracking-widest" style={{ color: 'rgba(201,168,76,0.5)' }}>٠{number}</span>
          <h3 className="text-xl font-black" style={{ color: '#F5EDD8' }}>{title}</h3>
        </div>
      </div>
      {children}
    </motion.div>
  );
}

export default function RepairPolicy() {
  return (
    <div dir="rtl" style={{ background: BG, minHeight: '100vh', fontFamily: "'Tajawal', sans-serif" }}>
      {/* Navbar */}
      <nav className="sticky top-0 z-50 px-6 h-16 flex items-center justify-between"
        style={{ background: 'rgba(18,10,0,0.95)', borderBottom: '1px solid rgba(201,168,76,0.1)', backdropFilter: 'blur(12px)' }}>
        <Link to="/booking" className="text-xl font-black" style={{ color: GOLD }}>إبرة وخيط الإسكافي</Link>
        <Link to="/book">
          <button className="px-5 h-9 rounded-full text-sm font-bold text-black"
            style={{ background: `linear-gradient(135deg, ${GOLD}, #e8c96a)` }}>احجز موعد</button>
        </Link>
      </nav>

      {/* Header */}
      <div className="py-20 px-6 text-center" style={{ background: 'linear-gradient(180deg, #1A0C00 0%, #120A00 100%)' }}>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }}>
          <Link to="/booking" className="inline-flex items-center gap-2 mb-8 text-sm hover:opacity-80 transition-opacity"
            style={{ color: 'rgba(245,237,216,0.4)' }}>
            <ChevronLeft className="w-4 h-4" />العودة للرئيسية
          </Link>
          <div className="inline-flex items-center gap-2 mb-4 px-4 py-1.5 rounded-full text-xs font-bold"
            style={{ background: 'rgba(201,168,76,0.1)', border: '1px solid rgba(201,168,76,0.25)', color: GOLD }}>
            <Shield className="w-3 h-3" />سياسة الإصلاح
          </div>
          <h1 className="text-4xl md:text-6xl font-black mb-4" style={{ color: '#F5EDD8' }}>
            الشفافية أولاً
          </h1>
          <p className="text-base max-w-xl mx-auto" style={{ color: 'rgba(245,237,216,0.4)' }}>
            نلتزم بالشفافية الكاملة — اقرأ سياستنا قبل إرسال قطعتك
          </p>
        </motion.div>
      </div>

      {/* Policy Sections */}
      <div className="max-w-4xl mx-auto px-6 pb-24 space-y-6">

        <PolicyCard number="1" title="استلام القطع وتقييمها" icon={Package}>
          <ul className="space-y-3">
            {[
              'تُفحص كل قطعة عند الاستلام وتُوثَّق بالصور قبل بدء أي عمل.',
              'يُرسَل للعميل تقرير مبدئي خلال 24 ساعة من الاستلام.',
              'لا يُبدأ أي عمل قبل موافقة العميل الصريحة على السعر.',
              'يحق للعميل استرداد قطعته كاملة قبل بدء العمل بلا أي تكلفة.',
            ].map((item, i) => (
              <li key={i} className="flex items-start gap-3 text-sm" style={{ color: 'rgba(245,237,216,0.6)' }}>
                <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" style={{ color: GOLD }} />
                {item}
              </li>
            ))}
          </ul>
        </PolicyCard>

        <PolicyCard number="2" title="مدة التسليم" icon={Clock}>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
            {[
              { time: '1–2 يوم', type: 'تلميع الأحذية' },
              { time: '3–5 أيام', type: 'ترميم بسيط' },
              { time: '7–14 يوم', type: 'ترميم شامل' },
            ].map((d, i) => (
              <div key={i} className="rounded-xl p-4 text-center"
                style={{ background: 'rgba(201,168,76,0.05)', border: '1px solid rgba(201,168,76,0.1)' }}>
                <div className="text-2xl font-black mb-1" style={{ color: GOLD }}>{d.time}</div>
                <div className="text-xs" style={{ color: 'rgba(245,237,216,0.4)' }}>{d.type}</div>
              </div>
            ))}
          </div>
          <p className="text-xs" style={{ color: 'rgba(245,237,216,0.35)' }}>
            * قد تختلف المدة في حالات الترميم المعقدة. الطلبات المستعجلة متاحة برسوم إضافية.
          </p>
        </PolicyCard>

        <PolicyCard number="3" title="ضمان الجودة" icon={Shield}>
          <ul className="space-y-3">
            {[
              'جميع أعمال الإصلاح مضمونة لمدة 30 يوماً من تاريخ الاستلام.',
              'في حال وجود عيب في العمل، يُعاد العمل مجاناً بلا أي نقاش.',
              'لا يشمل الضمان التلف الناجم عن الاستخدام غير الطبيعي بعد التسليم.',
              'يُطلب الإبلاغ عن أي مشكلة خلال مدة الضمان مع إرفاق صور توضيحية.',
            ].map((item, i) => (
              <li key={i} className="flex items-start gap-3 text-sm" style={{ color: 'rgba(245,237,216,0.6)' }}>
                <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" style={{ color: GOLD }} />
                {item}
              </li>
            ))}
          </ul>
        </PolicyCard>

        <PolicyCard number="4" title="الأسعار والدفع" icon={CreditCard}>
          <ul className="space-y-3 mb-4">
            {[
              'يُحدَّد السعر النهائي بعد الفحص — لا مفاجآت في التسعير.',
              'يُطلب 50% مقدماً للطلبات التي تتجاوز 300 ريال.',
            ].map((item, i) => (
              <li key={i} className="flex items-start gap-3 text-sm" style={{ color: 'rgba(245,237,216,0.6)' }}>
                <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" style={{ color: GOLD }} />
                {item}
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-2">
            {['نقداً', 'تحويل بنكي', 'Apple Pay', 'Mada'].map(m => (
              <span key={m} className="px-3 py-1 rounded-full text-xs font-bold"
                style={{ background: 'rgba(201,168,76,0.1)', border: '1px solid rgba(201,168,76,0.2)', color: GOLD }}>{m}</span>
            ))}
          </div>
        </PolicyCard>

        <PolicyCard number="5" title="الحالات الاستثنائية" icon={AlertCircle}>
          <ul className="space-y-3">
            {[
              'القطع ذات القيمة العالية جداً (مثل الجلود النادرة) قد تستغرق تقييماً أطول.',
              'نحتفظ بالحق في رفض أعمال الترميم التي قد تضر بالقطعة أكثر مما تنفعها.',
              'في حال وجود ضرر مسبق غير ظاهر، يتم إبلاغ العميل فوراً قبل المتابعة.',
              'المطالبات بالتعويض عن الفقدان محدودة بسعر الإصلاح المتفق عليه.',
            ].map((item, i) => (
              <li key={i} className="flex items-start gap-3 text-sm" style={{ color: 'rgba(245,237,216,0.6)' }}>
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" style={{ color: '#f59e0b' }} />
                {item}
              </li>
            ))}
          </ul>
        </PolicyCard>

        {/* CTA */}
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
          className="rounded-2xl p-10 text-center mt-8"
          style={{ background: 'linear-gradient(135deg, rgba(201,168,76,0.08), rgba(201,168,76,0.03))', border: '1px solid rgba(201,168,76,0.2)' }}>
          <Scissors className="w-10 h-10 mx-auto mb-4" style={{ color: GOLD }} />
          <h3 className="text-2xl font-black mb-3" style={{ color: '#F5EDD8' }}>مستعد تبدأ؟</h3>
          <p className="text-sm mb-6" style={{ color: 'rgba(245,237,216,0.4)' }}>احجز موعدك وسنتواصل معك لتأكيد التفاصيل</p>
          <Link to="/book">
            <button className="px-10 py-3.5 rounded-full font-black text-base text-black hover:scale-105 transition-all"
              style={{ background: `linear-gradient(135deg, ${GOLD}, #e8c96a)`, boxShadow: '0 8px 30px rgba(201,168,76,0.3)' }}>
              احجز الآن
            </button>
          </Link>
        </motion.div>
      </div>
    </div>
  );
}