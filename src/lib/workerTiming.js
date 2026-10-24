// بيانات الفني تُسجَّل مع بدء العمل/الإنجاز؛ والتوقيت نفسه يُختم من قاعدة البيانات (trigger)
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function workerPatch(session) {
  if (!session || session.role !== 'staff') return {};
  return { ...(UUID.test(String(session.id || '')) ? { worker_id: session.id } : {}), worker_name: session.name || '' };
}
export function minutesBetween(a, b) {
  if (!a || !b) return null;
  const m = (new Date(b) - new Date(a)) / 60000;
  return m >= 0 ? m : null;
}
export function formatDuration(mins) {
  if (mins == null) return '—';
  if (mins < 1) return 'أقل من دقيقة';
  const h = Math.floor(mins / 60), m = Math.round(mins % 60);
  if (h >= 24) return `${Math.floor(h / 24)} يوم ${h % 24} ساعة`;
  return h ? `${h} ساعة${m ? ` و${m} دقيقة` : ''}` : `${m} دقيقة`;
}
