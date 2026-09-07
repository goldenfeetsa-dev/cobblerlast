/**
 * supabaseApi.js
 * طبقة الوصول الوحيدة للبيانات — كل العمليات تذهب مباشرة إلى Supabase
 */
import { supabase } from '@/lib/supabaseClient';
import { secureExpenses } from '@/lib/secureApi';

// ── Generic Entity Factory ──────────────────────────────────────
// list() / get() / create() / update() / delete() / filter() لكل جدول
// أعمدة آمنة فقط (بدون أسرار) — يُستخدم صراحة مع employees و
// app_settings لأن عمود pin (كود دخول الموظف) والأعمدة السرية بـ
// app_settings (zatca_cert, zatca_private_key, twilio_sid, twilio_token)
// مقفولة على مستوى قاعدة البيانات نفسها لـ anon/authenticated — أي
// select('*') عليهم سيفشل بخطأ صلاحيات.
export const EMPLOYEE_SAFE_COLUMNS = 'id, name, role, branch_id, branch_name, is_active, total_orders, total_revenue, created_at, avatar_url, auth_user_id';
export const APP_SETTINGS_SAFE_COLUMNS = 'id, shop_name, vat_number, cr_number, city, address, phone, logo_url, vat_enabled, vat_rate, currency, zatca_enabled, zatca_sandbox, zatca_connected, moyasar_publishable_key, updated_at, social_instagram, social_whatsapp, social_twitter, social_snapchat, social_tiktok, google_maps_url, b2b_invoicing_enabled';

function createEntity(tableName) {
  return {
    async list(orderBy = '-created_at', limit = 200, columns = '*') {
      const col = orderBy.startsWith('-') ? orderBy.slice(1) : orderBy;
      const asc = !orderBy.startsWith('-');
      const { data, error } = await supabase
        .from(tableName)
        .select(columns)
        .order(col, { ascending: asc })
        .limit(limit);
      if (error) throw new Error(error.message);
      return data || [];
    },

    async get(id, columns = '*') {
      const { data, error } = await supabase
        .from(tableName).select(columns).eq('id', id).single();
      if (error) throw new Error(error.message);
      return data;
    },

    async create(record, columns = '*') {
      const { data, error } = await supabase
        .from(tableName).insert(record).select(columns).single();
      if (error) throw new Error(error.message);
      return data;
    },

    async update(id, record, columns = '*') {
      const { data, error } = await supabase
        .from(tableName).update(record).eq('id', id).select(columns).single();
      if (error) throw new Error(error.message);
      return data;
    },

    async delete(id) {
      const { error } = await supabase
        .from(tableName).delete().eq('id', id);
      if (error) throw new Error(error.message);
      return { id };
    },

    async filter(filters = {}, orderBy = 'created_at', limit = 200) {
      const col = orderBy.startsWith('-') ? orderBy.slice(1) : orderBy;
      const asc = !orderBy.startsWith('-');
      let query = supabase.from(tableName).select('*').order(col, { ascending: asc }).limit(limit);
      for (const [key, val] of Object.entries(filters)) {
        if (val === null) query = query.is(key, null);
        else if (Array.isArray(val)) query = query.in(key, val);
        else query = query.eq(key, val);
      }
      const { data, error } = await query;
      if (error) throw new Error(error.message);
      return data || [];
    },

    // Real-time subscription
    subscribe(callback) {
      const channel = supabase
        .channel(`${tableName}_changes`)
        .on('postgres_changes', { event: '*', schema: 'public', table: tableName },
          (payload) => callback(payload))
        .subscribe();
      return () => supabase.removeChannel(channel);
    },
  };
}

// ── Secure Entity Factory ───────────────────────────────────────
// نفس واجهة createEntity بالضبط (list/filter/get/create/update/delete)
// — بس تمر عبر /api/secure/data (كوكي جلسة HttpOnly + تحقق دور
// بالسيرفر) بدل استعلام مباشر لـ Supabase بمفتاح anon. أي صفحة
// تستخدم db.Customer (مثلاً) ما تحتاج تتغيّر إطلاقاً — نفس الاستدعاءات.
async function secureFetch(path, options = {}) {
  const res = await fetch(path, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `فشل الطلب (${res.status})`);
  }
  return res.json();
}

function createSecureEntity(resource) {
  const base = `/api/secure/data?resource=${resource}`;
  return {
    async list(orderBy = '-created_at', limit = 200) {
      const params = new URLSearchParams({ op: 'list', orderBy, limit: String(limit) });
      return secureFetch(`${base}&${params}`);
    },
    async filter(filters = {}, orderBy = '-created_at', limit = 200) {
      const params = new URLSearchParams({ op: 'filter', orderBy, limit: String(limit), filters: JSON.stringify(filters) });
      return secureFetch(`${base}&${params}`);
    },
    async get(id) {
      return secureFetch(`${base}&op=get&id=${encodeURIComponent(id)}`);
    },
    async create(record) {
      return secureFetch(base, { method: 'POST', body: JSON.stringify(record) });
    },
    async update(id, record) {
      return secureFetch(`${base}&id=${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(record) });
    },
    async delete(id) {
      return secureFetch(`${base}&id=${encodeURIComponent(id)}`, { method: 'DELETE' });
    },
  };
}

// ── File Upload ──────────────────────────────────────────────
async function uploadFile({ file, bucket = 'order-photos' }) {
  const ext  = file.name.split('.').pop() || 'jpg';
  const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    cacheControl: '3600',
    upsert: false,
  });
  if (error) throw new Error(error.message);
  const { data: { publicUrl } } = supabase.storage.from(bucket).getPublicUrl(path);
  return { file_url: publicUrl };
}

// يحذف ملفاً من التخزين اعتماداً على رابطه العام الكامل
async function deleteFile(publicUrl, bucket = 'order-photos') {
  if (!publicUrl) return;
  const marker = `/object/public/${bucket}/`;
  const idx = publicUrl.indexOf(marker);
  if (idx === -1) return; // ليس رابط تخزين معروف — تجاهل بأمان
  const path = publicUrl.slice(idx + marker.length);
  const { error } = await supabase.storage.from(bucket).remove([path]);
  if (error) throw new Error(error.message);
}

// ── Edge Function caller ───────────────────────────────────────
async function invokeFunction(name, body = {}) {
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (error) throw new Error(error.message);
  return data;
}

// ── Map all entities ───────────────────────────────────────────
export const db = {
  // Core entities
  Order:            createEntity('orders'),
  Employee:         createEntity('employees'),
  Customer:         createSecureEntity('customers'),
  Branch:           createEntity('branches'),
  InventoryItem:    createEntity('inventory_items'),
  Supplier:         createEntity('suppliers'),
  SupplierProduct:  createEntity('supplier_products'),
  PurchaseInvoice:      createEntity('purchase_invoices'),
  PurchaseInvoiceItem:  createEntity('purchase_invoice_items'),
  Product:          createEntity('products'),
  SalesInvoice:     createEntity('sales_invoices'),
  // Expenses — يمر حصرياً عبر /api/secure/expenses (BFF بكوكي HttpOnly).
  // نفس شكل الدوال بالضبط (list/get/create/update/delete/filter) عشان
  // كل الصفحات اللي تستخدم db.Expense.xxx() تفضل تشتغل بدون أي تعديل.
  Expense: {
    list: (orderBy = '-expense_date', limit = 500) => secureExpenses.list({ orderBy, limit }),
    get: (id) => secureExpenses.get(id),
    create: (record) => secureExpenses.create(record),
    update: (id, record) => secureExpenses.update(id, record),
    delete: (id) => secureExpenses.delete(id),
    filter: (filters = {}, orderBy = '-expense_date', limit = 500) => secureExpenses.filter(filters, orderBy, limit),
    subscribe: () => (() => {}), // لا يوجد بث لحظي عبر BFF — راجع RealtimeSync.jsx
  },
  AuditLog:         createEntity('audit_logs'),
  AppSettings:      createEntity('app_settings'),
  // Loyalty
  LoyaltyCard:      createEntity('loyalty_cards'),
  LoyaltyStamp:     createEntity('loyalty_stamps'),
  LoyaltySettings:  createEntity('loyalty_settings'),
  // Loyalty — برنامج النقاط والعضويات (نظام جديد ومستقل)
  LoyaltyMember:            createEntity('loyalty_members'),
  LoyaltyPointsTransaction: createEntity('loyalty_points_transactions'),
  LoyaltyMemberNotification: createEntity('loyalty_member_notifications'),
  LoyaltyMembershipSettings: createEntity('loyalty_membership_settings'),
  // Other (booking, reviews, etc.) — kept for compatibility
  Booking:          createEntity('bookings'),
  Service:          createEntity('services'),
  JobPosting:       createEntity('job_postings'),
  Review:           createEntity('reviews'),
  WorkingHours:     createEntity('working_hours'),
  Brand:            createEntity('brands'),
  ShopSettings:     createEntity('shop_settings'),
  SiteVisit:        createEntity('site_visits'),
  StockMovement:    createEntity('stock_movements'),
  WorkshopCustody:  createEntity('workshop_custodies'),
  WorkshopSettlement: createEntity('workshop_settlements'),
  OperationsPlan:   createEntity('operations_plans'),
  WorkflowStage:    createEntity('workflow_stages'),
};

// ── Storage ────────────────────────────────────────────────────
export const storage = { uploadFile, deleteFile };

// ── Functions ──────────────────────────────────────────────────
export const functions = { invoke: invokeFunction };

export default db;
