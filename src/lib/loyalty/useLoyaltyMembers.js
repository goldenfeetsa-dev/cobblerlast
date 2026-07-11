/**
 * useLoyaltyMembers — Hook للتعامل مع برنامج الولاء بالنقاط
 * (نظام مستقل عن useLoyalty.ts القديم الخاص ببطاقات الختم)
 * يتصل بدوال Vercel API تحت /api/loyalty/* بدلاً من استدعاء Supabase مباشرة،
 * لأن منطق النقاط وبطاقات المحفظة يجب أن يمرّ عبر الخادم (service role + شهادات).
 */
import { useCallback, useState } from 'react';
import { toast } from 'sonner';

async function callApi(path, options = {}) {
  const res = await fetch(`/api/loyalty/${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `فشل الاتصال بالخادم (${res.status})`);
  return data;
}

export function useLoyaltyMembers() {
  const [loading, setLoading] = useState(false);

  const createMember = useCallback(async ({ full_name, phone, email, user_id }) => {
    setLoading(true);
    try {
      const data = await callApi('create-member', {
        method: 'POST',
        body: JSON.stringify({ full_name, phone, email, user_id }),
      });
      if (data.alreadyExists) {
        toast.info('العميل لديه عضوية ولاء بالفعل بهذا الرقم');
      } else {
        toast.success(`✅ تم إنشاء عضوية الولاء برقم ${data.member.member_number}`);
      }
      return data;
    } catch (err) {
      toast.error(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const lookupMember = useCallback(async ({ member_number, phone }) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (member_number) params.set('member_number', member_number);
      if (phone) params.set('phone', phone);
      return await callApi(`lookup?${params.toString()}`);
    } catch (err) {
      // silent — يُترك للواجهة عرض "لم يُعثر على عضو"
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const adjustPoints = useCallback(async ({ member_number, change_amount, reason, performed_by, performed_by_id }) => {
    setLoading(true);
    try {
      const data = await callApi('adjust-points', {
        method: 'POST',
        body: JSON.stringify({ member_number, change_amount, reason, performed_by, performed_by_id }),
      });
      toast.success(
        Number(change_amount) > 0
          ? `✅ تمت إضافة ${change_amount} نقطة — الرصيد الآن ${data.member.points}`
          : `✅ تم خصم ${Math.abs(change_amount)} نقطة — الرصيد الآن ${data.member.points}`
      );
      if (data.leveledUp) toast.success(`🎉 تمت ترقية العضو إلى المستوى ${data.member.membership_level}`);
      return data;
    } catch (err) {
      toast.error(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const getAppleWalletUrl = useCallback((memberNumber) => {
    return `/api/loyalty/apple-pass?member_number=${encodeURIComponent(memberNumber)}`;
  }, []);

  const getGoogleWalletSaveUrl = useCallback(async (memberNumber) => {
    const data = await callApi(`google-pass?member_number=${encodeURIComponent(memberNumber)}`);
    return data.saveUrl;
  }, []);

  const getQrImageUrl = useCallback((memberNumber) => {
    return `/api/loyalty/qr?member_number=${encodeURIComponent(memberNumber)}`;
  }, []);

  const markNotificationRead = useCallback(async (memberNumber, notificationId) => {
    try {
      await callApi('notifications', {
        method: 'POST',
        body: JSON.stringify({ member_number: memberNumber, notification_id: notificationId }),
      });
    } catch {
      // غير حرج — نتجاهل الفشل بصمت
    }
  }, []);

  return {
    loading,
    createMember,
    lookupMember,
    adjustPoints,
    getAppleWalletUrl,
    getGoogleWalletSaveUrl,
    getQrImageUrl,
    markNotificationRead,
  };
}
