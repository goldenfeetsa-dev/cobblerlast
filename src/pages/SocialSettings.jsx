import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabaseClient';
import { getSession } from '@/lib/sessionStore';
import { Instagram, MessageCircle, Twitter, Globe, Phone, MapPin, Save, Loader2, ExternalLink } from 'lucide-react';

export default function SocialSettings() {
  const session = getSession();
  const isAdmin = session?.role === 'admin' || session?.role === 'owner' || session?.role === 'manager';
  const [settings, setSettings] = useState({});
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);

  useEffect(() => {
    supabase.from('app_settings').select('*').limit(1)
      .then(({ data }) => { setSettings(data?.[0] || {}); setLoading(false); });
  }, []);

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        <span>🔒 هذه الصفحة للمدراء فقط</span>
      </div>
    );
  }

  const upd = (k, v) => setSettings(s => ({ ...s, [k]: v }));

  const save = async () => {
    setSaving(true);
    try {
      if (settings.id) {
        await supabase.from('app_settings').update(settings).eq('id', settings.id);
      } else {
        const { data } = await supabase.from('app_settings').insert(settings).select().single();
        setSettings(data);
      }
      toast.success('✅ تم حفظ بيانات التواصل الاجتماعي');
    } catch (e) {
      toast.error('فشل الحفظ: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  const fields = [
    {
      key: 'social_instagram',
      label: 'إنستغرام',
      icon: Instagram,
      placeholder: 'https://instagram.com/ebra.kh8',
      color: '#E1306C',
      hint: 'رابط حساب الإنستغرام كامل',
    },
    {
      key: 'social_whatsapp',
      label: 'واتساب',
      icon: MessageCircle,
      placeholder: '966549678191',
      color: '#25D366',
      hint: 'رقم الواتساب بدون + (مثال: 966549678191)',
    },
    {
      key: 'social_twitter',
      label: 'تويتر / X',
      icon: Twitter,
      placeholder: 'https://twitter.com/username',
      color: '#1DA1F2',
      hint: 'رابط حساب تويتر / X',
    },
    {
      key: 'social_snapchat',
      label: 'سناب شات',
      icon: Globe,
      placeholder: 'https://snapchat.com/add/username',
      color: '#FFFC00',
      hint: 'رابط حساب سناب شات',
    },
    {
      key: 'social_tiktok',
      label: 'تيك توك',
      icon: Globe,
      placeholder: 'https://tiktok.com/@username',
      color: '#ff0050',
      hint: 'رابط حساب تيك توك',
    },
    {
      key: 'phone',
      label: 'رقم الهاتف الرئيسي',
      icon: Phone,
      placeholder: '0549678191',
      color: '#C9A84C',
      hint: 'يظهر في الموقع وصفحة الحجز',
    },
    {
      key: 'address',
      label: 'العنوان',
      icon: MapPin,
      placeholder: 'الرياض، حي النرجس',
      color: '#C9A84C',
      hint: 'يظهر في الخريطة وصفحة الحجز',
    },
    {
      key: 'google_maps_url',
      label: 'رابط خرائط جوجل',
      icon: MapPin,
      placeholder: 'https://maps.google.com/...',
      color: '#4285F4',
      hint: 'رابط الموقع على خرائط جوجل',
    },
  ];

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto" dir="rtl">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #E1306C22, #1DA1F222)' }}>
          <Instagram className="w-5 h-5" style={{ color: '#E1306C' }} />
        </div>
        <div>
          <h1 className="text-xl font-black">بيانات التواصل الاجتماعي</h1>
          <p className="text-sm text-gray-500">تظهر في الصفحة الرئيسية والـ Footer وصفحة الحجز</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">روابط التواصل الاجتماعي ومعلومات التواصل</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {fields.map(field => (
            <div key={field.key} className="space-y-1.5">
              <Label className="flex items-center gap-2">
                <field.icon className="w-4 h-4" style={{ color: field.color }} />
                {field.label}
              </Label>
              <div className="flex gap-2">
                <Input
                  value={settings[field.key] || ''}
                  onChange={e => upd(field.key, e.target.value)}
                  placeholder={field.placeholder}
                  dir="ltr"
                  className="flex-1"
                />
                {settings[field.key] && (
                  <a href={
                    field.key === 'social_whatsapp'
                      ? `https://wa.me/${settings[field.key]}`
                      : settings[field.key]
                  } target="_blank" rel="noopener noreferrer"
                    className="flex items-center justify-center w-10 h-10 rounded-lg border border-gray-200 hover:bg-gray-50">
                    <ExternalLink className="w-4 h-4 text-gray-400" />
                  </a>
                )}
              </div>
              <p className="text-xs text-gray-400">{field.hint}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Preview */}
      <Card className="border-amber-100 bg-amber-50/30">
        <CardHeader>
          <CardTitle className="text-base text-amber-800">معاينة — كيف تظهر في الموقع</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            {settings.social_instagram && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-sm" style={{ background: 'rgba(225,48,108,0.1)', color: '#E1306C' }}>
                <Instagram className="w-4 h-4" />
                إنستغرام ✅
              </div>
            )}
            {settings.social_whatsapp && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-sm" style={{ background: 'rgba(37,211,102,0.1)', color: '#25D366' }}>
                <MessageCircle className="w-4 h-4" />
                واتساب ✅
              </div>
            )}
            {settings.social_twitter && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-sm" style={{ background: 'rgba(29,161,242,0.1)', color: '#1DA1F2' }}>
                <Twitter className="w-4 h-4" />
                تويتر ✅
              </div>
            )}
            {settings.phone && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-sm" style={{ background: 'rgba(201,168,76,0.1)', color: '#C9A84C' }}>
                <Phone className="w-4 h-4" />
                {settings.phone} ✅
              </div>
            )}
          </div>
          {!settings.social_instagram && !settings.social_whatsapp && !settings.phone && (
            <p className="text-sm text-gray-400">أضف البيانات أعلاه لتظهر في الموقع</p>
          )}
        </CardContent>
      </Card>

      <Button onClick={save} disabled={saving} className="w-full gap-2">
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
        حفظ بيانات التواصل
      </Button>
    </div>
  );
}
