// camera-alert — يستقبل تنبيه الكاميرا/جهاز التسجيل ويرسله لتلقيرام. لا يحفظ فيديو ولا صور ولا بيانات.
// الأسرار (Supabase → Edge Functions → Secrets): CAMERA_ALERT_SECRET, TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID
// الاستدعاء: POST /functions/v1/camera-alert?key=<CAMERA_ALERT_SECRET>&event=cashier_motion&camera=1
//   event=cashier_motion → يتحقق: هل صدرت فاتورة/طلب خلال آخر N دقيقة؟ إن لا → ينبّه. أي حدث آخر → ينبّه مباشرة.
import { createClient } from 'jsr:@supabase/supabase-js@2';

const GRACE_MIN = 2;
const COOLDOWN_MS = 60_000;
let lastAlert = 0; // ذاكرة مؤقتة فقط (بدون تخزين)

const LABELS: Record<string, string> = {
  cashier_motion: 'حركة عند الكاشير بدون فاتورة',
  drawer_open: 'فتح الدرج بدون فاتورة',
  no_scan: 'تسليم قطعة بدون مسح باركود',
};

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const secret = Deno.env.get('CAMERA_ALERT_SECRET');
  const key = url.searchParams.get('key') || req.headers.get('x-alert-key');
  if (!secret || key !== secret) return new Response('unauthorized', { status: 401 });

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { /* الكاميرات القديمة ترسل GET/بدون جسم */ }
  const event = String(url.searchParams.get('event') || body.event || 'cashier_motion');
  const camera = String(url.searchParams.get('camera') || body.camera || '');

  const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  if (event === 'cashier_motion') {
    const since = new Date(Date.now() - GRACE_MIN * 60_000).toISOString();
    const [o, s] = await Promise.all([
      sb.from('orders').select('id', { count: 'exact', head: true }).gte('created_at', since),
      sb.from('sales_invoices').select('id', { count: 'exact', head: true }).gte('created_at', since),
    ]);
    if ((o.count ?? 0) + (s.count ?? 0) > 0) return Response.json({ alert: false, reason: 'invoice_recent' });
  }

  if (Date.now() - lastAlert < COOLDOWN_MS) return Response.json({ alert: false, reason: 'cooldown' });
  lastAlert = Date.now();

  const now = new Date();
  const time = now.toLocaleTimeString('ar-SA', { timeZone: 'Asia/Riyadh', hour: '2-digit', minute: '2-digit' });
  const date = now.toLocaleDateString('ar-SA', { timeZone: 'Asia/Riyadh' });
  const opNo = 'CAM-' + now.toISOString().slice(5, 16).replace(/[-:T]/g, '');
  const text = `⚠️ تنبيه كاميرا\n${LABELS[event] || event}${camera ? `\nكاميرا: ${camera}` : ''}\nرقم العملية: ${opNo}\nالوقت: ${time} — ${date}`;

  const r = await fetch(`https://api.telegram.org/bot${Deno.env.get('TELEGRAM_BOT_TOKEN')}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: Deno.env.get('TELEGRAM_CHAT_ID'), text }),
  });
  return Response.json({ alert: true, sent: r.ok, op: opNo }, { status: r.ok ? 200 : 502 });
});
