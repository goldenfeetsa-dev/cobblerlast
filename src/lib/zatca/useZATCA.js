/**
 * useZATCA hook
 * ──────────────────────────────────────────────────────────────────
 * Thin client wrapper — ALL real signing/submission now happens
 * server-side in /api/zatca/submit.js. The browser never sees the
 * certificate or private key.
 *
 * Works identically for repair orders and product sales — this is
 * the single, unified invoicing path called by both NewOrder.jsx and
 * SalesSystem.jsx.
 */
import { useCallback } from 'react';
import { toast } from 'sonner';

export function useZATCA() {
  /**
   * @param {'order'|'sale'} type
   * @param {string} id - the order or sales_invoice row id (must already be saved to DB)
   */
  const submitInvoice = useCallback(async (type, id) => {
    try {
      const res = await fetch('/api/zatca/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, id }),
      });
      const data = await res.json();

      if (!res.ok) {
        toast.error(`❌ زاتكا: ${data.error || 'فشل الإرسال'}`);
        return { zatcaStatus: 'REJECTED', error: data.error, qr: data.qr || null };
      }

      if (data.alreadySubmitted) {
        return { zatcaStatus: data.zatca_status, qr: data.zatca_qr, alreadySubmitted: true };
      }

      if (data.warnings?.length > 0) {
        toast.warning(`⚠️ زاتكا: ${data.warnings[0]?.message || 'تحذير'}`);
      } else {
        toast.success(`✅ تم إبلاغ زاتكا رسمياً — الحالة: ${data.zatca_status}`);
      }

      return {
        zatcaStatus: data.zatca_status,
        qr: data.qr,
        invoiceHash: data.invoice_hash,
        uuid: data.uuid,
        warnings: data.warnings || [],
      };
    } catch (err) {
      toast.error('❌ تعذر الوصول لخدمة زاتكا — تحقق من الاتصال');
      return { zatcaStatus: 'ERROR', error: err.message };
    }
  }, []);

  return { submitInvoice };
}
