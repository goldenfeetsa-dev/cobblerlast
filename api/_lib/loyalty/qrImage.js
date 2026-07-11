/**
 * توليد صورة QR (PNG buffer) من نص — باستخدام مكتبة node-qrcode فقط.
 */
import QRCode from 'qrcode';

export async function generateQrPngBuffer(text, { size = 512, darkColor = '#1A0F00', lightColor = '#FFFFFF' } = {}) {
  return QRCode.toBuffer(text, {
    type: 'png',
    width: size,
    margin: 1,
    errorCorrectionLevel: 'M',
    color: { dark: darkColor, light: lightColor },
  });
}

export async function generateQrDataUrl(text) {
  return QRCode.toDataURL(text, { errorCorrectionLevel: 'M', margin: 1 });
}
