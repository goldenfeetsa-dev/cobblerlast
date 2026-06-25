// ── Session Store ────────────────────────────────────────────────
// يخزّن بيانات الموظف المسجّل — بدون PIN أبداً
const SESSION_KEY = 'needle_thread_session';

function getStorage() {
  try {
    localStorage.setItem('_test', '1');
    localStorage.removeItem('_test');
    return localStorage;
  } catch {
    return null;
  }
}

let memorySession = null;

export function getSession() {
  const storage = getStorage();
  if (storage) {
    const raw = storage.getItem(SESSION_KEY);
    if (!raw) return null;
    try { return JSON.parse(raw); } catch { return null; }
  }
  return memorySession;
}

export function setSession(employee) {
  // ⚠️ لا يُخزّن الـ PIN في أي وقت
  const { pin, ...safe } = employee;
  const storage = getStorage();
  if (storage) {
    storage.setItem(SESSION_KEY, JSON.stringify(safe));
  }
  memorySession = safe;
}

export function clearSession() {
  const storage = getStorage();
  if (storage) storage.removeItem(SESSION_KEY);
  memorySession = null;
}
