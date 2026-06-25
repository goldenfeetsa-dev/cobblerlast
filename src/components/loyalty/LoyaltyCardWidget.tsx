import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, Wallet, Gift, Phone, User, Star, CheckCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useLoyalty } from '@/lib/loyalty/useLoyalty';

// ── ختمة واحدة ──────────────────────────────────────────────
function Stamp({ filled, isFree }: { filled: boolean; isFree?: boolean }) {
  return (
    <motion.div
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all
        ${isFree
          ? 'border-yellow-400 bg-yellow-50'
          : filled
            ? 'border-amber-700 bg-amber-700'
            : 'border-gray-200 bg-gray-50'
        }`}
    >
      {isFree
        ? <Gift className="w-5 h-5 text-yellow-500" />
        : filled
          ? <CheckCircle className="w-5 h-5 text-white" />
          : <div className="w-4 h-4 rounded-full border-2 border-gray-300" />
      }
    </motion.div>
  );
}

// ── بطاقة العميل ────────────────────────────────────────────
function CardDisplay({ card, onRedeem, onRefresh }: any) {
  const freeAfter  = card.free_after || 3;
  const stamps     = card.stamps || 0;
  const hasFree    = stamps > 0 && stamps % freeAfter === 0;
  const remaining  = hasFree ? 0 : freeAfter - (stamps % freeAfter);
  const progress   = (stamps % freeAfter) / freeAfter;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl overflow-hidden shadow-lg"
      style={{ background: 'linear-gradient(135deg, #1A0F00 0%, #2C1A00 60%, #C9A84C 100%)' }}
    >
      {/* Header */}
      <div className="px-5 pt-5 pb-3 flex items-start justify-between">
        <div>
          <div className="text-xs text-amber-200/70 font-medium">بطاقة الولاء</div>
          <div className="text-white font-black text-lg leading-tight">{card.customer_name}</div>
          <div className="text-amber-300/80 text-xs mt-0.5">{card.customer_phone}</div>
        </div>
        <div className="text-right">
          <div className="text-amber-300 font-black text-2xl">{stamps}</div>
          <div className="text-amber-200/60 text-[10px]">ختمة</div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="px-5 pb-2">
        <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
          <motion.div
            className="h-full rounded-full bg-amber-400"
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(progress * 100, 100)}%` }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
          />
        </div>
        <div className="flex justify-between mt-1">
          <span className="text-amber-200/50 text-[10px]">٠</span>
          <span className="text-amber-200/50 text-[10px]">{freeAfter} ختمات = خدمة مجانية</span>
        </div>
      </div>

      {/* Stamps grid */}
      <div className="px-5 pb-4">
        <div className="flex gap-2 flex-wrap">
          {Array.from({ length: freeAfter }).map((_, i) => (
            <Stamp key={i} filled={i < (stamps % freeAfter)} />
          ))}
          <Stamp isFree filled={hasFree} />
        </div>
      </div>

      {/* Status & Action */}
      <div className="px-5 pb-5 flex items-center gap-3">
        {hasFree ? (
          <Button
            onClick={onRedeem}
            className="flex-1 bg-yellow-400 hover:bg-yellow-500 text-yellow-900 font-black gap-2"
          >
            <Gift className="w-4 h-4" />استرداد الخدمة المجانية
          </Button>
        ) : (
          <div className="flex-1 text-center">
            <div className="text-amber-300/70 text-xs">
              {remaining === 1
                ? 'ختمة واحدة للخدمة المجانية 🎯'
                : `${remaining} ختمات للخدمة المجانية`}
            </div>
          </div>
        )}
        <button onClick={onRefresh} className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors">
          <RefreshCw className="w-4 h-4 text-white" />
        </button>
      </div>

      {/* Stats footer */}
      <div className="bg-black/20 px-5 py-3 flex justify-between text-xs text-amber-200/60">
        <span>{card.total_orders || 0} خدمة إجمالاً</span>
        <span>{(card.total_spent || 0).toFixed(0)} ر.س أجمالي</span>
        {card.last_service_at && (
          <span>آخر زيارة: {new Date(card.last_service_at).toLocaleDateString('ar-SA')}</span>
        )}
      </div>
    </motion.div>
  );
}

// ── Main Component ───────────────────────────────────────────
export default function LoyaltyCardWidget({
  prefillPhone = '',
  prefillName  = '',
  orderId      = '',
  orderNumber  = '',
  serviceType  = '',
  amount       = 0,
  mode         = 'lookup', // 'lookup' | 'stamp' (يُضيف ختمة تلقائياً)
}: {
  prefillPhone?: string;
  prefillName?:  string;
  orderId?:      string;
  orderNumber?:  string;
  serviceType?:  string;
  amount?:       number;
  mode?:         'lookup' | 'stamp';
}) {
  const [phone, setPhone] = useState(prefillPhone);
  const [name,  setName]  = useState(prefillName);
  const { card, loading, getCard, issueCard, addStamp, redeemFree } = useLoyalty();
  const [stamped, setStamped] = useState(false);

  // في وضع stamp، إذا كان عندنا جوال مسبق نبحث تلقائياً
  useEffect(() => {
    if (prefillPhone && mode === 'stamp') {
      getCard(prefillPhone);
    }
  }, [prefillPhone]);

  const handleLookup = async () => {
    if (!phone) return;
    await getCard(phone);
  };

  const handleIssue = async () => {
    if (!phone || !name) return;
    await issueCard(phone, name);
  };

  const handleStamp = async () => {
    if (!phone) return;
    const n = name || card?.customer_name || 'عميل';
    const res = await addStamp({ phone, name: n, orderId, orderNumber, serviceType, amount });
    if (res) setStamped(true);
  };

  const handleRedeem = async () => {
    if (!card) return;
    await redeemFree(card.customer_phone, orderId);
    await getCard(card.customer_phone);
  };

  return (
    <div className="space-y-4" dir="rtl">
      {/* Search form */}
      {!card && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs flex items-center gap-1">
                <Phone className="w-3 h-3" />رقم الجوال
              </Label>
              <Input
                value={phone}
                onChange={e => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                placeholder="05XXXXXXXX"
                dir="ltr"
                inputMode="tel"
                className="text-center font-mono"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs flex items-center gap-1">
                <User className="w-3 h-3" />اسم العميل
              </Label>
              <Input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="اسم العميل"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={handleLookup}
              disabled={!phone || loading}
              variant="outline"
              className="flex-1 gap-1 text-sm"
            >
              {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
              بحث عن البطاقة
            </Button>
            <Button
              onClick={handleIssue}
              disabled={!phone || !name || loading}
              className="flex-1 gap-1 text-sm"
              style={{ background: '#1A0F00' }}
            >
              <Star className="w-3.5 h-3.5" />إصدار بطاقة جديدة
            </Button>
          </div>
        </div>
      )}

      {/* Card display */}
      <AnimatePresence>
        {card && (
          <div className="space-y-3">
            <CardDisplay
              card={card}
              onRedeem={handleRedeem}
              onRefresh={() => getCard(card.customer_phone)}
            />

            {/* Actions */}
            <div className="flex gap-2">
              {mode === 'stamp' && !stamped && (
                <Button
                  onClick={handleStamp}
                  disabled={loading}
                  className="flex-1 gap-2 bg-amber-700 hover:bg-amber-800 text-white font-bold"
                >
                  {loading
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : <CheckCircle className="w-4 h-4" />}
                  تسجيل ختمة لهذا الطلب
                </Button>
              )}

              {stamped && (
                <div className="flex-1 flex items-center justify-center gap-2 text-green-700 bg-green-50 border border-green-200 rounded-lg py-2 text-sm font-bold">
                  <CheckCircle className="w-4 h-4" />تم تسجيل الختمة ✅
                </div>
              )}

              {card.google_pass_url && (
                <a
                  href={card.google_pass_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors text-sm font-medium"
                >
                  <Wallet className="w-4 h-4 text-blue-600" />
                  <span>Google Wallet</span>
                </a>
              )}

              <Button
                variant="ghost"
                size="sm"
                onClick={() => { getCard(''); }}
                className="text-xs text-gray-400"
              >
                تغيير
              </Button>
            </div>
          </div>
        )}
      </AnimatePresence>

      {loading && !card && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      )}
    </div>
  );
}
