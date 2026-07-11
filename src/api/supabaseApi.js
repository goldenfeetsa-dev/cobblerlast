/**
 * supabaseApi.js
 * بديل كامل عن base44Client — كل العمليات على Supabase
 */
import { supabase } from '@/lib/supabaseClient';

// ── Generic Entity Factory ──────────────────────────────────────
// يحاكي base44.entities.X.list() / .create() / .update() / .filter()
function createEntity(tableName) {
  return {
    async list(orderBy = '-created_at', limit = 200) {
      const col = orderBy.startsWith('-') ? orderBy.slice(1) : orderBy;
      const asc = !orderBy.startsWith('-');
      const { data, error } = await supabase
        .from(tableName)
        .select('*')
        .order(col, { ascending: asc })
        .limit(limit);
      if (error) throw new Error(error.message);
      return data || [];
    },

    async get(id) {
      const { data, error } = await supabase
        .from(tableName).select('*').eq('id', id).single();
      if (error) throw new Error(error.message);
      return data;
    },

    async create(record) {
      const { data, error } = await supabase
        .from(tableName).insert(record).select().single();
      if (error) throw new Error(error.message);
      return data;
    },

    async update(id, record) {
      const { data, error } = await supabase
        .from(tableName).update(record).eq('id', id).select().single();
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

    // Real-time subscription (replaces base44 subscribe)
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

// ── File Upload (replaces base44 UploadFile) ───────────────────
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
  Customer:         createEntity('customers'),
  Branch:           createEntity('branches'),
  InventoryItem:    createEntity('inventory_items'),
  Product:          createEntity('products'),
  SalesInvoice:     createEntity('sales_invoices'),
  Expense:          createEntity('expenses'),
  AuditLog:         createEntity('audit_logs'),
  AppSettings:      createEntity('app_settings'),
  // Loyalty
  LoyaltyCard:      createEntity('loyalty_cards'),
  LoyaltyStamp:     createEntity('loyalty_stamps'),
  LoyaltySettings:  createEntity('loyalty_settings'),
  // Other (booking, reviews, etc.) — kept for compatibility
  Booking:          createEntity('bookings'),
  Service:          createEntity('services'),
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

// ── Backward compat shim (drop-in for base44) ─────────────────
export const base44 = {
  entities: db,
  integrations: {
    Core: { UploadFile: uploadFile },
  },
};

export default db;
