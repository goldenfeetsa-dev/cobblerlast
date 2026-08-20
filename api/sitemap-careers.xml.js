// GET /api/sitemap-careers.xml
// ─────────────────────────────────────────────────────────────
// سايتماب ديناميكي لكل وظيفة منشورة (is_active = true). robots.txt
// كان يشاور عليه أصلاً بدون ما يكون موجود — جوجل يوصله 404 بدل XML.
// لازم يكون ديناميكي (مو ملف ثابت بـ public/) لأنه يتغيّر كل ما
// المالك/المدير ينشر أو يخفي وظيفة من لوحة الإدارة.
import { getSupabaseAdmin } from './_lib/loyalty/supabaseAdmin.js';

export default async function handler(req, res) {
  try {
    const supabase = getSupabaseAdmin();
    const { data: jobs, error } = await supabase
      .from('job_postings')
      .select('slug,updated_at')
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const urls = (jobs || []).map(j => `  <url>
    <loc>https://needlecobbler.com/careers/${j.slug}</loc>
    <lastmod>${(j.updated_at || new Date().toISOString()).slice(0, 10)}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>`).join('\n');

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://needlecobbler.com/careers</loc>
    <changefreq>daily</changefreq>
    <priority>0.8</priority>
  </url>
${urls}
</urlset>`;

    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    // كاش خفيف على الـ CDN — يتحدث كل ساعة بحد أقصى، يكفي لمحتوى
    // بمعدل تغيّر منخفض (وظائف تُنشر بضعة مرات بالشهر)
    res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400');
    return res.status(200).send(xml);
  } catch (err) {
    console.error('sitemap-careers error', err);
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    return res.status(200).send('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>');
  }
}
