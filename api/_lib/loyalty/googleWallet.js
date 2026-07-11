/**
 * تكامل Google Wallet REST API لبرنامج الولاء — بدون أي مكتبة SDK خارجية
 * (googleapis غير مسموح بها)؛ نبني JWT ونوقّعه يدوياً عبر crypto المدمجة في Node
 * ثم نستدعي واجهات walletobjects/v1 مباشرة عبر fetch.
 *
 * المتغيرات البيئية المطلوبة:
 *   GOOGLE_WALLET_SERVICE_ACCOUNT_JSON   محتوى ملف حساب الخدمة (Service Account) كـ JSON كامل (نص)
 *   GOOGLE_WALLET_ISSUER_ID              معرّف المُصدر من Google Pay & Wallet Console
 *   GOOGLE_WALLET_CLASS_ID                (اختياري) معرّف الفئة الجاهز؛ إن لم يوجد سيُنشأ تلقائياً بصيغة {issuerId}.loyalty_class
 */
import crypto from 'crypto';

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const WALLET_API = 'https://walletobjects.googleapis.com/walletobjects/v1';
const SCOPE = 'https://www.googleapis.com/auth/wallet_object.issuer';

function base64url(input) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function getServiceAccount() {
  const raw = process.env.GOOGLE_WALLET_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error('متغير البيئة GOOGLE_WALLET_SERVICE_ACCOUNT_JSON غير مضبوط');
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error('GOOGLE_WALLET_SERVICE_ACCOUNT_JSON ليس JSON صالحاً');
  }
}

export function isGoogleWalletConfigured() {
  return !!(process.env.GOOGLE_WALLET_SERVICE_ACCOUNT_JSON && process.env.GOOGLE_WALLET_ISSUER_ID);
}

function signJwtRS256(payload, privateKeyPem) {
  const header = { alg: 'RS256', typ: 'JWT' };
  const signingInput = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(payload))}`;
  const signature = crypto.createSign('RSA-SHA256').update(signingInput).sign(privateKeyPem);
  const sigB64Url = signature.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${signingInput}.${sigB64Url}`;
}

/**
 * يحصل على access_token عبر تدفق JWT Bearer (Service Account → OAuth2).
 */
async function getAccessToken() {
  const sa = getServiceAccount();
  const now = Math.floor(Date.now() / 1000);
  const assertion = signJwtRS256(
    {
      iss: sa.client_email,
      scope: SCOPE,
      aud: TOKEN_URL,
      iat: now,
      exp: now + 3600,
    },
    sa.private_key
  );

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`فشل الحصول على access token من Google: ${data.error_description || data.error || res.status}`);
  return data.access_token;
}

function getIssuerId() {
  const id = process.env.GOOGLE_WALLET_ISSUER_ID;
  if (!id) throw new Error('متغير البيئة GOOGLE_WALLET_ISSUER_ID غير مضبوط');
  return id;
}

function getClassId() {
  return process.env.GOOGLE_WALLET_CLASS_ID || `${getIssuerId()}.loyalty_class`;
}

/**
 * يتأكد من وجود Loyalty Class على مستوى المُصدر (تُنشأ مرة واحدة فقط، وتُعاد إذا كانت موجودة).
 */
export async function ensureLoyaltyClass(settings = {}) {
  const accessToken = await getAccessToken();
  const classId = getClassId();

  const classPayload = {
    id: classId,
    issuerName: settings.program_name || 'إبرة وخيط الإسكافي',
    programName: settings.program_name || 'برنامج الولاء',
    reviewStatus: 'UNDER_REVIEW',
    hexBackgroundColor: settings.brand_color || '#1A0F00',
  };

  const getRes = await fetch(`${WALLET_API}/loyaltyClass/${encodeURIComponent(classId)}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (getRes.ok) return classId;

  const createRes = await fetch(`${WALLET_API}/loyaltyClass`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(classPayload),
  });
  const created = await createRes.json();
  if (!createRes.ok) throw new Error(`فشل إنشاء Loyalty Class في Google Wallet: ${created.error?.message || createRes.status}`);
  return classId;
}

function buildLoyaltyObjectPayload(member, classId) {
  return {
    id: `${getIssuerId()}.${member.member_number}`,
    classId,
    state: 'ACTIVE',
    accountId: member.member_number,
    accountName: member.full_name,
    loyaltyPoints: {
      balance: { int: member.points },
      label: 'النقاط',
    },
    barcode: {
      type: 'QR_CODE',
      value: member.qr_code || `LOYALTY:${member.member_number}`,
    },
    textModulesData: [
      { header: 'المستوى', body: member.membership_level, id: 'level' },
      { header: 'رقم العضوية', body: member.member_number, id: 'member_number' },
    ],
  };
}

/**
 * ينشئ بطاقة Google Wallet لعضو جديد أو يحدّث بطاقة موجودة (نقاط/مستوى).
 * يُعيد { objectId, saveUrl }.
 */
export async function upsertLoyaltyObject(member, settings = {}) {
  const accessToken = await getAccessToken();
  const classId = await ensureLoyaltyClass(settings);
  const objectId = member.google_object_id || `${getIssuerId()}.${member.member_number}`;
  const payload = buildLoyaltyObjectPayload(member, classId);

  const getRes = await fetch(`${WALLET_API}/loyaltyObject/${encodeURIComponent(objectId)}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  let res;
  if (getRes.ok) {
    res = await fetch(`${WALLET_API}/loyaltyObject/${encodeURIComponent(objectId)}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } else {
    res = await fetch(`${WALLET_API}/loyaltyObject`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  }

  const data = await res.json();
  if (!res.ok) throw new Error(`فشل إنشاء/تحديث بطاقة Google Wallet: ${data.error?.message || res.status}`);

  const saveUrl = buildSaveLink(objectId);
  return { objectId, saveUrl };
}

/**
 * يبني رابط "Add to Google Wallet" باستخدام JWT قصير الأجل موقّع بحساب الخدمة —
 * لا يستدعي واجهة برمجية، فقط يوقّع JWT محلياً (نمط "Save to Wallet with JWT" الرسمي من Google).
 */
export function buildSaveLink(objectId) {
  const sa = getServiceAccount();
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: sa.client_email,
    aud: 'google',
    typ: 'savetowallet',
    iat: now,
    payload: {
      loyaltyObjects: [{ id: objectId }],
    },
  };
  const jwt = signJwtRS256(payload, sa.private_key);
  return `https://pay.google.com/gp/v/save/${jwt}`;
}
