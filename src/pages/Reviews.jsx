import React, { useState } from 'react';
import { base44 } from '@/api/supabaseApi';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Star, Send, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useTrackVisit } from '@/hooks/useTrackVisit';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';

function StarRating({ value, onChange }) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map(n => (
        <button key={n} type="button"
          onMouseEnter={() => onChange && setHover(n)}
          onMouseLeave={() => onChange && setHover(0)}
          onClick={() => onChange && onChange(n)}>
          <Star className="w-8 h-8 transition-colors"
            fill={(hover || value) >= n ? '#C9A84C' : 'none'}
            style={{ color: (hover || value) >= n ? '#C9A84C' : 'rgba(201,168,76,0.25)' }} />
        </button>
      ))}
    </div>
  );
}

export default function Reviews() {
  useTrackVisit('/reviews');
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ customer_name: '', rating: 0, text: '', service: '', order_number: '' });
  const [submitted, setSubmitted] = useState(false);

  const { data: reviews = [] } = useQuery({
    queryKey: ['reviews-approved'],
    queryFn: () => base44.entities.Review.filter({ is_approved: true }, '-created_at'),
  });

  const submitMutation = useMutation({
    mutationFn: (data) => base44.entities.Review.create(data),
    onSuccess: () => {
      setSubmitted(true);
      queryClient.invalidateQueries({ queryKey: ['reviews-approved'] });
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.customer_name || !form.rating || !form.text) return;
    submitMutation.mutate(form);
  };

  return (
    <div className="min-h-screen font-tajawal" style={{ background: '#05071A' }} dir="rtl">
      {/* Header */}
      <div className="relative py-20 px-6 text-center overflow-hidden"
        style={{ background: 'linear-gradient(160deg, #05071A 0%, #0d1235 60%, #05071A 100%)' }}>
        <div className="absolute inset-0 opacity-[0.04]"
          style={{ backgroundImage: 'linear-gradient(#C9A84C 1px, transparent 1px), linear-gradient(90deg, #C9A84C 1px, transparent 1px)', backgroundSize: '60px 60px' }} />
        <div className="relative z-10 max-w-2xl mx-auto">
          <p className="text-xs tracking-[0.4em] font-bold mb-3 uppercase" style={{ color: '#C9A84C' }}>آراء عملاؤنا</p>
          <h1 className="text-5xl md:text-6xl font-black mb-4" style={{ color: '#E8E4DC' }}>التقييمات</h1>
          <div className="w-24 h-0.5 mx-auto mb-6" style={{ background: 'linear-gradient(90deg, transparent, #C9A84C, transparent)' }} />
          <p className="text-base" style={{ color: 'rgba(232,228,220,0.5)' }}>شاركنا تجربتك وساعد الآخرين في اختيار أفضل خدمة</p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-16">
        {/* Submit Form */}
        <div className="max-w-xl mx-auto mb-20">
          <div className="rounded-2xl p-8" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(201,168,76,0.15)' }}>
            {submitted ? (
              <div className="text-center py-8">
                <CheckCircle className="w-16 h-16 mx-auto mb-4" style={{ color: '#C9A84C' }} />
                <h3 className="text-xl font-black mb-2" style={{ color: '#E8E4DC' }}>شكراً على تقييمك!</h3>
                <p className="text-sm mb-6" style={{ color: 'rgba(232,228,220,0.5)' }}>سيتم مراجعة تقييمك ونشره قريباً</p>
                <Button onClick={() => { setSubmitted(false); setForm({ customer_name: '', rating: 0, text: '', service: '', order_number: '' }); }}
                  className="rounded-full text-black font-bold px-8"
                  style={{ background: 'linear-gradient(135deg, #C9A84C, #e8c96a)' }}>
                  أضف تقييماً آخر
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                <h2 className="text-xl font-black mb-6" style={{ color: '#E8E4DC' }}>أضف تقييمك</h2>
                <div>
                  <label className="text-sm font-bold mb-2 block" style={{ color: 'rgba(232,228,220,0.7)' }}>اسمك *</label>
                  <Input value={form.customer_name} onChange={e => setForm(f => ({ ...f, customer_name: e.target.value }))}
                    placeholder="محمد العنزي" maxLength={80}
                    className="bg-transparent border-white/10 text-white placeholder:text-white/20 focus:border-yellow-500/50" />
                </div>
                <div>
                  <label className="text-sm font-bold mb-2 block" style={{ color: 'rgba(232,228,220,0.7)' }}>تقييمك *</label>
                  <StarRating value={form.rating} onChange={v => setForm(f => ({ ...f, rating: v }))} />
                </div>
                <div>
                  <label className="text-sm font-bold mb-2 block" style={{ color: 'rgba(232,228,220,0.7)' }}>تجربتك *</label>
                  <Textarea value={form.text} onChange={e => setForm(f => ({ ...f, text: e.target.value }))}
                    placeholder="شاركنا تفاصيل تجربتك..." rows={4} maxLength={500}
                    className="bg-transparent border-white/10 text-white placeholder:text-white/20 focus:border-yellow-500/50 resize-none" />
                </div>
                <div>
                  <label className="text-sm font-bold mb-2 block" style={{ color: 'rgba(232,228,220,0.7)' }}>الخدمة (اختياري)</label>
                  <Input value={form.service} onChange={e => setForm(f => ({ ...f, service: e.target.value }))}
                    placeholder="مثال: ترميم حذاء" maxLength={100}
                    className="bg-transparent border-white/10 text-white placeholder:text-white/20 focus:border-yellow-500/50" />
                </div>
                <div>
                  <label className="text-sm font-bold mb-2 block" style={{ color: 'rgba(232,228,220,0.7)' }}>رقم الطلب (اختياري)</label>
                  <Input value={form.order_number} onChange={e => setForm(f => ({ ...f, order_number: e.target.value }))}
                    placeholder="ORD-XXXX" maxLength={20}
                    className="bg-transparent border-white/10 text-white placeholder:text-white/20 focus:border-yellow-500/50" />
                </div>
                <Button type="submit" disabled={!form.customer_name || !form.rating || !form.text || submitMutation.isPending}
                  className="w-full h-12 rounded-full text-black font-black text-base"
                  style={{ background: 'linear-gradient(135deg, #C9A84C, #e8c96a)' }}>
                  <Send className="w-4 h-4 ml-2" />
                  {submitMutation.isPending ? 'جاري الإرسال...' : 'أرسل تقييمك'}
                </Button>
              </form>
            )}
          </div>
        </div>

        {/* Reviews Grid */}
        {reviews.length > 0 && (
          <div>
            <h2 className="text-2xl font-black text-center mb-10" style={{ color: '#E8E4DC' }}>
              ماذا يقول عملاؤنا
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {reviews.map((r, i) => (
                <motion.div key={r.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                  className="rounded-2xl p-6 flex flex-col gap-4"
                  style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(201,168,76,0.12)' }}>
                  <div className="flex gap-0.5">
                    {[...Array(5)].map((_, s) => (
                      <Star key={s} className="w-4 h-4"
                        fill={s < r.rating ? '#C9A84C' : 'none'}
                        style={{ color: s < r.rating ? '#C9A84C' : 'rgba(201,168,76,0.2)' }} />
                    ))}
                  </div>
                  <p className="text-sm leading-relaxed flex-1" style={{ color: 'rgba(232,228,220,0.65)' }}>"{r.text}"</p>
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full flex items-center justify-center font-black text-sm text-black shrink-0"
                      style={{ background: 'linear-gradient(135deg, #C9A84C, #e8c96a)' }}>
                      {r.customer_name?.[0] || '؟'}
                    </div>
                    <div>
                      <p className="font-bold text-sm" style={{ color: '#E8E4DC' }}>{r.customer_name}</p>
                      {r.service && <p className="text-xs" style={{ color: 'rgba(232,228,220,0.3)' }}>{r.service}</p>}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {/* Back link */}
        <div className="text-center mt-16">
          <Link to="/booking">
            <button className="px-8 py-3 rounded-full font-bold text-sm transition-all hover:scale-105"
              style={{ background: 'rgba(201,168,76,0.1)', border: '1px solid rgba(201,168,76,0.25)', color: '#C9A84C' }}>
              العودة للرئيسية
            </button>
          </Link>
        </div>
      </div>
    </div>
  );
}