/**
 * عميل Supabase بصلاحية service_role — يُستخدم فقط داخل دوال api/
 * (لا يُستورد أبداً داخل src/ الخاص بالمتصفح).
 * نفس نمط api/zatca/health.js تماماً للحفاظ على اتساق البنية.
 */
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

let client = null;

export function getSupabaseAdmin() {
  if (!SUPABASE_URL || !SERVICE_KEY) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY أو SUPABASE_URL غير مضبوطين على الخادم');
  }
  if (!client) {
    client = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
}
