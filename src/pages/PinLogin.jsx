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
    if (getSession()) navigate('/');
  }, [navigate]);

  // ── منع المتصفح من حفظ الـ PIN في التاريخ ─────────────────
  useEffect(() => {
    // نبدّل الـ URL لصفحة login بـ replaceState حتى لا يُسجَّل في history
    window.history.replaceState(null, '', '/login');
  }, []);

  const handlePin = async (pin) => {
    setIsLoading(true);
    setError('');
    try {
      const match = employees.find(e => e.pin === pin && e.is_active !== false);
      if (match) {
        // setSession يحذف الـ PIN قبل التخزين
        setSession(match);
        // navigate بـ replace حتى لا يرجع المستخدم بزر الرجوع لصفحة PIN
        navigate('/', { replace: true });
      } else {
        setError('رقم PIN غير صحيح. حاول مجدداً.');
        setPinKey(k => k + 1);
      }
    } catch (err) {
      setError('حدث خطأ، حاول مجدداً.');
      console.error('Login error:', err);
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
