/**
 * GET /api/public/site-data
 * ──────────────────────────────────────────────────────────────────
 * يجمّع كل البيانات العامة اللي تحتاجها صفحة الهبوط (علامات، فروع،
 * بيانات تواصل، رقم السجل التجاري) باستعلام واحد بدل 4 استعلامات
 * منفصلة من كل متصفح زائر مباشرة لـ Supabase.
 *
 * الأهم: ترويسة Cache-Control أدناه تخلي شبكة Vercel العالمية (CDN)
 * تخزّن هذا الرد نفسه وترجعه لكل الزوار مباشرة من أقرب نقطة جغرافية
 * لهم — بدون ما تلمس Supabase إطلاقاً في كل مرة. فرق شاسع بين:
 *   • 30,000 زائر × 4 استعلامات = 120,000 ضغطة على القاعدة لحظياً (ينهار)
 *   • 30,000 زائر يقرؤون نفس النسخة المخزّنة بالـ CDN = تقريباً استعلام
 *     واحد فعلي لقاعدة البيانات كل 30 ثانية، بغض النظر عن عدد الزوار.
 *
 * s-maxage=30           → Vercel يخدم النسخة المخزّنة لمدة 30 ثانية دون أي اتصال بالخادم
 * stale-while-revalidate=300 → بعدها يقدر يخدم نسخة "قديمة قليلاً" لغاية 5 دقائق
 *                              وهو بالخلفية يجدّدها، بدل ما يخلي الزائر ينتظر
 */
import { getSupabaseAdmin } from '../_lib/loyalty/supabaseAdmin.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'method_not_allowed' });

  try {
    const supabase = getSupabaseAdmin();

    const [{ data: brands }, { data: branches }, { data: settingsArr }, { data: crArr }] = await Promise.all([
      supabase.from('brands').select('*').eq('is_active', true).order('sort_order'),
      supabase.from('branches').select('*').eq('is_active', true).order('sort_order'),
      supabase.from('app_settings').select('social_instagram,social_whatsapp,social_twitter,phone').limit(1),
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
    // حتى عند الخطأ، ما نمنع الكاش من الاستمرار بخدمة آخر نسخة صالحة كانت عنده
    return res.status(500).json({ error: 'server_error' });
  }
}
