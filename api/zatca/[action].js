/**
 * api/zatca/[action].js
 * ──────────────────────────────────────────────────────────────────
 * دمج 3 دوال زاتكا بملف واحد (نفس نمط /api/loyalty/[action].js
 * المُثبت أصلاً) — Vercel Hobby يحدد أقصى 12 دالة سيرفرليس، والمشروع
 * تجاوزها فعلياً (13 دالة) وهذا بالضبط سبب فشل كل عملية نشر خلال
 * الأسبوعين الماضيين. المنطق منسوخ حرفياً من كل ملف أصلي، فقط البنية
 * تغيّرت — بدون أي تعديل بالسلوك على نظام ضريبي حساس.
 *
 * المسارات المحفوظة تماماً (بدون أي تغيير على أي رابط خارجي أو cron):
 *   GET       /api/zatca/health         → action=health
 *   GET/POST  /api/zatca/retry-worker   → action=retry-worker
 *   POST      /api/zatca/submit         → action=submit
 */
import { createClient } from '@supabase/supabase-js';
import { getSupabase, signAndSubmitInvoice } from '../_lib/zatcaEngine.js';
import { getSessionFromRequest } from '../_lib/session.js';

// ── health ───────────────────────────────────────────────────────
async function handleHealth(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !SERVICE_KEY) {
    return res.status(500).json({ error: 'SUPABASE_SERVICE_ROLE_KEY غير مضبوط على الخادم' });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
  const { data: settings } = await supabase.from('zatca_settings').select('*').eq('id', 1).single();
  const env = settings?.environment || 'sandbox';

  const hasPrivateKey = !!process.env.ZATCA_PRIVATE_KEY;
  const hasCert = env === 'production'
    ? !!process.env.ZATCA_PRODUCTION_CERTIFICATE
    : !!process.env.ZATCA_CERTIFICATE;
  const hasSecret = env === 'production'
    ? !!process.env.ZATCA_PRODUCTION_API_SECRET
    : !!process.env.ZATCA_API_SECRET;

  const businessInfoComplete = !!(settings?.vat_number && settings?.cr_number && settings?.seller_name);
  const ready = hasPrivateKey && hasCert && hasSecret && businessInfoComplete;

  return res.status(200).json({
    ready,
    environment: env,
    checks: { hasPrivateKey, hasCert, hasSecret, businessInfoComplete },
  });
}

// ── submit ───────────────────────────────────────────────────────
async function handleSubmit(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const session = getSessionFromRequest(req);
  if (!session) return res.status(401).json({ error: 'unauthenticated' });

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

// ── retry-worker ─────────────────────────────────────────────────
const MAX_RETRIES = 5;
const BATCH_LIMIT = 20;

function backoffOk(lastAttemptISO, retryCount) {
  if (!lastAttemptISO) return true;
  const waitMinutes = Math.min(2 ** retryCount, 120);
  const elapsedMs = Date.now() - new Date(lastAttemptISO).getTime();
  return elapsedMs >= waitMinutes * 60 * 1000;
}

async function handleRetryWorker(req, res) {
  const authHeader = req.headers.authorization || '';
  const cronSecret = process.env.CRON_SECRET;
  const manualSecret = req.headers['x-admin-retry-secret'];
  const authorized =
    (cronSecret && authHeader === `Bearer ${cronSecret}`) ||
    (cronSecret && manualSecret === cronSecret);

  if (!authorized) {
    return res.status(401).json({ error: 'غير مصرح — هذه نقطة داخلية فقط' });
  }

  const supabase = getSupabase();
  const results = { processed: 0, fixed: 0, stillFailing: 0, escalated: 0, details: [] };

  for (const [type, table] of [['order', 'orders'], ['sale', 'sales_invoices']]) {
    const { data: pending } = await supabase
      .from(table)
      .select('id, zatca_retry_count, zatca_submitted_at, zatca_needs_review, zatca_status')
      .in('zatca_status', ['REJECTED', 'ERROR'])
      .eq('zatca_needs_review', false)
      .lt('zatca_retry_count', MAX_RETRIES)
      .order('zatca_submitted_at', { ascending: true })
      .limit(BATCH_LIMIT);

    for (const rec of pending || []) {
      if (!backoffOk(rec.zatca_submitted_at, rec.zatca_retry_count || 0)) continue;

      results.processed++;
      try {
        const outcome = await signAndSubmitInvoice({ type, id: rec.id, isRetry: true });
        if (outcome.zatca_status === 'REPORTED') {
          results.fixed++;
          results.details.push({ type, id: rec.id, result: 'FIXED' });
        } else if (outcome.classification && !outcome.classification.autoRetryable) {
          results.escalated++;
          results.details.push({ type, id: rec.id, result: 'ESCALATED', reason: outcome.classification.reason });
        } else {
          results.stillFailing++;
          results.details.push({ type, id: rec.id, result: 'RETRY_FAILED', attempt: (rec.zatca_retry_count || 0) + 1 });
        }
      } catch (err) {
        results.stillFailing++;
        results.details.push({ type, id: rec.id, result: 'ERROR', message: err.message });
      }
    }
  }

  return res.status(200).json(results);
}

// ── router ───────────────────────────────────────────────────────
const ROUTES = {
  health: handleHealth,
  submit: handleSubmit,
  'retry-worker': handleRetryWorker,
};

export default async function handler(req, res) {
  const { action } = req.query;
  const fn = ROUTES[action];
  if (!fn) return res.status(404).json({ error: 'not_found' });
  return fn(req, res);
}
