import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/supabaseApi';
import { useQuery } from '@tanstack/react-query';
import PinPad from '@/components/pos/PinPad';
import { setSession, getSession } from '@/lib/sessionStore';

export default function PinLogin() {
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [pinKey, setPinKey] = useState(0);

  const { data: employees = [] } = useQuery({
    queryKey: ['employees-login'],
    queryFn: () => base44.entities.Employee.list(),
    initialData: [],
    staleTime: 30_000,
  });

  useEffect(() => {
    if (getSession()) navigate('/pos');
  }, [navigate]);

  // ── منع المتصفح من حفظ الـ PIN في التاريخ ─────────────────
  useEffect(() => {
    // نبدّل الـ URL لصفحة login بـ replaceState حتى لا يُسجَّل في history
    window.history.replaceState(null, '', '/login');
  }, []);

  const handlePin = async (pin) => {
    // Rate limiting: max 5 attempts per minute
    const ATTEMPTS_KEY = 'login_attempts';
    const WINDOW_KEY   = 'login_window';
    const now = Date.now();
    const windowStart = parseInt(sessionStorage.getItem(WINDOW_KEY) || '0');
    let attempts = parseInt(sessionStorage.getItem(ATTEMPTS_KEY) || '0');

    if (now - windowStart > 60_000) {
      // Reset after 1 minute
      attempts = 0;
      sessionStorage.setItem(WINDOW_KEY, String(now));
    }

    if (attempts >= 5) {
      const remaining = Math.ceil((60_000 - (now - windowStart)) / 1000);
      setError(`محاولات كثيرة. انتظر ${remaining} ثانية.`);
      setPinKey(k => k + 1);
      return;
    }

    sessionStorage.setItem(ATTEMPTS_KEY, String(attempts + 1));
    if (attempts === 0) sessionStorage.setItem(WINDOW_KEY, String(now));

    setIsLoading(true);
    setError('');
    try {
      const match = employees.find(e => e.pin === pin && e.is_active !== false);
      if (match) {
        // نجح — أعد عداد المحاولات
        sessionStorage.removeItem(ATTEMPTS_KEY);
        sessionStorage.removeItem(WINDOW_KEY);
        setSession(match);
        navigate('/pos', { replace: true });
      } else {
        setError(`رقم PIN غير صحيح. المحاولة ${attempts + 1}/5.`);
        setPinKey(k => k + 1);
      }
    } catch (err) {
      setError('حدث خطأ، حاول مجدداً.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <PinPad key={pinKey} onSubmit={handlePin} error={error} isLoading={isLoading} />
      </div>
    </div>
  );
}
