/** ApplyForm — تقديم وظيفي: بيانات المتقدم + رفع السيرة؛ التحليل (ATS) يتم على الخادم مقابل كلمات الوظيفة. */
import React, { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { extractCvText, CV_ACCEPT, CV_MAX_BYTES } from '@/lib/cvText';
import { Loader2, Upload, CheckCircle2, FileText } from 'lucide-react';
import { toast } from 'sonner';

const INK = '#ece8df';
const HAIR = 'rgba(255,255,255,0.12)';
const field = 'w-full bg-transparent px-4 py-3 text-sm outline-none transition-colors focus:border-[#ece8df]';
const fieldStyle = { border: `1px solid ${HAIR}`, color: INK };

const ERR = {
  ar: { invalid_name: 'اكتب اسمك الكامل', invalid_phone: 'رقم الجوال غير صحيح (05XXXXXXXX)', duplicate: 'استلمنا طلبك لهذه الوظيفة قبل قليل، شكراً لك', job_not_found: 'هذه الوظيفة لم تعد متاحة' },
  en: { invalid_name: 'Please enter your full name', invalid_phone: 'Invalid mobile number (05XXXXXXXX)', duplicate: 'We already received your application for this role. Thank you', job_not_found: 'This position is no longer available' },
};

export default function ApplyForm({ job, isAr }) {
  const [f, setF] = useState({ full_name: '', phone: '', email: '', city: '', years_experience: '', about: '' });
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }));
  const L = (ar, en) => (isAr ? ar : en);

  const pick = (e) => {
    const x = e.target.files?.[0];
    if (!x) return;
    if (x.size > CV_MAX_BYTES) return toast.error(L('حجم الملف أكبر من 3 ميجا', 'File is larger than 3 MB'));
    setFile(x);
  };

  const [agree, setAgree] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    if (!file) return toast.error(L('أرفق سيرتك الذاتية', 'Please attach your CV'));
    if (!agree) return toast.error(L('يلزم الموافقة على معالجة بياناتك', 'Please accept the data processing consent'));
    setBusy(true);
    try {
      const cvText = await extractCvText(file);
      const ext = (file.name.split('.').pop() || 'pdf').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 5);
      const path = `${job.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const up = await supabase.storage.from('cvs').upload(path, file, { contentType: file.type || undefined, upsert: false });
      const { data, error } = await supabase.rpc('submit_job_application', {
        p: { ...f, years_experience: f.years_experience || null, job_id: job.id, cv_text: cvText, cv_path: up.error ? null : path },
      });
      if (error || !data?.ok) throw new Error(ERR[isAr ? 'ar' : 'en'][data?.error] || L('تعذّر إرسال الطلب، حاول مرة أخرى', 'Could not submit, please try again'));
      setResult({ ...data, noText: !cvText });
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  if (result) {
    const s = result.score;
    return (
      <div className="p-6 sm:p-8 text-center space-y-4" style={{ border: `1px solid ${HAIR}` }}>
        <CheckCircle2 className="w-10 h-10 mx-auto" style={{ color: INK }} />
        <h3 className="text-xl font-semibold" style={{ color: INK }}>{L('وصلنا طلبك، شكراً لاهتمامك', 'Application received — thank you')}</h3>
        <p className="text-sm font-light" style={{ color: '#a8a398' }}>{L('سيتواصل معك فريقنا إذا كان ملفك مناسباً للمرحلة التالية.', 'Our team will contact you if your profile fits the next stage.')}</p>
        <div className="mx-auto max-w-xs">
          <div className="flex justify-between text-xs mb-1" style={{ color: '#bdb8ad' }}><span>{L('مطابقة سيرتك لمتطلبات الوظيفة', 'CV match for this role')}</span><span>{s}%</span></div>
          <div className="h-[3px]" style={{ background: 'rgba(255,255,255,.1)' }}><div className="h-full" style={{ width: `${s}%`, background: INK }} /></div>
        </div>
        {result.noText && <p className="text-xs" style={{ color: '#8d8a82' }}>{L('تعذّرت قراءة نص السيرة (قد تكون صورة). يُفضّل رفعها بصيغة PDF نصية أو Word.', 'We could not read text from your CV (it may be an image). A text PDF or Word file works best.')}</p>}
        {result.missing?.length > 0 && s < 80 && (
          <p className="text-xs" style={{ color: '#8d8a82' }}>{L('لرفع المطابقة مستقبلاً اذكر في سيرتك خبراتك في: ', 'To improve your match, mention your experience with: ')}{result.missing.join(isAr ? '، ' : ', ')}</p>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-3 p-6 sm:p-8" style={{ border: `1px solid ${HAIR}` }}>
      <h3 className="text-lg font-semibold mb-1" style={{ color: INK }}>{L('قدّم على هذه الوظيفة', 'Apply for this role')}</h3>
      <div className="grid sm:grid-cols-2 gap-3">
        <input className={field} style={fieldStyle} required maxLength={120} placeholder={L('الاسم الكامل *', 'Full name *')} value={f.full_name} onChange={set('full_name')} autoComplete="name" />
        <input className={field} style={fieldStyle} required dir="ltr" inputMode="tel" placeholder={L('رقم الجوال 05XXXXXXXX *', 'Mobile 05XXXXXXXX *')} value={f.phone} onChange={set('phone')} autoComplete="tel" />
        <input className={field} style={fieldStyle} type="email" dir="ltr" maxLength={160} placeholder={L('البريد الإلكتروني', 'Email')} value={f.email} onChange={set('email')} autoComplete="email" />
        <input className={field} style={fieldStyle} maxLength={80} placeholder={L('المدينة', 'City')} value={f.city} onChange={set('city')} />
        <input className={field} style={fieldStyle} type="number" min="0" max="60" placeholder={L('سنوات الخبرة', 'Years of experience')} value={f.years_experience} onChange={set('years_experience')} />
      </div>
      <textarea className={field} style={fieldStyle} rows={3} maxLength={1500} placeholder={L('نبذة عن خبرتك ومهاراتك (اختياري)', 'A short note on your experience and skills (optional)')} value={f.about} onChange={set('about')} />
      <label className="flex items-center gap-3 px-4 py-3 cursor-pointer text-sm" style={{ border: `1px dashed ${HAIR}`, color: '#bdb8ad' }}>
        {file ? <FileText className="w-4 h-4 shrink-0" /> : <Upload className="w-4 h-4 shrink-0" />}
        <span className="truncate">{file ? file.name : L('أرفق سيرتك الذاتية (PDF أو Word) — حتى 3 ميجا *', 'Attach your CV (PDF or Word) — up to 3 MB *')}</span>
        <input type="file" accept={CV_ACCEPT} className="hidden" onChange={pick} />
      </label>
      <label className="flex items-start gap-3 text-xs font-light leading-relaxed cursor-pointer" style={{ color: '#a8a398' }}>
        <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-0.5" required />
        <span>{L('أوافق على معالجة بياناتي وسيرتي الذاتية لأغراض التوظيف فقط وحفظها 12 شهراً كحد أقصى، وفق ', 'I consent to my data and CV being processed for recruitment only and kept for up to 12 months, per the ')}<a href={isAr ? '/privacy' : '/en/privacy'} target="_blank" rel="noreferrer" className="underline">{L('سياسة الخصوصية', 'Privacy Policy')}</a></span>
      </label>
      <button disabled={busy} className="w-full min-h-[52px] font-semibold flex items-center justify-center gap-2 disabled:opacity-60" style={{ background: INK, color: '#0b0b0c' }}>
        {busy ? <><Loader2 className="w-4 h-4 animate-spin" />{L('جارٍ التحليل والإرسال…', 'Analysing and sending…')}</> : L('إرسال الطلب', 'Submit application')}
      </button>
      <p className="text-[11px]" style={{ color: '#8d8a82' }}>{L('تُستخدم بياناتك لأغراض التوظيف فقط.', 'Your data is used for recruitment purposes only.')}</p>
    </form>
  );
}
