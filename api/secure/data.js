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

// تطبيع عربي مبسّط للمطابقة (تشكيل/همزات/تاء مربوطة)
const normalizeAr = (t = '') => String(t).replace(/[\u064B-\u0652\u0640]/g, '').replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').toLowerCase();

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

  // ── المساعد الذكي العام: يفهم كل اللهجات العربية ويجيب من بيانات النظام (قراءة فقط) ──
  // أدوات قراءة فقط، الأرقام المالية لا تُعرض إلا لأدوار المالية، وكل شي بعد التحقق من الجلسة.
  if (resourceKey === 'assistant') {
    const sess = getSessionFromRequest(req);
    if (!sess) return res.status(401).json({ error: 'unauthenticated' });
    if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
    // ── تشخيص: أي مزوّدات مفعّلة على هذا النشر + رقم النسخة المنشورة (بدون كشف أي مفتاح) ──
    if (req.body && req.body.diag === true) {
      return res.status(200).json({
        deploy: (process.env.VERCEL_GIT_COMMIT_SHA || 'unknown').slice(0, 7),
        env: process.env.VERCEL_ENV || 'unknown',
        providers: { local: !!process.env.LOCAL_AGENT_URL, gateway: !!process.env.AI_GATEWAY_API_KEY, gemini: !!process.env.GEMINI_API_KEY, groq: !!process.env.GROQ_API_KEY, anthropic: !!process.env.ANTHROPIC_API_KEY },
        role: sess.role,
      });
    }
    // ── نطق الرد بصوت عصبي طبيعي (Microsoft Edge neural — ar-SA-HamedNeural) ──
    if (req.body && typeof req.body.tts === 'string') {
      const VOICES = ['ar-SA-HamedNeural', 'ar-SA-ZariyahNeural', 'ar-EG-ShakirNeural', 'ar-EG-SalmaNeural', 'ar-AE-HamdanNeural', 'ar-KW-FahedNeural'];
      const voice = VOICES.includes(req.body.voice) ? req.body.voice : 'ar-SA-HamedNeural';
      const txt = req.body.tts.replace(/[<>&]/g, ' ').trim().slice(0, 700);
      if (!txt) return res.status(400).json({ error: 'missing_text' });
      try {
        const { MsEdgeTTS, OUTPUT_FORMAT } = await import('msedge-tts');
        const tts = new MsEdgeTTS({ connectionTimeoutMs: 8000, synthesisTimeoutMs: 20000 });
        await tts.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
        const { audioStream } = tts.toStream(txt);
        const chunks = [];
        await new Promise((resolve, reject) => {
          audioStream.on('data', (d) => chunks.push(d));
          audioStream.on('close', resolve);
          audioStream.on('error', reject);
        });
        const buf = Buffer.concat(chunks);
        if (buf.length < 500) throw new Error('empty_audio');
        return res.status(200).json({ audio: buf.toString('base64'), mime: 'audio/mpeg' });
      } catch (err) {
        console.error('api/secure/data (tts) error', err);
        return res.status(502).json({ error: 'tts_failed', detail: String(err.message || '').slice(0, 80) });
      }
    }
    // ── تحويل التسجيل الصوتي إلى نص (Whisper عبر Groq) — بديل لإملاء المتصفح عندما لا يعمل ──
    if (req.body && typeof req.body.stt === 'string') {
      const gk = process.env.GROQ_API_KEY;
      if (!gk) return res.status(503).json({ error: 'stt_not_configured' });
      try {
        const b64 = req.body.stt;
        if (b64.length > 4_000_000) return res.status(413).json({ error: 'audio_too_long' });
        const mime = ['audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg', 'audio/wav'].includes(req.body.mime) ? req.body.mime : 'audio/webm';
        const ext = { 'audio/webm': 'webm', 'audio/ogg': 'ogg', 'audio/mp4': 'm4a', 'audio/mpeg': 'mp3', 'audio/wav': 'wav' }[mime];
        const form = new FormData();
        form.append('file', new Blob([Buffer.from(b64, 'base64')], { type: mime }), `speech.${ext}`);
        form.append('model', process.env.GROQ_STT_MODEL || 'whisper-large-v3-turbo');
        form.append('language', 'ar');
        form.append('temperature', '0');
        form.append('prompt', 'إبرة وخيط الإسكافي. طلب ORD، فاتورة، الشركات، جاهز، تسليم، باركود، الإيراد، العملاء.');
        const r = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', { method: 'POST', headers: { authorization: `Bearer ${gk}` }, body: form });
        if (!r.ok) throw new Error(`groq_stt_${r.status}`);
        const j = await r.json();
        return res.status(200).json({ text: String(j.text || '').trim().slice(0, 1000) });
      } catch (err) {
        console.error('api/secure/data (stt) error', err);
        return res.status(502).json({ error: 'stt_failed', detail: String(err.message || '').slice(0, 80) });
      }
    }
    const apiKey = process.env.ANTHROPIC_API_KEY;
    const FINROLES = ['owner', 'admin', 'manager', 'accountant'];
    const canSeeMoney = FINROLES.includes(sess.role);
    const sb = getSupabaseAdmin();
    const todayRiyadh = () => new Date(Date.now() + 3 * 3600 * 1000).toISOString().slice(0, 10);
    const ORDER_COLS = 'order_number,customer_name,customer_phone,item_type,description,status,delivery_date,shelf_location,created_at,partner_id' + (canSeeMoney ? ',total_price,payment_status' : '');

    const tools = [
      { name: 'find_orders', description: 'بحث عن طلبات برقم الطلب أو اسم العميل أو رقم جواله، أو حسب الحالة. للقراءة فقط.',
        input_schema: { type: 'object', properties: {
          query: { type: 'string', description: 'رقم طلب أو اسم أو جوال (اختياري)' },
          status: { type: 'string', enum: ['pending', 'in_progress', 'ready', 'completed', 'cancelled'] },
          limit: { type: 'integer', description: 'حتى 15' } } } },
      { name: 'deliveries', description: 'الطلبات غير المسلَّمة التي موعد تسليمها اليوم أو متأخر أو خلال يومين.',
        input_schema: { type: 'object', properties: {} } },
      { name: 'counts_today', description: 'عدد الطلبات المسجلة اليوم وعدد الجاهزة وعدد المسلَّمة.',
        input_schema: { type: 'object', properties: {} } },
    ];
    if (canSeeMoney) {
      tools.push(
        { name: 'revenue', description: 'إجمالي الإيراد (شامل الضريبة) لفترة. لا يُحسب الشيء مرتين.',
          input_schema: { type: 'object', properties: { period: { type: 'string', enum: ['today', 'week', 'month'] } }, required: ['period'] } },
        { name: 'partners_due', description: 'الشركات الشريكة: غير المسدد والمستحق الآن والقريب الاستحقاق.',
          input_schema: { type: 'object', properties: {} } },
      );
    }

    const runTool = async (name, input) => {
      input = input || {};
      if (name === 'find_orders') {
        let q = sb.from('orders').select(ORDER_COLS).order('created_at', { ascending: false }).limit(Math.min(parseInt(input.limit, 10) || 8, 15));
        if (input.status) q = q.eq('status', input.status);
        const t = String(input.query || '').trim().replace(/[%,()]/g, '').slice(0, 40);
        if (t) q = q.or(`order_number.ilike.%${t}%,customer_name.ilike.%${t}%,customer_phone.ilike.%${t}%`);
        const { data, error } = await q; if (error) throw error;
        return data || [];
      }
      if (name === 'deliveries') {
        const t0 = todayRiyadh();
        const t2 = new Date(Date.parse(t0) + 2 * 86400000).toISOString().slice(0, 10);
        const { data, error } = await sb.from('orders').select(ORDER_COLS).not('status', 'in', '(completed,cancelled)').lte('delivery_date', t2).order('delivery_date').limit(40);
        if (error) throw error;
        return { today: t0, orders: (data || []).map((o) => ({ ...o, timing: o.delivery_date < t0 ? 'متأخر' : o.delivery_date === t0 ? 'اليوم' : 'خلال يومين' })) };
      }
      if (name === 'counts_today') {
        const t0 = todayRiyadh();
        const { data, error } = await sb.from('orders').select('status').gte('created_at', `${t0}T00:00:00+03:00`).limit(2000);
        if (error) throw error;
        const c = {}; (data || []).forEach((o) => { c[o.status] = (c[o.status] || 0) + 1; });
        return { registered_today: (data || []).length, by_status: c };
      }
      if (name === 'revenue' && canSeeMoney) {
        const t0 = todayRiyadh();
        const days = { today: 0, week: 6, month: 29 }[input.period] ?? 0;
        const from = `${new Date(Date.parse(t0) - days * 86400000).toISOString().slice(0, 10)}T00:00:00+03:00`;
        const [o, i] = await Promise.all([
          sb.from('orders').select('total_price,status').gte('created_at', from).neq('status', 'cancelled').limit(5000),
          sb.from('sales_invoices').select('total,items').gte('created_at', from).limit(5000),
        ]);
        if (o.error) throw o.error; if (i.error) throw i.error;
        const orders = o.data || [];
        // فاتورة الشركة المجمّعة (بنودها تحمل order_id) تغطي طلبات محسوبة أصلاً
        const inv = (i.data || []).filter((x) => !(Array.isArray(x.items) && x.items.some((it) => it && it.order_id)));
        const ordersSum = orders.reduce((a, x) => a + Number(x.total_price || 0), 0);
        const salesSum = inv.reduce((a, x) => a + Number(x.total || 0), 0);
        return { period: input.period, repair_orders_total: +ordersSum.toFixed(2), product_sales_total: +salesSum.toFixed(2), grand_total: +(ordersSum + salesSum).toFixed(2), currency: 'SAR', note: 'شامل ضريبة 15%' };
      }
      if (name === 'partners_due' && canSeeMoney) {
        const { data, error } = await sb.rpc('partner_admin_list'); if (error) throw error;
        return (data || []).map((p) => ({ name: p.name, unpaid_total: p.unpaid_total, due_now_total: p.due_total, due_now_count: p.due_count, due_soon_total: p.soon_total || 0 }));
      }
      const periodFrom = (period) => {
        const t0 = todayRiyadh();
        const days = { today: 0, week: 6, month: 29, quarter: 89, year: 364 }[period] ?? 29;
        return `${new Date(Date.parse(t0) - days * 86400000).toISOString().slice(0, 10)}T00:00:00+03:00`;
      };
      if (name === 'order_details') {
        const num = String(input.order_number || '').toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 20);
        const { data, error } = await sb.from('orders').select('order_number,customer_name,customer_phone,item_type,description,notes,status,payment_status,paid,shelf_location,delivery_date,created_at,delivered_at,quantity,employee_name' + (canSeeMoney ? ',total_price,payment_method' : '')).eq('order_number', num).limit(1);
        if (error) throw error;
        return data?.[0] || { found: false };
      }
      if (name === 'customer_lookup') {
        const t = String(input.query || '').replace(/[%,()]/g, '').trim().slice(0, 40);
        if (!t) return { error: 'empty_query' };
        const { data, error } = await sb.from('customers').select('name,phone,city,total_orders,loyalty_tier,stamps' + (canSeeMoney ? ',total_spent' : '')).or(`name.ilike.%${t}%,phone.ilike.%${t}%`).limit(8);
        if (error) throw error;
        return data || [];
      }
      if (name === 'sales_by_service' && canSeeMoney) {
        const { data, error } = await sb.from('orders').select('item_type,total_price').gte('created_at', periodFrom(input.period)).neq('status', 'cancelled').is('partner_id', null).limit(5000);
        if (error) throw error;
        const m = {}; (data || []).forEach((o) => { const k = o.item_type || 'غير محدد'; m[k] = m[k] || { count: 0, total: 0 }; m[k].count++; m[k].total += Number(o.total_price || 0); });
        return { period: input.period || 'month', note: 'طلبات الأفراد فقط', by_item: Object.entries(m).map(([k, v]) => ({ item: k, count: v.count, total: +v.total.toFixed(2) })).sort((a, b) => b.total - a.total).slice(0, 12) };
      }
      if (name === 'top_customers' && canSeeMoney) {
        const { data, error } = await sb.from('customers').select('name,phone,total_orders,total_spent').order('total_spent', { ascending: false }).limit(Math.min(parseInt(input.limit, 10) || 5, 10));
        if (error) throw error;
        return data || [];
      }
      if (name === 'expenses_summary' && canSeeMoney) {
        const { data, error } = await sb.from('expenses').select('category,amount').gte('created_at', periodFrom(input.period)).limit(5000);
        if (error) throw error;
        const m = {}; let tot = 0; (data || []).forEach((e) => { const a = Number(e.amount || 0); tot += a; m[e.category || 'أخرى'] = (m[e.category || 'أخرى'] || 0) + a; });
        return { period: input.period || 'month', total: +tot.toFixed(2), by_category: Object.entries(m).map(([k, v]) => ({ category: k, total: +v.toFixed(2) })).sort((a, b) => b.total - a.total) };
      }
      if (name === 'unpaid_orders' && canSeeMoney) {
        const { data, error } = await sb.from('orders').select('order_number,customer_name,customer_phone,total_price,status,payment_status').is('partner_id', null).neq('status', 'cancelled').neq('payment_status', 'paid').order('created_at', { ascending: false }).limit(20);
        if (error) throw error;
        return { count: (data || []).length, total: +(data || []).reduce((a, o) => a + Number(o.total_price || 0), 0).toFixed(2), orders: data || [] };
      }
      return { error: 'tool_not_available' };
    };

    // وضع الأدوات المباشر (بدون ذكاء صناعي خارجي): المحرك المحلي في المتصفح يحدد النية ويستدعي الأداة هنا
    if (req.body && typeof req.body.tool === 'string') {
      const allowed = ['find_orders', 'deliveries', 'counts_today', 'revenue', 'partners_due'];
      if (!allowed.includes(req.body.tool)) return res.status(400).json({ error: 'unknown_tool' });
      try {
        const data = await runTool(req.body.tool, req.body.input);
        return res.status(200).json({ data });
      } catch (err) {
        console.error('api/secure/data (assistant tool) error', err);
        return res.status(500).json({ error: 'tool_failed' });
      }
    }
    const geminiKey = process.env.GEMINI_API_KEY;
    const groqKey = process.env.GROQ_API_KEY;
    const gatewayKey = process.env.AI_GATEWAY_API_KEY;
    const localUrl = (process.env.LOCAL_AGENT_URL || '').replace(/\/+$/, '');
    if (!apiKey && !geminiKey && !groqKey && !gatewayKey && !localUrl) return res.status(503).json({ error: 'ai_not_configured' });

    // ── العقل الذكي عبر Gemini (مجاني بمفتاح من Google AI Studio): مستشار نقاش بسياق بيانات المحل ──
    if (geminiKey || groqKey || gatewayKey || localUrl) {
      try {
        const { text, history } = req.body || {};
        const said = String(text || '').trim().slice(0, 1200);
        if (!said) return res.status(400).json({ error: 'missing_text' });
        // لقطة بيانات حيّة تُعطى للمستشار (المالية فقط لمن يملك الصلاحية)
        const snap = {};
        const safe = async (k, fn) => { try { snap[k] = await fn(); } catch { /* تجاهل */ } };
        await Promise.all([
          safe('registered_today', () => runTool('counts_today', {})),
          safe('deliveries_due', async () => { const d = await runTool('deliveries', {}); return { today: d.today, count: d.orders.length, sample: d.orders.slice(0, 12).map((o) => `${o.order_number} ${o.timing}`) }; }),
          ...(canSeeMoney ? [
            safe('revenue_today', () => runTool('revenue', { period: 'today' })),
            safe('revenue_week', () => runTool('revenue', { period: 'week' })),
            safe('revenue_month', () => runTool('revenue', { period: 'month' })),
            safe('partners', () => runTool('partners_due', {})),
          ] : []),
        ]);
        const system = `أنت "مساعد إبرة وخيط" — مستشار أعمال ذكي ودود لورشة إصلاح أحذية وحقائب وجلديات في الرياض (إبرة وخيط الإسكافي). تتحدث مع ${sess.name || 'المدير'} (${sess.role}).
اللهجة: افهم كل اللهجات العربية، وردّ بنفس لهجة المتحدث (الافتراضي سعودية بيضاء). الرد للنطق الصوتي: جمل قصيرة طبيعية، بدون جداول ولا رموز كثيرة.
دورك: ناقش، اسأل أسئلة توضيحية، اقترح حلولاً عملية قابلة للتنفيذ (تسعير، تسليم، متابعة تحصيل الشركات، كفاءة الورشة، تسويق، خدمة العملاء)، وقدّم رأيك بصراحة مع ذكر المفاضلات. لا تخترع أرقاماً: استعمل لقطة البيانات أدناه فقط، وإذا ما كفت قل ذلك.
للأرقام استعمل الدوال المتاحة. لتغيير حالة طلب استعمل change_order_status (لا ينفَّذ إلا بعد تأكيد المستخدم). للبحث في الإنترنت يوجد وضع بحث جوجل عند طلب المستخدم ذلك. الردود مختصرة بالعامية. لا تعطِ استشارة قانونية/ضريبية قاطعة: اذكر أنها إرشاد عام وراجع محاسباً أو هيئة الزكاة للقرار النهائي.
تاريخ اليوم: ${todayRiyadh()}. لقطة بيانات المحل الآن: ${JSON.stringify(snap).slice(0, 6000)}`;
        const hist = (Array.isArray(history) ? history : []).slice(-10).map((m) => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: String(m.content || '').slice(0, 1200) }));
        const errors = [];
        let reply = '';
        let action = null;
        // ── الوكيل المحلي (Qwen2.5 على جهازك عبر نفق آمن): للمدراء فقط لأنه يملك صلاحية القراءة الكاملة ──
        const localOk = !!localUrl && ['owner', 'admin', 'manager'].includes(sess.role);
        const askLocal = async () => {
          try {
            const r = await fetch(`${localUrl}/chat`, {
              method: 'POST', headers: { 'content-type': 'application/json', 'x-token': process.env.LOCAL_AGENT_TOKEN || '' },
              body: JSON.stringify({ phone: `web-${sess.role}-${sess.name || ''}`.slice(0, 40), text: said }), signal: AbortSignal.timeout(25000),
            });
            if (!r.ok) throw new Error(`local_http_${r.status}`);
            reply = String((await r.json()).reply || '').trim();
            if (!reply) throw new Error('local_empty');
          } catch (e) { errors.push(`local:${String(e.message || e).slice(0, 60)}`); }
        };
        if (localOk && process.env.LOCAL_AGENT_FIRST === '1') await askLocal();
        // ── المسار الأول: Vercel AI SDK عبر AI Gateway (مفتاح واحد لأي نموذج) ──
        if (gatewayKey) {
          try {
            const { generateText, tool, stepCountIs } = await import('ai');
            const { z } = await import('zod');
            const tools = {
              find_orders: tool({ description: 'بحث عن طلبات برقم الطلب أو اسم العميل أو جواله أو الحالة', inputSchema: z.object({ query: z.string().optional(), status: z.enum(['pending', 'in_progress', 'ready', 'completed', 'cancelled']).optional(), limit: z.number().optional() }), execute: async (a) => runTool('find_orders', a) }),
              deliveries: tool({ description: 'الطلبات غير المسلَّمة المتأخرة أو المستحقة اليوم أو خلال يومين', inputSchema: z.object({}), execute: async () => runTool('deliveries', {}) }),
              counts_today: tool({ description: 'عدد الطلبات المسجلة اليوم حسب الحالة', inputSchema: z.object({}), execute: async () => runTool('counts_today', {}) }),
              order_details: tool({ description: 'تفاصيل طلب كاملة (وصف، ملاحظات، رف، حالة الدفع) برقم الطلب', inputSchema: z.object({ order_number: z.string() }), execute: async (a) => runTool('order_details', a) }),
              customer_lookup: tool({ description: 'بحث عن عميل باسمه أو جواله (عدد طلباته ومستوى الولاء)', inputSchema: z.object({ query: z.string() }), execute: async (a) => runTool('customer_lookup', a) }),
              ...(canSeeMoney ? {
                sales_by_service: tool({ description: 'المبيعات مقسمة حسب نوع القطعة/الخدمة لفترة', inputSchema: z.object({ period: z.enum(['today', 'week', 'month', 'quarter', 'year']) }), execute: async (a) => runTool('sales_by_service', a) }),
                top_customers: tool({ description: 'أكثر العملاء إنفاقاً', inputSchema: z.object({ limit: z.number().optional() }), execute: async (a) => runTool('top_customers', a) }),
                expenses_summary: tool({ description: 'ملخص المصروفات حسب التصنيف لفترة', inputSchema: z.object({ period: z.enum(['today', 'week', 'month', 'quarter', 'year']) }), execute: async (a) => runTool('expenses_summary', a) }),
                unpaid_orders: tool({ description: 'طلبات الأفراد غير المدفوعة وإجماليها', inputSchema: z.object({}), execute: async () => runTool('unpaid_orders', {}) }),
                revenue: tool({ description: 'إجمالي الإيراد لفترة', inputSchema: z.object({ period: z.enum(['today', 'week', 'month']) }), execute: async (a) => runTool('revenue', a) }),
                partners_due: tool({ description: 'مبالغ الشركات غير المسددة والمستحقة', inputSchema: z.object({}), execute: async () => runTool('partners_due', {}) }),
              } : {}),
              ...(sess.role !== 'accountant' ? {
                prepare_new_order: tool({
                  description: 'تجهيز طلب جديد: يفتح نموذج الطلب معبّأً للمراجعة والحفظ من المستخدم (لا يُحفظ تلقائياً). اطلب اسم العميل وجواله ونوع القطعة على الأقل.',
                  inputSchema: z.object({ customer_name: z.string(), customer_phone: z.string().optional(), item_type: z.enum(['shoes', 'bag', 'dress', 'suit', 'jacket', 'pants', 'shirt', 'other']).optional(), description: z.string().optional(), total_price: z.number().optional(), delivery_date: z.string().optional().describe('YYYY-MM-DD'), notes: z.string().optional() }),
                  execute: async (a) => {
                    const d = { customer_name: String(a.customer_name || '').slice(0, 80), customer_phone: String(a.customer_phone || '').replace(/[^\d+]/g, '').slice(0, 15), item_type: a.item_type || 'shoes', description: String(a.description || '').slice(0, 300), total_price: a.total_price > 0 ? String(a.total_price) : '', delivery_date: /^\d{4}-\d{2}-\d{2}$/.test(a.delivery_date || '') ? a.delivery_date : '', notes: String(a.notes || '').slice(0, 300) };
                    action = { type: 'new_order', draft: d };
                    return { ok: true, note: 'سيُفتح نموذج الطلب للمراجعة؛ قل للمستخدم أن يراجع ويحفظ.' };
                  },
                }),
                add_order_note: tool({
                  description: 'إضافة ملاحظة لطلب موجود (تُنفَّذ بعد تأكيد المستخدم)',
                  inputSchema: z.object({ order_number: z.string(), note: z.string() }),
                  execute: async (a) => {
                    action = { type: 'add_note', order_number: String(a.order_number || '').toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 20), note: String(a.note || '').slice(0, 300) };
                    return { pending_user_confirmation: true };
                  },
                }),
                set_delivery_date: tool({
                  description: 'تغيير موعد تسليم طلب (تُنفَّذ بعد تأكيد المستخدم)',
                  inputSchema: z.object({ order_number: z.string(), delivery_date: z.string().describe('YYYY-MM-DD') }),
                  execute: async (a) => {
                    if (!/^\d{4}-\d{2}-\d{2}$/.test(a.delivery_date || '')) return { error: 'bad_date' };
                    action = { type: 'set_delivery', order_number: String(a.order_number || '').toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 20), delivery_date: a.delivery_date };
                    return { pending_user_confirmation: true };
                  },
                }),
                change_order_status: tool({
                  description: 'طلب تغيير حالة طلب إلى جاهز (ready) أو تم التسليم (completed). لا يُنفَّذ إلا بعد تأكيد المستخدم، فاسأله للتأكيد.',
                  inputSchema: z.object({ order_number: z.string(), status: z.enum(['ready', 'completed']) }),
                  execute: async (a) => {
                    const num = String(a.order_number || '').toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 20);
                    action = { type: 'set_status', order_number: num, status: a.status, label: a.status === 'completed' ? 'تم التسليم' : 'جاهز' };
                    return { pending_user_confirmation: true, note: 'لم يتغير شيء بعد؛ اسأل المستخدم يؤكد.' };
                  },
                }),
              } : {}),
            };
            const out = await generateText({
              model: process.env.AI_MODEL || 'google/gemini-2.5-flash',
              system,
              messages: [...hist, { role: 'user', content: said }],
              tools,
              stopWhen: stepCountIs(5),
              maxOutputTokens: 1024,
            });
            reply = (out.text || '').trim();
            if (!reply) throw new Error('gateway_empty');
          } catch (e) { action = null; errors.push(`gateway:${String(e.message || e).slice(0, 80)}`); console.error('assistant gateway', e.message); }
        }
        if (!reply && geminiKey) {
          try {
            const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
            const callG = async (body) => {
              const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
                method: 'POST', headers: { 'content-type': 'application/json', 'x-goog-api-key': geminiKey }, body: JSON.stringify(body),
              });
              if (!r.ok) { const t = await r.text().catch(() => ''); throw new Error(`gemini_http_${r.status}${/ACCESS_TOKEN_TYPE_UNSUPPORTED/.test(t) ? '_AQ_key_unsupported' : ''}`); }
              return r.json();
            };
            const textOf = (j) => (j.candidates?.[0]?.content?.parts || []).filter((x) => !x.thought).map((x) => x.text || '').join('').trim();
            const gen = { maxOutputTokens: 2048, temperature: 0.7, thinkingConfig: { thinkingBudget: 0 } };
            const baseContents = [...hist.map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })), { role: 'user', parts: [{ text: said }] }];
            const wantsWeb = /(ابحث (في )?(الانترنت|النت|جوجل|قوقل|الويب)|دور (في )?(الانترنت|النت|جوجل)|search the web|اخر اخبار|سعر .*(الان|اليوم) في السوق|الطقس|احوال الطقس|منافسين|اسعار المنافسين)/.test(normalizeAr(said));
            if (wantsWeb) {
              // بحث جوجل الحقيقي (Grounding) — لا يُدمج مع الدوال بنفس الطلب
              const j = await callG({ systemInstruction: { parts: [{ text: system }] }, contents: baseContents, tools: [{ google_search: {} }], generationConfig: gen });
              reply = textOf(j);
            } else {
              const fdecl = [
                { name: 'find_orders', description: 'بحث عن طلبات برقم الطلب أو اسم العميل أو جواله أو الحالة', parameters: { type: 'OBJECT', properties: { query: { type: 'STRING' }, status: { type: 'STRING', enum: ['pending', 'in_progress', 'ready', 'completed', 'cancelled'] }, limit: { type: 'INTEGER' } } } },
                { name: 'deliveries', description: 'الطلبات غير المسلَّمة المتأخرة أو المستحقة اليوم أو خلال يومين', parameters: { type: 'OBJECT', properties: {} } },
                { name: 'counts_today', description: 'عدد الطلبات المسجلة اليوم حسب الحالة', parameters: { type: 'OBJECT', properties: {} } },
                ...(canSeeMoney ? [
                  { name: 'revenue', description: 'إجمالي الإيراد لفترة (today/week/month)', parameters: { type: 'OBJECT', properties: { period: { type: 'STRING', enum: ['today', 'week', 'month'] } }, required: ['period'] } },
                  { name: 'partners_due', description: 'مبالغ الشركات غير المسددة والمستحقة', parameters: { type: 'OBJECT', properties: {} } },
                ] : []),
                ...(sess.role !== 'accountant' ? [
                  { name: 'change_order_status', description: 'طلب تغيير حالة طلب إلى جاهز (ready) أو تم التسليم (completed). لا يُنفَّذ إلا بعد تأكيد المستخدم، فاسأله بعدها للتأكيد.', parameters: { type: 'OBJECT', properties: { order_number: { type: 'STRING' }, status: { type: 'STRING', enum: ['ready', 'completed'] } }, required: ['order_number', 'status'] } },
                ] : []),
              ];
              let contents = baseContents;
              for (let round = 0; round < 4; round++) {
                const j = await callG({ systemInstruction: { parts: [{ text: system }] }, contents, tools: [{ functionDeclarations: fdecl }], generationConfig: gen });
                const parts = j.candidates?.[0]?.content?.parts || [];
                const calls = parts.filter((x) => x.functionCall);
                if (!calls.length) { reply = textOf(j); if (!reply) throw new Error(`gemini_empty_${j.candidates?.[0]?.finishReason || j.promptFeedback?.blockReason || 'unknown'}`); break; }
                const responses = [];
                for (const c of calls) {
                  const { name, args } = c.functionCall;
                  let out;
                  if (name === 'change_order_status') {
                    const num = String(args?.order_number || '').toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 20);
                    const st = args?.status === 'completed' ? 'completed' : 'ready';
                    action = { type: 'set_status', order_number: num, status: st, label: st === 'completed' ? 'تم التسليم' : 'جاهز' };
                    out = { pending_user_confirmation: true, note: 'لم يتغير شيء بعد؛ اسأل المستخدم يؤكد.' };
                  } else { try { out = await runTool(name, args); } catch { out = { error: 'tool_failed' }; } }
                  responses.push({ functionResponse: { name, response: { result: out } } });
                }
                contents = [...contents, { role: 'model', parts }, { role: 'user', parts: responses }];
              }
            }
            if (!reply) throw new Error('gemini_empty_unknown');
          } catch (e) { errors.push(e.message); console.error('assistant gemini', e.message); }
        }
        if (!reply && groqKey) {
          try {
            const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
              method: 'POST',
              headers: { 'content-type': 'application/json', authorization: `Bearer ${groqKey}` },
              body: JSON.stringify({ model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile', temperature: 0.7, max_tokens: 900,
                messages: [{ role: 'system', content: system }, ...hist, { role: 'user', content: said }] }),
            });
            if (!r.ok) throw new Error(`groq_http_${r.status}`);
            const j = await r.json();
            reply = String(j.choices?.[0]?.message?.content || '').trim();
          } catch (e) { errors.push(e.message); console.error('assistant groq', e.message); }
        }
        if (!reply && localOk && process.env.LOCAL_AGENT_FIRST !== '1') await askLocal();
        if (!reply) return res.status(502).json({ error: 'ai_failed', detail: errors.join(' | ') || `empty_reply(providers:${[gatewayKey && 'gateway', geminiKey && 'gemini', groqKey && 'groq'].filter(Boolean).join('+')})` });
        return res.status(200).json({ reply: reply.slice(0, 2000), ...(action ? { action } : {}) });
      } catch (err) {
        console.error('api/secure/data (assistant llm) error', err);
        return res.status(502).json({ error: 'ai_failed', detail: String(err.message || '').slice(0, 120) });
      }
    }
    if (!apiKey) return res.status(503).json({ error: 'ai_not_configured' });

    try {
      const { text, history } = req.body || {};
      const said = String(text || '').trim().slice(0, 800);
      if (!said) return res.status(400).json({ error: 'missing_text' });
      const hist = (Array.isArray(history) ? history : []).slice(-8)
        .map((m) => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: String(m.content || '').slice(0, 800) }));
      const system = `أنت "مساعد إبرة وخيط" — مساعد ذكي لورشة إصلاح أحذية وحقائب وجلديات في الرياض (إبرة وخيط الإسكافي). أنت تتكلم مع ${sess.name || 'الموظف'} (دوره: ${sess.role}).
اللغة: افهم كل اللهجات العربية (سعودي، خليجي، مصري، شامي، سوداني، يمني، مغاربي، فصحى) حتى لو كُتب الكلام بالحروف اللاتينية أو بأخطاء إملائية أو نص مُملى صوتياً. ورد بنفس لهجة المتحدث بأسلوب ودود ومختصر مناسب للنطق الصوتي (جملة إلى ثلاث). الافتراضي لهجة سعودية بيضاء.
القواعد: استعمل الأدوات للإجابة عن أي سؤال يخص الطلبات أو التسليم أو الإيراد أو الشركات ولا تخترع أرقاماً أبداً. أنت للقراءة فقط: إذا طلب تنفيذ تغيير (تغيير حالة طلب، حذف، تعديل سعر، إصدار فاتورة) فقل له بلطف إنك لا تنفذ التغييرات وأرشده للصفحة المناسبة في النظام. لا تكشف أرقاماً مالية لمن ليس لديه صلاحية. المبالغ بالريال السعودي. التاريخ اليوم: ${todayRiyadh()}.`;
      let messages = [...hist, { role: 'user', content: said }];
      let reply = '';
      for (let round = 0; round < 4; round++) {
        const r = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
          body: JSON.stringify({ model: 'claude-sonnet-5-5', max_tokens: 600, system, tools, messages }),
        });
        if (!r.ok) throw new Error(`ai_http_${r.status}`);
        const j = await r.json();
        const uses = (j.content || []).filter((c) => c.type === 'tool_use');
        if (j.stop_reason !== 'tool_use' || !uses.length) {
          reply = (j.content || []).filter((c) => c.type === 'text').map((c) => c.text).join('').trim();
          break;
        }
        const results = [];
        for (const u of uses) {
          let out; try { out = await runTool(u.name, u.input); } catch (e) { console.error('assistant tool', u.name, e); out = { error: 'tool_failed' }; }
          results.push({ type: 'tool_result', tool_use_id: u.id, content: JSON.stringify(out).slice(0, 12000) });
        }
        messages = [...messages, { role: 'assistant', content: j.content }, { role: 'user', content: results }];
      }
      return res.status(200).json({ reply: (reply || 'ما قدرت أجاوب الحين، جرّب مرة ثانية.').slice(0, 1200) });
    } catch (err) {
      console.error('api/secure/data (assistant) error', err);
      return res.status(502).json({ error: 'ai_failed', detail: `anthropic:${String(err.message || '').slice(0, 80)}` });
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
