/**
 * /api/secure/data?resource=customers — بوابة آمنة موحّدة لجداول حساسة
 * ──────────────────────────────────────────────────────────────────
 * نفس نمط /api/secure/expenses.js بالضبط (المُثبت والمُختبر أصلاً)،
 * بس معمّم بمعامل resource بدل ملف منفصل لكل جدول — هذا يخلينا نضيف
 * جداول حساسة أكثر لاحقاً (orders, sales_invoices, suppliers) بدون
 * أي دالة سيرفرليس جديدة (Vercel Hobby محدود بـ12 دالة، وصلنا الحد
 * قبل وسبب عطل نشر لمدة أسبوعين — هذا الملف مصمم يتفادى تكرار ذلك).
 *
 * كل عملية تتحقق من:
 *   1) كوكي الجلسة HttpOnly صالحة وموقّعة (المتصفح ما يقدر يزوّرها)
 *   2) الدور المرتبط بها مسموح له بهذا المورد تحديداً
 * ثم تنفّذ بمفتاح service_role (يتجاوز RLS كمصدر موثوق على مستوى
 * السيرفر فقط، بعد التحقق أعلاه).
 */
import { getSessionFromRequest } from '../_lib/session.js';
import { getSupabaseAdmin } from '../_lib/loyalty/supabaseAdmin.js';

// كل مورد مسموح: اسم الجدول الفعلي + الأدوار المسموحة لكل عملية.
// أي جدول مو موجود بهالقائمة يُرفض تلقائياً (allow-list صريحة، مو
// deny-list) — أضمن طريقة تمنع أي استخدام غير مقصود لهذا endpoint.
const RESOURCES = {
  customers: {
    table: 'customers',
    read: ['owner', 'admin', 'manager', 'cashier', 'staff', 'accountant'],
    write: ['owner', 'admin', 'manager', 'cashier', 'staff'],
    del: ['owner', 'admin', 'manager'],
  },
};

export default async function handler(req, res) {
  const resourceKey = String(req.query.resource || '');

  // ── الشركاء (B2B): إدارة عبر دوال Postgres، للمالك/المدير فقط ──
  if (resourceKey === 'partners') {
    const sess = getSessionFromRequest(req);
    if (!sess) return res.status(401).json({ error: 'unauthenticated' });
    if (!['owner', 'admin'].includes(sess.role)) return res.status(403).json({ error: 'forbidden' });
    const sb = getSupabaseAdmin();
    try {
      let r;
      if (req.method === 'GET') r = await sb.rpc('partner_admin_list');
      else if (req.method === 'POST') {
        const name = String(req.body?.name || '').trim().slice(0, 80);
        if (!name) return res.status(400).json({ error: 'missing_name' });
        r = await sb.rpc('partner_admin_create', { p_name: name });
      } else if (req.method === 'PATCH') {
        if (!req.query.id) return res.status(400).json({ error: 'missing_id' });
        r = await sb.rpc('partner_admin_set_active', { p_id: String(req.query.id), p_active: !!req.body?.is_active });
        if (!r.error) return res.status(200).json({ ok: true });
      } else return res.status(405).json({ error: 'method_not_allowed' });
      if (r.error) throw r.error;
      return res.status(200).json(r.data);
    } catch (err) {
      console.error('api/secure/data (partners) error', err);
      return res.status(500).json({ error: err.message || 'server_error' });
    }
  }

  // ── مساعد الفني الذكي: يفهم الطلب ويرد، عبر Claude API (مفتاح على السيرفر فقط) ──
  if (resourceKey === 'tech-ai') {
    const sess = getSessionFromRequest(req);
    if (!sess) return res.status(401).json({ error: 'unauthenticated' });
    if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return res.status(503).json({ error: 'ai_not_configured' });
    try {
      const { order_id, text, history } = req.body || {};
      const said = String(text || '').slice(0, 600);
      if (!order_id || !said) return res.status(400).json({ error: 'missing_fields' });
      const { data: o, error } = await getSupabaseAdmin().from('orders')
        .select('order_number,item_type,description,notes,status,order_items,shelf_location,delivery_date').eq('id', order_id).single();
      if (error || !o) return res.status(404).json({ error: 'order_not_found' });
      const hist = (Array.isArray(history) ? history : []).slice(-6)
        .map((m) => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: String(m.content || '').slice(0, 600) }));
      const system = `أنت مساعد صوتي لفني ورشة إصلاح أحذية وحقائب وجلديات في الرياض. الفني يداه مشغولتان ويتكلم معك بالعامية السعودية.
مهمتك: تفهم كلامه بالنسبة للطلب أدناه، تجيب بجملة أو جملتين قصيرتين بالعربية، وتستخرج ملاحظة العمل إن ذكر عملاً أنجزه أو قياساً أو ملاحظة.
أجب بـ JSON فقط بدون أي نص آخر: {"reply":"ردك المنطوق","note":"ملاحظة نصية موحّدة مختصرة أو سلسلة فارغة","mark_ready":true|false}
- mark_ready=true فقط إذا قال بوضوح إنه خلّص/أنجز القطعة.
- لا تخترع معلومات غير موجودة بالطلب. لو سأل عن شيء لا تعرفه قل ذلك.
- لا تذكر أسعاراً ولا بيانات عميل.
الطلب: ${JSON.stringify(o)}`;
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model: 'claude-sonnet-5-5', max_tokens: 300, system, messages: [...hist, { role: 'user', content: said }] }),
      });
      if (!r.ok) throw new Error(`ai_http_${r.status}`);
      const j = await r.json();
      const raw = (j.content || []).map((c) => c.text || '').join('');
      let out;
      try { out = JSON.parse(raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1)); } catch { out = { reply: raw.slice(0, 300), note: '', mark_ready: false }; }
      return res.status(200).json({
        reply: String(out.reply || '').slice(0, 400),
        note: String(out.note || '').slice(0, 300),
        mark_ready: out.mark_ready === true,
      });
    } catch (err) {
      console.error('api/secure/data (tech-ai) error', err);
      return res.status(502).json({ error: 'ai_failed' });
    }
  }

  const resource = RESOURCES[resourceKey];
  if (!resource) return res.status(404).json({ error: 'unknown_resource' });

  const session = getSessionFromRequest(req);
  if (!session) return res.status(401).json({ error: 'unauthenticated' });

  const TABLE = resource.table;
  const supabase = getSupabaseAdmin();

  try {
    if (req.method === 'GET') {
      if (!resource.read.includes(session.role)) return res.status(403).json({ error: 'forbidden' });

      const { op = 'list', id, orderBy = '-created_at', limit = '200', filters } = req.query;
      const lim = Math.min(parseInt(limit, 10) || 200, 2000);

      if (op === 'get') {
        if (!id) return res.status(400).json({ error: 'missing_id' });
        const { data, error } = await supabase.from(TABLE).select('*').eq('id', id).single();
        if (error) throw error;
        return res.status(200).json(data);
      }

      const col = String(orderBy).startsWith('-') ? String(orderBy).slice(1) : String(orderBy);
      const asc = !String(orderBy).startsWith('-');
      let query = supabase.from(TABLE).select('*').order(col, { ascending: asc }).limit(lim);

      if (op === 'filter' && filters) {
        let parsed;
        try { parsed = JSON.parse(String(filters)); } catch { return res.status(400).json({ error: 'invalid_filters' }); }
        for (const [key, val] of Object.entries(parsed)) {
          if (val === null) query = query.is(key, null);
          else if (Array.isArray(val)) query = query.in(key, val);
          else query = query.eq(key, val);
        }
      }

      const { data, error } = await query;
      if (error) throw error;
      return res.status(200).json(data || []);
    }

    if (req.method === 'POST') {
      if (!resource.write.includes(session.role)) return res.status(403).json({ error: 'forbidden' });
      const record = req.body || {};
      const { data, error } = await supabase.from(TABLE).insert(record).select().single();
      if (error) throw error;
      return res.status(200).json(data);
    }

    if (req.method === 'PATCH') {
      if (!resource.write.includes(session.role)) return res.status(403).json({ error: 'forbidden' });
      const { id } = req.query;
      if (!id) return res.status(400).json({ error: 'missing_id' });
      const record = req.body || {};
      const { data, error } = await supabase.from(TABLE).update(record).eq('id', id).select().single();
      if (error) throw error;
      return res.status(200).json(data);
    }

    if (req.method === 'DELETE') {
      if (!resource.del.includes(session.role)) return res.status(403).json({ error: 'forbidden' });
      const { id } = req.query;
      if (!id) return res.status(400).json({ error: 'missing_id' });
      const { error } = await supabase.from(TABLE).delete().eq('id', id);
      if (error) throw error;
      return res.status(200).json({ id });
    }

    return res.status(405).json({ error: 'method_not_allowed' });
  } catch (err) {
    console.error(`api/secure/data (${resourceKey}) error`, err);
    return res.status(500).json({ error: err.message || 'server_error' });
  }
}
