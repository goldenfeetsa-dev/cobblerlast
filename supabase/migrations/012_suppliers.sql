-- ══════════════════════════════════════════════════════════
-- قسم الموردين — Suppliers
-- ══════════════════════════════════════════════════════════
-- كل مورد له بيانات أساسية + قائمة منتجات (من مخزون inventory_items)
-- اللي نشتريها منه. الواجهة تحسب تلقائياً هل أي منتج من منتجاته
-- نفد من المخزن (كل الفروع) وتعلّمه بالأحمر حتى يعرف صاحب المحل
-- إنه لازم يطلب من هذا المورد بالذات.

CREATE TABLE IF NOT EXISTS suppliers (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  contact_name  TEXT,               -- اسم الشخص المسؤول لدى المورد (اختياري)
  phone         TEXT,
  email         TEXT,
  address       TEXT,
  notes         TEXT,
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

-- ربط مورد بمنتج (Many-to-Many) — نفس المنتج ممكن يجي من أكثر من مورد
CREATE TABLE IF NOT EXISTS supplier_products (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id   UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  item_id       UUID NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  supplier_sku  TEXT,               -- كود المنتج عند المورد (اختياري)
  unit_cost     NUMERIC(10,2),      -- آخر سعر شراء من هذا المورد (اختياري)
  created_at    TIMESTAMPTZ DEFAULT now(),
  UNIQUE(supplier_id, item_id)
);

CREATE INDEX IF NOT EXISTS idx_supplier_products_supplier ON supplier_products(supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_products_item ON supplier_products(item_id);

ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_all_suppliers" ON suppliers;
CREATE POLICY "service_all_suppliers" ON suppliers FOR ALL USING (true);

DROP POLICY IF EXISTS "service_all_supplier_products" ON supplier_products;
CREATE POLICY "service_all_supplier_products" ON supplier_products FOR ALL USING (true);
