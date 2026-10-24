import { createClient } from '@supabase/supabase-js';

// وضع الاتصال: افتراضياً مباشر (يعمل كما كان). لتفعيل بوابة الخادم الآمنة /sb ضع
// VITE_USE_PROXY=1 في Vercel بعد التأكد أنها تعمل (انظر api/_lib/sbProxy.js).
export const SUPABASE_PUBLIC_URL = import.meta.env.VITE_SUPABASE_URL || 'https://bwuvldnlfgobqpdfhyql.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ3dXZsZG5sZmdvYnFwZGZoeXFsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzczOTM4NzUsImV4cCI6MjA5Mjk2OTg3NX0.mE9_sVG0E2ZWwkLq9lDFZEKM5xPidSNCsyx9AJrxAgo';

export const USE_PROXY = import.meta.env.VITE_USE_PROXY === '1' && typeof window !== 'undefined';

export const supabase = createClient(
  USE_PROXY ? `${window.location.origin}/sb` : SUPABASE_PUBLIC_URL,
  USE_PROXY ? 'via-server-proxy' : supabaseAnonKey,
  { auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false } },
);

export default supabase;
