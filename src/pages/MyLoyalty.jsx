import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Search, Award, ArrowRight, Wallet, Smartphone, Bell, History, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useLoyaltyMembers } from '@/lib/loyalty/useLoyaltyMembers';

const LEVEL_LABELS_AR = { Bronze: 'برونزي', Silver: 'فضي', Gold: 'ذهبي', Platinum: 'بلاتيني' };

export default function MyLoyalty() {
  const { loading, lookupMember, getAppleWalletUrl, getGoogleWalletSaveUrl, getQrImageUrl, markNotificationRead } = useLoyaltyMembers();

  const [query, setQuery] = useState('');
  const [result, setResult] = useState(null);
  const [searched, setSearched] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const handleSearch = async () => {
    const value = query.trim();
    if (!value) return;
    setSearched(true);
    // نقبل رقم العضوية أو رقم الجوال في نفس الحقل
    const isPhone = /^\d{8,}$/.test(value.replace(/\D/g, '')) && !value.toUpperCase().startsWith('NT-');
    const data = await lookupMember(isPhone ? { phone: value } : { member_number: value });
    setResult(data);
  };

  const handleGoogleWallet = async () => {
    if (!result?.member) return;
    setGoogleLoading(true);
    try {
      const url = await getGoogleWalletSaveUrl(result.member.member_number);
      window.open(url, '_blank');
    } catch (err) {
      alert(err.message);
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleDismissNotification = async (id) => {
    await markNotificationRead(result.member.member_number, id);
    setResult((prev) => ({
      ...prev,
      notifications: prev.notifications.map((n) => (n.id === id ? { ...n, is_read: true } : n)),
    }));
  };

  const member = result?.member;

  return (
    <div className="min-h-screen py-8 px-4 font-tajawal" dir="rtl"
      style={{ background: 'linear-gradient(135deg, #120800 0%, #1E1000 40%, #2A1500 70%, #1A0C00 100%)' }}>
      <Helmet>
        <title>بطاقة الولاء | إبرة وخيط الإسكافي</title>
        <meta name="robots" content="noindex, follow" />
      </Helmet>

      <div className="max-w-lg mx-auto relative z-10">
        <div className="text-center mb-8">
          <div className="flex items-center justify-between mb-6">
            <Link to="/" className="inline-flex items-center gap-2 text-sm transition-colors"
              style={{ color: 'rgba(201,168,76,0.6)' }}>
              <ArrowRight className="w-4 h-4" /> الرئيسية
            </Link>
          </div>
          <div className="inline-flex items-center gap-2 mb-4 px-4 py-1.5 rounded-full text-xs font-bold"
            style={{ background: 'rgba(201,168,76,0.1)', border: '1px solid rgba(201,168,76,0.3)', color: '#C9A84C' }}>
            <Award className="w-3 h-3" /> برنامج الولاء
          </div>
          <h1 className="text-3xl font-black" style={{ color: '#F5EDD8' }}>بطاقة الولاء الخاصة بك</h1>
          <p className="text-sm mt-2" style={{ color: 'rgba(245,237,216,0.4)' }}>
            ابحث برقم عضويتك أو رقم جوالك لعرض نقاطك وبطاقتك
          </p>
        </div>

        {/* Search */}
        <div className="rounded-2xl p-5 mb-6 flex gap-3"
          style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(201,168,76,0.15)' }}>
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="رقم العضوية NT-XXXX أو رقم الجوال"
            className="text-right border-0 bg-transparent text-base"
            style={{ color: '#F5EDD8', caretColor: '#C9A84C' }}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          />
          <button onClick={handleSearch}
            className="px-6 py-2 rounded-xl font-bold text-black transition-all hover:scale-105 flex items-center gap-2 shrink-0"
            style={{ background: 'linear-gradient(135deg, #C9A84C, #e8c96a)' }}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            بحث
          </button>
        </div>

        {searched && !loading && !member && (
          <div className="text-center py-14 rounded-2xl" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(201,168,76,0.1)' }}>
            <p style={{ color: 'rgba(245,237,216,0.4)' }}>لم يتم العثور على بطاقة ولاء بهذه البيانات.</p>
          </div>
        )}

        {member && (
          <div className="space-y-5">
            {/* Notifications */}
            {result.notifications?.filter((n) => !n.is_read).length > 0 && (
              <div className="space-y-2">
                {result.notifications.filter((n) => !n.is_read).map((n) => (
                  <div key={n.id} className="rounded-xl p-3 flex items-start gap-2 text-sm"
                    style={{ background: 'rgba(201,168,76,0.08)', border: '1px solid rgba(201,168,76,0.2)', color: '#F5EDD8' }}>
                    <Bell className="w-4 h-4 shrink-0 mt-0.5" style={{ color: '#C9A84C' }} />
                    <span className="flex-1">{n.message}</span>
                    <button onClick={() => handleDismissNotification(n.id)} className="text-xs opacity-60 hover:opacity-100">✕</button>
                  </div>
                ))}
              </div>
            )}

            {/* Card */}
            <div className="rounded-2xl p-6 text-center"
              style={{ background: 'linear-gradient(135deg, rgba(201,168,76,0.12), rgba(201,168,76,0.03))', border: '1px solid rgba(201,168,76,0.25)' }}>
              <p className="text-xs font-mono mb-1" style={{ color: 'rgba(201,168,76,0.6)' }}>{member.member_number}</p>
              <h2 className="text-2xl font-black mb-1" style={{ color: '#F5EDD8' }}>{member.full_name}</h2>
              <span className="inline-block px-3 py-1 rounded-full text-xs font-bold mb-4"
                style={{ background: 'rgba(201,168,76,0.15)', color: '#C9A84C' }}>
                {LEVEL_LABELS_AR[member.membership_level] || member.membership_level}
              </span>
              <div className="text-5xl font-black mb-1" style={{ color: '#C9A84C' }}>{member.points}</div>
              <p className="text-xs mb-5" style={{ color: 'rgba(245,237,216,0.4)' }}>نقطة</p>

              <img
                src={getQrImageUrl(member.member_number)}
                alt="QR Code"
                className="w-40 h-40 mx-auto rounded-xl bg-white p-2"
              />
            </div>

            {/* Wallet buttons */}
            <div className="grid grid-cols-2 gap-3">
              <a href={getAppleWalletUrl(member.member_number)}
                className="flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm transition-all hover:scale-[1.02]"
                style={{ background: '#000', color: '#fff', border: '1px solid rgba(255,255,255,0.15)' }}>
                <Wallet className="w-4 h-4" /> Apple Wallet
              </a>
              <button onClick={handleGoogleWallet} disabled={googleLoading}
                className="flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm transition-all hover:scale-[1.02]"
                style={{ background: '#fff', color: '#1a1a1a' }}>
                {googleLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Smartphone className="w-4 h-4" />}
                Google Wallet
              </button>
            </div>

            {/* History */}
            <div className="rounded-2xl p-5" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(201,168,76,0.1)' }}>
              <h3 className="flex items-center gap-2 text-sm font-bold mb-3" style={{ color: '#F5EDD8' }}>
                <History className="w-4 h-4" style={{ color: '#C9A84C' }} /> آخر العمليات
              </h3>
              {(!result.history || result.history.length === 0) ? (
                <p className="text-xs" style={{ color: 'rgba(245,237,216,0.4)' }}>لا توجد عمليات بعد.</p>
              ) : (
                <div className="space-y-2">
                  {result.history.slice(0, 10).map((tx) => (
                    <div key={tx.id} className="flex items-center justify-between text-xs py-2"
                      style={{ borderTop: '1px solid rgba(201,168,76,0.08)' }}>
                      <span style={{ color: 'rgba(245,237,216,0.6)' }}>{tx.reason || 'بدون سبب'}</span>
                      <span className="font-bold" style={{ color: tx.change_amount > 0 ? '#4ADE80' : '#F87171' }}>
                        {tx.change_amount > 0 ? `+${tx.change_amount}` : tx.change_amount}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
