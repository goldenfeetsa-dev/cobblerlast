/**
 * ZATCASettings — صفحة ربط زاتكا
 * Wizard خطوة بخطوة مثل زد وسلة:
 * 1. أدخل الرقم الضريبي + السجل التجاري
 * 2. ادخل OTP الذي وصلك من زاتكا
 * 3. رفع الشهادة (مرة واحدة فقط)
 * 4. مكتمل ✅
 */
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import {
  Shield, CheckCircle, XCircle, AlertTriangle, RefreshCw,
  FileText, Upload, Eye, EyeOff, Building2, Hash, Key,
  Globe, ChevronRight, ChevronLeft, Smartphone, Lock
} from 'lucide-react';
import { validateVATNumber, checkCompliance } from '@/lib/zatca/zatcaUtils';
import { getSession } from '@/lib/sessionStore';

const STORAGE_KEY = 'zatca_config';

function loadConfig() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); }
  catch { return {}; }
}
function saveConfig(cfg) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
}
export function loadZatcaConfig() { return loadConfig(); }

function getSubmissionLog() {
  try { return JSON.parse(localStorage.getItem('zatca_log') || '[]'); }
  catch { return []; }
}
export function addToLog(entry) {
  const log = getSubmissionLog();
  log.unshift({ ...entry, timestamp: new Date().toISOString() });
  localStorage.setItem('zatca_log', JSON.stringify(log.slice(0, 100)));
}

function StatusBadge({ status }) {
  if (!status) return <Badge variant="outline" className="text-gray-500">غير محدد</Badge>;
  if (status === 'REPORTED') return <Badge className="bg-green-100 text-green-700">✅ تم الإبلاغ</Badge>;
  if (status === 'CLEARED')  return <Badge className="bg-blue-100 text-blue-700">✅ تم التخليص</Badge>;
  if (status === 'REJECTED') return <Badge className="bg-red-100 text-red-700">❌ مرفوض</Badge>;
  return <Badge variant="outline">{status}</Badge>;
}

// ── Step Indicator ───────────────────────────────────────────────
function Steps({ current, steps }) {
  return (
    <div className="flex items-center gap-0 mb-8">
      {steps.map((s, i) => (
        <React.Fragment key={i}>
          <div className="flex flex-col items-center gap-1">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all
              ${i < current  ? 'bg-green-500 text-white'
              : i === current ? 'bg-blue-600 text-white ring-4 ring-blue-100'
              : 'bg-gray-100 text-gray-400'}`}>
              {i < current ? <CheckCircle className="w-4 h-4" /> : i + 1}
            </div>
            <span className={`text-[10px] text-center max-w-[60px] ${i === current ? 'text-blue-700 font-semibold' : 'text-gray-400'}`}>{s}</span>
          </div>
          {i < steps.length - 1 && (
            <div className={`flex-1 h-0.5 mb-4 mx-1 ${i < current ? 'bg-green-400' : 'bg-gray-200'}`} />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

// ── Main ─────────────────────────────────────────────────────────
export default function ZATCASettings() {
  const session = getSession();
  const isAdmin = session?.role === 'admin';
  const [config, setConfig] = useState(() => loadConfig());
  const [step, setStep] = useState(() => {
    const cfg = loadConfig();
    if (cfg.connected) return 3;
    if (cfg.certificateBase64) return 3;
    if (cfg.vatNumber && cfg.crNumber) return 1;
    return 0;
  });
  const [otp, setOtp]           = useState('');
  const [testing, setTesting]   = useState(false);
  const [showKey, setShowKey]   = useState(false);
  const [log] = useState(() => getSubmissionLog());

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        <Shield className="w-8 h-8 ml-2" /> هذه الصفحة للمسؤولين فقط
      </div>
    );
  }

  const update = (key, val) => {
    const next = { ...config, [key]: val };
    setConfig(next);
    saveConfig(next);
  };

  const isVATValid = !config.vatNumber || validateVATNumber(config.vatNumber);

  // ── Step 0: بيانات المنشأة ────────────────────────────────────
  const step0Complete = config.vatNumber && config.crNumber && isVATValid
    && config.sellerName && config.city;

  // ── Step 1: OTP + اختبار الاتصال ─────────────────────────────
  const handleOTPConnect = async () => {
    if (otp.length < 4) { toast.error('أدخل رمز OTP'); return; }
    if (!config.certificateBase64) {
      toast.error('يجب رفع الشهادة أولاً في الخطوة التالية');
      setStep(2); return;
    }
    setTesting(true);
    try {
      await checkCompliance({
        certificateBase64: config.certificateBase64,
        privateKeyBase64: config.privateKeyBase64,
        sandbox: config.sandbox !== false,
      });
      update('connected', true);
      update('connectedAt', new Date().toISOString());
      toast.success('✅ تم الربط بزاتكا بنجاح!');
      setStep(3);
    } catch (err) {
      toast.error(`فشل الربط: ${err.message}`);
    } finally {
      setTesting(false);
    }
  };

  // ── Step 2: رفع الشهادة ───────────────────────────────────────
  const handleCertUpload = (e, field) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      let content = ev.target.result;
      // إزالة PEM headers إذا كانت موجودة
      if (content.includes('-----BEGIN')) {
        content = content.replace(/-----BEGIN.*-----|-----END.*-----|\n|\r/g, '').trim();
      }
      update(field, content);
      toast.success(`تم رفع ${field === 'certificateBase64' ? 'الشهادة' : 'المفتاح'}`);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const STEPS = ['بيانات المنشأة', 'رمز OTP', 'الشهادة', 'مكتمل'];

  return (
    <div className="space-y-6 max-w-2xl mx-auto" dir="rtl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center">
          <Shield className="w-5 h-5 text-green-700" />
        </div>
        <div>
          <h1 className="text-xl font-black">إعدادات زاتكا ZATCA</h1>
          <p className="text-sm text-gray-500">الفوترة الإلكترونية — المرحلة الأولى والثانية</p>
        </div>
        <div className="mr-auto">
          {config.connected
            ? <Badge className="bg-green-100 text-green-700 px-3 py-1">✅ مرتبط بزاتكا</Badge>
            : <Badge className="bg-amber-100 text-amber-700 px-3 py-1">⚠️ غير مرتبط</Badge>}
        </div>
      </div>

      <Tabs defaultValue="wizard">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="wizard">إعداد الربط</TabsTrigger>
          <TabsTrigger value="log">سجل الفواتير</TabsTrigger>
        </TabsList>

        {/* ── Wizard ─────────────────────────────────── */}
        <TabsContent value="wizard" className="mt-6">
          <Steps current={step} steps={STEPS} />

          {/* STEP 0 — بيانات المنشأة */}
          {step === 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-blue-600" />بيانات منشأتك
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>اسم المنشأة *</Label>
                    <Input value={config.sellerName || ''} onChange={e => update('sellerName', e.target.value)} placeholder="إبرة وخيط الإسكافي" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="flex items-center gap-1"><Hash className="w-3 h-3" />الرقم الضريبي (VAT) *</Label>
                    <Input value={config.vatNumber || ''} onChange={e => update('vatNumber', e.target.value)}
                      placeholder="300000000000003" dir="ltr"
                      className={!isVATValid ? 'border-red-400' : ''} />
                    {!isVATValid && <p className="text-xs text-red-500">15 رقماً — يبدأ وينتهي بـ 3</p>}
                  </div>
                  <div className="space-y-1.5">
                    <Label>رقم السجل التجاري *</Label>
                    <Input value={config.crNumber || ''} onChange={e => update('crNumber', e.target.value)} placeholder="1000000000" dir="ltr" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>المدينة *</Label>
                    <Input value={config.city || ''} onChange={e => update('city', e.target.value)} placeholder="الرياض" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>الحي</Label>
                    <Input value={config.district || ''} onChange={e => update('district', e.target.value)} placeholder="العليا" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>الشارع</Label>
                    <Input value={config.street || ''} onChange={e => update('street', e.target.value)} placeholder="شارع الملك فهد" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>الرمز البريدي</Label>
                    <Input value={config.postalCode || ''} onChange={e => update('postalCode', e.target.value)} placeholder="11111" dir="ltr" />
                  </div>
                </div>
                <div className="flex items-center justify-between pt-2 border-t">
                  <label className="flex items-center gap-2 text-sm">
                    <Switch checked={config.sandbox !== false} onCheckedChange={v => update('sandbox', v)} />
                    بيئة اختبار (Sandbox)
                  </label>
                  <Button onClick={() => setStep(1)} disabled={!step0Complete} className="gap-1">
                    التالي <ChevronLeft className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* STEP 1 — OTP */}
          {step === 1 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Smartphone className="w-4 h-4 text-purple-600" />رمز التحقق OTP من زاتكا
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="p-4 bg-blue-50 rounded-xl border border-blue-100 text-sm text-blue-800 space-y-2">
                  <p className="font-bold">📱 كيف تحصل على OTP:</p>
                  <ol className="list-decimal list-inside space-y-1 text-xs">
                    <li>افتح بوابة فاتورة: <span className="font-mono font-bold">fatoora.zatca.gov.sa</span></li>
                    <li>سجّل دخولك بالنفاذ الوطني</li>
                    <li>اذهب إلى <strong>الأجهزة ← إضافة جهاز جديد</strong></li>
                    <li>أدخل بيانات المنشأة وأنشئ الجهاز</li>
                    <li>سيصلك رمز OTP على جوالك المسجّل في زاتكا</li>
                  </ol>
                </div>
                <div className="space-y-1.5">
                  <Label>رمز OTP</Label>
                  <Input
                    value={otp}
                    onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="أدخل الرمز هنا"
                    dir="ltr"
                    inputMode="numeric"
                    className="text-center text-2xl tracking-widest font-mono"
                    maxLength={6}
                  />
                  <p className="text-xs text-gray-500">الرمز صالح لمدة 60 دقيقة من إنشائه</p>
                </div>
                <div className="flex gap-2 pt-2 border-t">
                  <Button variant="outline" onClick={() => setStep(0)} className="gap-1">
                    <ChevronRight className="w-4 h-4" />رجوع
                  </Button>
                  <Button onClick={() => setStep(2)} disabled={otp.length < 4} className="flex-1 gap-1">
                    التالي — رفع الشهادة <ChevronLeft className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* STEP 2 — الشهادة */}
          {step === 2 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Key className="w-4 h-4 text-amber-600" />رفع الشهادة الرقمية
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-3 bg-amber-50 border border-amber-100 rounded-lg text-xs text-amber-800">
                  بعد إنشاء الجهاز في بوابة فاتورة، حمّل ملفَي <strong>.pem</strong> — واحد للشهادة وواحد للمفتاح الخاص.
                </div>

                {/* Certificate upload */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    الشهادة (Certificate.pem)
                    {config.certificateBase64 && <CheckCircle className="w-3.5 h-3.5 text-green-500" />}
                  </Label>
                  <label className={`flex items-center gap-3 p-4 rounded-xl border-2 border-dashed cursor-pointer transition-colors
                    ${config.certificateBase64 ? 'border-green-300 bg-green-50' : 'border-gray-200 hover:border-blue-300 hover:bg-blue-50'}`}>
                    <Upload className="w-5 h-5 text-gray-400 shrink-0" />
                    <span className="text-sm text-gray-600">
                      {config.certificateBase64 ? '✅ تم رفع الشهادة — انقر للتغيير' : 'انقر لرفع ملف الشهادة (.pem أو .crt)'}
                    </span>
                    <input type="file" accept=".pem,.crt,.cer,.txt" className="hidden"
                      onChange={e => handleCertUpload(e, 'certificateBase64')} />
                  </label>
                </div>

                {/* Private key upload */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    المفتاح الخاص (PrivateKey.pem)
                    {config.privateKeyBase64 && <CheckCircle className="w-3.5 h-3.5 text-green-500" />}
                  </Label>
                  <label className={`flex items-center gap-3 p-4 rounded-xl border-2 border-dashed cursor-pointer transition-colors
                    ${config.privateKeyBase64 ? 'border-green-300 bg-green-50' : 'border-gray-200 hover:border-purple-300 hover:bg-purple-50'}`}>
                    <Lock className="w-5 h-5 text-gray-400 shrink-0" />
                    <span className="text-sm text-gray-600">
                      {config.privateKeyBase64 ? '✅ تم رفع المفتاح — انقر للتغيير' : 'انقر لرفع المفتاح الخاص (.pem أو .key)'}
                    </span>
                    <input type="file" accept=".pem,.key,.txt" className="hidden"
                      onChange={e => handleCertUpload(e, 'privateKeyBase64')} />
                  </label>
                </div>

                <div className="flex gap-2 pt-2 border-t">
                  <Button variant="outline" onClick={() => setStep(1)} className="gap-1">
                    <ChevronRight className="w-4 h-4" />رجوع
                  </Button>
                  <Button
                    onClick={handleOTPConnect}
                    disabled={testing || !config.certificateBase64 || !config.privateKeyBase64}
                    className="flex-1 gap-2 bg-green-600 hover:bg-green-700">
                    {testing
                      ? <><RefreshCw className="w-4 h-4 animate-spin" />جارٍ الربط...</>
                      : <><Globe className="w-4 h-4" />ربط بزاتكا الآن</>}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* STEP 3 — مكتمل */}
          {step === 3 && (
            <Card className="border-green-200 bg-green-50/50">
              <CardContent className="pt-8 pb-6 flex flex-col items-center text-center gap-4">
                <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
                  <CheckCircle className="w-9 h-9 text-green-600" />
                </div>
                <div>
                  <h2 className="text-xl font-black text-green-800">تم الربط بزاتكا بنجاح ✅</h2>
                  <p className="text-sm text-green-700 mt-1">
                    سيتم إرسال كل فاتورة تلقائياً عند الإصدار
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3 w-full max-w-xs text-sm">
                  <div className="bg-white rounded-lg p-3 border border-green-200 text-right">
                    <div className="text-xs text-gray-500">الرقم الضريبي</div>
                    <div className="font-mono font-bold text-xs mt-0.5">{config.vatNumber}</div>
                  </div>
                  <div className="bg-white rounded-lg p-3 border border-green-200 text-right">
                    <div className="text-xs text-gray-500">البيئة</div>
                    <div className="font-bold text-xs mt-0.5">{config.sandbox !== false ? '🧪 اختبار' : '🟢 إنتاج'}</div>
                  </div>
                </div>
                <div className="flex gap-2 w-full max-w-xs">
                  <Button variant="outline" size="sm" onClick={() => { update('connected', false); setStep(0); }} className="flex-1 text-xs">
                    إعادة الإعداد
                  </Button>
                  <Button size="sm" onClick={() => update('sandbox', !config.sandbox)} className="flex-1 text-xs">
                    {config.sandbox !== false ? 'تحويل للإنتاج' : 'رجوع للاختبار'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ── Log ────────────────────────────────────── */}
        <TabsContent value="log" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="w-4 h-4" />سجل إرسال الفواتير
              </CardTitle>
            </CardHeader>
            <CardContent>
              {log.length === 0 ? (
                <div className="text-center text-gray-400 py-12 text-sm">لا يوجد سجل إرسال بعد</div>
              ) : (
                <div className="space-y-2">
                  {log.map((entry, i) => (
                    <div key={i} className="flex items-center gap-3 p-3 rounded-lg border text-sm flex-wrap">
                      <StatusBadge status={entry.status} />
                      <span className="font-mono font-medium">{entry.invoiceNumber}</span>
                      <span className="text-gray-500 text-xs">{entry.customerName}</span>
                      <span className="text-gray-400 text-xs mr-auto">
                        {new Date(entry.timestamp).toLocaleString('ar-SA')}
                      </span>
                      {entry.warnings?.length > 0 && (
                        <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
