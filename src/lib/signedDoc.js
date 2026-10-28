// رابط موقّع قصير لمستند خاص (فاتورة مشتريات) — الملفات الخاصة لا تُفتح برابط عام.
export async function signedDocUrl(value, bucket = 'purchase-invoices') {
  if (!value) return '';
  const r = await fetch(`/api/secure/data?resource=docurl&bucket=${encodeURIComponent(bucket)}&u=${encodeURIComponent(value)}`, { credentials: 'include' });
  if (!r.ok) throw new Error('signed_url_failed');
  return (await r.json()).url;
}
