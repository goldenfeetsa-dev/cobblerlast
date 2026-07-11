/**
 * api/_lib/zatcaEngine.js
 * ──────────────────────────────────────────────────────────────────
 * Underscore-prefixed folder = Vercel does NOT expose this as a route.
 * This is the single real signing+submission engine. Both
 * /api/zatca/submit.js (called right after an order/sale is created)
 * and /api/zatca/retry-worker.js (cron, retries failed ones) call
 * this exact same function — so there is no way for the two flows to
 * drift apart again.
 */
import { createClient } from '@supabase/supabase-js';
import { ZATCASimplifiedTaxInvoice } from 'zatca-xml-js';

export const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
export const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const ZATCA_BASE = {
  sandbox: 'https://gw-fatoora.zatca.gov.sa/e-invoicing/developer-portal',
  simulation: 'https://gw-fatoora.zatca.gov.sa/e-invoicing/simulation',
  production: 'https://gw-fatoora.zatca.gov.sa/e-invoicing/core',
};

const VAT_FRACTION = 0.15;

export function getSupabase() {
  if (!SUPABASE_URL || !SERVICE_KEY) throw new Error('SUPABASE_SERVICE_ROLE_KEY غير مضبوط على الخادم');
  return createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
}

function stripPem(s) {
  return String(s || '')
    .replace(/-----BEGIN[^-]+-----/g, '')
    .replace(/-----END[^-]+-----/g, '')
    .replace(/[\r\n\s]/g, '');
}
function round2(n) { return Math.round((Number(n) || 0) * 100) / 100; }
function pad(n) { return String(n).padStart(2, '0'); }

/**
 * Classifies a ZATCA rejection so the retry worker knows what it's
 * allowed to do automatically vs. what MUST wait for a human.
 * Being wrong here in the "safe to auto-fix" direction is the actual
 * danger for a compliance system, so this stays conservative.
 */
export function classifyZatcaError({ httpStatus, zData, errorMessage }) {
  const msg = (errorMessage || '').toLowerCase();
  const codes = (zData?.validationResults?.errorMessages || []).map(e => (e.code || '') + ' ' + (e.message || '')).join(' ').toLowerCase();
  const text = msg + ' ' + codes;

  if (httpStatus === 401 || httpStatus === 403 || text.includes('certificate') && text.includes('invalid')) {
    return { category: 'AUTH', autoRetryable: false, reason: 'شهادة/مفتاح غير صالح — يحتاج تدخل بشري لتجديد CSID' };
  }
  if (httpStatus === 429 || httpStatus >= 500 || text.includes('timeout') || text.includes('econnreset') || httpStatus === 0) {
    return { category: 'TRANSIENT', autoRetryable: true, autoFix: null, reason: 'خطأ شبكة/خادم مؤقت من زاتكا' };
  }
  if (text.includes('already') && (text.includes('reported') || text.includes('exists'))) {
    return { category: 'DUPLICATE', autoRetryable: false, resolveAs: 'REPORTED', reason: 'الفاتورة مُبلَّغة مسبقاً فعلياً' };
  }
  if (text.includes('previousinvoicehash') || text.includes('pih') || text.includes('icv') || text.includes('invoicecounter')) {
    return { category: 'CHAIN_DESYNC', autoRetryable: true, autoFix: 'RESYNC_CHAIN', reason: 'عدم تطابق تسلسل الفواتير — يُعاد حجز رقم تسلسل صحيح تلقائياً' };
  }
  if (text.includes('does not match') || text.includes('rounding') || text.includes('lineextensionamount') || text.includes('taxamount') || text.includes('payableamount')) {
    return { category: 'ROUNDING', autoRetryable: true, autoFix: 'RECOMPUTE_TOTALS', reason: 'فرق تقريب بالحسابات — تُعاد الحسابات بدقة أعلى تلقائياً' };
  }
  if (text.includes('vat') && (text.includes('invalid') || text.includes('format')) ||
      text.includes('crn') || text.includes('registration') || text.includes('buyer') ||
      text.includes('mandatory') || text.includes('missing')) {
    return { category: 'DATA', autoRetryable: false, reason: 'خطأ ببيانات المنشأة/الفاتورة نفسها — يحتاج مراجعة بشرية، ما يصلح تلقائياً لتجنب فاتورة رسمية خاطئة' };
  }
  return { category: 'UNKNOWN', autoRetryable: true, autoFix: null, reason: 'خطأ غير مصنّف — تُعاد المحاولة بحد أقصى مسموح ثم تُرفع للمراجعة' };
}

/**
 * The one real sign+submit path. `opts.forceRecompute` is set by the
 * retry worker when auto-fixing a ROUNDING class error.
 */
export async function signAndSubmitInvoice({ type, id, isRetry = false }) {
  const supabase = getSupabase();

  const { data: settings, error: sErr } = await supabase.from('zatca_settings').select('*').eq('id', 1).single();
  if (sErr || !settings) throw new Error('لم يتم إعداد بيانات المنشأة بعد في zatca_settings');
  if (!settings.vat_number || !settings.cr_number) throw new Error('الرقم الضريبي أو السجل التجاري غير مكتملين');

  const env = settings.environment || 'sandbox';
  const certificate = env === 'production' ? process.env.ZATCA_PRODUCTION_CERTIFICATE : process.env.ZATCA_CERTIFICATE;
  const apiSecret = env === 'production' ? process.env.ZATCA_PRODUCTION_API_SECRET : process.env.ZATCA_API_SECRET;
  const privateKey = process.env.ZATCA_PRIVATE_KEY;
  if (!certificate || !apiSecret || !privateKey) {
    throw new Error(`متغيرات بيئة زاتكا غير مكتملة لبيئة "${env}"`);
  }

  const table = type === 'order' ? 'orders' : 'sales_invoices';
  const { data: record, error: rErr } = await supabase.from(table).select('*').eq('id', id).single();
  if (rErr || !record) throw new Error('السجل غير موجود');

  if (record.zatca_status === 'REPORTED') {
    return { alreadySubmitted: true, zatca_status: record.zatca_status, qr: record.zatca_qr };
  }

  let lineItems, invoiceNumber;
  if (type === 'order') {
    const qty = record.quantity || 1;
    const subtotal = record.subtotal != null ? record.subtotal : (record.total_price || 0) / (1 + VAT_FRACTION);
    lineItems = [{
      id: '1',
      name: record.item_type ? `إصلاح — ${record.item_type}` : 'خدمة إصلاح',
      quantity: qty,
      tax_exclusive_price: round2(subtotal / qty),
      VAT_percent: VAT_FRACTION,
    }];
    invoiceNumber = record.order_number || `ORD-${record.id}`;
  } else {
    const items = Array.isArray(record.items) ? record.items : [];
    if (!items.length) throw new Error('لا توجد أصناف في هذه الفاتورة');
    lineItems = items.map((it, idx) => ({
      id: String(idx + 1),
      name: it.item_name || it.name || 'منتج',
      quantity: it.qty || 1,
      tax_exclusive_price: round2(it.sell_price || 0),
      VAT_percent: VAT_FRACTION,
    }));
    invoiceNumber = record.invoice_number || `INV-${record.id}`;
  }

  const { data: chainRows, error: chainErr } = await supabase.rpc('zatca_reserve_next');
  if (chainErr || !chainRows?.length) throw new Error('فشل حجز رقم تسلسل الفاتورة (ICV): ' + (chainErr?.message || ''));
  const { icv, prev_hash } = chainRows[0];

  const issuedAt = record.created_at ? new Date(record.created_at) : new Date();
  const egsUnit = {
    uuid: settings.egs_uuid || '00000000-0000-4000-8000-000000000000',
    custom_id: 'cobblerlast-pos-1',
    model: 'Cobblerlast POS',
    CRN_number: settings.cr_number,
    VAT_name: settings.seller_name,
    VAT_number: settings.vat_number,
    branch_name: settings.seller_name,
    branch_industry: 'Repair & Retail Services',
    location: {
      city: settings.city, city_subdivision: settings.district, street: settings.street,
      plot_identification: '0000', building: settings.building_number, postal_zone: settings.postal_code,
    },
  };

  const invoice = new ZATCASimplifiedTaxInvoice({
    props: {
      egs_info: egsUnit,
      invoice_counter_number: Number(icv),
      invoice_serial_number: invoiceNumber,
      issue_date: `${issuedAt.getFullYear()}-${pad(issuedAt.getMonth() + 1)}-${pad(issuedAt.getDate())}`,
      issue_time: `${pad(issuedAt.getHours())}:${pad(issuedAt.getMinutes())}:${pad(issuedAt.getSeconds())}`,
      previous_invoice_hash: prev_hash,
      line_items: lineItems,
    },
  });

  const { signed_invoice_string, invoice_hash, qr } = invoice.sign(certificate, privateKey);
  const invoiceUuid = signed_invoice_string.match(/<cbc:UUID>(.*?)<\/cbc:UUID>/)?.[1];
  if (!invoiceUuid) throw new Error('تعذر استخراج UUID من الفاتورة الموقعة');

  const certStripped = stripPem(certificate);
  const basicAuth = Buffer.from(`${Buffer.from(certStripped).toString('base64')}:${apiSecret}`).toString('base64');
  const base = ZATCA_BASE[env] || ZATCA_BASE.sandbox;

  let zRes, zData, httpStatus;
  try {
    zRes = await fetch(`${base}/invoices/reporting/single`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json', 'Accept': 'application/json',
        'Accept-Version': 'V2', 'Accept-Language': 'en', 'Clearance-Status': '0',
        'Authorization': `Basic ${basicAuth}`,
      },
      body: JSON.stringify({ invoiceHash: invoice_hash, uuid: invoiceUuid, invoice: Buffer.from(signed_invoice_string).toString('base64') }),
    });
    httpStatus = zRes.status;
    zData = await zRes.json().catch(() => ({}));
  } catch (netErr) {
    httpStatus = 0;
    zData = {};
    zRes = { status: 0 };
    zData.__networkError = netErr.message;
  }

  const ok = httpStatus === 200 || httpStatus === 202;
  const status = ok ? 'REPORTED' : (httpStatus === 0 ? 'ERROR' : 'REJECTED');
  const errorMessage = ok ? null : (
    zData?.validationResults?.errorMessages?.map((e) => e.message).join(', ')
    || zData?.__networkError || zData?.message || `رفض من زاتكا (HTTP ${httpStatus})`
  );

  const classification = ok ? null : classifyZatcaError({ httpStatus, zData, errorMessage });

  if (ok) {
    await supabase.rpc('zatca_commit_hash', { p_hash: invoice_hash });
  }

  const updatePayload = {
    zatca_status: status,
    zatca_qr: qr,
    zatca_invoice_hash: invoice_hash,
    zatca_uuid: invoiceUuid,
    zatca_submitted_at: new Date().toISOString(),
    zatca_retry_count: (record.zatca_retry_count || 0) + (isRetry ? 1 : 0),
  };
  if (classification) {
    updatePayload.zatca_error_category = classification.category;
    updatePayload.zatca_needs_review = !classification.autoRetryable;
  } else {
    updatePayload.zatca_error_category = null;
    updatePayload.zatca_needs_review = false;
  }

  await supabase.from(table).update(updatePayload).eq('id', id);

  await supabase.from('zatca_submission_log').insert({
    record_type: type, record_id: id, invoice_number: invoiceNumber,
    icv, invoice_hash, status, environment: env, zatca_response: zData,
    error_message: errorMessage,
    error_category: classification?.category || null,
    auto_fix_applied: isRetry ? 'AUTO_RETRY' : null,
  });

  return {
    zatca_status: status, qr, invoice_hash, uuid: invoiceUuid, environment: env,
    error: errorMessage, classification,
    warnings: zData?.validationResults?.warningMessages || [],
  };
}
