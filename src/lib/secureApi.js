/**
 * secureApi.js
 * ──────────────────────────────────────────────────────────────────
 * نداءات لطبقة /api/secure/* — الجافاسكربت هنا لا يحمل أي توكن أو
 * مفتاح؛ المتصفح يرسل كوكي الجلسة HttpOnly تلقائياً (credentials:
 * 'include')، والسيرفر هو اللي يتحقق من الهوية والدور قبل أي عملية.
 */

async function secureFetch(path, options = {}) {
  const res = await fetch(path, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `فشل الطلب (${res.status})`);
  }
  if (res.status === 204) return null;
  return res.json();
}

export const secureExpenses = {
  async list({ orderBy = '-expense_date', limit = 500, gteCol, gteVal, lteCol, lteVal } = {}) {
    const params = new URLSearchParams({ op: 'list', orderBy, limit: String(limit) });
    if (gteCol && gteVal) { params.set('gte_col', gteCol); params.set('gte_val', gteVal); }
    if (lteCol && lteVal) { params.set('lte_col', lteCol); params.set('lte_val', lteVal); }
    return secureFetch(`/api/secure/expenses?${params.toString()}`);
  },
  async get(id) {
    return secureFetch(`/api/secure/expenses?op=get&id=${encodeURIComponent(id)}`);
  },
  async filter(filters = {}, orderBy = '-expense_date', limit = 500) {
    const params = new URLSearchParams({ op: 'filter', orderBy, limit: String(limit), filters: JSON.stringify(filters) });
    return secureFetch(`/api/secure/expenses?${params.toString()}`);
  },
  async create(record) {
    return secureFetch('/api/secure/expenses', { method: 'POST', body: JSON.stringify(record) });
  },
  async update(id, record) {
    return secureFetch(`/api/secure/expenses?id=${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(record) });
  },
  async delete(id) {
    return secureFetch(`/api/secure/expenses?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
  },
};

export const secureZatca = {
  async getSettings() {
    return secureFetch('/api/secure/zatca?resource=settings');
  },
  async updateSettings(record) {
    return secureFetch('/api/secure/zatca?resource=settings', { method: 'POST', body: JSON.stringify(record) });
  },
  async getLog() {
    return secureFetch('/api/secure/zatca?resource=log');
  },
};
