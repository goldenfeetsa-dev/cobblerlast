/**
 * Security utilities for the Cobblerlast app
 * Provides input sanitization, rate limiting, and XSS protection
 */

// ── Input Sanitization ──────────────────────────────────────────
/**
 * Sanitize a string to prevent XSS
 */
export const sanitizeInput = (input) => {
  if (typeof input !== 'string') return input;
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
};

/**
 * Validate phone number (Saudi format)
 */
export const validatePhone = (phone) => {
  const saudiPhoneRegex = /^((\+966|00966|966)|0)?5[0-9]{8}$/;
  return saudiPhoneRegex.test(phone?.replace(/\s/g, ''));
};

/**
 * Validate email
 */
export const validateEmail = (email) => {
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return emailRegex.test(email);
};

// ── Client-side Rate Limiter ─────────────────────────────────────
const rateLimitStore = {};

/**
 * Simple client-side rate limiter
 * @param {string} key - Unique key for the action (e.g., 'booking-submit')
 * @param {number} maxAttempts - Max number of attempts
 * @param {number} windowMs - Time window in milliseconds
 * @returns {boolean} - true if allowed, false if rate limited
 */
export const checkRateLimit = (key, maxAttempts = 5, windowMs = 60000) => {
  const now = Date.now();
  if (!rateLimitStore[key]) {
    rateLimitStore[key] = { attempts: 0, firstAttempt: now };
  }
  
  const store = rateLimitStore[key];
  
  // Reset if window expired
  if (now - store.firstAttempt > windowMs) {
    store.attempts = 0;
    store.firstAttempt = now;
  }
  
  store.attempts++;
  
  if (store.attempts > maxAttempts) {
    const remainingMs = windowMs - (now - store.firstAttempt);
    console.warn(`Rate limit exceeded for "${key}". Try again in ${Math.ceil(remainingMs / 1000)}s`);
    return false;
  }
  
  return true;
};

// ── CSRF Token ───────────────────────────────────────────────────
/**
 * Generate a simple CSRF token stored in sessionStorage
 */
export const getCsrfToken = () => {
  let token = sessionStorage.getItem('csrf_token');
  if (!token) {
    token = Array.from(crypto.getRandomValues(new Uint8Array(32)))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    sessionStorage.setItem('csrf_token', token);
  }
  return token;
};

// ── URL Validation ───────────────────────────────────────────────
/**
 * Validate that a redirect URL is safe (same origin or allowed domains)
 */
export const isSafeRedirectUrl = (url) => {
  try {
    const parsed = new URL(url, window.location.origin);
    const allowedOrigins = [
      window.location.origin,
      'https://cobblerlast.com',
    ];
    return allowedOrigins.includes(parsed.origin);
  } catch {
    return false;
  }
};

// ── Content Security ─────────────────────────────────────────────
/**
 * Strip HTML tags from user input
 */
export const stripHtml = (html) => {
  const div = document.createElement('div');
  div.innerHTML = html;
  return div.textContent || div.innerText || '';
};

export default {
  sanitizeInput,
  validatePhone,
  validateEmail,
  checkRateLimit,
  getCsrfToken,
  isSafeRedirectUrl,
  stripHtml,
};
