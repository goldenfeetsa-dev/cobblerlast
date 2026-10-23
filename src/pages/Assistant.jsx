/** المساعد الذكي — محادثة صوتية/كتابية بكل اللهجات العربية، يجيب من بيانات النظام (قراءة فقط) */
import React, { useEffect, useRef, useState } from 'react';
import { Mic, MicOff, Send, Volume2, VolumeX, Copy, MessageCircle, Loader2, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

const SR = typeof window !== 'undefined' ? (window.SpeechRecognition || window.webkitSpeechRecognition) : null;
const DIALECTS = [
  ['ar-SA', 'سعودي'], ['ar-EG', 'مصري'], ['ar-AE', 'إماراتي/خليجي'], ['ar-JO', 'شامي'],
  ['ar-SD', 'سوداني'], ['ar-MA', 'مغاربي'], ['ar-IQ', 'عراقي'], ['ar-YE', 'يمني'],
];
const SUGGEST = ['كم طلب جاهز اليوم؟', 'وش التسليمات المتأخرة؟', 'كم إيراد اليوم؟', 'مين الشركات اللي عليها مبالغ؟', 'دورلي على طلب ORD-01002'];

export default function Assistant() {
  const [msgs, setMsgs] = useState([{ role: 'assistant', content: 'هلا! أنا مساعد إبرة وخيط. اسألني عن الطلبات والتسليمات والإيراد والشركات، بالصوت أو الكتابة وبأي لهجة.' }]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [speakOn, setSpeakOn] = useState(true);
  const [lang, setLang] = useState(() => { try { return localStorage.getItem('assistant_lang') || 'ar-SA'; } catch { return 'ar-SA'; } });
  const recRef = useRef(null);
  const endRef = useRef(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs, busy]);

  const speak = (text) => {
    try {
      if (!speakOn || !window.speechSynthesis || !text) return;
      const u = new SpeechSynthesisUtterance(text.replace(/[*_#`]/g, ''));
      u.lang = lang;
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(u);
    } catch { /* ignore */ }
  };

  const send = async (raw) => {
    const text = String(raw ?? input).trim();
    if (!text || busy) return;
    setInput('');
    const next = [...msgs, { role: 'user', content: text }];
    setMsgs(next);
    setBusy(true);
    try {
      const res = await fetch('/api/secure/data?resource=assistant', {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, history: next.slice(1, -1).slice(-8) }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        const m = body.error === 'ai_not_configured'
          ? 'المساعد غير مفعّل بعد: لازم تضيف ANTHROPIC_API_KEY في إعدادات Vercel (Environment Variables) ثم Redeploy.'
          : res.status === 401 ? 'انتهت الجلسة — سجّل دخول من جديد.' : 'تعذّر الرد الحين، جرّب بعد شوي.';
        setMsgs((m0) => [...m0, { role: 'assistant', content: m, error: true }]);
      } else {
        setMsgs((m0) => [...m0, { role: 'assistant', content: body.reply }]);
        speak(body.reply);
      }
    } catch {
      setMsgs((m0) => [...m0, { role: 'assistant', content: 'خطأ في الاتصال — تأكد من الإنترنت.', error: true }]);
    } finally { setBusy(false); }
  };

  const toggleMic = () => {
    if (!SR) { toast.error('متصفحك لا يدعم الإملاء الصوتي — استخدم Chrome أو اكتب رسالتك'); return; }
    if (listening) { recRef.current?.stop(); return; }
    try { window.speechSynthesis?.cancel(); } catch { /* ignore */ }
    const rec = new SR();
    rec.lang = lang; rec.interimResults = true; rec.continuous = false;
    let finalText = '';
    rec.onresult = (e) => {
      let t = '';
      for (let i = 0; i < e.results.length; i++) t += e.results[i][0].transcript;
      finalText = t; setInput(t);
    };
    rec.onerror = (e) => { setListening(false); if (e.error === 'not-allowed') toast.error('اسمح للمتصفح باستخدام المايك'); };
    rec.onend = () => { setListening(false); if (finalText.trim()) send(finalText); };
    recRef.current = rec; setListening(true); rec.start();
  };

  const last = [...msgs].reverse().find((m) => m.role === 'assistant' && !m.error);
  const copy = () => { navigator.clipboard?.writeText(last?.content || ''); toast.success('تم النسخ'); };
  const wa = () => window.open(`https://wa.me/?text=${encodeURIComponent(last?.content || '')}`, '_blank');

  return (
    <div dir="rtl" className="max-w-2xl mx-auto p-3 flex flex-col" style={{ height: 'calc(100vh - 90px)' }}>
      <div className="flex items-center justify-between mb-2 gap-2">
        <h1 className="font-black text-lg flex items-center gap-2"><Sparkles className="w-5 h-5 text-amber-700" />المساعد الذكي</h1>
        <div className="flex items-center gap-2">
          <select value={lang} onChange={(e) => { setLang(e.target.value); try { localStorage.setItem('assistant_lang', e.target.value); } catch { /* ignore */ } }}
            className="text-xs border rounded-lg px-2 py-1 bg-background" title="لهجة الإملاء الصوتي">
            {DIALECTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <button onClick={() => { setSpeakOn(!speakOn); window.speechSynthesis?.cancel(); }} className="p-2 rounded-lg border" title="نطق الردود">
            {speakOn ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto space-y-2 rounded-2xl border bg-card p-3">
        {msgs.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-start' : 'justify-end'}`}>
            <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap ${m.role === 'user' ? 'bg-primary text-primary-foreground' : m.error ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-muted'}`}>{m.content}</div>
          </div>
        ))}
        {busy && <div className="flex justify-end"><div className="bg-muted rounded-2xl px-3 py-2"><Loader2 className="w-4 h-4 animate-spin" /></div></div>}
        <div ref={endRef} />
      </div>

      {msgs.length <= 2 && (
        <div className="flex gap-2 flex-wrap mt-2">
          {SUGGEST.map((s) => <button key={s} onClick={() => send(s)} className="text-xs border rounded-full px-3 py-1 bg-card">{s}</button>)}
        </div>
      )}

      {last && msgs.length > 1 && (
        <div className="flex gap-2 mt-2">
          <button onClick={copy} className="text-xs border rounded-lg px-3 py-1 flex items-center gap-1"><Copy className="w-3 h-3" />نسخ الرد</button>
          <button onClick={wa} className="text-xs border rounded-lg px-3 py-1 flex items-center gap-1"><MessageCircle className="w-3 h-3" />إرسال الرد واتساب</button>
        </div>
      )}

      <form onSubmit={(e) => { e.preventDefault(); send(); }} className="flex gap-2 mt-2">
        <button type="button" onClick={toggleMic} className={`p-3 rounded-xl text-white ${listening ? 'bg-red-600 animate-pulse' : ''}`} style={listening ? undefined : { background: '#7c4a1e' }} title="تحدث">
          {listening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
        </button>
        <input value={input} onChange={(e) => setInput(e.target.value)} placeholder={listening ? 'أسمعك…' : 'اكتب أو اضغط المايك وتكلم'} className="flex-1 rounded-xl border px-3 py-2 text-sm bg-background" />
        <button disabled={busy || !input.trim()} className="p-3 rounded-xl border disabled:opacity-40"><Send className="w-5 h-5" /></button>
      </form>
    </div>
  );
}
