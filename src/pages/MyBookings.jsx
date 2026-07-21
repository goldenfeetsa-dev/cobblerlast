import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { db } from '@/api/supabaseApi';
import { Calendar, Search, Scissors, Store, Truck, CheckCircle, XCircle, AlertCircle, RefreshCw, ArrowRight, ArrowLeft } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { ar, enUS } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Helmet } from 'react-helmet-async';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import LanguageSwitcher from '@/components/LanguageSwitcher';

const STATUS_ICONS = {
  pending: AlertCircle,
  confirmed: CheckCircle,
  in_progress: RefreshCw,
  completed: CheckCircle,
  cancelled: XCircle,
};
const STATUS_COLORS = {
  pending: 'text-yellow-400 border-yellow-500/30 bg-yellow-500/10',
  confirmed: 'text-blue-400 border-blue-500/30 bg-blue-500/10',
  in_progress: 'text-purple-400 border-purple-500/30 bg-purple-500/10',
  completed: 'text-green-400 border-green-500/30 bg-green-500/10',
  cancelled: 'text-red-400 border-red-500/30 bg-red-500/10',
};

export default function MyBookings() {
  const { t, dir, lang } = useLanguage();
  const isAr = lang === 'ar';
  const BackIcon = dir === 'rtl' ? ArrowRight : ArrowLeft;
  const STATUS_LABELS = t('myBookings.status');
  const [phone, setPhone] = useState('');
  const [searched, setSearched] = useState(false);
  const [searchPhone, setSearchPhone] = useState('');

  const { data: bookings = [], isLoading } = useQuery({
    queryKey: ['my-bookings', searchPhone],
    queryFn: () => db.Booking.filter({ customer_phone: searchPhone }),
    enabled: !!searchPhone,
  });

  const handleSearch = () => {
    if (!phone.trim()) return;
    setSearchPhone(phone.trim());
    setSearched(true);
  };

  return (
    <div className="min-h-screen py-8 px-4 font-tajawal" dir={dir}
      style={{ background: 'linear-gradient(135deg, #FBF9F5 0%, #F4F1EA 40%, #EFE9DD 70%, #F4F1EA 100%)' }}>
      <Helmet>
        <title>{isAr ? 'متابعة حجزي | إبرة وخيط الإسكافي' : 'Track My Booking | Ebra & Khait Cobbler'}</title>
        <meta name="description" content={isAr
          ? 'تابع حالة طلب إصلاح حذائك أو حقيبتك الجلدية في إبرة وخيط الإسكافي عبر إدخال رقم جوالك.'
          : 'Track the status of your shoe or leather bag repair order at Ebra & Khait Cobbler by entering your phone number.'} />
        <link rel="canonical" href="https://needlecobbler.com/my-bookings" />
        <meta name="robots" content="noindex, follow" />
      </Helmet>
      {/* Subtle texture */}
      <div className="fixed inset-0 opacity-[0.03] pointer-events-none"
        style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, #A67C68 1px, transparent 0)', backgroundSize: '40px 40px' }} />

      <div className="max-w-lg mx-auto relative z-10">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-between mb-6">
            <Link to="/booking" className="inline-flex items-center gap-2 text-sm transition-colors"
              style={{ color: 'rgba(166,124,104,0.6)' }}
              onMouseEnter={e => e.currentTarget.style.color = '#A67C68'}
              onMouseLeave={e => e.currentTarget.style.color = 'rgba(166,124,104,0.6)'}>
              <BackIcon className="w-4 h-4" />
              {t('myBookings.backHome')}
            </Link>
            <LanguageSwitcher />
          </div>
          <div className="inline-flex items-center gap-2 mb-4 px-4 py-1.5 rounded-full text-xs font-bold"
            style={{ background: 'rgba(166,124,104,0.1)', border: '1px solid rgba(166,124,104,0.3)', color: '#A67C68' }}>
            <Scissors className="w-3 h-3" />
            {t('myBookings.trackBadge')}
          </div>
          <h1 className="text-3xl font-black" style={{ color: '#3E322D' }}>{t('myBookings.title')}</h1>
          <p className="text-sm mt-2" style={{ color: 'rgba(62,50,45,0.4)' }}>{t('myBookings.subtitle')}</p>
        </div>

        {/* Search */}
        <div className="rounded-2xl p-5 mb-6 flex gap-3"
          style={{ background: 'rgba(62,50,45,0.045)', border: '1px solid rgba(166,124,104,0.15)' }}>
          <Input
            value={phone}
            onChange={e => setPhone(e.target.value)}
            placeholder="05XXXXXXXX"
            className="text-right border-0 bg-transparent text-base"
            style={{ color: '#3E322D', caretColor: '#A67C68' }}
            dir="ltr"
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
          />
          <button onClick={handleSearch}
            className="px-6 py-2 rounded-xl font-bold text-black transition-all hover:scale-105 flex items-center gap-2 shrink-0"
            style={{ background: 'linear-gradient(135deg, #A67C68, #C9A08D)' }}>
            <Search className="w-4 h-4" />
            {t('myBookings.searchBtn')}
          </button>
        </div>

        {isLoading && (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-4 border-t-[#A67C68] rounded-full animate-spin" style={{ borderColor: 'rgba(166,124,104,0.2)', borderTopColor: '#A67C68' }} />
          </div>
        )}

        {searched && !isLoading && bookings.length === 0 && (
          <div className="text-center py-14 rounded-2xl" style={{ background: 'rgba(62,50,45,0.035)', border: '1px solid rgba(166,124,104,0.1)' }}>
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
              style={{ background: 'rgba(166,124,104,0.08)', border: '1px solid rgba(166,124,104,0.15)' }}>
              <Scissors className="w-8 h-8" style={{ color: 'rgba(166,124,104,0.4)' }} />
            </div>
            <p style={{ color: 'rgba(62,50,45,0.4)' }}>{t('myBookings.noBookings')}</p>
            <Link to="/book">
              <button className="mt-5 px-7 py-3 rounded-full font-bold text-black transition-all hover:scale-105"
                style={{ background: 'linear-gradient(135deg, #A67C68, #C9A08D)' }}>{t('myBookings.bookNow')}</button>
            </Link>
          </div>
        )}

        <div className="space-y-4">
          {bookings.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).map(booking => {
            const StatusIcon = STATUS_ICONS[booking.status] || STATUS_ICONS.pending;
            const statusColor = STATUS_COLORS[booking.status] || STATUS_COLORS.pending;
            const statusLabel = STATUS_LABELS[booking.status] || booking.status;
            return (
              <div key={booking.id} className="rounded-2xl p-5 transition-all"
                style={{ background: 'rgba(62,50,45,0.035)', border: '1px solid rgba(166,124,104,0.1)' }}>
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <p className="font-black text-base" style={{ color: '#3E322D' }}>{booking.service_name}</p>
                    <p className="text-xs mt-0.5 font-mono" style={{ color: 'rgba(166,124,104,0.5)' }}>#{booking.booking_number}</p>
                  </div>
                  <span className={cn("text-xs font-bold px-3 py-1.5 rounded-full border flex items-center gap-1.5", statusColor)}>
                    <StatusIcon className="w-3 h-3" />
                    {statusLabel}
                  </span>
                </div>
                <div className="space-y-2 text-sm" style={{ color: 'rgba(62,50,45,0.5)' }}>
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 shrink-0" style={{ color: '#A67C68' }} />
                    <span>
                      {booking.booking_date && format(new Date(booking.booking_date), 'EEEE d MMMM yyyy', { locale: isAr ? ar : enUS })} — {booking.booking_time}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {booking.booking_type === 'home_visit'
                      ? <Truck className="w-4 h-4 shrink-0" style={{ color: '#A67C68' }} />
                      : <Store className="w-4 h-4 shrink-0" style={{ color: '#A67C68' }} />}
                    <span>{booking.booking_type === 'home_visit' ? t('myBookings.homeVisit') : t('myBookings.inStore')}</span>
                  </div>
                </div>
                <div className="mt-4 pt-4 flex items-center justify-between" style={{ borderTop: '1px solid rgba(166,124,104,0.1)' }}>
                  <span className="text-xs" style={{ color: 'rgba(62,50,45,0.3)' }}>{t('myBookings.total')}</span>
                  <span className="font-black text-lg" style={{ color: '#A67C68' }}>{booking.total_price} SAR</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
