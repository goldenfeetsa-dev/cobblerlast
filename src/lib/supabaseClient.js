import { createClient } from '@supabase/supabase-js';

// المتصفح لا يكلّم Supabase مباشرة ولا يحمل أي مفتاح: كل الطلبات تمر عبر بوابة
// الخادم /sb/* (تتحقق من الجلسة والدور ثم تنفّذ بمفتاح الخادم). انظر api/_lib/sbProxy.js
export const SUPABASE_PUBLIC_URL = 'https://bwuvldnlfgobqpdfhyql.supabase.co'; // لروابط الصور العامة فقط

const base = typeof window !== 'undefined' ? `${window.location.origin}/sb` : SUPABASE_PUBLIC_URL;

export const supabase = createClient(base, 'via-server-proxy', {
  auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
});

export default supabase;
