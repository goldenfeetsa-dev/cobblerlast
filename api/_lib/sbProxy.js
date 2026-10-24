/**
 * api/_lib/sbProxy.js — بوابة آمنة بين المتصفح وقاعدة Supabase
 * ──────────────────────────────────────────────────────────────────
 * المتصفح لم يعد يكلّم Supabase مباشرة بالمفتاح العام (anon). كل طلب
 * (rest / rpc / storage / functions) يمر من هنا:  /sb/*  →  /api/secure/data?resource=sb
 *   1) نتحقق من جلسة الموظف (كوكي HttpOnly) أو نسمح بقائمة بيضاء ضيقة للزوار.
 *   2) نطبّق صلاحية الدور لكل جدول وعملية (قراءة/إضافة/تعديل/حذف).
 *   3) للفنّي (staff) نفرض قائمة أعمدة مسموحة فقط (بدون جوال/سعر/فاتورة/ضريبة).
 *   4) ننفّذ الطلب بمفتاح service_role (يبقى بالخادم فقط).
 * بعد تشغيل migration 042 يُقفل الوصول المباشر للمفتاح العام نهائياً.
 */
import { getSessionFromRequest } from './session.js';

const SB_URL = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://bwuvldnlfgobqpdfhyql.supabase.co').replace(/\/$/, '');
const SERVICE = () => process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON = () => process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';

const OWN = ['owner', 'admin', 'manager'];
const FIN = [...OWN, 'accountant'];
const FRONT = [...OWN, 'cashier'];
const NS = [...OWN, 'accountant', 'cashier']; // كل الأدوار عدا الفنّي
const ALL = [...NS, 'staff'];
const OA = ['owner', 'admin'];

// r=قراءة w=إضافة/تعديل d=حذف ؛ pub=مسموح بدون تسجيل دخول (r|i)
const T = {
  orders: { r: ALL, i: FRONT, u: ALL, d: OWN },
  employees: { r: ALL, i: OA, u: OA, d: OA, safe: 'id,name,role,branch_id,branch_name,is_active,total_orders,total_revenue,created_at,avatar_url,auth_user_id', staffCols: 'id,name,role,branch_id,branch_name,is_active,avatar_url' },
  branches: { r: ALL, i: OWN, u: OWN, d: OWN },
  inventory_items: { r: NS, i: NS, u: NS, d: OWN },
  stock_movements: { r: NS, i: NS, u: NS, d: OWN },
  suppliers: { r: FIN, i: FIN, u: FIN, d: OWN },
  supplier_products: { r: FIN, i: FIN, u: FIN, d: OWN },
  purchase_invoices: { r: FIN, i: FIN, u: FIN, d: OWN },
  purchase_invoice_items: { r: FIN, i: FIN, u: FIN, d: OWN },
  products: { r: NS, i: OWN, u: [...OWN, 'cashier'], d: OWN, pubR: true },
  sales_invoices: { r: NS, i: NS, u: NS, d: OA },
  audit_logs: { r: FIN, i: ALL, u: [], d: [] },
  app_settings: { r: ALL, i: OWN, u: OWN, d: [], pubR: true, safe: 'id,shop_name,vat_number,cr_number,city,address,phone,logo_url,vat_enabled,vat_rate,currency,zatca_enabled,zatca_sandbox,zatca_connected,moyasar_publishable_key,updated_at,social_instagram,social_whatsapp,social_twitter,social_snapchat,social_tiktok,google_maps_url,b2b_invoicing_enabled' },
  loyalty_cards: { r: NS, i: NS, u: NS, d: OWN },
  loyalty_stamps: { r: NS, i: NS, u: NS, d: OWN },
  loyalty_settings: { r: NS, i: OWN, u: OWN, d: OWN },
  loyalty_members: { r: NS, i: NS, u: NS, d: OWN },
  loyalty_points_transactions: { r: NS, i: NS, u: NS, d: OWN },
  loyalty_member_notifications: { r: NS, i: NS, u: NS, d: OWN },
  loyalty_membership_settings: { r: NS, i: OWN, u: OWN, d: OWN },
  bookings: { r: NS, i: NS, u: NS, d: OWN, pubI: true, pubRPhone: true },
  services: { r: ALL, i: OWN, u: OWN, d: OWN, pubR: true },
  job_postings: { r: ALL, i: OWN, u: OWN, d: OWN, pubR: true },
  reviews: { r: ALL, i: NS, u: OWN, d: OWN, pubR: true, pubI: true, pubRFilter: ['is_approved', 'eq.true'] },
  working_hours: { r: ALL, i: OWN, u: OWN, d: OWN, pubR: true },
  brands: { r: ALL, i: OWN, u: OWN, d: OWN, pubR: true },
  shop_settings: { r: ALL, i: OWN, u: OWN, d: OWN, pubR: true },
  site_visits: { r: OWN, i: [], u: [], d: OWN, pubI: true },
  workshop_custodies: { r: FIN, i: FIN, u: FIN, d: OWN },
  workshop_settlements: { r: FIN, i: FIN, u: FIN, d: OWN },
  operations_plans: { r: FIN, i: FIN, u: FIN, d: OWN },
  workflow_stages: { r: ALL, i: OWN, u: OWN, d: OWN },
  auction_listings: { r: ALL, i: OWN, u: OWN, d: OWN, pubR: true, pubI: true },
  auction_bids: { r: ALL, i: ALL, u: [], d: OWN, pubR: true, pubI: true, hideCols: ['bidder_phone'] },
  zatca_credit_debit_notes: { r: FIN, i: [], u: [], d: [] },
};

const RPC = {
  partner_login: { pub: true },
  partner_orders: { pub: true },
  partner_submit_order: { pub: true },
  get_monthly_financial_trend: { roles: FIN },
};

const FN = { 'loyalty-notify': NS, 'send-email': NS };

const BUCKETS = {
  'order-photos': { up: ALL, pubUp: true, del: NS },
  'auction-submissions': { up: ALL, pubUp: true, del: OWN },
  'purchase-invoices': { up: FIN, del: OWN },
  'purchase-documents': { up: FIN, del: OWN },
  orders: { up: NS, del: OWN },
  branding: { up: OWN, del: OWN },
  brands: { up: OWN, del: OWN },
  'shop-products': { up: OWN, del: OWN },
};

// أعمدة الطلبات المسموحة للفنّي (لا جوال، لا سعر، لا فاتورة، لا ضريبة، لا عنوان توصيل)
const STAFF_ORDER_COLS = [
  'id', 'order_number', 'customer_name', 'item_type', 'description', 'status', 'photos',
  'shelf_location', 'branch_id', 'branch_name', 'employee_id', 'employee_name', 'created_at', 'updated_at',
  'quantity', 'notes', 'delivery_date', 'delivered_at', 'source', 'order_items',
  'work_started_at', 'work_done_at', 'worker_id', 'worker_name', 'is_b2b',
];
const STAFF_ORDER_UPDATE = ['status', 'shelf_location', 'notes', 'delivery_date', 'work_started_at', 'work_done_at', 'worker_id', 'worker_name', 'delivered_at'];
const PRICEY = /price|amount|total|vat|cost|tax|subtotal/i;

const RESERVED = new Set(['select', 'order', 'limit', 'offset', 'on_conflict', 'columns']);
const STORE = new Map();

function rateLimited(ip, key, max, windowMs) {
  const now = Date.now();
  const k = `${key}:${ip}`;
  const e = STORE.get(k);
  if (!e || now - e.t > windowMs) { STORE.set(k, { t: now, n: 1 }); if (STORE.size > 5000) STORE.clear(); return false; }
  e.n += 1;
  return e.n > max;
}

const deny = (res, code, msg) => res.status(code).json({ message: msg, code: String(code), error: msg });

function stripPricey(v) {
  if (Array.isArray(v)) return v.map(stripPricey);
  if (v && typeof v === 'object') {
    const o = {};
    for (const [k, x] of Object.entries(v)) { if (!PRICEY.test(k)) o[k] = stripPricey(x); }
    return o;
  }
  return v;
}

function cleanSelect(sel, allowed) {
  // يرجّع قائمة أعمدة مسموحة أو null لو الطلب غير مسموح
  if (!sel || sel === '*') return null;
  if (/[()!:]/.test(sel)) return null;
  const cols = sel.split(',').map((s) => s.trim());
  return cols.every((c) => allowed.includes(c)) ? cols.join(',') : null;
}

export async function handleSbProxy(req, res) {
  if (!SERVICE()) return deny(res, 500, 'server_not_configured');
  res.setHeader('Cache-Control', 'no-store');

  const url = new URL(req.url, 'http://x');
  // Vercel قد يُلحق متغير المسار (:path*) كمعامل إضافي؛ نستنتج المسار من أي معامل قيمته تبدأ بـ rest/ storage/ functions/
  const isPathVal = (v) => /^(rest|storage|functions)\/v1\//.test(v);
  let path = String(url.searchParams.get('p') || '');
  if (!isPathVal(path)) { for (const [, v] of url.searchParams) { if (isPathVal(v)) { path = v; break; } } }
  path = path.replace(/^\/+/, '');
  const rawParts = (url.search || '').replace(/^\?/, '').split('&').filter((s) => {
    if (!s) return false;
    const eq = s.indexOf('=');
    const key = decodeURIComponent(s.slice(0, eq < 0 ? s.length : eq));
    const val = eq < 0 ? '' : decodeURIComponent(s.slice(eq + 1).replace(/\+/g, ' '));
    if (key === 'resource' || key === 'p') return false;
    if (isPathVal(val)) return false; // معامل المسار المُلحق من Vercel
    return true;
  });
  const q = new URLSearchParams(rawParts.join('&'));
  const method = req.method;
  const ip = String(req.headers['x-forwarded-for'] || '').split(',').pop().trim() || 'ip';
  const session = getSessionFromRequest(req);
  const role = session?.role || null;
  const isPublic = !role;

  const headers = { apikey: SERVICE(), Authorization: `Bearer ${SERVICE()}` };
  for (const h of ['prefer', 'accept', 'accept-profile', 'content-profile', 'range', 'content-type', 'cache-control', 'x-upsert']) {
    if (req.headers[h]) headers[h] = req.headers[h];
  }
  let upstream = '';
  let body;
  const rawBody = () => {
    const b = req.body;
    if (b === undefined || b === null || b === '') return undefined;
    if (Buffer.isBuffer(b) || typeof b === 'string') return b;
    return JSON.stringify(b);
  };

  // ───────────── REST ─────────────
  if (path.startsWith('rest/v1/')) {
    const target = path.slice('rest/v1/'.length);

    // RPC
    if (target.startsWith('rpc/')) {
      const fn = target.slice(4);
      const rule = RPC[fn];
      if (!rule || method !== 'POST') return deny(res, 403, 'forbidden_rpc');
      if (rule.pub) {
        if (rateLimited(ip, 'rpc', 40, 60_000)) return deny(res, 429, 'too_many_requests');
      } else if (!role || !rule.roles.includes(role)) return deny(res, 403, 'forbidden');
      upstream = `${SB_URL}/rest/v1/rpc/${fn}`;
      body = rawBody();
    } else {
      const table = target.split('/')[0];
      const pol = T[table];
      if (!pol) return deny(res, 403, 'forbidden_table');
      const op = method === 'GET' || method === 'HEAD' ? 'r' : method === 'POST' ? 'i' : method === 'PATCH' ? 'u' : method === 'DELETE' ? 'd' : null;
      if (!op) return deny(res, 405, 'method_not_allowed');
      const upsert = /resolution=(merge|ignore)-duplicates/.test(String(req.headers.prefer || ''));

      if (isPublic) {
        if (rateLimited(ip, `t-${op}`, op === 'r' ? 240 : 30, 60_000)) return deny(res, 429, 'too_many_requests');
        if (op === 'r') {
          if (pol.pubR) { /* مسموح */ }
          else if (pol.pubRPhone) {
            const ph = String(q.get('customer_phone') || '');
            if (!/^eq\.[+0-9]{8,15}$/.test(ph)) return deny(res, 401, 'unauthenticated');
          } else return deny(res, 401, 'unauthenticated');
          if (pol.pubRFilter && q.get(pol.pubRFilter[0]) !== pol.pubRFilter[1]) q.set(pol.pubRFilter[0], pol.pubRFilter[1]);
        } else if (op === 'i' && pol.pubI && !upsert) {
          // مسموح (حجز/تقييم/زيارة/مزايدة/عرض مزاد)
        } else return deny(res, 401, 'unauthenticated');
      } else if (!pol[op].includes(role)) {
        return deny(res, 403, 'forbidden');
      }

      // ── فرض الأعمدة ──
      let sel = q.get('select');
      const wantsRows = op === 'r' || /return=representation/.test(String(req.headers.prefer || ''));
      let staffOrders = false;
      if (role === 'staff' && table === 'orders') {
        staffOrders = true;
        if (op === 'r' || wantsRows) {
          const ok = cleanSelect(sel, STAFF_ORDER_COLS);
          q.set('select', ok || STAFF_ORDER_COLS.join(','));
        }
        // فلاتر على أعمدة محظورة = استدلال ببيانات مخفية
        for (const [k, v] of q.entries()) {
          if (RESERVED.has(k)) continue;
          if (k === 'or' || k === 'and' || k === 'not') {
            if (/phone|price|total|paid|payment|vat|zatca|invoice|buyer|address|subtotal/i.test(v)) return deny(res, 403, 'forbidden_filter');
          } else if (!STAFF_ORDER_COLS.includes(k)) return deny(res, 403, 'forbidden_filter');
        }
        const ord = q.get('order');
        if (ord && !ord.split(',').every((o) => STAFF_ORDER_COLS.includes(o.split('.')[0]))) q.set('order', 'created_at.desc');
        if (op === 'i') return deny(res, 403, 'forbidden');
        if (op === 'u') {
          const b = req.body && typeof req.body === 'object' ? req.body : {};
          if (!Object.keys(b).length || !Object.keys(b).every((k) => STAFF_ORDER_UPDATE.includes(k))) return deny(res, 403, 'forbidden_fields');
        }
      } else if (pol.safe && (op === 'r' || wantsRows)) {
        // لا نُرجع pin ولا أعمدة الأسرار أبداً
        const safeCols = role === 'staff' && pol.staffCols ? pol.staffCols : pol.safe;
        const ok = sel && sel !== '*' && !/[()]/.test(sel) ? sel.split(',').map((s) => s.trim()) : null;
        const allowed = safeCols.split(',');
        q.set('select', ok && ok.every((c) => allowed.includes(c)) ? ok.join(',') : safeCols);
      }
      if (table === 'employees' && op !== 'r' && Array.isArray(req.body)) return deny(res, 400, 'bad_request');
      if (table === 'auction_listings' && isPublic && op === 'i') {
        const b = req.body && !Array.isArray(req.body) ? req.body : {};
        if (b.status && b.status !== 'pending') return deny(res, 403, 'forbidden');
      }
      if (table === 'auction_listings' && isPublic && op === 'r') q.append('status', 'neq.pending');
      if (table === 'reviews' && isPublic && op === 'i') {
        const b = req.body && !Array.isArray(req.body) ? req.body : {};
        req.body = { ...b, is_approved: false };
      }
      if (table === 'auction_bids' && isPublic && op === 'r') {
        // قراءة المزايدات للزوار: فقط أعمدة بدون الجوال
        const cols = (sel && sel !== '*' ? sel.split(',') : ['listing_id', 'amount', 'bidder_name', 'created_at']).filter((c) => !/phone/i.test(c));
        q.set('select', cols.join(','));
      }
      if (table === 'auction_bids' && isPublic && op === 'i') {
        // إرجاع التمثيل بدون الجوال
        q.set('select', 'id,listing_id,amount,created_at');
      }

      upstream = `${SB_URL}/rest/v1/${target}?${q.toString()}`;
      body = op === 'r' ? undefined : rawBody();

      // ── التنفيذ (مع تنقية رد الفنّي) ──
      try {
        const r = await fetch(upstream, { method, headers, body });
        const buf = Buffer.from(await r.arrayBuffer());
        for (const h of ['content-type', 'content-range', 'content-profile']) {
          const v = r.headers.get(h); if (v) res.setHeader(h, v);
        }
        if (staffOrders && r.ok && buf.length) {
          try {
            const j = JSON.parse(buf.toString('utf8'));
            const clean = (row) => (row && row.order_items ? { ...row, order_items: stripPricey(row.order_items) } : row);
            const out = Array.isArray(j) ? j.map(clean) : clean(j);
            return res.status(r.status).send(JSON.stringify(out));
          } catch { /* يرجع الرد كما هو */ }
        }
        return res.status(r.status).send(buf);
      } catch (e) {
        console.error('sb proxy rest error', e?.message);
        return deny(res, 502, 'upstream_unreachable');
      }
    }

    try {
      const r = await fetch(upstream, { method, headers, body });
      const buf = Buffer.from(await r.arrayBuffer());
      const ct = r.headers.get('content-type'); if (ct) res.setHeader('content-type', ct);
      return res.status(r.status).send(buf);
    } catch (e) {
      console.error('sb proxy rpc error', e?.message);
      return deny(res, 502, 'upstream_unreachable');
    }
  }

  // ───────────── Storage ─────────────
  if (path.startsWith('storage/v1/object/')) {
    const rest = path.slice('storage/v1/object/'.length);
    const bucket = rest.split('/')[0];
    const b = BUCKETS[bucket];
    if (!b || rest.startsWith('public/') || rest.startsWith('sign/')) return deny(res, 403, 'forbidden_bucket');
    if (method === 'POST' || method === 'PUT') {
      if (isPublic ? !b.pubUp : !b.up.includes(role)) return deny(res, isPublic ? 401 : 403, 'forbidden');
      if (isPublic && rateLimited(ip, 'up', 10, 60_000)) return deny(res, 429, 'too_many_requests');
      const ct = String(req.headers['content-type'] || '');
      if (/svg|html|xml|javascript/i.test(ct)) return deny(res, 415, 'type_not_allowed');
    } else if (method === 'DELETE') {
      if (isPublic || !b.del.includes(role)) return deny(res, isPublic ? 401 : 403, 'forbidden');
    } else return deny(res, 405, 'method_not_allowed');
    try {
      const r = await fetch(`${SB_URL}/storage/v1/object/${rest}${q.toString() ? `?${q}` : ''}`, { method, headers, body: method === 'DELETE' ? rawBody() : (Buffer.isBuffer(req.body) ? req.body : rawBody()) });
      const buf = Buffer.from(await r.arrayBuffer());
      const ct = r.headers.get('content-type'); if (ct) res.setHeader('content-type', ct);
      return res.status(r.status).send(buf);
    } catch (e) {
      console.error('sb proxy storage error', e?.message);
      return deny(res, 502, 'upstream_unreachable');
    }
  }

  // ───────────── Edge functions ─────────────
  if (path.startsWith('functions/v1/')) {
    const name = path.slice('functions/v1/'.length).split('/')[0];
    const roles = FN[name];
    if (!roles || !role || !roles.includes(role)) return deny(res, role ? 403 : 401, 'forbidden');
    try {
      const r = await fetch(`${SB_URL}/functions/v1/${name}`, {
        method, headers: { ...headers, apikey: ANON() || SERVICE(), Authorization: `Bearer ${ANON() || SERVICE()}` }, body: method === 'GET' ? undefined : rawBody(),
      });
      const buf = Buffer.from(await r.arrayBuffer());
      const ct = r.headers.get('content-type'); if (ct) res.setHeader('content-type', ct);
      return res.status(r.status).send(buf);
    } catch (e) {
      console.error('sb proxy fn error', e?.message);
      return deny(res, 502, 'upstream_unreachable');
    }
  }

  return deny(res, 404, 'not_found');
}
