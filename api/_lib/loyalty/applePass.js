/**
 * بناء بطاقة Apple Wallet (.pkpass) لعضو ولاء — passkit-generator فقط.
 *
 * المتغيرات البيئية المطلوبة على Vercel (بدون قيم افتراضية حقيقية):
 *   APPLE_WWDR_CERTIFICATE_BASE64   شهادة Apple WWDR (PEM) مُرمّزة Base64
 *   APPLE_PASS_SIGNER_CERT_BASE64   شهادة التوقيع الخاصة بالـ Pass Type ID (PEM) مُرمّزة Base64
 *   APPLE_PASS_SIGNER_KEY_BASE64    المفتاح الخاص (PEM) مُرمّز Base64
 *   APPLE_PASS_SIGNER_KEY_PASSPHRASE  عبارة مرور المفتاح الخاص (إن وجدت)
 *   APPLE_PASS_TYPE_IDENTIFIER       مثال: pass.com.needlethread.loyalty
 *   APPLE_TEAM_IDENTIFIER             معرّف فريق Apple Developer
 *   APPLE_PASS_WEBSERVICE_URL         (اختياري) رابط الويب سيرفس لتحديثات الدفع (push) — إن لم يُضبط، تُصدر البطاقة بدون تسجيل تحديثات تلقائية
 *
 * ملاحظة مهمة: بدون ضبط هذه المتغيرات، ستفشل عملية إصدار بطاقة Apple Wallet
 * برسالة خطأ واضحة، لكن باقي نظام النقاط (Supabase + Google Wallet) يستمر بالعمل طبيعياً.
 */
import { PKPass } from 'passkit-generator';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ASSETS_DIR = path.join(__dirname, 'pass-assets');

function readAsset(name) {
  return fs.readFileSync(path.join(ASSETS_DIR, name));
}

function requireEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`متغير البيئة ${name} غير مضبوط — لا يمكن إصدار بطاقة Apple Wallet`);
  return v;
}

function loadCertificates() {
  const wwdr = Buffer.from(requireEnv('APPLE_WWDR_CERTIFICATE_BASE64'), 'base64');
  const signerCert = Buffer.from(requireEnv('APPLE_PASS_SIGNER_CERT_BASE64'), 'base64');
  const signerKey = Buffer.from(requireEnv('APPLE_PASS_SIGNER_KEY_BASE64'), 'base64');
  const signerKeyPassphrase = process.env.APPLE_PASS_SIGNER_KEY_PASSPHRASE || undefined;
  return { wwdr, signerCert, signerKey, signerKeyPassphrase };
}

export function isApplePassConfigured() {
  return !!(
    process.env.APPLE_WWDR_CERTIFICATE_BASE64 &&
    process.env.APPLE_PASS_SIGNER_CERT_BASE64 &&
    process.env.APPLE_PASS_SIGNER_KEY_BASE64 &&
    process.env.APPLE_PASS_TYPE_IDENTIFIER &&
    process.env.APPLE_TEAM_IDENTIFIER
  );
}

/**
 * ينشئ بطاقة Apple Wallet (نوع storeCard وهو الأنسب لبرامج الولاء بالنقاط)
 * ويُعيد Buffer جاهزاً لملف .pkpass.
 */
export async function buildApplePassBuffer(member, settings = {}) {
  const passTypeIdentifier = requireEnv('APPLE_PASS_TYPE_IDENTIFIER');
  const teamIdentifier = requireEnv('APPLE_TEAM_IDENTIFIER');
  const certificates = loadCertificates();

  const passJson = {
    formatVersion: 1,
    passTypeIdentifier,
    teamIdentifier,
    serialNumber: member.apple_pass_id || member.member_number,
    organizationName: settings.program_name || 'إبرة وخيط الإسكافي',
    description: 'بطاقة الولاء — إبرة وخيط',
    logoText: settings.program_name || 'إبرة وخيط',
    backgroundColor: hexToRgbCss(settings.brand_color || '#1A0F00'),
    foregroundColor: '#FFFFFF',
    labelColor: hexToRgbCss(settings.accent_color || '#C9A84C'),
    storeCard: {
      headerFields: [
        { key: 'level', label: 'المستوى', value: member.membership_level },
      ],
      primaryFields: [
        { key: 'points', label: 'النقاط', value: member.points, textAlignment: 'PKTextAlignmentCenter' },
      ],
      secondaryFields: [
        { key: 'name', label: 'الاسم', value: member.full_name },
        { key: 'member_number', label: 'رقم العضوية', value: member.member_number },
      ],
      backFields: [
        { key: 'phone', label: 'الجوال', value: member.phone },
        { key: 'terms', label: 'حول البرنامج', value: 'استخدم هذه البطاقة لجمع النقاط والاستفادة من مزايا برنامج الولاء في إبرة وخيط الإسكافي.' },
      ],
    },
    barcodes: [
      {
        message: member.qr_code || `LOYALTY:${member.member_number}`,
        format: 'PKBarcodeFormatQR',
        messageEncoding: 'iso-8859-1',
      },
    ],
  };

  if (process.env.APPLE_PASS_WEBSERVICE_URL && process.env.APPLE_PASS_AUTH_TOKEN) {
    passJson.webServiceURL = process.env.APPLE_PASS_WEBSERVICE_URL;
    passJson.authenticationToken = process.env.APPLE_PASS_AUTH_TOKEN;
  }

  const buffers = {
    'pass.json': Buffer.from(JSON.stringify(passJson)),
    'icon.png': readAsset('icon.png'),
    'icon@2x.png': readAsset('icon@2x.png'),
    'icon@3x.png': readAsset('icon@3x.png'),
    'logo.png': readAsset('logo.png'),
    'logo@2x.png': readAsset('logo@2x.png'),
    'logo@3x.png': readAsset('logo@3x.png'),
  };

  const pass = new PKPass(buffers, certificates, {});
  return pass.getAsBuffer();
}

function hexToRgbCss(hex) {
  const clean = (hex || '').replace('#', '');
  if (clean.length !== 6) return 'rgb(26,15,0)';
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `rgb(${r},${g},${b})`;
}
