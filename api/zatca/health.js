/**
 * GET /api/zatca/health
 * Reports whether the server-side ZATCA secrets are configured for the
 * currently selected environment — WITHOUT ever returning their values.
 * Lets the admin UI show a real "connected/not connected" status
 * instead of the old fake localStorage-based one.
 */
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
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
