// product-feed — فيد منتجات Google Merchant Center (RSS 2.0 + g:) من جدول products مباشرة. بلا تخزين.
// الرابط: https://<project>.supabase.co/functions/v1/product-feed  (يُضاف في Merchant Center كملف مجدول)
import { createClient } from 'jsr:@supabase/supabase-js@2';

const SITE = 'https://www.needlecobbler.com';
const esc = (s: unknown) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const abs = (u: string | null) => (!u ? null : /^https?:\/\//.test(u) ? u : SITE + (u.startsWith('/') ? u : '/' + u));

Deno.serve(async () => {
  const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const { data, error } = await sb.from('products')
    .select('id,name,name_ar,description,price,original_price,image_url,sku,in_stock,category,brand_name')
    .gt('price', 0).order('sort_order');
  if (error) return new Response('error', { status: 500 });

  const items = (data || []).filter((p) => p.image_url).map((p) => {
    const title = p.name_ar || p.name;
    const sale = p.original_price && Number(p.original_price) > Number(p.price);
    return `<item>
<g:id>${esc(p.sku || p.id)}</g:id>
<g:title>${esc(String(title).slice(0, 150))}</g:title>
<g:description>${esc((p.description || title).slice(0, 4900))}</g:description>
<g:link>${SITE}/shop/${p.id}</g:link>
<g:image_link>${esc(abs(p.image_url))}</g:image_link>
<g:availability>${p.in_stock ? 'in_stock' : 'out_of_stock'}</g:availability>
<g:price>${Number(sale ? p.original_price : p.price).toFixed(2)} SAR</g:price>${sale ? `\n<g:sale_price>${Number(p.price).toFixed(2)} SAR</g:sale_price>` : ''}
<g:condition>new</g:condition>
<g:brand>${esc(p.brand_name || 'إبرة وخيط الإسكافي')}</g:brand>
<g:identifier_exists>no</g:identifier_exists>${p.category ? `\n<g:product_type>${esc(p.category)}</g:product_type>` : ''}
</item>`;
  }).join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0"><channel>
<title>متجر إبرة وخيط الإسكافي</title><link>${SITE}/shop</link><description>مستلزمات العناية بالأحذية والحقائب الجلدية</description>
${items}
</channel></rss>`;
  return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=900' } });
});
