/**
 * GET /api/public/site-data
 * GET /api/public/site-data?code=...   (بحث تتبع الطلب — كان endpoint منفصل)
 * ──────────────────────────────────────────────────────────────────
 * دمجت track-order.js هنا (فرع واحد إضافي بنفس الملف) بدل ملف مستقل —
 * Vercel Hobby يحدد أقصى 12 دالة سيرفرليس، والمشروع تجاوزها فعلياً
 * وهذا بالضبط سبب فشل كل عملية نشر خلال الأسبوعين الماضيين.
 *
 * بدون ?code: يجمّع كل البيانات العامة اللي تحتاجها صفحة الهبوط
 * (علامات، فروع، بيانات تواصل، رقم السجل التجاري) باستعلام واحد بدل
 * 4 استعلامات منفصلة من كل متصفح زائر مباشرة لـ Supabase، ومخزَّن
 * على CDN فيرسل (s-maxage=30).
 *
 * مع ?code=xxx: بحث تتبع الطلب العام (رقم الطلب أو الجوال) — بدون
 * تخزين مؤقت لأنها نتيجة خاصة بحالة العميل، لازم تكون آنية.
 */
import { getSupabaseAdmin } from '../_lib/loyalty/supabaseAdmin.js';

async function handleTrackOrder(req, res, supabase) {
  const code = String(req.query.code || '').trim();
  if (!code || code.length < 3 || code.length > 50) {
    return res.status(400).json({ error: 'invalid_code' });
  }

  try {
    const { data, error } = await supabase
      .from('orders')
      .select('order_number,customer_name,status,item_type,created_at')
      .or(`order_number.eq.${code},customer_phone.eq.${code}`)
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) throw error;

    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ results: data || [] });
  } catch (err) {
    console.error('api/public/site-data (track-order) error', err);
    return res.status(500).json({ error: 'server_error' });
  }
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'method_not_allowed' });

  const supabase = getSupabaseAdmin();

  if (req.query.code !== undefined) {
    return handleTrackOrder(req, res, supabase);
  }

  try {
    const [{ data: brands }, { data: branches }, { data: settingsArr }, { data: crArr }] = await Promise.all([
      supabase.from('brands').select('*').eq('is_active', true).order('sort_order'),
      supabase.from('branches').select('*').eq('is_active', true).order('sort_order'),
      supabase.from('app_settings').select('social_instagram,social_whatsapp,social_twitter,social_tiktok,phone').limit(1),
      supabase.from('zatca_public_info').select('cr_number').limit(1),
    ]);

    res.setHeader('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=300');
    return res.status(200).json({
      brands: brands || [],
      branches: branches || [],
      settings: settingsArr?.[0] || {},
      crNumber: crArr?.[0]?.cr_number || null,
    });
  } catch (err) {
    console.error('api/public/site-data error', err);
    return res.status(500).json({ error: 'server_error' });
  }
}
