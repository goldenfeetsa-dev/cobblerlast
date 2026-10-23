/** المساعد الذكي — محادثة صوتية/كتابية بكل اللهجات العربية، يجيب من بيانات النظام (قراءة فقط) */
import React, { useEffect, useRef, useState } from 'react';
import { Mic, MicOff, Send, Volume2, VolumeX, Copy, MessageCircle, Loader2, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { db } from '@/api/supabaseApi';
import { logAudit } from '@/lib/auditLog';
import { clearSession } from '@/lib/sessionStore';
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
// أسئلة استشارية/نقاش: تذهب مباشرة للذكاء الصناعي (إن كان مفعّلاً) بدل المحرك المحلي
const ADVISORY = /(قترح|رايك|رايكم|نصيح|تنصح|انصح|استشير|ناقش|نناقش|كيف ازيد|كيف اطور|كيف احسن|كيف اقلل|كيف اتعامل|ليش|ليه|لماذا|افضل|ايش الحل|وش الحل|حل لمشكل|حلول|مشكله|تتوقع|تحليل|حلل|قارن|خطه|فكره|افكار|ساعدني افكر|وش اسوي|ايش اسوي|شو اعمل|اسوي ايش|ايش رايك|وش رايك|ممكن اسوي|تفكر)/;
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

// نص صالح للنطق: يقرأ «ORD-01002» كـ«طلب رقم 1002» والمبالغ كـ«ريال» ويتجاهل الرموز
function speakable(t) {
  return String(t)
    .replace(/ORD-0*(\d+)/gi, 'طلب رقم $1')
    .replace(/INV-0*(\d+)/gi, 'فاتورة رقم $1')
    .replace(/(\d[\d,.]*)\s*ر\.س/g, '$1 ريال')
    .replace(/[•*_#`✅👌🙏⏰⚠️]/g, ' ')
    .replace(/\n+/g, '. ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}
// ترتيب الأصوات العربية: الطبيعية/العصبية (Edge «Natural»، Google) أولاً
function rankVoice(v) {
  const n = `${v.name} ${v.voiceURI}`.toLowerCase();
  let sc = 0;
  if (/natural|neural|online/.test(n)) sc += 50;
  if (/google/.test(n)) sc += 30;
  if (/hamed|zariyah|naayf|salma|shakir|laila|maged|tarik|hoda/.test(n)) sc += 10;
  if (v.lang?.toLowerCase().startsWith('ar-sa')) sc += 8;
  if (!v.localService) sc += 5;
  return sc;
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
  const [voices, setVoices] = useState([]);
  const [voiceURI, setVoiceURI] = useState(() => { try { return localStorage.getItem('assistant_voice') || ''; } catch { return ''; } });
  const [rate, setRate] = useState(() => { try { return Number(localStorage.getItem('assistant_rate')) || 1; } catch { return 1; } });
  const [live, setLive] = useState(''); // نص الإملاء الحي يظهر بالمحادثة أثناء الكلام
  const [showVoice, setShowVoice] = useState(false);
  const [hamed, setHamed] = useState(() => { try { return localStorage.getItem('assistant_hamed') !== '0'; } catch { return true; } });
  useEffect(() => { try { localStorage.setItem('assistant_hamed', hamed ? '1' : '0'); } catch { /* ignore */ } }, [hamed]);
  const [srvVoice, setSrvVoice] = useState(() => { try { return localStorage.getItem('assistant_srv_voice') || 'ar-SA-HamedNeural'; } catch { return 'ar-SA-HamedNeural'; } });
  const audioRef = useRef(null);
  const hamedFailed = useRef(false);
  const [useRecorder, setUseRecorder] = useState(() => { try { return localStorage.getItem('assistant_recorder') === '1'; } catch { return false; } });
  useEffect(() => { try { localStorage.setItem('assistant_recorder', useRecorder ? '1' : '0'); } catch { /* ignore */ } }, [useRecorder]);

  useEffect(() => {
    const load = () => {
      const all = (window.speechSynthesis?.getVoices?.() || []).filter((v) => v.lang?.toLowerCase().startsWith('ar'));
      setVoices(all.sort((a, b) => rankVoice(b) - rankVoice(a)));
    };
    load();
    if (window.speechSynthesis) window.speechSynthesis.onvoiceschanged = load;
    return () => { if (window.speechSynthesis) window.speechSynthesis.onvoiceschanged = null; };
  }, []);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs, busy]);

  const speak = async (text, onEnd) => {
    // الصوت العصبي السعودي (Hamed) من السيرفر؛ وإن تعذّر نرجع لصوت المتصفح
    if (speakOn && hamed && !hamedFailed.current && text) {
      try {
        const res = await fetch('/api/secure/data?resource=assistant', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tts: speakable(text), voice: srvVoice }) });
        const b = await res.json().catch(() => ({}));
        if (res.ok && b.audio) {
          try { audioRef.current?.pause(); window.speechSynthesis?.cancel(); } catch { /* ignore */ }
          const a = new Audio(`data:${b.mime || 'audio/mpeg'};base64,${b.audio}`);
          a.playbackRate = rate; audioRef.current = a;
          if (onEnd) { a.onended = onEnd; a.onerror = onEnd; }
          await a.play();
          return;
        }
        hamedFailed.current = true; // لا نكرر المحاولة طوال الجلسة
      } catch { hamedFailed.current = true; }
    }
    try {
      if (!speakOn || !window.speechSynthesis || !text) { onEnd?.(); return; }
      const u = new SpeechSynthesisUtterance(speakable(text));
      const v = voices.find((x) => x.voiceURI === voiceURI) || voices[0];
      if (v) { u.voice = v; u.lang = v.lang; } else u.lang = lang;
      u.rate = rate; u.pitch = 1;
      if (onEnd) { u.onend = onEnd; u.onerror = onEnd; }
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(u);
    } catch { /* ignore */ }
  };

  const micRef = useRef(null);
  const say = (content, extra = {}) => {
    setMsgs((m0) => [...m0, { role: 'assistant', content, ...(String(content).includes('انتهت الجلسة') ? { relogin: true } : {}), ...extra }]);
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

  const confirmUpdate = async (cmd) => {
    try {
      const found = await db.Order.filter({ order_number: cmd.order_number }, '-created_at', 1);
      const order = found?.[0];
      if (!order) return say(`ما لقيت الطلب ${cmd.order_number}.`, { error: true });
      const changes = cmd.type === 'add_note'
        ? { notes: [order.notes, `[المساعد] ${cmd.note}`].filter(Boolean).join('\n') }
        : { delivery_date: cmd.delivery_date };
      await db.Order.update(order.id, changes);
      logAudit({ action: 'update', page: 'المساعد الذكي', entity: 'order', entity_id: order.id, details: { order_number: order.order_number, changes } });
      qc.invalidateQueries({ queryKey: ['orders'] });
      say(`تمام ✅ سجلتها على الطلب ${order.order_number}.`);
    } catch (e) { say(`ما قدرت أنفّذ: ${e.message}`, { error: true }); }
  };

  const askAI = async (text) => {
    try {
      const res = await fetch('/api/secure/data?resource=assistant', {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, history: msgs.slice(1).slice(-10) }),
      });
      const body = await res.json().catch(() => ({}));
      if (res.ok && body.reply) return { reply: body.reply, action: body.action };
      if (body.error === 'ai_not_configured') return { code: 'ai_not_configured', msg: 'للنقاش والاستشارة أحتاج «العقل الذكي» مفعّلاً: أضف AI_GATEWAY_API_KEY (أو GROQ_API_KEY المجاني) في إعدادات Vercel ثم Redeploy. الأوامر والأرقام تشتغل بدونه.' };
      if (res.status === 401) return { code: 'auth', msg: 'انتهت الجلسة — سجّل دخول من جديد.' };
      const d = String(body.detail || '');
      const hint = /AQ_key_unsupported/.test(d)
        ? 'مفتاح Gemini من النوع الجديد «AQ.» لا تقبله واجهة REST. أنشئ مفتاحاً من Google Cloud Console (Credentials ← Create API key) أو استخدم GROQ_API_KEY المجاني من console.groq.com.'
        : /_http_(401|403)/.test(d) ? 'المفتاح مرفوض (غير صالح أو غير مفعّل للخدمة). تأكد منه وأعد النشر.'
        : /_http_429/.test(d) ? 'تجاوزت حد الاستخدام المجاني مؤقتاً — جرّب بعد دقيقة.'
        : 'تعذّر الاتصال بالعقل الذكي الحين.';
      return { code: 'ai_failed', msg: `${hint}${d ? `\n(تفصيل فني: ${d})` : ''}` };
    } catch {
      return { code: 'net', msg: 'خطأ في الاتصال — تأكد من الإنترنت.' };
    }
  };

  const sayAI = (r) => {
    const a = r.action;
    if (a?.type === 'new_order') {
      try { sessionStorage.setItem('assistant_order_draft', JSON.stringify(a.draft)); } catch { /* ignore */ }
      say(`${r.reply}\nأفتح لك نموذج الطلب معبّأً للمراجعة.`);
      setTimeout(() => navigate('/new-order'), 900);
      return;
    }
    if (a?.type === 'add_note' || a?.type === 'set_delivery') {
      const label = a.type === 'add_note' ? `أضيف ملاحظة «${a.note}»` : `أغيّر موعد التسليم إلى ${a.delivery_date}`;
      setPending(a);
      return say(`${r.reply}\n${label} على الطلب ${a.order_number}؟ قل «تمام» أو «لا».`, { confirm: a });
    }
    if (a?.type === 'set_status' && a.order_number) {
      const cmd = { type: 'set_status', order_number: a.order_number, status: a.status, label: a.label };
      setPending(cmd);
      return say(`${r.reply}\nأغيّر حالة الطلب ${cmd.order_number} إلى «${cmd.label}»؟ قل «تمام» أو «لا».`, { confirm: cmd });
    }
    return say(r.reply);
  };

  const handle = async (text) => {
    if (/^(خروج|انهاء|إنهاء|مع السلامه|مع السلامة|سلام)$/.test(text.trim())) {
      try { audioRef.current?.pause(); window.speechSynthesis?.cancel(); } catch { /* ignore */ }
      return say('مع السلامة! 👋');
    }
    // ردّ على سؤال تأكيد
    if (pending) {
      const t = normalize(text);
      const yes = ['ايوه', 'ايوا', 'نعم', 'اكيد', 'تمام', 'ايه', 'اي', 'ماشي', 'اوكي', 'ok', 'yes', 'نفذ', 'اوافق', 'طيب', 'يلا', 'ايوة'].some((w) => t === w || t.startsWith(w + ' '));
      const no = ['لا', 'لأ', 'الغ', 'الغي', 'لا تنفذ', 'كنسل', 'cancel', 'no', 'مو'].some((w) => t === normalize(w) || t.startsWith(normalize(w) + ' '));
      if (yes) { const c = pending; setPending(null); return c.type === 'set_status' ? confirmSetStatus(c) : confirmUpdate(c); }
      if (no) { setPending(null); return say('تمام، لغيتها.'); }
      setPending(null);
    }
    if (/^(تشخيص|diag|فحص)$/i.test(text.trim())) {
      try {
        const res = await fetch('/api/secure/data?resource=assistant', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ diag: true }) });
        const d = await res.json().catch(() => ({}));
        if (!res.ok) return say(`التشخيص: ${res.status === 401 ? 'انتهت الجلسة — سجّل دخول من جديد' : 'خطأ ' + res.status}`, { error: true });
        const yn = (b) => (b ? '✅ مفعّل' : '❌ غير موجود');
        return say(`نسخة الموقع المنشورة: ${d.deploy} (${d.env})\nالوكيل المحلي: ${yn(d.providers.local)}\nAI Gateway: ${yn(d.providers.gateway)}\nGemini: ${yn(d.providers.gemini)}\nGroq: ${yn(d.providers.groq)}\nClaude: ${yn(d.providers.anthropic)}\nدورك: ${d.role}`);
      } catch { return say('تعذّر الاتصال بالخادم.', { error: true }); }
    }
    const norm = normalize(text);
    const words = norm.split(' ').length;
    const advisory = ADVISORY.test(norm);
    const parsed = parseCommand(text);
    // نقاش/استشارة أو جملة طويلة حرّة ← الذكاء الصناعي أولاً؛ فإن لم يتوفر نرجع للمحرك المحلي
    const aiFirst = advisory || ((parsed.type === 'tool' || parsed.type === 'find_orders') && words > 6);
    if (aiFirst) {
      const r = await askAI(text);
      if (r.reply) return sayAI(r);
      if (advisory || parsed.type === 'unknown') return say(r.msg, { error: true });
    }
    const cmd = parsed;
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
      const r = await askAI(text);
      if (r.reply) return sayAI(r);
      if (r.code !== 'ai_not_configured') return say(r.msg, { error: true });
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

  // ─── تسجيل صوتي + تحويل لنص بالسيرفر (Whisper): يعمل حتى لو إملاء المتصفح لا يعمل ───
  const mediaRef = useRef(null);
  const [recording, setRecording] = useState(false);
  const startRecording = async () => {
    try {
      if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
        return say('جهازك/متصفحك لا يدعم التسجيل الصوتي. استخدم Chrome أو Edge، أو اكتب رسالتك.', { error: true });
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'].find((m) => MediaRecorder.isTypeSupported?.(m)) || '';
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      const chunks = [];
      rec.ondataavailable = (e) => { if (e.data?.size) chunks.push(e.data); };
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        setRecording(false);
        const blob = new Blob(chunks, { type: rec.mimeType || 'audio/webm' });
        if (blob.size < 1500) return say('ما سمعت صوت واضح — قرّب من المايك وجرّب مرة ثانية.', { error: true });
        setBusy(true);
        try {
          const b64 = await new Promise((resolve, reject) => { const fr = new FileReader(); fr.onload = () => resolve(String(fr.result).split(',')[1]); fr.onerror = reject; fr.readAsDataURL(blob); });
          const res = await fetch('/api/secure/data?resource=assistant', {
            method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ stt: b64, mime: (blob.type || 'audio/webm').split(';')[0] }),
          });
          const body = await res.json().catch(() => ({}));
          if (res.ok && body.text) { setBusy(false); return send(body.text); }
          if (body.error === 'stt_not_configured') say('تحويل الصوت لنص من السيرفر غير مفعّل: أضف GROQ_API_KEY (مجاني من console.groq.com) في Vercel ثم Redeploy.', { error: true });
          else say(`تعذّر تحويل الصوت لنص${body.detail ? ` (${body.detail})` : ''}. جرّب مرة ثانية أو اكتب رسالتك.`, { error: true });
        } catch { say('خطأ في الاتصال أثناء إرسال التسجيل.', { error: true }); }
        finally { setBusy(false); }
      };
      mediaRef.current = rec;
      rec.start();
      setRecording(true);
      setTimeout(() => { if (rec.state === 'recording') rec.stop(); }, 30000); // حد أقصى 30 ثانية
    } catch (e) {
      setRecording(false);
      if (e?.name === 'NotAllowedError' || e?.name === 'SecurityError') say('المايك ممنوع. اضغط أيقونة القفل بجانب رابط الموقع ← المايك ← السماح، ثم أعد تحميل الصفحة.', { error: true });
      else if (e?.name === 'NotFoundError') say('ما لقيت مايك في جهازك. وصّل سماعة/مايك أو تأكد من إعدادات الصوت.', { error: true });
      else say(`تعذّر تشغيل المايك: ${e?.message || e?.name || ''}`, { error: true });
    }
  };

  const toggleMic = () => {
    if (recording) { mediaRef.current?.stop(); return; }
    if (listening) { recRef.current?.stop(); return; }
    if (!SR || useRecorder) { startRecording(); return; }
    try { window.speechSynthesis?.cancel(); } catch { /* ignore */ }
    const rec = new SR();
    rec.lang = lang; rec.interimResults = true; rec.continuous = true; rec.maxAlternatives = 5;
    let finalText = ''; let silence = null; let sent = false; let failed = false;
    const finish = () => { if (sent) return; sent = true; clearTimeout(silence); try { rec.stop(); } catch { /* ignore */ } };
    rec.onresult = (e) => {
      let t = '';
      for (let i = 0; i < e.results.length; i++) t += e.results[i][0].transcript + ' ';
      setLive(t.trim());
      finalText = t.trim();
      // مثل جيميني: يكتب أثناء كلامك، ويرسل تلقائياً بعد ~1.6 ثانية صمت
      clearTimeout(silence); silence = setTimeout(finish, 1600);
    };
    rec.onerror = (e) => {
      failed = true; setListening(false); setLive('');
      const code = e.error;
      if (code === 'no-speech') return toast('ما سمعتك — جرّب مرة ثانية');
      if (code === 'aborted') return;
      if (code === 'not-allowed') return say('المايك ممنوع. اضغط أيقونة القفل بجانب رابط الموقع ← المايك ← السماح، ثم أعد تحميل الصفحة.', { error: true });
      if (code === 'audio-capture') return say('ما لقيت مايك في جهازك. تأكد أنه موصول ومفعّل.', { error: true });
      // network / service-not-allowed / language-not-supported ← إملاء المتصفح لا يعمل هنا: نتحول للتسجيل بالسيرفر
      setUseRecorder(true);
      say(`إملاء المتصفح لا يعمل عندك (${code}). حوّلت للتسجيل: اضغط المايك مرة ثانية، تكلم، ثم اضغطه لإيقاف التسجيل.`, { error: true });
    };
    rec.onend = () => { clearTimeout(silence); setListening(false); setLive(''); sent = true; if (!failed && finalText.trim()) send(finalText.trim()); };
    try { recRef.current = rec; setListening(true); setLive(''); rec.start(); }
    catch (e) { setListening(false); setUseRecorder(true); startRecording(); }
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
          <button onClick={() => setShowVoice(!showVoice)} className="text-xs border rounded-lg px-2 py-2" title="إعدادات الصوت">🎙 الصوت</button>
          <button onClick={() => { setSpeakOn(!speakOn); window.speechSynthesis?.cancel(); }} className="p-2 rounded-lg border" title="نطق الردود">
            {speakOn ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {showVoice && (
        <div className="rounded-xl border bg-card p-3 mb-2 space-y-2 text-xs">
          <div className="flex gap-2 items-center">
            <span className="shrink-0">الصوت</span>
            <select value={voiceURI || voices[0]?.voiceURI || ''} onChange={(e) => { setVoiceURI(e.target.value); try { localStorage.setItem('assistant_voice', e.target.value); } catch { /* ignore */ } }} className="flex-1 border rounded-lg px-2 py-1 bg-background">
              {voices.length === 0 && <option value="">لا توجد أصوات عربية على جهازك</option>}
              {voices.map((v) => <option key={v.voiceURI} value={v.voiceURI}>{v.name} ({v.lang}){/natural|neural|online/i.test(v.name) ? ' ⭐' : ''}</option>)}
            </select>
          </div>
          <div className="flex gap-2 items-center">
            <span className="shrink-0">السرعة</span>
            <input type="range" min="0.7" max="1.3" step="0.05" value={rate} onChange={(e) => { setRate(Number(e.target.value)); try { localStorage.setItem('assistant_rate', e.target.value); } catch { /* ignore */ } }} className="flex-1" />
            <button onClick={() => speak('هلا والله، هذا صوتي. طلب رقم ألف واثنين جاهز، والإيراد ألف ومئتين ريال.')} className="border rounded-lg px-3 py-1">تجربة</button>
          </div>
          <div className="flex gap-2 items-center">
            <span className="shrink-0">صوت السيرفر</span>
            <select value={srvVoice} onChange={(e) => { setSrvVoice(e.target.value); hamedFailed.current = false; try { localStorage.setItem('assistant_srv_voice', e.target.value); } catch { /* ignore */ } }} className="flex-1 border rounded-lg px-2 py-1 bg-background">
              <option value="ar-SA-HamedNeural">حامد — سعودي (رجل)</option>
              <option value="ar-SA-ZariyahNeural">زارية — سعودية (امرأة)</option>
              <option value="ar-EG-ShakirNeural">شاكر — مصري (رجل)</option>
              <option value="ar-EG-SalmaNeural">سلمى — مصرية (امرأة)</option>
              <option value="ar-AE-HamdanNeural">حمدان — إماراتي (رجل)</option>
              <option value="ar-KW-FahedNeural">فهد — كويتي (رجل)</option>
            </select>
          </div>
          <label className="flex items-center gap-2"><input type="checkbox" checked={hamed} onChange={(e) => { hamedFailed.current = false; setHamed(e.target.checked); }} />صوت «حامد» السعودي الطبيعي (من السيرفر) — يرجع تلقائياً لصوت المتصفح إن تعذّر</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={useRecorder} onChange={(e) => setUseRecorder(e.target.checked)} />استخدم التسجيل بالسيرفر (Whisper) بدل إملاء المتصفح — أدق باللهجات ويعمل في كل المتصفحات (يحتاج GROQ_API_KEY)</label>
          <p className="text-muted-foreground">أفضل صوت مجاني: افتح الموقع من متصفح <b>Microsoft Edge</b> واختر صوت «Natural» (مثل Hamed/Zariyah). في Chrome اختر أصوات Google.</p>
        </div>
      )}

      <div className="flex-1 overflow-auto space-y-2 rounded-2xl border bg-card p-3">
        {msgs.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-start' : 'justify-end'}`}>
            <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap ${m.role === 'user' ? 'bg-primary text-primary-foreground' : m.error ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-muted'}`}>{m.content}
              {m.relogin && (
                <button onClick={() => { clearSession(); fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }).catch(() => {}); navigate('/login', { replace: true }); }}
                  className="block mt-2 px-3 py-1 rounded-lg bg-primary text-primary-foreground text-xs font-bold">تسجيل دخول من جديد</button>
              )}
              {m.confirm && pending && pending === m.confirm && (
                <div className="flex gap-2 mt-2">
                  <button onClick={() => send('تمام')} className="px-3 py-1 rounded-lg bg-emerald-600 text-white text-xs font-bold">تأكيد</button>
                  <button onClick={() => send('لا')} className="px-3 py-1 rounded-lg border text-xs font-bold">إلغاء</button>
                </div>
              )}
            </div>
          </div>
        ))}
        {listening && (
          <div className="flex justify-start"><div className="max-w-[85%] rounded-2xl px-3 py-2 text-sm bg-primary/70 text-primary-foreground">{live || 'أسمعك…'}<span className="inline-block w-1.5 h-4 mr-1 align-middle bg-current animate-pulse" /></div></div>
        )}
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
        <button type="button" onClick={toggleMic} className={`p-3 rounded-xl text-white ${(listening || recording) ? 'bg-red-600 animate-pulse' : ''}`} style={(listening || recording) ? undefined : { background: '#7c4a1e' }} title="تحدث">
          {(listening || recording) ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
        </button>
        <input value={input} onChange={(e) => setInput(e.target.value)} placeholder={recording ? 'جاري التسجيل… اضغط المايك لإيقافه' : listening ? 'أسمعك…' : 'اكتب أو اضغط المايك وتكلم'} className="flex-1 rounded-xl border px-3 py-2 text-sm bg-background" />
        <button disabled={busy || !input.trim()} className="p-3 rounded-xl border disabled:opacity-40"><Send className="w-5 h-5" /></button>
      </form>
    </div>
  );
}
