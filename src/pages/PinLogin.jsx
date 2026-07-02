import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';
import PinPad from '@/components/pos/PinPad';
import { setSession, getSession } from '@/lib/sessionStore';

export default function PinLogin() {
  const navigate  = useNavigate();
  const [error, setError]       = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [pinKey, setPinKey]     = useState(0);
  const [employees, setEmployees] = useState([]);

  useEffect(() => {
    if (getSession()) { navigate('/pos'); return; }
    window.history.replaceState(null, '', '/login');

    // جلب الموظفين مباشرة من Supabase (بدون React Query)
    supabase.from('employees').select('*').eq('is_active', true)
      .then(({ data, error: err }) => {
        if (err) console.warn('employees fetch error:', err.message);
        if (data?.length) setEmployees(data);
      });
  }, [navigate]);

  const handlePin = async (pin) => {
    // Rate limiting
    const now = Date.now();
    const windowStart = parseInt(sessionStorage.getItem('lw') || '0');
    let attempts     = parseInt(sessionStorage.getItem('la') || '0');

    if (now - windowStart > 60_000) {
      attempts = 0;
      sessionStorage.setItem('lw', String(now));
    }
    if (attempts >= 5) {
      const rem = Math.ceil((60_000 - (now - windowStart)) / 1000);
      setError(`محاولات كثيرة — انتظر ${rem} ثانية`);
      setPinKey(k => k + 1);
      return;
    }
    sessionStorage.setItem('la', String(attempts + 1));
    if (attempts === 0) sessionStorage.setItem('lw', String(now));

    setIsLoading(true);
    setError('');

    try {
      // جلب مباشر من Supabase بالـ PIN
      const { data, error: dbErr } = await supabase
        .from('employees')
        .select('*')
        .eq('pin', pin)
        .eq('is_active', true)
        .limit(1);

      if (dbErr) throw dbErr;

      const match = data?.[0];
      if (match) {
        sessionStorage.removeItem('la');
        sessionStorage.removeItem('lw');
        setSession(match);
        navigate('/pos', { replace: true });
      } else {
        setError(`رقم PIN غير صحيح — المحاولة ${attempts + 1}/5`);
        setPinKey(k => k + 1);
      }
    } catch (err) {
      setError('خطأ في الاتصال — حاول مجدداً');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-black" style={{ color: '#1A0F00' }}>إبرة وخيط الإسكافي</h1>
          <p className="text-sm text-muted-foreground mt-1">أدخل رقم PIN للدخول</p>
        </div>
        <PinPad key={pinKey} onSubmit={handlePin} error={error} isLoading={isLoading} />
      </div>
    </div>
  );
}
