/**
 * VoiceNote — زر إملاء صوتي للفني (Web Speech API، يعمل على المتصفح فقط).
 * الصوت لا يُرفع ولا يُخزَّن؛ يُحفظ فقط نص صافي صغير في ملاحظات الطلب.
 */
import React, { useRef, useState } from 'react';
import { Mic, MicOff, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabaseClient';
import { parseDictation } from '@/lib/voiceParse';

const SR = typeof window !== 'undefined' ? (window.SpeechRecognition || window.webkitSpeechRecognition) : null;

export default function VoiceNote({ order, onSaved }) {
  const [listening, setListening] = useState(false);
  const [saving, setSaving] = useState(false);
  const recRef = useRef(null);

  if (!SR) return null; // المتصفح لا يدعم الإملاء — نخفي الزر

  const save = async (raw) => {
    const { text, done } = parseDictation(raw);
    if (!text && !done) return toast.error('لم أفهم الكلام، أعد المحاولة');
    setSaving(true);
    const stamp = new Date().toLocaleString('ar-SA', { timeZone: 'Asia/Riyadh', dateStyle: 'short', timeStyle: 'short' });
    const line = text ? `[ورشة ${stamp}] ${text}` : '';
    const notes = [order.notes, line].filter(Boolean).join('\n').slice(0, 2000);
    const patch = { notes };
    if (done && ['pending', 'in_progress'].includes(order.status)) patch.status = 'ready';
    const { error } = await supabase.from('orders').update(patch).eq('id', order.id);
    setSaving(false);
    if (error) return toast.error('تعذّر الحفظ');
    toast.success(done ? `تم الحفظ وإغلاق الطلب: ${text}` : `تم الحفظ: ${text}`);
    onSaved?.();
  };

  const toggle = () => {
    if (listening) { recRef.current?.stop(); return; }
    const rec = new SR();
    rec.lang = 'ar-SA';
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    let heard = '';
    rec.onresult = (e) => { heard = Array.from(e.results).map((r) => r[0].transcript).join(' '); };
    rec.onerror = (e) => { setListening(false); toast.error(e.error === 'not-allowed' ? 'اسمح بالميكروفون من إعدادات المتصفح' : 'تعذّر التقاط الصوت'); };
    rec.onend = () => { setListening(false); if (heard.trim()) save(heard); };
    recRef.current = rec;
    setListening(true);
    rec.start();
  };

  return (
    <button onClick={toggle} disabled={saving} type="button"
      className="w-full py-2.5 rounded-xl font-black text-sm flex items-center justify-center gap-2 border-2 transition-all disabled:opacity-60"
      style={listening ? { background: '#fee2e2', borderColor: '#ef4444', color: '#b91c1c' } : { background: '#fff', borderColor: '#7c4a1e', color: '#7c4a1e' }}>
      {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : listening ? <><MicOff className="w-4 h-4" /> جارٍ الاستماع… اضغط للإيقاف</> : <><Mic className="w-4 h-4" /> إملاء ملاحظة صوتية</>}
    </button>
  );
}
