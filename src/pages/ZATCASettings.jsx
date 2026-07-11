/**
 * ZATCASettings — إعدادات زاتكا (نسخة حقيقية)
 * ──────────────────────────────────────────────────────────────────
 * الفرق عن النسخة القديمة: ما نعد نخزن الشهادة/المفتاح الخاص بمتصفح
 * المستخدم (localStorage) — هذا كان خطأ أمنياً وامتثالياً. الشهادة
 * والمفتاح الخاص و API secret تُضبط كمتغيرات بيئة على الخادم
 * (Vercel) فقط، ولا تُرسل للمتصفح إطلاقاً.
 *
 * هذي الصفحة تدير فقط:
 *  1) بيانات المنشأة العامة (غير سرية — نفس اللي مطبوع بأي إيصال ورقي)
 *  2) اختيار البيئة (اختبار / محاكاة / إنتاج)
 *  3) حالة اتصال حقيقية (يفحصها الخادم فعلياً، مو مجرد Badge وهمي)
 *  4) سجل إرسال حقيقي من قاعدة البيانات
 */
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import {
  Shield, CheckCircle, AlertTriangle, RefreshCw,
  FileText, Building2, Hash, Server, Terminal, ExternalLink,
} from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { getSession } from '@/lib/sessionStore';

const validateVATNumber = (vat) => /^3\d{13}3$/.test(vat || '');

function StatusBadge({ status }) {
  if (!status) return <Badge variant="outline" className="text-gray-500">غير محدد</Badge>;
  if (status === 'REPORTED') return <Badge className="bg-green-100 text-green-700">✅ تم الإبلاغ</Badge>;
  if (status === 'CLEARED') return <Badge className="bg-blue-100 text-blue-700">✅ تم التخليص</Badge>;
  if (status === 'REJECTED') return <Badge className="bg-red-100 text-red-700">❌ مرفوض</Badge>;
  return <Badge variant="outline">{status}</Badge>;
}

const ENV_LABELS = {
  sandbox: { label: '🧪 اختبار (Developer Sandbox)', desc: 'بيئة تجريبية بحتة — لا قيمة قانونية للفواتير هنا' },
  simulation: { label: '🟡 محاكاة (Simulation)', desc: 'تحاكي الإنتاج بدون أثر قانوني — آخر محطة قبل التشغيل الفعلي' },
  production: { label: '🟢 إنتاج (Production)', desc: 'فواتير حقيقية ورسمية تُرفع فعلياً لزاتكا' },
};

export default function ZATCASettings() {
  const session = getSession();
  const isAdmin = ['admin', 'owner', 'manager'].includes(session?.role);

  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [health, setHealth] = useState(null);
  const [checkingHealth, setCheckingHealth] = useState(false);
  const [log, setLog] = useState([]);

  const [needsReview, setNeedsReview] = useState([]);

  const loadAll = async () => {
    setLoading(true);
    const { data } = await supabase.from('zatca_settings').select('*').eq('id', 1).single();
    setSettings(data || {});
    const { data: logRows } = await supabase
      .from('zatca_submission_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);
    setLog(logRows || []);

    const [{ data: ordersFlagged }, { data: salesFlagged }] = await Promise.all([
      supabase.from('orders').select('id, order_number, total_price, zatca_error_category, zatca_retry_count').eq('zatca_needs_review', true),
      supabase.from('sales_invoices').select('id, invoice_number, total, zatca_error_category, zatca_retry_count').eq('zatca_needs_review', true),
    ]);
    setNeedsReview([
      ...(ordersFlagged || []).map(o => ({ ...o, kind: 'طلب إصلاح', number: o.order_number, amount: o.total_price })),
      ...(salesFlagged || []).map(s => ({ ...s, kind: 'فاتورة بيع', number: s.invoice_number, amount: s.total })),
    ]);
    setLoading(false);
  };

  const checkHealth = async () => {
    setCheckingHealth(true);
    try {
      const res = await fetch('/api/zatca/health');
      const data = await res.json();
      setHealth(data);
    } catch {
      setHealth({ ready: false, error: 'تعذر الوصول للخادم' });
    } finally {
      setCheckingHealth(false);
    }
  };

  useEffect(() => { loadAll(); checkHealth(); }, []);

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        <Shield className="w-8 h-8 ml-2" /> هذه الصفحة للمسؤولين فقط
      </div>
    );
  }

  if (loading || !settings) {
    return <div className="flex items-center justify-center h-64 text-gray-400">جارٍ التحميل...</div>;
  }

  const update = (key, val) => setSettings((prev) => ({ ...prev, [key]: val }));

  const isVATValid = !settings.vat_number || validateVATNumber(settings.vat_number);
  const infoComplete = settings.vat_number && settings.cr_number && isVATValid && settings.seller_name && settings.city;

  const save = async () => {
    if (!infoComplete) { toast.error('أكمل بيانات المنشأة أولاً'); return; }
    setSaving(true);
    const { error } = await supabase.from('zatca_settings').update({
      seller_name: settings.seller_name,
      vat_number: settings.vat_number,
      cr_number: settings.cr_number,
      city: settings.city,
      district: settings.district,
      street: settings.street,
      postal_code: settings.postal_code,
      building_number: settings.building_number,
      environment: settings.environment,
      egs_uuid: settings.egs_uuid,
      updated_at: new Date().toISOString(),
    }).eq('id', 1);
    setSaving(false);
    if (error) { toast.error('فشل الحفظ: ' + error.message); return; }
    toast.success('تم حفظ إعدادات زاتكا ✅');
    checkHealth();
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto" dir="rtl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center">
          <Shield className="w-5 h-5 text-green-700" />
        </div>
        <div>
          <h1 className="text-xl font-black">إعدادات زاتكا ZATCA</h1>
          <p className="text-sm text-gray-500">فوترة إلكترونية حقيقية — مرحلة 2 (ربط مباشر)</p>
        </div>
        <div className="mr-auto">
          {health?.ready
            ? <Badge className="bg-green-100 text-green-700 px-3 py-1">✅ الخادم جاهز ({ENV_LABELS[health.environment]?.label.split(' ')[0]})</Badge>
            : <Badge className="bg-amber-100 text-amber-700 px-3 py-1">⚠️ غير جاهز</Badge>}
        </div>
      </div>

      <Tabs defaultValue="settings">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="settings">بيانات المنشأة</TabsTrigger>
          <TabsTrigger value="server">مفاتيح الخادم</TabsTrigger>
          <TabsTrigger value="log">سجل الفواتير</TabsTrigger>
        </TabsList>

        {/* ── بيانات المنشأة ─────────────────────────────── */}
        <TabsContent value="settings" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Building2 className="w-4 h-4 text-blue-600" />بيانات منشأتك (غير سرية)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>اسم المنشأة *</Label>
                  <Input value={settings.seller_name || ''} onChange={e => update('seller_name', e.target.value)} placeholder="إبرة وخيط الإسكافي" />
                </div>
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1"><Hash className="w-3 h-3" />الرقم الضريبي (VAT) *</Label>
                  <Input value={settings.vat_number || ''} onChange={e => update('vat_number', e.target.value)}
                    placeholder="300000000000003" dir="ltr"
                    className={!isVATValid ? 'border-red-400' : ''} />
                  {!isVATValid && <p className="text-xs text-red-500">15 رقماً — يبدأ وينتهي بـ 3</p>}
                </div>
                <div className="space-y-1.5">
                  <Label>رقم السجل التجاري *</Label>
                  <Input value={settings.cr_number || ''} onChange={e => update('cr_number', e.target.value)} placeholder="1000000000" dir="ltr" />
                </div>
                <div className="space-y-1.5">
                  <Label>المدينة *</Label>
                  <Input value={settings.city || ''} onChange={e => update('city', e.target.value)} placeholder="الرياض" />
                </div>
                <div className="space-y-1.5">
                  <Label>الحي</Label>
                  <Input value={settings.district || ''} onChange={e => update('district', e.target.value)} placeholder="العليا" />
                </div>
                <div className="space-y-1.5">
                  <Label>الشارع</Label>
                  <Input value={settings.street || ''} onChange={e => update('street', e.target.value)} placeholder="شارع الملك فهد" />
                </div>
                <div className="space-y-1.5">
                  <Label>الرمز البريدي</Label>
                  <Input value={settings.postal_code || ''} onChange={e => update('postal_code', e.target.value)} placeholder="11111" dir="ltr" />
                </div>
                <div className="space-y-1.5">
                  <Label>رقم المبنى</Label>
                  <Input value={settings.building_number || ''} onChange={e => update('building_number', e.target.value)} placeholder="0000" dir="ltr" />
                </div>
              </div>

              <div className="space-y-1.5 pt-2 border-t">
                <Label>البيئة</Label>
                <div className="grid grid-cols-1 gap-2">
                  {Object.entries(ENV_LABELS).map(([key, v]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => update('environment', key)}
                      className={`text-right p-3 rounded-xl border-2 transition-colors ${
                        settings.environment === key ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="font-bold text-sm">{v.label}</div>
                      <div className="text-xs text-gray-500 mt-0.5">{v.desc}</div>
                    </button>
                  ))}
                </div>
                {settings.environment === 'production' && (
                  <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-800 mt-2">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                    أي طلب أو فاتورة تُنشأ الآن سترسل لزاتكا فعلياً بأثر قانوني حقيقي. تأكد إنك اختبرت على simulation أولاً.
                  </div>
                )}
              </div>

              <Button onClick={save} disabled={saving || !infoComplete} className="w-full gap-2">
                {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                حفظ الإعدادات
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── مفاتيح الخادم ─────────────────────────────── */}
        <TabsContent value="server" className="mt-6 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Server className="w-4 h-4 text-purple-600" />الشهادة والمفتاح الخاص — على الخادم فقط
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg text-xs text-blue-800 leading-relaxed">
                لأسباب أمنية وامتثالية، الشهادة والمفتاح الخاص ما يُرفعان من هذه الصفحة أبداً — أي شيء يُكتب بالمتصفح ممكن يُسرّب.
                بدلاً من ذلك، تُضبط كمتغيرات بيئة سرّية في لوحة Vercel لهذا المشروع (Settings → Environment Variables):
              </div>
              <div className="bg-gray-900 text-gray-100 rounded-lg p-4 font-mono text-xs space-y-1 overflow-x-auto" dir="ltr">
                <div>ZATCA_PRIVATE_KEY=&lt;نفس المفتاح الخاص المستخدم لكل من CSID التجريبي والإنتاجي&gt;</div>
                <div>ZATCA_CERTIFICATE=&lt;شهادة Compliance CSID (اختبار/محاكاة)&gt;</div>
                <div>ZATCA_API_SECRET=&lt;secret المرافق لشهادة الاختبار&gt;</div>
                <div>ZATCA_PRODUCTION_CERTIFICATE=&lt;شهادة Production CSID الحقيقية&gt;</div>
                <div>ZATCA_PRODUCTION_API_SECRET=&lt;secret المرافق لشهادة الإنتاج&gt;</div>
                <div>SUPABASE_SERVICE_ROLE_KEY=&lt;من Supabase → Project Settings → API&gt;</div>
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <Terminal className="w-3.5 h-3.5" />
                بعد إضافتها، أعد نشر المشروع (Redeploy) حتى تُقرأ من دالة <code dir="ltr">/api/zatca/submit</code>
              </div>
              <a href="https://vercel.com/docs/projects/environment-variables" target="_blank" rel="noreferrer"
                className="flex items-center gap-1.5 text-xs text-blue-600 hover:underline">
                <ExternalLink className="w-3 h-3" /> دليل Vercel لإضافة متغيرات البيئة
              </a>

              <div className="pt-3 border-t">
                <Button variant="outline" onClick={checkHealth} disabled={checkingHealth} className="w-full gap-2">
                  {checkingHealth ? <RefreshCw className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                  فحص جاهزية الخادم الآن
                </Button>
                {health && (
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <CheckRow ok={health.checks?.businessInfoComplete} label="بيانات المنشأة" />
                    <CheckRow ok={health.checks?.hasPrivateKey} label="المفتاح الخاص (خادم)" />
                    <CheckRow ok={health.checks?.hasCert} label={`الشهادة (${ENV_LABELS[health.environment]?.label.split(' ')[0] || ''})`} />
                    <CheckRow ok={health.checks?.hasSecret} label="API secret" />
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Log ────────────────────────────────────── */}
        <TabsContent value="log" className="mt-6 space-y-4">
          {needsReview.length > 0 && (
            <Card className="border-red-300">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2 text-red-700">
                  <AlertTriangle className="w-4 h-4" />
                  {needsReview.length} فاتورة تحتاج مراجعتك يدوياً (النظام ما يقدر يصلحها تلقائياً)
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {needsReview.map((r) => (
                  <div key={r.id} className="flex items-center gap-3 p-3 rounded-lg border border-red-200 bg-red-50 text-sm flex-wrap">
                    <Badge variant="outline">{r.kind}</Badge>
                    <span className="font-mono font-medium">{r.number}</span>
                    <span className="text-gray-500">{r.amount?.toFixed?.(2)} ر.س</span>
                    <Badge className="bg-red-100 text-red-700">{r.zatca_error_category || 'غير مصنّف'}</Badge>
                    <span className="text-xs text-gray-400 mr-auto">{r.zatca_retry_count} محاولات</span>
                  </div>
                ))}
                <p className="text-xs text-gray-500 pt-1">
                  هذي الفئة (بيانات ناقصة/شهادة غير صالحة) عمداً ما تُصلَح تلقائياً — تصحيحها آلياً على بيانات ضريبية رسمية خطر أكبر من تأخيرها يوم.
                </p>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <RefreshCw className="w-4 h-4 text-blue-600" />الإصلاح التلقائي — كيف يشتغل
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-gray-600 space-y-1.5 leading-relaxed">
              <p>مهمة مجدولة (Vercel Cron) تفحص كل الفواتير المرفوضة كل 10 دقائق تلقائياً بدون تدخلك:</p>
              <p>✅ أخطاء شبكة/خادم مؤقتة من زاتكا → تُعاد المحاولة تلقائياً</p>
              <p>✅ فرق تقريب بالحسابات أو عدم تطابق تسلسل الفواتير → تُصحَّح وتُعاد تلقائياً</p>
              <p>🛑 رقم ضريبي/سجل تجاري خاطئ أو شهادة منتهية → يتوقف ويظهر لك أعلاه فقط، ما يُخمِّن قيمة بديلة</p>
              <p className="text-amber-600 pt-1">⚠️ ملاحظة: تشغيل Cron كل 10 دقائق يحتاج خطة Vercel Pro — على الخطة المجانية (Hobby) الحد الأقصى تشغيل واحد يومياً.</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="w-4 h-4" />سجل إرسال الفواتير (من قاعدة البيانات مباشرة)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {log.length === 0 ? (
                <div className="text-center text-gray-400 py-12 text-sm">لا يوجد سجل إرسال بعد</div>
              ) : (
                <div className="space-y-2">
                  {log.map((entry) => (
                    <div key={entry.id} className="flex items-center gap-3 p-3 rounded-lg border text-sm flex-wrap">
                      <StatusBadge status={entry.status} />
                      <span className="font-mono font-medium">{entry.invoice_number}</span>
                      <span className="text-gray-400 text-xs">ICV #{entry.icv}</span>
                      <Badge variant="outline" className="text-[10px]">{entry.environment}</Badge>
                      {entry.auto_fix_applied && <Badge className="bg-blue-100 text-blue-700 text-[10px]">إعادة محاولة تلقائية</Badge>}
                      <span className="text-gray-400 text-xs mr-auto">
                        {new Date(entry.created_at).toLocaleString('ar-SA')}
                      </span>
                      {entry.error_message && (
                        <span className="text-red-500 text-xs w-full">{entry.error_message}</span>
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

function CheckRow({ ok, label }) {
  return (
    <div className={`flex items-center gap-1.5 p-2 rounded-lg border ${ok ? 'border-green-200 bg-green-50 text-green-700' : 'border-gray-200 bg-gray-50 text-gray-500'}`}>
      {ok ? <CheckCircle className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
      {label}
    </div>
  );
}
