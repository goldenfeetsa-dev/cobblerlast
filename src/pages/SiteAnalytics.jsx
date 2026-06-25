import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { getSession } from '@/lib/sessionStore';
import { Navigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Globe, Smartphone, Monitor, MapPin, TrendingUp, Users, Eye } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell } from 'recharts';
import { format, subDays } from 'date-fns';

const COLORS = ['#C9A84C', '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];

export default function SiteAnalytics() {
  const session = getSession();

  const { data: visits = [], isLoading } = useQuery({
    queryKey: ['site-visits'],
    queryFn: () => base44.entities.SiteVisit.list('-created_date', 2000),
  });

  if (session?.role !== 'admin') return <Navigate to="/" replace />;

  // Last 14 days chart
  const last14 = [];
  for (let i = 13; i >= 0; i--) {
    const d = subDays(new Date(), i);
    const dateStr = format(d, 'yyyy-MM-dd');
    const dayVisits = visits.filter(v => v.created_date && format(new Date(v.created_date), 'yyyy-MM-dd') === dateStr);
    last14.push({ day: format(d, 'MM/dd'), count: dayVisits.length });
  }

  // By country
  const byCountry = {};
  visits.forEach(v => {
    const key = v.country || 'غير معروف';
    byCountry[key] = (byCountry[key] || 0) + 1;
  });
  const countryData = Object.entries(byCountry).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([name, value]) => ({ name, value }));

  // By city
  const byCity = {};
  visits.forEach(v => {
    const key = v.city || 'غير معروف';
    byCity[key] = (byCity[key] || 0) + 1;
  });
  const cityData = Object.entries(byCity).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([name, value]) => ({ name, value }));

  // Mobile vs Desktop
  const mobileCount = visits.filter(v => v.is_mobile).length;
  const desktopCount = visits.length - mobileCount;

  // Today
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const todayVisits = visits.filter(v => v.created_date && format(new Date(v.created_date), 'yyyy-MM-dd') === todayStr).length;

  // Unique IPs (approx unique visitors)
  const uniqueIPs = new Set(visits.map(v => v.ip).filter(Boolean)).size;

  return (
    <div dir="rtl">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <Globe className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">إحصائيات الموقع</h1>
          <p className="text-sm text-muted-foreground">زوار موقع الحجز الإلكتروني</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Card>
          <CardContent className="p-4 text-center">
            <Eye className="w-5 h-5 text-primary mx-auto mb-1" />
            <p className="text-2xl font-black text-primary">{visits.length}</p>
            <p className="text-xs text-muted-foreground mt-1">إجمالي الزيارات</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Users className="w-5 h-5 text-blue-500 mx-auto mb-1" />
            <p className="text-2xl font-black text-blue-600">{uniqueIPs}</p>
            <p className="text-xs text-muted-foreground mt-1">زوار فريدون (تقريبي)</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <TrendingUp className="w-5 h-5 text-green-500 mx-auto mb-1" />
            <p className="text-2xl font-black text-green-600">{todayVisits}</p>
            <p className="text-xs text-muted-foreground mt-1">زيارات اليوم</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Smartphone className="w-5 h-5 text-amber-500 mx-auto mb-1" />
            <p className="text-2xl font-black text-amber-600">{visits.length ? Math.round(mobileCount / visits.length * 100) : 0}%</p>
            <p className="text-xs text-muted-foreground mt-1">من الجوال</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-5">
        {/* Daily visits chart */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">الزيارات - آخر 14 يوم</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={last14}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-20" />
                  <XAxis dataKey="day" fontSize={10} />
                  <YAxis fontSize={10} />
                  <Tooltip />
                  <Bar dataKey="count" fill="hsl(38,80%,50%)" radius={[4, 4, 0, 0]} name="زيارات" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Mobile vs Desktop Pie */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">الجهاز</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-40">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={[{ name: 'جوال', value: mobileCount }, { name: 'كمبيوتر', value: desktopCount }]}
                    cx="50%" cy="50%" outerRadius={60} dataKey="value" label={({ name, percent }) => `${name} ${Math.round(percent * 100)}%`} labelLine={false}>
                    <Cell fill="#C9A84C" />
                    <Cell fill="#3B82F6" />
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex justify-center gap-4 mt-1">
              <span className="flex items-center gap-1 text-xs"><span className="w-3 h-3 rounded-full bg-primary inline-block" /> جوال: {mobileCount}</span>
              <span className="flex items-center gap-1 text-xs"><span className="w-3 h-3 rounded-full bg-blue-500 inline-block" /> كمبيوتر: {desktopCount}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Countries & Cities */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><MapPin className="w-4 h-4 text-primary" /> حسب الدولة</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-8"><div className="w-6 h-6 border-4 border-primary/20 border-t-primary rounded-full animate-spin" /></div>
            ) : countryData.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-8">لا توجد بيانات بعد</p>
            ) : (
              <div className="space-y-2">
                {countryData.map((c, i) => (
                  <div key={c.name} className="flex items-center gap-2">
                    <span className="text-xs w-4 text-muted-foreground">{i + 1}</span>
                    <div className="flex-1 flex items-center gap-2">
                      <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${(c.value / countryData[0].value) * 100}%`, backgroundColor: COLORS[i % COLORS.length] }} />
                      </div>
                      <span className="text-xs font-medium w-20 truncate">{c.name}</span>
                      <span className="text-xs font-bold text-primary">{c.value}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><MapPin className="w-4 h-4 text-blue-500" /> حسب المدينة</CardTitle>
          </CardHeader>
          <CardContent>
            {cityData.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-8">لا توجد بيانات بعد</p>
            ) : (
              <div className="space-y-2">
                {cityData.map((c, i) => (
                  <div key={c.name} className="flex items-center gap-2">
                    <span className="text-xs w-4 text-muted-foreground">{i + 1}</span>
                    <div className="flex-1 flex items-center gap-2">
                      <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
                        <div className="h-full rounded-full bg-blue-400" style={{ width: `${(c.value / cityData[0].value) * 100}%` }} />
                      </div>
                      <span className="text-xs font-medium w-20 truncate">{c.name}</span>
                      <span className="text-xs font-bold text-blue-600">{c.value}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Visits */}
      <Card className="mt-5">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">آخر الزيارات</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="text-right py-2 px-3">الوقت</th>
                  <th className="text-right py-2 px-3">الدولة</th>
                  <th className="text-right py-2 px-3">المدينة</th>
                  <th className="text-right py-2 px-3">الجهاز</th>
                  <th className="text-right py-2 px-3">الصفحة</th>
                </tr>
              </thead>
              <tbody>
                {visits.slice(0, 20).map(v => (
                  <tr key={v.id} className="border-b hover:bg-muted/30 transition-colors">
                    <td className="py-2 px-3 text-muted-foreground">{v.created_date ? format(new Date(v.created_date), 'MM/dd HH:mm') : '—'}</td>
                    <td className="py-2 px-3">{v.country || '—'}</td>
                    <td className="py-2 px-3">{v.city || '—'}</td>
                    <td className="py-2 px-3">
                      {v.is_mobile
                        ? <span className="flex items-center gap-1"><Smartphone className="w-3 h-3 text-amber-500" /> جوال</span>
                        : <span className="flex items-center gap-1"><Monitor className="w-3 h-3 text-blue-500" /> كمبيوتر</span>}
                    </td>
                    <td className="py-2 px-3 text-muted-foreground truncate max-w-[120px]">{v.page || '/'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}