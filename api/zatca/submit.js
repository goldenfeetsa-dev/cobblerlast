/**
 * POST /api/zatca/submit
 * body: { type: 'order' | 'sale', id: string }
 * The real work lives in api/_lib/zatcaEngine.js (shared with the
 * retry worker so both flows can never drift apart again).
 */
import { signAndSubmitInvoice } from '../_lib/zatcaEngine.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { type, id } = req.body || {};
  if (!type || !id || !['order', 'sale'].includes(type)) {
    return res.status(400).json({ error: 'الحقول المطلوبة: type ("order" أو "sale") و id' });
  }

  try {
    const result = await signAndSubmitInvoice({ type, id, isRetry: false });
    if (result.alreadySubmitted) return res.status(200).json(result);
    if (result.zatca_status !== 'REPORTED') {
      return res.status(502).json({ zatca_status: result.zatca_status, error: result.error, qr: result.qr, classification: result.classification });
    }
    return res.status(200).json(result);
  } catch (err) {
    return res.status(500).json({ error: err.message || 'خطأ غير متوقع أثناء الإرسال لزاتكا' });
  }
}
