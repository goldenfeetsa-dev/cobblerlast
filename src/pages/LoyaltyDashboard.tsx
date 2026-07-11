import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabaseClient';
import LoyaltyCardWidget from '@/components/loyalty/LoyaltyCardWidget';
import ImageUploader from '@/components/common/ImageUploader';
import {
  Star, Users, Gift, Settings, Bell, Search,
  TrendingUp, Phone, RefreshCw, Loader2
} from 'lucide-react';
import { getSession } from '@/lib/sessionStore';

export default function LoyaltyDashboard() {
  const session  = getSession();
  const isAdmin  = ['admin','owner','manager'].includes(session?.role);

  const [cards, setCards]       = useState<any[]>([]);
  const [settings, setSettings] = useState<any>({});
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState('');
  const [saving, setSaving]     = useState(false);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [cardsRes, settingsRes] = await Promise.all([
        supabase.from('loyalty_cards').select('*').order('updated_at', { ascending: false }),
        supabase.from('loyalty_settings').select('*').limit(1),
      ]);
      setCards(cardsRes.data || []);
      setSettings(settingsRes.data?.[0] || {});
    } catch (err: any) {
      toast.error('فشل تحميل البيانات: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      if (settings.id) {
        await supabase.from('loyalty_settings').update(settings).eq('id', settings.id);
      } else {
        const { data } = await supabase.from('loyalty_settings').insert(settings).select().single();
        setSettings(data);
      }
      toast.success('✅ تم حفظ الإعدادات');
    } catch (err: any) {
      toast.error('فشل الحفظ: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const sendPendingNotifs = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('loyalty-notify', {
        body: { mode: 'pending' },
      });
      if (error) throw error;
      toast.success(`✅ تم إرسال ${data.sent} إشعار`);
    } catch (err: any) {
      toast.error('فشل الإرسال: ' + err.message);
    }
  };

  const filtered = cards.filter(c =>
    !search ||
    c.customer_name?.includes(search) ||
    c.customer_phone?.includes(search)
  );

  // Stats
  const totalStamps   = cards.reduce((a, c) => a + (c.stamps || 0), 0);
  const totalRedeemed = cards.reduce((a, c) => a + (c.total_orders || 0), 0);
  const withFree      = cards.filter(c => c.stamps > 0 && c.stamps % (c.free_after || 3) === 0).length;

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
          <Star className="w-5 h-5 text-amber-700" />
        </div>
        <div>
          <h1 className="text-xl font-black">نظام الولاء</h1>
          <p className="text-sm text-gray-500">بطاقات العملاء وGoogle Wallet</p>
        </div>
        <Button onClick={fetchData} variant="outline" size="sm" className="mr-auto gap-1">
          <RefreshCw className="w-3.5 h-3.5" />تحديث
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'إجمالي العملاء', value: cards.length, icon: Users, color: 'text-blue-600' },
          { label: 'إجمالي الختمات', value: totalStamps, icon: Star, color: 'text-amber-600' },
          { label: 'خدمات مكتملة', value: totalRedeemed, icon: TrendingUp, color: 'text-green-600' },
          { label: 'خدمة مجانية جاهزة', value: withFree, icon: Gift, color: 'text-purple-600' },
        ].map(stat => (
          <Card key={stat.label}>
            <CardContent className="p-4 flex items-center gap-3">
              <stat.icon className={`w-8 h-8 ${stat.color} shrink-0`} />
              <div>
                <div className="text-2xl font-black">{stat.value}</div>
                <div className="text-xs text-gray-500">{stat.label}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="cards">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="cards">العملاء</TabsTrigger>
          <TabsTrigger value="issue">إصدار بطاقة</TabsTrigger>
          {isAdmin && <TabsTrigger value="settings">الإعدادات</TabsTrigger>}
        </TabsList>

        {/* ── العملاء ─────────────────────────────────── */}
        <TabsContent value="cards" className="mt-4 space-y-4">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="ابحث بالاسم أو الجوال..."
                className="pr-9"
              />
            </div>
            <Button onClick={sendPendingNotifs} variant="outline" size="sm" className="gap-1 shrink-0">
              <Bell className="w-3.5 h-3.5" />إرسال الإشعارات
            </Button>
          </div>

          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center text-gray-400 py-12 text-sm">
              {search ? 'لا نتائج' : 'لا يوجد عملاء مسجّلين بعد'}
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map(c => {
                const freeAfter = c.free_after || 3;
                const hasFree   = c.stamps > 0 && c.stamps % freeAfter === 0;
                return (
                  <Card key={c.id} className={hasFree ? 'border-yellow-300 bg-yellow-50/30' : ''}>
                    <CardContent className="p-4 flex items-center gap-4">
                      {/* Avatar */}
                      <div className="w-10 h-10 rounded-full flex items-center justify-center font-black text-white shrink-0"
                        style={{ background: '#1A0F00' }}>
                        {c.customer_name?.[0] || '؟'}
                      </div>
                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-sm">{c.customer_name}</div>
                        <div className="text-xs text-gray-500 flex items-center gap-1">
                          <Phone className="w-3 h-3" />{c.customer_phone}
                        </div>
                      </div>
                      {/* Stamps */}
                      <div className="text-center shrink-0">
                        <div className="font-black text-lg text-amber-700">{c.stamps}/{freeAfter}</div>
                        <div className="text-[10px] text-gray-400">ختمات</div>
                      </div>
                      {/* Status */}
                      <div className="shrink-0">
                        {hasFree
                          ? <Badge className="bg-yellow-100 text-yellow-700 border-yellow-300">🎁 خدمة مجانية</Badge>
                          : <Badge variant="outline" className="text-[10px]">{c.total_orders} خدمة</Badge>}
                      </div>
                      {/* Wallet link */}
                      {c.google_pass_url && (
                        <a href={c.google_pass_url} target="_blank" rel="noopener noreferrer"
                          className="text-blue-500 hover:text-blue-700 shrink-0 text-xs underline">
                          Wallet
                        </a>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* ── إصدار بطاقة ─────────────────────────────── */}
        <TabsContent value="issue" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">إصدار بطاقة ولاء جديدة</CardTitle>
            </CardHeader>
            <CardContent>
              <LoyaltyCardWidget mode="lookup" />
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── الإعدادات ────────────────────────────────── */}
        {isAdmin && (
          <TabsContent value="settings" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Settings className="w-4 h-4" />إعدادات نظام الولاء
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>اسم البرنامج</Label>
                    <Input
                      value={settings.program_name || ''}
                      onChange={e => setSettings((s: any) => ({ ...s, program_name: e.target.value }))}
                      placeholder="بطاقة ولاء إبرة وخيط"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>عدد الختمات للحصول على خدمة مجانية</Label>
                    <Input
                      type="number"
                      min={1} max={20}
                      value={settings.free_after || 3}
                      onChange={e => setSettings((s: any) => ({ ...s, free_after: Number(e.target.value) }))}
                      dir="ltr"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>لون البراند</Label>
                    <div className="flex gap-2">
                      <Input
                        value={settings.brand_color || '#1A0F00'}
                        onChange={e => setSettings((s: any) => ({ ...s, brand_color: e.target.value }))}
                        placeholder="#1A0F00"
                        dir="ltr"
                      />
                      <input type="color" value={settings.brand_color || '#1A0F00'}
                        onChange={e => setSettings((s: any) => ({ ...s, brand_color: e.target.value }))}
                        className="w-10 h-10 rounded border cursor-pointer" />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>شعار برنامج الولاء</Label>
                    <ImageUploader
                      value={settings.brand_logo_url || ''}
                      onChange={(url: string) => setSettings((s: any) => ({ ...s, brand_logo_url: url }))}
                      bucket="branding"
                      label=""
                    />
                  </div>
                </div>

                <div className="pt-3 border-t space-y-3">
                  <p className="text-sm font-semibold text-gray-700">Google Wallet API</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label>Issuer ID</Label>
                      <Input
                        value={settings.google_issuer_id || ''}
                        onChange={e => setSettings((s: any) => ({ ...s, google_issuer_id: e.target.value }))}
                        placeholder="3388000000XXXXXXXX"
                        dir="ltr"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Class Suffix</Label>
                      <Input
                        value={settings.google_class_id || 'cobblerlast_loyalty'}
                        onChange={e => setSettings((s: any) => ({ ...s, google_class_id: e.target.value }))}
                        dir="ltr"
                      />
                    </div>
                  </div>
                  <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg text-xs text-blue-800 space-y-1">
                    <p className="font-bold">خطوات Google Wallet Console:</p>
                    <ol className="list-decimal list-inside space-y-0.5">
                      <li>افتح <span className="font-mono">pay.google.com/business/console</span></li>
                      <li>أنشئ Issuer account ← احفظ الـ Issuer ID هنا</li>
                      <li>أنشئ Service Account في Google Cloud ← حمّل الـ JSON</li>
                      <li>أضف بيانات الـ Service Account في Supabase Secrets</li>
                    </ol>
                  </div>
                </div>

                <Button onClick={saveSettings} disabled={saving} className="w-full gap-2">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  حفظ الإعدادات
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
