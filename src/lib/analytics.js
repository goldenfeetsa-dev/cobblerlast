/**
 * أدوات تحليل موحّدة للفروع والموظفين
 * ──────────────────────────────────────────────────────────────────
 * المشكلة الأصلية: كل لوحات التحليل (لوحة التحكم، لوحة التدقيق،
 * لوحة المتصدرين) كانت تجيب بياناتها من جدول "orders" (طلبات الإصلاح)
 * فقط، وتتجاهل جدول "sales_invoices" (فواتير بيع المنتجات) بالكامل.
 * أي متجر يبيع منتجات (مو بس يصلّح) كانت كل إيراداته من المبيعات
 * تختفي من كل الأرقام — وهذا سبب رئيسي لعدم دقة لوحة التدقيق.
 *
 * هذا الملف يوحّد المصدرين في مصفوفة واحدة من "العمليات" (transactions)
 * حتى تُحسب كل الأرقام (الإيراد، أفضل فرع، أفضل موظف) بشكل صحيح.
 */

// حالات الطلبات التي لا تُحتسب كإيراد فعلي
const NON_REVENUE_STATUSES = new Set(['cancelled', 'returned']);

/**
 * يحوّل طلبات الإصلاح (Order) وفواتير البيع (SalesInvoice) إلى قائمة
 * واحدة موحّدة من العمليات، كل عملية فيها: الفرع، الموظف، المبلغ، النوع.
 */
export function unifyTransactions(orders = [], salesInvoices = []) {
  const fromOrders = (orders || [])
    .filter(o => !NON_REVENUE_STATUSES.has(o.status))
    .map(o => ({
      id: `order-${o.id}`,
      kind: 'repair', // خدمة إصلاح
      number: o.order_number,
      branch_id: o.branch_id || null,
      branch_name: o.branch_name || 'الفرع الرئيسي',
      employee_id: o.employee_id || null,
      employee_name: o.employee_name || null,
      amount: o.total_price || 0,
      payment_method: o.payment_method || null,
      payment_status: o.payment_status || null,
      status: o.status || null,
      is_completed: o.status === 'completed',
      created_at: o.created_at,
      raw: o,
    }));

  const fromSales = (salesInvoices || []).map(inv => ({
    id: `sale-${inv.id}`,
    kind: 'sale', // بيع منتج
    number: inv.invoice_number,
    branch_id: inv.branch_id || null,
    branch_name: inv.branch_name || 'الفرع الرئيسي',
    employee_id: inv.employee_id || null,
    employee_name: inv.employee_name || null,
    amount: inv.total || 0,
    payment_method: inv.payment_method || null,
    payment_status: inv.payment_status || 'paid',
    status: 'completed',
    is_completed: true,
    created_at: inv.created_at,
    raw: inv,
  }));

  return [...fromOrders, ...fromSales];
}

/** يجمع العمليات حسب الفرع، ويرجع مصفوفة ملخّصة مرتّبة تنازلياً حسب الإيراد */
export function summarizeByBranch(transactions = []) {
  const map = new Map();
  for (const t of transactions) {
    const key = t.branch_name || 'الفرع الرئيسي';
    if (!map.has(key)) {
      map.set(key, { branch_name: key, branch_id: t.branch_id, revenue: 0, count: 0, repairCount: 0, saleCount: 0 });
    }
    const entry = map.get(key);
    entry.revenue += t.amount || 0;
    entry.count += 1;
    if (t.kind === 'repair') entry.repairCount += 1;
    if (t.kind === 'sale') entry.saleCount += 1;
  }
  return [...map.values()].sort((a, b) => b.revenue - a.revenue);
}

/**
 * يجمع أداء الموظفين حسب الدور: الكاشير يُقاس بإيراد المبيعات التي
 * أنشأها، والفني/العامل يُقاس بعدد طلبات الإصلاح "المكتملة" التي أنجزها
 * — لأن كل دور له مقياس نجاح مختلف (مبيعات مقابل عدد إصلاحات منجزة).
 */
export function summarizeEmployeePerformance(employees = [], transactions = []) {
  return employees.map(emp => {
    const empTx = transactions.filter(t =>
      (emp.id && t.employee_id === emp.id) || t.employee_name === emp.name
    );
    const sales = empTx.filter(t => t.kind === 'sale');
    const repairs = empTx.filter(t => t.kind === 'repair');
    const completedRepairs = repairs.filter(t => t.is_completed);

    return {
      ...emp,
      branch_name: emp.branch_name || 'الفرع الرئيسي',
      sales_count: sales.length,
      sales_revenue: sales.reduce((s, t) => s + t.amount, 0),
      repairs_count: repairs.length,
      completed_repairs_count: completedRepairs.length,
      repairs_revenue: repairs.reduce((s, t) => s + t.amount, 0),
      total_revenue: empTx.reduce((s, t) => s + t.amount, 0),
    };
  });
}
