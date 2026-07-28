/**
 * GET /api/public/track-order?code=...
 * ──────────────────────────────────────────────────────────────────
 * ميزة "تتبع الطلب" العامة بصفحة الهبوط كانت تستعلم جدول orders
 * مباشرة من المتصفح عبر anon key (RLS كانت USING (true) فتسمح بذلك).
 * بعد إغلاق RLS على orders بميغريشن 026 (تتطلب موظف مسجّل دخول)،
 * أصبح لازم مسار عام من السيرفر يستخدم صلاحية admin بدل ذلك — بنفس
 * نمط api/public/site-data.js.
 *
 * أمان: يرجّع فقط الحقول اللي كانت تُعرض أصلاً للعميل (لا بيانات
 * مالية ولا بيانات عميل حساسة)، ويشترط تطابق رقم الطلب أو رقم الجوال
 * المُدخل — تماماً نفس منطق البحث القديم، بس منفّذ من السيرفر.
 */
import { getSupabaseAdmin } from '../_lib/loyalty/supabaseAdmin.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'method_not_allowed' });

  const code = String(req.query.code || '').trim();
  if (!code || code.length < 3 || code.length > 50) {
    return res.status(400).json({ error: 'invalid_code' });
  }

  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('orders')
      .select('order_number,customer_name,status,item_type,created_at')
      .or(`order_number.eq.${code},customer_phone.eq.${code}`)
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) throw error;

    // لا تخزين مؤقت — نتيجة خاصة بحالة العميل، لازم تكون آنية
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ results: data || [] });
  } catch (err) {
    console.error('api/public/track-order error', err);
    return res.status(500).json({ error: 'server_error' });
  }
}
