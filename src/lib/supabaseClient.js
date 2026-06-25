import { createClient } from '@supabase/supabase-js';

const supabaseUrl    = import.meta.env.VITE_SUPABASE_URL     || 'https://bwuvldnlfgobqpdfhyql.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ3dXZsZG5sZmdvYnFwZGZoeXFsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzczOTM4NzUsImV4cCI6MjA5Mjk2OTg3NX0.mE9_sVG0E2ZWwkLq9lDFZEKM5xPidSNCsyx9AJrxAgo';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: false }
});

export default supabase;
