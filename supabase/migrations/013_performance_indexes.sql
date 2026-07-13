-- ══════════════════════════════════════════════════════════
-- فهارس لتسريع الاستعلامات الأكثر استخداماً بالتطبيق
-- ══════════════════════════════════════════════════════════
-- كل استعلام رئيسي بالتطبيق يفرز بـ created_at أو يبحث برقم/جوال/
-- حالة معينة. بدون فهرس على هذي الأعمدة، قاعدة البيانات تفحص الجدول
-- كامل (Sequential Scan) بكل مرة — كل ما زاد عدد الطلبات، صار الجلب
-- أبطأ أكثر. الفهارس أدناه آمنة 100% (IF NOT EXISTS) ولا تغيّر أي
-- بيانات أو سلوك، بس تسرّع القراءة.

-- orders — الأكثر استخداماً بالتطبيق كامل
CREATE INDEX IF NOT EXISTS idx_orders_created_at   ON orders (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_order_number ON orders (order_number);
CREATE INDEX IF NOT EXISTS idx_orders_branch_id    ON orders (branch_id);
CREATE INDEX IF NOT EXISTS idx_orders_status        ON orders (status);
CREATE INDEX IF NOT EXISTS idx_orders_customer_phone ON orders (customer_phone);
CREATE INDEX IF NOT EXISTS idx_orders_zatca_needs_review ON orders (zatca_needs_review) WHERE zatca_needs_review = true;

-- customers — يُبحث فيها برقم الجوال عند كل طلب جديد (بحث عميل حالي)
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers (phone);

-- sales_invoices — فواتير بيع المنتجات
CREATE INDEX IF NOT EXISTS idx_sales_invoices_created_at    ON sales_invoices (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sales_invoices_invoice_number ON sales_invoices (invoice_number);
CREATE INDEX IF NOT EXISTS idx_sales_invoices_zatca_needs_review ON sales_invoices (zatca_needs_review) WHERE zatca_needs_review = true;

-- inventory_items — تُقرأ بكل عملية بيع وكل صفحة موردين
CREATE INDEX IF NOT EXISTS idx_inventory_items_name ON inventory_items (name);

-- employees — تسجيل الدخول (PIN) يبحث بها بكل مرة
CREATE INDEX IF NOT EXISTS idx_employees_is_active ON employees (is_active) WHERE is_active = true;
