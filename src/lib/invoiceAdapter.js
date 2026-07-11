// يحوّل فاتورة بيع منتج (من نظام المبيعات) إلى نفس الشكل الذي يتوقعه
// مكوّن ReceiptView (المُصمَّم أصلاً لطلبات الإصلاح)، حتى نقدر نستخدم
// نفس مكوّن الطباعة/الفاتورة الرسمية لكل من فواتير الإصلاح وفواتير المنتجات.
export function salesInvoiceToReceipt(inv) {
  return {
    ...inv,
    order_number: inv.invoice_number,
    invoice_number: inv.invoice_number,
    total_price: inv.total,
    subtotal: inv.subtotal,
    vat_amount: inv.vat_amount,
    items: inv.items || [],
    payment_status: inv.payment_status || 'paid',
  };
}

// نوع الفاتورة المعروض بالواجهة (لصفحة الفواتير الموحّدة)
export function invoiceTypeLabel(kind) {
  return kind === 'product' ? 'بيع منتج' : 'خدمة إصلاح';
}
