import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import PinPad from '@/components/pos/PinPad';
import { setSession, getSession } from '@/lib/sessionStore';
import { getHomePath } from '@/lib/roles';

export default function PinLogin() {
  const navigate  = useNavigate();
  const [error, setError]       = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [pinKey, setPinKey]     = useState(0);

  useEffect(() => {
    const existing = getSession();
    if (existing) { navigate(getHomePath(existing.role), { replace: true }); return; }
    window.history.replaceState(null, '', '/login');
    // ملاحظة: لا يوجد أي جلب لبيانات الموظفين أو أرقام الـ PIN هنا —
    // التحقق يتم بالكامل على السيرفر عبر /api/auth/login حتى لا تُفتح أي بيانات حساسة للمتصفح.
  }, [navigate]);

  const handlePin = async (pin) => {
    setIsLoading(true);
    setError('');

    try {
      // /api/auth/login يتحقق من الـ PIN (نفس منطق pos-login الآمن على
      // السيرفر) ثم يصدر كوكي جلسة HttpOnly مباشرة — المتصفح والجافاسكربت
      // لا يريان أي توكن إطلاقاً (credentials: 'include' يخلي المتصفح
      // يحفظ ويرسل الكوكي تلقائياً بكل طلب لاحق، بدون تدخل من كودنا).
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin }),
      });
      const result = await res.json();

      if (res.status === 429) {
        const mins = Math.ceil((result.retry_after_seconds || 0) / 60);
        setError(`محاولات كثيرة من جهازك — انتظر ${mins} دقيقة قبل المحاولة مجدداً`);
        setPinKey(k => k + 1);
        return;
      }

      if (result.success && result.employee) {
        // هذي نسخة "عرض فقط" تُخزَّن محلياً لتلوين الواجهة (اسم/دور/صورة)
        // — هي ليست مصدر الصلاحية الفعلي؛ أي عملية حساسة (مصاريف، زاتكا)
        // يتحقق منها السيرفر من كوكي HttpOnly في كل طلب بشكل مستقل.
        setSession(result.employee);
        navigate(getHomePath(result.employee.role), { replace: true });
        return;
      }

      const attemptsLeft = result.attempts_left;
      setError(attemptsLeft != null ? `رقم PIN غير صحيح — المحاولات المتبقية ${attemptsLeft}` : 'رقم PIN غير صحيح');
      setPinKey(k => k + 1);
    } catch (err) {
      setError('خطأ في الاتصال — حاول مجدداً');
      setPinKey(k => k + 1);
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
