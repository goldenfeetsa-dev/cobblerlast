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

  // ── الشركاء (B2B): حسابات الشركات ─────────────────────────────
  // كل العمليات عبر دوال Postgres بمفتاح service_role، بعد التحقق من الجلسة
  // والدور هنا. السعر دائماً يُحسب داخل القاعدة من قائمة أسعار الشركة —
  // لا نقبل أي سعر قادم من المتصفح. تعديل الأسعار وإنشاء الشركات للإدارة فقط.
  if (resourceKey === 'partners') {
    const sess = getSessionFromRequest(req);
    if (!sess) return res.status(401).json({ error: 'unauthenticated' });

    const MGR = ['owner', 'admin', 'manager'];   // إدارة كاملة
    const FIN = [...MGR, 'accountant'];          // + المحاسب: قراءة وإصدار فواتير
    const action = String(req.query.action || '');
    const rules = {
      '':             { GET: FIN, POST: MGR, PATCH: MGR },
      'detail':       { GET: FIN },
      'update':       { POST: MGR },
      'set-prices':   { POST: MGR },
      'save-service': { POST: MGR },
      'intake':       { POST: MGR },
      'reprice':      { POST: MGR },
      'invoice':      { POST: FIN },
    }[action];
    if (!rules) return res.status(404).json({ error: 'unknown_action' });
    if (!rules[req.method]) return res.status(405).json({ error: 'method_not_allowed' });
    if (!rules[req.method].includes(sess.role)) return res.status(403).json({ error: 'forbidden' });

    const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const id = String(req.query.id || '');
    if (action && action !== 'save-service' && !UUID.test(id)) return res.status(400).json({ error: 'معرّف الشركة غير صحيح' });
    const body = req.body || {};
    const sb = getSupabaseAdmin();

    try {
      let r;
      if (action === '') {
        if (req.method === 'GET') r = await sb.rpc('partner_admin_list');
        else if (req.method === 'POST') {
          const name = String(body.name || '').trim().slice(0, 80);
          if (!name) return res.status(400).json({ error: 'اكتب اسم الشركة' });
          r = await sb.rpc('partner_admin_create', {
            p_name: name, p_vat: body.vat_number || null, p_cr: body.cr_number || null,
            p_address: body.address || null, p_phone: body.phone || null,
          });
        } else {
          if (!UUID.test(id)) return res.status(400).json({ error: 'معرّف الشركة غير صحيح' });
          r = await sb.rpc('partner_admin_set_active', { p_id: id, p_active: !!body.is_active });
          if (!r.error) return res.status(200).json({ ok: true });
        }
      } else if (action === 'detail') {
        r = await sb.rpc('partner_detail', { p_id: id });
      } else if (action === 'update') {
        const allow = ['name', 'vat_number', 'cr_number', 'address', 'phone', 'payment_terms_days', 'turnaround_days'];
        const p = Object.fromEntries(allow.filter((k) => k in body).map((k) => [k, body[k] == null ? '' : String(body[k])]));
        r = await sb.rpc('partner_admin_update', { p_id: id, p });
      } else if (action === 'set-prices') {
        const prices = (Array.isArray(body.prices) ? body.prices : []).slice(0, 100)
          .map((x) => ({ service_id: String(x.service_id || ''), price: x.price === null || x.price === '' || x.price === undefined ? '' : String(x.price) }));
        r = await sb.rpc('partner_set_prices', { p_partner: id, p_prices: prices });
      } else if (action === 'save-service') {
        if (body.id && !UUID.test(String(body.id))) return res.status(400).json({ error: 'معرّف الخدمة غير صحيح' });
        r = await sb.rpc('partner_save_service', {
          p_id: body.id || null, p_name: String(body.name || ''), p_base: Number(body.base_price), p_active: body.is_active !== false,
        });
      } else if (action === 'intake') {
        const bags = (Array.isArray(body.bags) ? body.bags : []).slice(0, 100).map((b) => ({
          label: String(b.label || '').slice(0, 100),
          notes: String(b.notes || '').slice(0, 500),
          services: (Array.isArray(b.services) ? b.services : []).slice(0, 30)
            .map((s) => ({ service_id: String(s.service_id || ''), qty: Math.max(1, Math.min(50, parseInt(s.qty, 10) || 1)) })),
        }));
        r = await sb.rpc('partner_create_orders', {
          p_partner: id, p_bags: bags, p_employee_id: UUID.test(String(sess.employee_id || '')) ? sess.employee_id : null,
          p_employee_name: sess.name || null, p_branch_id: UUID.test(String(sess.branch_id || '')) ? sess.branch_id : null, p_branch_name: null,
        });
      } else if (action === 'reprice') {
        if (!UUID.test(String(body.order_id || ''))) return res.status(400).json({ error: 'معرّف الطلب غير صحيح' });
        const services = (Array.isArray(body.services) ? body.services : []).slice(0, 30)
          .map((s) => ({ service_id: String(s.service_id || ''), qty: Math.max(1, Math.min(50, parseInt(s.qty, 10) || 1)) }));
        r = await sb.rpc('partner_reprice_order', { p_order_id: body.order_id, p_services: services });
      } else if (action === 'invoice') {
        const ids = (Array.isArray(body.order_ids) ? body.order_ids : []).map(String);
        if (!ids.length || ids.length > 300 || !ids.every((x) => UUID.test(x))) return res.status(400).json({ error: 'اختر طلبات صحيحة للفاتورة' });
        const method = ['cash', 'network', 'online', 'mada', 'card'].includes(body.payment_method) ? body.payment_method : 'online';
        r = await sb.rpc('partner_issue_invoice', {
          p_partner: id, p_order_ids: ids, p_payment_method: method,
          p_employee_id: UUID.test(String(sess.employee_id || '')) ? sess.employee_id : null,
          p_employee_name: sess.name || null, p_branch_id: UUID.test(String(sess.branch_id || '')) ? sess.branch_id : null, p_branch_name: null,
        });
        if (r.error) throw r.error;
        // الفاتورة أُنشئت وسُجّلت الشنط كمسدّدة داخل معاملة واحدة. الحين الإبلاغ لزاتكا؛
        // لو فشل لا نتراجع عن السداد — الفاتورة تبقى بحالة غير مُبلَّغة وعامل إعادة المحاولة يكملها.
        const inv = r.data;
        let zatca = { status: 'PENDING' };
        try {
          const { signAndSubmitInvoice } = await import('../_lib/zatcaEngine.js');
          const z = await signAndSubmitInvoice({ type: 'sale', id: inv.invoice_id, isRetry: false });
          zatca = { status: z.zatca_status || 'REPORTED', error: z.error || null };
        } catch (zerr) {
          console.error('api/secure/data (partner invoice) zatca error', zerr);
          zatca = { status: 'ERROR', error: zerr.message || 'تعذّر الإبلاغ لزاتكا' };
        }
        const { data: row } = await sb.from('sales_invoices')
          .select('id, invoice_number, created_at, subtotal, vat_amount, total, zatca_status, zatca_qr, items, payment_method, buyer_company_name, buyer_vat_number, buyer_cr_number, buyer_address')
          .eq('id', inv.invoice_id).single();
        return res.status(200).json({ ...inv, invoice: row || null, zatca });
      }
      if (r.error) throw r.error;
      return res.status(200).json(r.data);
    } catch (err) {
      const m = String(err?.message || '');
      const known = [
        [/^price_not_set: (.+)$/, (x) => `سعر خدمة "${x[1]}" غير محدد — حدّده من تبويب الأسعار أولاً`],
        [/^partner_vat_missing/, () => 'أضف الرقم الضريبي للشركة (15 رقماً يبدأ وينتهي بـ 3) قبل إصدار فاتورة ضريبية'],
        [/^invalid_vat/, () => 'الرقم الضريبي غير صحيح (15 رقماً يبدأ وينتهي بـ 3)'],
        [/^orders_not_invoiceable: (.+)$/, (x) => `لا يمكن فوترة: ${x[1]} — تأكد أنها مسلَّمة وغير مسدّدة ومسعّرة`],
        [/^order_without_services: (.+)$/, (x) => `الطلب ${x[1]} بدون خدمات مسعّرة — حدّد خدماته أولاً`],
        [/^order_already_invoiced/, () => 'هذا الطلب تم تسديده/فوترته ولا يمكن تعديل خدماته'],
        [/^order_cancelled/, () => 'الطلب ملغى'],
        [/^order_not_found|^orders_not_found/, () => 'طلب غير موجود'],
        [/^partner_not_found_or_inactive/, () => 'الشركة غير موجودة أو موقوفة'],
        [/^partner_not_found/, () => 'الشركة غير موجودة'],
        [/^service_not_found/, () => 'خدمة غير موجودة أو موقوفة'],
        [/^no_services/, () => 'اختر خدمة واحدة على الأقل لكل شنطة'],
        [/^no_bags|^no_orders/, () => 'لا توجد عناصر'],
        [/^too_many_bags/, () => 'الحد الأقصى 100 شنطة بالمرة الواحدة'],
        [/^missing_name/, () => 'الاسم مطلوب'],
        [/^invalid_price/, () => 'السعر غير صحيح'],
        [/duplicate key value/, () => 'الاسم مكرر'],
      ];
      for (const [re, fn] of known) {
        const x = m.match(re);
        if (x) return res.status(400).json({ error: fn(x), code: m.split(':')[0] });
      }
      console.error('api/secure/data (partners) error', err);
      return res.status(500).json({ error: m || 'server_error' });
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
