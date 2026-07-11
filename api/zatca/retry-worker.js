/**
 * GET/POST /api/zatca/retry-worker
 * Triggered by Vercel Cron (see vercel.json). Also callable manually
 * by an admin from the ZATCA settings page.
 *
 * Design decision (important): this does NOT try to "auto-fix
 * everything with zero human involvement" — for a tax-compliance
 * system that would be reckless. What it DOES fully automatically:
 *   • retries transient network/server errors from ZATCA
 *   • re-syncs the invoice-counter/hash chain and recomputes totals
 *     with full precision on every retry (fixes the two most common
 *     rejection classes: ROUNDING and CHAIN_DESYNC) — this happens
 *     for free because signAndSubmitInvoice() always recomputes from
 *     the current authoritative state, it never resubmits stale XML
 *   • gives up after MAX_RETRIES with exponential backoff
 * What it will NEVER silently "fix": wrong VAT/CR numbers, invalid
 * certificates, missing mandatory business data. Those get flagged
 * zatca_needs_review = true and stop retrying, because guessing on
 * official tax data is worse than a rejected invoice.
 */
import { getSupabase, signAndSubmitInvoice } from '../_lib/zatcaEngine.js';

const MAX_RETRIES = 5;
const BATCH_LIMIT = 20;

function backoffOk(lastAttemptISO, retryCount) {
  if (!lastAttemptISO) return true;
  const waitMinutes = Math.min(2 ** retryCount, 120); // caps at 2h between attempts
  const elapsedMs = Date.now() - new Date(lastAttemptISO).getTime();
  return elapsedMs >= waitMinutes * 60 * 1000;
}

export default async function handler(req, res) {
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
