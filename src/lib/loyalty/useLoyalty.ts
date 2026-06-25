/**
 * useLoyalty — React hook
 * يتصل بـ Supabase Edge Functions لنظام بطاقات الولاء
 */
import { useCallback, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { toast } from 'sonner';

const WALLET_FN  = 'loyalty-wallet';
const NOTIFY_FN  = 'loyalty-notify';

async function callFn(name: string, body: object) {
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (error) throw new Error(error.message);
  return data;
}

export interface LoyaltyCard {
  id: string;
  customer_phone: string;
  customer_name: string;
  stamps: number;
  free_after: number;
  total_orders: number;
  total_spent: number;
  google_pass_url?: string;
  google_object_id?: string;
  last_service_at?: string;
  created_at: string;
}

export function useLoyalty() {
  const [loading, setLoading] = useState(false);
  const [card, setCard]       = useState<LoyaltyCard | null>(null);

  // ── جلب بطاقة بالجوال ────────────────────────────────
  const getCard = useCallback(async (phone: string) => {
    setLoading(true);
    try {
      const res = await callFn(WALLET_FN, { action: 'get', phone });
      setCard(res.card || null);
      return res.card as LoyaltyCard | null;
    } catch (err: any) {
      console.error('getCard error:', err);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  // ── إصدار بطاقة جديدة أو جلب موجودة ─────────────────
  const issueCard = useCallback(async (phone: string, name: string) => {
    setLoading(true);
    try {
      const res = await callFn(WALLET_FN, { action: 'issue', phone, name });
      setCard(res.card);
      if (res.passUrl) {
        toast.success('✅ تم إصدار بطاقة الولاء');
      }
      return res as { card: LoyaltyCard; passUrl?: string };
    } catch (err: any) {
      toast.error(`فشل إصدار البطاقة: ${err.message}`);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // ── إضافة ختمة بعد خدمة ──────────────────────────────
  const addStamp = useCallback(async (params: {
    phone: string;
    name: string;
    orderId?: string;
    orderNumber?: string;
    serviceType?: string;
    amount?: number;
  }) => {
    setLoading(true);
    try {
      const res = await callFn(WALLET_FN, { action: 'stamp', ...params });
      setCard(res.card);

      if (res.isFreeEarned) {
        toast.success('🎉 العميل حصل على خدمة مجانية!', { duration: 6000 });
      } else {
        toast.success(`✅ تم تسجيل الختمة — ${res.stamps}/${res.card.free_after}`);
      }

      // إرسال SMS تلقائياً
      try {
        await callFn(NOTIFY_FN, { mode: 'pending' });
      } catch {
        // الإشعار اختياري — لا نوقف العملية
      }

      return res as {
        card: LoyaltyCard;
        stamps: number;
        isFreeEarned: boolean;
        remaining: number;
        message: string;
      };
    } catch (err: any) {
      toast.error(`فشل تسجيل الختمة: ${err.message}`);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // ── استرداد خدمة مجانية ───────────────────────────────
  const redeemFree = useCallback(async (phone: string, orderId?: string) => {
    setLoading(true);
    try {
      const res = await callFn(WALLET_FN, { action: 'redeem', phone, orderId });
      setCard(res.card);
      toast.success('🎁 تم استخدام الخدمة المجانية بنجاح');
      return res;
    } catch (err: any) {
      toast.error(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return { card, loading, getCard, issueCard, addStamp, redeemFree };
}
