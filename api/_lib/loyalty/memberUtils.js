/**
 * أدوات مشتركة: توليد رقم العضوية، حساب المستوى، بناء محتوى QR.
 */
import { customAlphabet } from 'nanoid';

// أبجدية بدون أحرف/أرقام ملتبسة (0/O, 1/I) لسهولة القراءة يدوياً عند الحاجة
const nanoidAlphabet = customAlphabet('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 8);

const MEMBER_PREFIX = 'NT'; // إبرة وخيط (Needle & Thread)

/**
 * يولّد رقم عضوية فريد بالشكل NT-XXXXXXXX
 * التفرّد الفعلي يُضمن عبر UNIQUE constraint في قاعدة البيانات + إعادة المحاولة عند التعارض.
 */
export function generateMemberNumber() {
  return `${MEMBER_PREFIX}-${nanoidAlphabet()}`;
}

/**
 * يحسب مستوى العضوية بناءً على عدد النقاط والحدود المضبوطة في الإعدادات.
 */
export function computeMembershipLevel(points, thresholds = {}) {
  const silver = thresholds.silver_threshold ?? 500;
  const gold = thresholds.gold_threshold ?? 1500;
  const platinum = thresholds.platinum_threshold ?? 3000;

  if (points >= platinum) return 'Platinum';
  if (points >= gold) return 'Gold';
  if (points >= silver) return 'Silver';
  return 'Bronze';
}

/**
 * المحتوى النصي الذي يُرمَّز داخل QR — رابط تحقق قصير يحمل رقم العضوية فقط
 * (لا نضع نقاطاً أو بيانات حساسة داخل الـ QR لأنه قد يُلتقط بالكاميرا من أي شخص).
 */
export function buildQrPayload(memberNumber) {
  return `LOYALTY:${memberNumber}`;
}

const LEVEL_LABELS_AR = {
  Bronze: 'برونزي',
  Silver: 'فضي',
  Gold: 'ذهبي',
  Platinum: 'بلاتيني',
};

export function levelLabelAr(level) {
  return LEVEL_LABELS_AR[level] || level;
}
