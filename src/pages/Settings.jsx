import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabaseClient';
import { Settings2, Save, Loader2, Building2, Receipt } from 'lucide-react';
import ImageUploader from '@/components/common/ImageUploader';

export default function Settings() {
  const [settings, setSettings] = useState({});
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);

  useEffect(() => {
    supabase.from('app_settings').select('*').limit(1)
      .then(({ data }) => { setSettings(data?.[0] || {}); setLoading(false); });
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      if (settings.id) {
        await supabase.from('app_settings').update(settings).eq('id', settings.id);
      } else {
        const { data } = await supabase.from('app_settings').insert(settings).select().single();
        setSettings(data);
      }
      toast.success('✅ تم حفظ الإعدادات');
    } catch (e) {
      toast.error('فشل الحفظ: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  const upd = (k, v) => setSettings(s => ({ ...s, [k]: v }));

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin" /></div>;

  return (
    <div className="space-y-6 max-w-2xl mx-auto" dir="rtl">
      <div className="flex items-center gap-3">
        <Settings2 className="w-6 h-6" />
        <h1 className="text-xl font-black">إعدادات المتجر</h1>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Building2 className="w-4 h-4" />بيانات المنشأة</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {[
              ['shop_name','اسم المتجر'],['phone','الجوال'],
              ['city','المدينة'],['address','العنوان'],
              ['vat_number','الرقم الضريبي'],['cr_number','السجل التجاري'],
            ].map(([k, label]) => (
              <div key={k} className="space-y-1.5">
                <Label>{label}</Label>
                <Input value={settings[k] || ''} onChange={e => upd(k, e.target.value)} />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Receipt className="w-4 h-4" />الفواتير والضريبة</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label>تفعيل ضريبة القيمة المضافة (15%)</Label>
            <Switch checked={settings.vat_enabled !== false} onCheckedChange={v => upd('vat_enabled', v)} />
          </div>
          <div className="space-y-1.5">
            <ImageUploader
              value={settings.logo_url || ''}
              onChange={(url) => upd('logo_url', url)}
              bucket="branding"
              label="شعار المتجر"
              hint="يُرفع الشعار مباشرة إلى Supabase — لا حاجة لأي رابط خارجي"
            />
          </div>
          <div className="space-y-1.5">
            <Label>مفتاح Moyasar (للدفع الإلكتروني)</Label>
            <Input value={settings.moyasar_publishable_key || ''} onChange={e => upd('moyasar_publishable_key', e.target.value)} dir="ltr" placeholder="pk_live_..." />
          </div>
        </CardContent>
      </Card>

      <Button onClick={save} disabled={saving} className="w-full gap-2">
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
        حفظ الإعدادات
      </Button>
    </div>
  );
}
