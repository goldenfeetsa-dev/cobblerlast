import { createClient } from '@supabase/supabase-js';

// وضع الاتصال: افتراضياً مباشر (يعمل كما كان). لتفعيل بوابة الخادم الآمنة /sb ضع
// VITE_USE_PROXY=1 في Vercel بعد التأكد أنها تعمل (انظر api/_lib/sbProxy.js).
export const SUPABASE_PUBLIC_URL = import.meta.env.VITE_SUPABASE_URL || 'https://bwuvldnlfgobqpdfhyql.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ3dXZsZG5sZmdvYnFwZGZoeXFsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzczOTM4NzUsImV4cCI6MjA5Mjk2OTg3NX0.mE9_sVG0E2ZWwkLq9lDFZEKM5xPidSNCsyx9AJrxAgo';

// تجربة البوابة على جهازك فقط دون التأثير على بقية المستخدمين: افتح أي صفحة بـ ?proxy=1 (للإلغاء ?proxy=0)
function proxyFlag() {
  if (typeof window === 'undefined') return false;
  try {
    const q = new URLSearchParams(window.location.search).get('proxy');
    if (q === '1') localStorage.setItem('sb_proxy', '1');
    if (q === '0') localStorage.setItem('sb_proxy', '0');
    return localStorage.getItem('sb_proxy') !== '0';
  } catch { return true; }
}
export const USE_PROXY = typeof window !== 'undefined' && (import.meta.env.VITE_USE_PROXY !== '0' && proxyFlag());

export const supabase = createClient(
  USE_PROXY ? `${window.location.origin}/sb` : SUPABASE_PUBLIC_URL,
  USE_PROXY ? 'via-server-proxy' : supabaseAnonKey,
  { auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false } },
);

export default supabase;
