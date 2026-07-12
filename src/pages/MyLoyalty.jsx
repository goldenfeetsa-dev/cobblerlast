import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Search, Award, ArrowRight, Bell, History, Loader2, User, Phone as PhoneIcon } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useLoyaltyMembers } from '@/lib/loyalty/useLoyaltyMembers';

const LEVEL_LABELS_AR = { Bronze: 'برونزي', Silver: 'فضي', Gold: 'ذهبي', Platinum: 'بلاتيني' };

// ── شارات المحفظة الرسمية (Apple Wallet / Google Wallet) ──────────────
function AppleWalletBadge({ href }) {
  return (
    <a href={href}
      className="flex items-center justify-center gap-2 h-12 rounded-xl transition-transform hover:scale-[1.03] active:scale-[0.98]"
      style={{ background: '#000' }}>
      <svg width="20" height="24" viewBox="0 0 24 29" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M19.665 15.407c-.033-3.302 2.7-4.887 2.822-4.963-1.538-2.25-3.934-2.558-4.79-2.593-2.04-.207-3.982 1.2-5.017 1.2-1.036 0-2.64-1.17-4.335-1.137-2.232.033-4.29 1.298-5.44 3.298-2.32 4.02-.592 9.983 1.668 13.25 1.104 1.598 2.42 3.395 4.15 3.33 1.665-.067 2.293-1.077 4.307-1.077 2.013 0 2.58 1.077 4.343 1.043 1.79-.033 2.928-1.63 4.023-3.238 1.27-1.86 1.793-3.663 1.822-3.755-.04-.018-3.497-1.342-3.53-5.323l-.023.965z" fill="#fff"/>
        <path d="M16.508 5.782c.914-1.11 1.532-2.65 1.363-4.182-1.318.053-2.913.878-3.86 1.988-.847.982-1.588 2.552-1.39 4.05 1.464.114 2.965-.744 3.887-1.856z" fill="#fff"/>
      </svg>
      <div className="text-white leading-tight text-right">
        <div className="text-[9px] opacity-80 -mb-0.5">أضفها إلى</div>
        <div className="text-sm font-bold -mt-0.5">Apple Wallet</div>
      </div>
    </a>
  );
}

function GoogleWalletBadge({ onClick, loading }) {
  return (
    <button onClick={onClick} disabled={loading}
      className="flex items-center justify-center gap-2 h-12 rounded-xl transition-transform hover:scale-[1.03] active:scale-[0.98] disabled:opacity-60"
      style={{ background: '#000' }}>
      {loading ? (
        <Loader2 className="w-5 h-5 animate-spin text-white" />
      ) : (
        <svg width="22" height="22" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
          <path fill="#4285F4" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
          <path fill="#34A853" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.9-2.26 5.36-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
          <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24s.92 7.54 2.56 10.78l7.97-6.19z"/>
          <path fill="#EA4335" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
        </svg>
      )}
      <div className="text-white leading-tight text-right">
        <div className="text-[9px] opacity-80 -mb-0.5">أضفها إلى</div>
        <div className="text-sm font-bold -mt-0.5">Google Wallet</div>
      </div>
    </button>
  );
}

function MemberCard({ result, getAppleWalletUrl, getGoogleWalletSaveUrl, getQrImageUrl, markNotificationRead, setResult }) {
  const [googleLoading, setGoogleLoading] = useState(false);
  const member = result.member;

  const handleGoogleWallet = async () => {
    setGoogleLoading(true);
    try {
      const url = await getGoogleWalletSaveUrl(member.member_number);
      window.open(url, '_blank');
    } catch (err) {
      alert(err.message);
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleDismissNotification = async (id) => {
    await markNotificationRead(member.member_number, id);
    setResult((prev) => ({
      ...prev,
      notifications: prev.notifications?.map((n) => (n.id === id ? { ...n, is_read: true } : n)),
    }));
  };

  return (
    <div className="space-y-5">
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

        <img src={getQrImageUrl(member.member_number)} alt="QR Code"
          className="w-40 h-40 mx-auto rounded-xl bg-white p-2" />
      </div>

      <div>
        <p className="text-xs text-center mb-2" style={{ color: 'rgba(245,237,216,0.35)' }}>اختر نوع محفظتك</p>
        <div className="grid grid-cols-2 gap-3">
          <AppleWalletBadge href={getAppleWalletUrl(member.member_number)} />
          <GoogleWalletBadge onClick={handleGoogleWallet} loading={googleLoading} />
        </div>
      </div>

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
  );
}

export default function MyLoyalty() {
  const { loading, lookupMember, createMember, getAppleWalletUrl, getGoogleWalletSaveUrl, getQrImageUrl, markNotificationRead } = useLoyaltyMembers();

  const [tab, setTab] = useState('join'); // 'join' | 'lookup'

  // lookup state
  const [query, setQuery] = useState('');
  const [result, setResult] = useState(null);
  const [searched, setSearched] = useState(false);

  // join state
  const [joinName, setJoinName] = useState('');
  const [joinPhone, setJoinPhone] = useState('');

  const handleSearch = async () => {
    const value = query.trim();
    if (!value) return;
    setSearched(true);
    const isPhone = /^\d{8,}$/.test(value.replace(/\D/g, '')) && !value.toUpperCase().startsWith('NT-');
    const data = await lookupMember(isPhone ? { phone: value } : { member_number: value });
    setResult(data);
  };

  const handleJoin = async () => {
    if (!joinName.trim() || !joinPhone.trim()) return;
    try {
      const data = await createMember({ full_name: joinName.trim(), phone: joinPhone.trim() });
      setResult(data);
      setSearched(true);
    } catch {
      // toast already shown by the hook
    }
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
            {member ? 'بطاقتك جاهزة — أضفها لمحفظة جوالك' : 'أنشئ عضويتك بثوانٍ، أو ابحث عن بطاقة موجودة'}
          </p>
        </div>

        {!member && (
          <div className="flex gap-2 mb-6 p-1 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)' }}>
            <button onClick={() => setTab('join')}
              className="flex-1 py-2.5 rounded-lg text-sm font-bold transition-all"
              style={tab === 'join'
                ? { background: 'linear-gradient(135deg, #C9A84C, #e8c96a)', color: '#000' }
                : { color: 'rgba(245,237,216,0.5)' }}>
              عضوية جديدة
            </button>
            <button onClick={() => setTab('lookup')}
              className="flex-1 py-2.5 rounded-lg text-sm font-bold transition-all"
              style={tab === 'lookup'
                ? { background: 'linear-gradient(135deg, #C9A84C, #e8c96a)', color: '#000' }
                : { color: 'rgba(245,237,216,0.5)' }}>
              لدي عضوية بالفعل
            </button>
          </div>
        )}

        {!member && tab === 'join' && (
          <div className="rounded-2xl p-5 mb-6 space-y-3"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(201,168,76,0.15)' }}>
            <div className="relative">
              <User className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2" style={{ color: 'rgba(201,168,76,0.5)' }} />
              <Input value={joinName} onChange={(e) => setJoinName(e.target.value)} placeholder="اسمك الكامل"
                className="text-right border-0 bg-transparent text-base pr-9"
                style={{ color: '#F5EDD8', caretColor: '#C9A84C' }} />
            </div>
            <div className="relative">
              <PhoneIcon className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2" style={{ color: 'rgba(201,168,76,0.5)' }} />
              <Input value={joinPhone} onChange={(e) => setJoinPhone(e.target.value)} placeholder="رقم جوالك (05xxxxxxxx)"
                dir="ltr" className="text-right border-0 bg-transparent text-base pr-9"
                style={{ color: '#F5EDD8', caretColor: '#C9A84C' }}
                onKeyDown={(e) => e.key === 'Enter' && handleJoin()} />
            </div>
            <button onClick={handleJoin} disabled={loading || !joinName.trim() || !joinPhone.trim()}
              className="w-full py-3 rounded-xl font-bold text-black transition-all hover:scale-[1.01] disabled:opacity-50 flex items-center justify-center gap-2"
              style={{ background: 'linear-gradient(135deg, #C9A84C, #e8c96a)' }}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Award className="w-4 h-4" />}
              إنشاء بطاقتي
            </button>
          </div>
        )}

        {!member && tab === 'lookup' && (
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
        )}

        {searched && !loading && !member && tab === 'lookup' && (
          <div className="text-center py-14 rounded-2xl" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(201,168,76,0.1)' }}>
            <p style={{ color: 'rgba(245,237,216,0.4)' }}>لم يتم العثور على بطاقة ولاء بهذه البيانات.</p>
          </div>
        )}

        {member && (
          <MemberCard result={result} setResult={setResult}
            getAppleWalletUrl={getAppleWalletUrl} getGoogleWalletSaveUrl={getGoogleWalletSaveUrl}
            getQrImageUrl={getQrImageUrl} markNotificationRead={markNotificationRead} />
        )}
      </div>
    </div>
  );
}
