/**
 * VoiceNote — زر إملاء صوتي للفني (Web Speech API، يعمل على المتصفح فقط).
 * الصوت لا يُرفع ولا يُخزَّن؛ يُحفظ فقط نص صافي صغير في ملاحظات الطلب.
 */
import React, { useRef, useState } from 'react';
import { Mic, MicOff, Loader2, Hand } from 'lucide-react';
import { notifyOrderReady } from '@/lib/waNotify';
import { workerPatch } from '@/lib/workerTiming';
import { getSession } from '@/lib/sessionStore';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabaseClient';
import { parseDictation } from '@/lib/voiceParse';

const SR = typeof window !== 'undefined' ? (window.SpeechRecognition || window.webkitSpeechRecognition) : null;

export default function VoiceNote({ order, onSaved }) {
  const [listening, setListening] = useState(false);
  const [saving, setSaving] = useState(false);
  const recRef = useRef(null);
  const [typed, setTyped] = useState('');

  const historyRef = useRef([]);
  // وضع «اليدين الحرة» للفني: يستمر بالاستماع بعد كل رد بدون ما يلمس الشاشة؛ «وقّف/خلاص» يوقفه
  const [hands, setHands] = useState(false);
  const handsRef = useRef(false);
  const startRef = useRef(null);

  const speak = (msg) => new Promise((resolve) => {
    try {
      if (!msg || !window.speechSynthesis) return resolve();
      const u = new SpeechSynthesisUtterance(msg);
      u.lang = 'ar-EG';
      u.onend = resolve; u.onerror = resolve;
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(u);
      setTimeout(resolve, 12000); // لا نعلّق إذا ما انتهى النطق
    } catch { resolve(); }
  });

  // مساعد ذكي: يفهم الطلب ويرد صوتياً؛ إن لم يتوفر نرجع للتحليل المحلي
  const ask = async (raw) => {
    setSaving(true);
    try {
      const res = await fetch('/api/secure/data?resource=tech-ai', {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_id: order.id, text: raw, history: historyRef.current }),
      });
      if (!res.ok) throw new Error('ai');
      const r = await res.json();
      historyRef.current = [...historyRef.current, { role: 'user', content: raw }, { role: 'assistant', content: r.reply }].slice(-8);
      toast.message(r.reply);
      const spoken = speak(r.reply);
      if (r.note || r.mark_ready) {
        const stamp = new Date().toLocaleString('ar-SA', { timeZone: 'Asia/Riyadh', dateStyle: 'short', timeStyle: 'short' });
        const patch = { notes: [order.notes, r.note && `[ورشة ${stamp}] ${r.note}`].filter(Boolean).join('\n').slice(0, 2000) };
        if (r.mark_ready && ['pending', 'in_progress'].includes(order.status) && window.confirm('تعليم الطلب «جاهز» وإرسال تنبيه للعميل؟')) { patch.status = 'ready'; Object.assign(patch, workerPatch(getSession())); }
        const { error } = await supabase.from('orders').update(patch).eq('id', order.id);
        if (error) toast.error('تعذّر الحفظ'); else { onSaved?.(); if (patch.status === 'ready') notifyOrderReady(order.id); }
      }
      setSaving(false);
      await spoken;
      if (handsRef.current) setTimeout(() => startRef.current?.(), 250);
    } catch {
      setSaving(false);
      await save(raw); // بدون ذكاء اصطناعي
    }
  };

  const save = async (raw) => {
    const { text, done } = parseDictation(raw);
    if (!text && !done) return toast.error('لم أفهم الكلام، أعد المحاولة');
    setSaving(true);
    const stamp = new Date().toLocaleString('ar-SA', { timeZone: 'Asia/Riyadh', dateStyle: 'short', timeStyle: 'short' });
    const line = text ? `[ورشة ${stamp}] ${text}` : '';
    const notes = [order.notes, line].filter(Boolean).join('\n').slice(0, 2000);
    const patch = { notes };
    if (done && ['pending', 'in_progress'].includes(order.status) && window.confirm('تعليم الطلب «جاهز» وإرسال تنبيه للعميل؟')) { patch.status = 'ready'; Object.assign(patch, workerPatch(getSession())); }
    const { error } = await supabase.from('orders').update(patch).eq('id', order.id);
    setSaving(false);
    if (error) return toast.error('تعذّر الحفظ');
    if (patch.status === 'ready') notifyOrderReady(order.id);
    toast.success(done ? `تم الحفظ وإغلاق الطلب: ${text}` : `تم الحفظ: ${text}`);
    onSaved?.();
  };

  // متصفح بدون Web Speech (مثل آيفون): حقل نص — زر الميكروفون في لوحة مفاتيح الجوال يُملي فيه
  if (!SR) {
    return (
      <div className="flex gap-2">
        <input value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="اكتب أو أملِ بميكروفون لوحة المفاتيح"
          className="flex-1 rounded-xl border-2 px-3 py-2 text-sm" style={{ borderColor: '#7c4a1e' }} />
        <button type="button" disabled={saving || !typed.trim()} onClick={async () => { await ask(typed); setTyped(''); }}
          className="px-4 rounded-xl text-white font-bold text-sm disabled:opacity-50" style={{ background: '#7c4a1e' }}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'حفظ'}
        </button>
      </div>
    );
  }

  const STOP_WORDS = /^(وقف|وقّف|خلاص|ايقاف|إيقاف|كفايه|كفاية|stop)$/;
  const startRec = () => {
    const rec = new SR();
    let L = 'ar-EG'; try { L = localStorage.getItem('assistant_lang') || 'ar-EG'; } catch { /* ignore */ }
    rec.lang = L;
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    let heard = '';
    rec.onresult = (e) => { heard = Array.from(e.results).map((r) => r[0].transcript).join(' '); };
    rec.onerror = (e) => { setListening(false); toast.error(e.error === 'not-allowed' ? 'اسمح بالميكروفون من إعدادات المتصفح' : 'تعذّر التقاط الصوت'); };
    rec.onend = () => {
      setListening(false);
      const h = heard.trim();
      if (h && STOP_WORDS.test(h.replace(/[\u064B-\u0652]/g, ''))) { handsRef.current = false; setHands(false); toast.message('أوقفت وضع اليدين الحرة'); return; }
      if (h) ask(h);
      else if (handsRef.current) setTimeout(() => startRef.current?.(), 400); // سكوت: نعيد الاستماع
    };
    recRef.current = rec;
    setListening(true);
    try { rec.start(); } catch { setListening(false); }
  };
  startRef.current = startRec;
  const toggle = () => {
    if (listening) { handsRef.current = false; setHands(false); recRef.current?.stop(); return; }
    startRec();
  };
  const toggleHands = () => {
    const on = !handsRef.current;
    handsRef.current = on; setHands(on);
    if (on && !listening) startRec();
    if (!on) { recRef.current?.stop(); window.speechSynthesis?.cancel(); }
  };

  return (
    <div className="space-y-2">
    <button onClick={toggleHands} type="button"
      className="w-full py-3 rounded-xl font-black text-sm flex items-center justify-center gap-2 border-2"
      style={hands ? { background: '#dcfce7', borderColor: '#16a34a', color: '#15803d' } : { background: '#fff', borderColor: '#16a34a', color: '#15803d' }}>
      <Hand className="w-4 h-4" /> {hands ? 'اليدين الحرة شغّال — قل «وقّف» للإيقاف' : 'اليدين الحرة (بدون لمس الشاشة)'}
    </button>
    <button onClick={toggle} disabled={saving} type="button"
      className="w-full py-2.5 rounded-xl font-black text-sm flex items-center justify-center gap-2 border-2 transition-all disabled:opacity-60"
      style={listening ? { background: '#fee2e2', borderColor: '#ef4444', color: '#b91c1c' } : { background: '#fff', borderColor: '#7c4a1e', color: '#7c4a1e' }}>
      {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : listening ? <><MicOff className="w-4 h-4" /> جارٍ الاستماع… اضغط للإيقاف</> : <><Mic className="w-4 h-4" /> تكلّم مع المساعد</>}
    </button>
    </div>
  );
}
