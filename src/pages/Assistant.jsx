/** المساعد الذكي — محادثة صوتية/كتابية بكل اللهجات العربية، يجيب من بيانات النظام (قراءة فقط) */
import React, { useEffect, useRef, useState } from 'react';
import { Mic, MicOff, Send, Volume2, VolumeX, Copy, MessageCircle, Loader2, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { db } from '@/api/supabaseApi';
import { logAudit } from '@/lib/auditLog';
import { useLoyalty } from '@/lib/loyalty/useLoyalty';
import { parseCommand, normalize, STATUS_AR } from '@/lib/assistantNlu';

// أفضل تفسير من بدائل التعرف الصوتي: أول بديل يفهمه المحرك، وإلا الأول
function bestAlternative(alts) {
  for (const a of alts) { const t = parseCommand(a).type; if (t !== 'unknown' && t !== 'empty') return a; }
  return alts[0] || '';
}

const SR = typeof window !== 'undefined' ? (window.SpeechRecognition || window.webkitSpeechRecognition) : null;
const DIALECTS = [
  ['ar-SA', 'سعودي'], ['ar-EG', 'مصري'], ['ar-AE', 'إماراتي/خليجي'], ['ar-JO', 'شامي'],
  ['ar-SD', 'سوداني'], ['ar-MA', 'مغاربي'], ['ar-IQ', 'عراقي'], ['ar-YE', 'يمني'],
];
const SUGGEST = ['افتح الشركات', 'وش التسليمات المتأخرة؟', 'كم إيراد اليوم؟', 'مين الشركات اللي عليها مبالغ؟', 'مساعدة'];

const money = (n) => `${(Number(n) || 0).toLocaleString('en-US', { maximumFractionDigits: 2 })} ر.س`;
const HELP = `أقدر أسوي لك:
• «افتح الشركات / الفواتير / الطلبات …» — أفتح الصفحة
• «ORD-01002 جاهز» أو «سلمت طلب 1002» — أغيّر حالة الطلب (بعد تأكيدك)
• «دور على أحمد» أو «وين طلب 1002» — أبحث عن طلب
• «كم طلب اليوم؟» · «وش التسليمات المتأخرة؟» · «كم إيراد اليوم/الأسبوع/الشهر؟» · «مين الشركات اللي عليها مبالغ؟»`;

async function callTool(tool, input) {
  const res = await fetch('/api/secure/data?resource=assistant', {
    method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tool, input }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(res.status === 401 ? 'انتهت الجلسة — سجّل دخول من جديد.' : 'تعذّر جلب البيانات الحين.');
  return body.data;
}

function formatTool(tool, d) {
  if (tool === 'find_orders') {
    if (!d?.length) return 'ما لقيت طلبات مطابقة.';
    return d.slice(0, 8).map((o) => `• ${o.order_number} — ${o.customer_name || 'بدون اسم'} — ${STATUS_AR[o.status] || o.status}${o.delivery_date ? ` — تسليم ${o.delivery_date}` : ''}${o.total_price != null ? ` — ${money(o.total_price)}` : ''}`).join('\n');
  }
  if (tool === 'deliveries') {
    const list = d?.orders || [];
    if (!list.length) return 'ما فيه تسليمات متأخرة ولا قريبة. الله يعطيك العافية 👌';
    return `عندك ${list.length} طلب لازم يتسلم:\n` + list.slice(0, 10).map((o) => `• ${o.order_number} — ${o.customer_name || ''} — ${o.timing} (${o.delivery_date})`).join('\n');
  }
  if (tool === 'counts_today') {
    const c = d?.by_status || {};
    return `اليوم تسجّل ${d?.registered_today || 0} طلب${Object.keys(c).length ? ' — ' + Object.entries(c).map(([k, v]) => `${STATUS_AR[k] || k}: ${v}`).join('، ') : ''}.`;
  }
  if (tool === 'revenue') {
    const p = { today: 'اليوم', week: 'آخر 7 أيام', month: 'آخر 30 يوم' }[d.period] || '';
    return `إيراد ${p} (شامل الضريبة): ${money(d.grand_total)}\n• إصلاح: ${money(d.repair_orders_total)}\n• مبيعات منتجات: ${money(d.product_sales_total)}`;
  }
  if (tool === 'partners_due') {
    if (!d?.length) return 'ما فيه شركات مسجلة.';
    return d.map((p) => `• ${p.name}: غير مسدد ${money(p.unpaid_total)} — مستحق الآن ${money(p.due_now_total)}${Number(p.due_soon_total) ? ` — قريب ${money(p.due_soon_total)}` : ''}`).join('\n');
  }
  return 'تم.';
}

export default function Assistant() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { addStamp } = useLoyalty();
  const [pending, setPending] = useState(null); // أمر بانتظار التأكيد
  const [msgs, setMsgs] = useState([{ role: 'assistant', content: 'هلا! أنا مساعد إبرة وخيط. أنفّذ أوامرك بالصوت أو الكتابة: أفتح الصفحات، أغيّر حالة الطلب، وأجيب الأرقام. اكتب «مساعدة» لأوريك الأوامر.' }]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [speakOn, setSpeakOn] = useState(true);
  const [lang, setLang] = useState(() => { try { return localStorage.getItem('assistant_lang') || 'ar-SA'; } catch { return 'ar-SA'; } });
  const recRef = useRef(null);
  const endRef = useRef(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs, busy]);

  const speak = (text, onEnd) => {
    try {
      if (!speakOn || !window.speechSynthesis || !text) { onEnd?.(); return; }
      const u = new SpeechSynthesisUtterance(text.replace(/[*_#`•]/g, ''));
      u.lang = lang;
      if (onEnd) { u.onend = onEnd; u.onerror = onEnd; }
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(u);
    } catch { /* ignore */ }
  };

  const micRef = useRef(null);
  const say = (content, extra = {}) => {
    setMsgs((m0) => [...m0, { role: 'assistant', content, ...extra }]);
    // سؤال تأكيد: بعد ما ينطقه نفتح المايك تلقائياً عشان تجاوب «تمام/لا» بصوتك
    speak(content, extra.confirm && SR ? () => setTimeout(() => micRef.current?.(), 300) : undefined);
  };

  const confirmSetStatus = async (cmd) => {
    try {
      const found = await db.Order.filter({ order_number: cmd.order_number }, '-created_at', 1);
      const order = found?.[0];
      if (!order) return say(`ما لقيت الطلب ${cmd.order_number}.`, { error: true });
      if (['completed', 'cancelled'].includes(order.status)) return say(`الطلب ${order.order_number} حالته الحالية «${STATUS_AR[order.status]}» ولا يتغيّر.`);
      await db.Order.update(order.id, { status: cmd.status });
      logAudit({ action: 'update', page: 'المساعد الذكي', entity: 'order', entity_id: order.id, details: { order_number: order.order_number, changes: { status: cmd.status } } });
      if (cmd.status === 'completed' && order.customer_phone) {
        try { await addStamp({ phone: order.customer_phone, name: order.customer_name || 'عميل', orderId: order.id, orderNumber: order.order_number, serviceType: order.item_type, amount: order.total_price || 0 }); } catch { /* اختياري */ }
      }
      qc.invalidateQueries({ queryKey: ['orders'] });
      say(`تمام ✅ الطلب ${order.order_number} صار «${cmd.label}».`);
    } catch (e) {
      say(`ما قدرت أغيّر الحالة: ${e.message}`, { error: true });
    }
  };

  const handle = async (text) => {
    // ردّ على سؤال تأكيد
    if (pending) {
      const t = normalize(text);
      const yes = ['ايوه', 'ايوا', 'نعم', 'اكيد', 'تمام', 'ايه', 'اي', 'ماشي', 'اوكي', 'ok', 'yes', 'نفذ', 'اوافق', 'طيب', 'يلا', 'ايوة'].some((w) => t === w || t.startsWith(w + ' '));
      const no = ['لا', 'لأ', 'الغ', 'الغي', 'لا تنفذ', 'كنسل', 'cancel', 'no', 'مو'].some((w) => t === normalize(w) || t.startsWith(normalize(w) + ' '));
      if (yes) { const c = pending; setPending(null); return confirmSetStatus(c); }
      if (no) { setPending(null); return say('تمام، لغيتها.'); }
      setPending(null);
    }
    const cmd = parseCommand(text);
    try {
      if (cmd.type === 'greet') return say('هلا والله! وش تبي أسوي لك؟ اكتب «مساعدة» وأقولك وش أقدر.');
      if (cmd.type === 'help') return say(HELP);
      if (cmd.type === 'navigate') { say(`تمام، أفتح «${cmd.label}».`); setTimeout(() => navigate(cmd.path), 600); return; }
      if (cmd.type === 'barcode') {
        const f = await db.Order.filter({ order_number: cmd.order_number }, '-created_at', 1);
        if (!f?.[0]) return say(`ما لقيت الطلب ${cmd.order_number}.`, { error: true });
        say(`أفتح باركود ${cmd.order_number}.`); setTimeout(() => navigate(`/barcode/${f[0].id}`), 600); return;
      }
      if (cmd.type === 'set_status') {
        setPending(cmd);
        return say(`أغيّر حالة الطلب ${cmd.order_number} إلى «${cmd.label}»؟ قل «تمام» للتأكيد أو «لا» للإلغاء.`, { confirm: cmd });
      }
      if (cmd.type === 'tool' || cmd.type === 'find_orders') {
        const tool = cmd.type === 'find_orders' ? 'find_orders' : cmd.tool;
        const input = cmd.type === 'find_orders' ? { query: cmd.query, limit: 8 } : cmd.input;
        const data = await callTool(tool, input);
        return say(formatTool(tool, data));
      }
      // ما فهمته محلياً: نجرّب الذكاء الصناعي إن كان مفعّلاً، وإلا نعرض المساعدة
      const res = await fetch('/api/secure/data?resource=assistant', {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, history: msgs.slice(1).slice(-8) }),
      });
      const body = await res.json().catch(() => ({}));
      if (res.ok && body.reply) return say(body.reply);
      return say('ما فهمت قصدك 🙏 جرّب صيغة ثانية، أو اكتب «مساعدة» وأوريك الأوامر.\n\n' + HELP);
    } catch (e) {
      say(e.message || 'صار خطأ، جرّب مرة ثانية.', { error: true });
    }
  };

  const send = async (raw) => {
    const text = String(raw ?? input).trim();
    if (!text || busy) return;
    setInput('');
    setMsgs((m0) => [...m0, { role: 'user', content: text }]);
    setBusy(true);
    try { await handle(text); } finally { setBusy(false); }
  };

  const toggleMic = () => {
    if (!SR) { toast.error('متصفحك لا يدعم الإملاء الصوتي — استخدم Chrome أو اكتب رسالتك'); return; }
    if (listening) { recRef.current?.stop(); return; }
    try { window.speechSynthesis?.cancel(); } catch { /* ignore */ }
    const rec = new SR();
    rec.lang = lang; rec.interimResults = true; rec.continuous = false; rec.maxAlternatives = 5;
    let finalText = '';
    rec.onresult = (e) => {
      let t = ''; const alts = [];
      for (let i = 0; i < e.results.length; i++) {
        t += e.results[i][0].transcript;
        if (e.results[i].isFinal) for (let k = 0; k < e.results[i].length; k++) alts.push(e.results[i][k].transcript);
      }
      setInput(t);
      finalText = alts.length ? bestAlternative(alts) : t;
    };
    rec.onerror = (e) => { setListening(false); if (e.error === 'not-allowed') toast.error('اسمح للمتصفح باستخدام المايك'); };
    rec.onend = () => { setListening(false); if (finalText.trim()) send(finalText); };
    recRef.current = rec; setListening(true); rec.start();
  };
  micRef.current = toggleMic;

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
            <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap ${m.role === 'user' ? 'bg-primary text-primary-foreground' : m.error ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-muted'}`}>{m.content}
              {m.confirm && pending && pending === m.confirm && (
                <div className="flex gap-2 mt-2">
                  <button onClick={() => send('تمام')} className="px-3 py-1 rounded-lg bg-emerald-600 text-white text-xs font-bold">تأكيد</button>
                  <button onClick={() => send('لا')} className="px-3 py-1 rounded-lg border text-xs font-bold">إلغاء</button>
                </div>
              )}
            </div>
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
