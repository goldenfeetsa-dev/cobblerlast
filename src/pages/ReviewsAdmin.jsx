import React from 'react';
import { base44 } from '@/api/supabaseApi';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Star, Check, Trash2, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { getSession } from '@/lib/sessionStore';
import { Navigate } from 'react-router-dom';

export default function ReviewsAdmin() {
  const session = getSession();
  const queryClient = useQueryClient();

  const { data: reviews = [], isLoading } = useQuery({
    queryKey: ['reviews-all'],
    queryFn: () => base44.entities.Review.list('-created_date'),
  });

  const approveMutation = useMutation({
    mutationFn: (id) => base44.entities.Review.update(id, { is_approved: true }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['reviews-all'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Review.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['reviews-all'] }),
  });

  if (session?.role !== 'admin') return <Navigate to="/" replace />;

  const pending = reviews.filter(r => !r.is_approved);
  const approved = reviews.filter(r => r.is_approved);

  return (
    <div className="p-6 max-w-4xl mx-auto" dir="rtl">
      <h1 className="text-2xl font-black mb-6 text-foreground">إدارة التقييمات</h1>

      <div className="flex gap-4 mb-8">
        <div className="rounded-xl p-4 text-center flex-1 bg-card border border-border">
          <div className="text-3xl font-black text-yellow-500">{pending.length}</div>
          <div className="text-sm text-muted-foreground">في انتظار الموافقة</div>
        </div>
        <div className="rounded-xl p-4 text-center flex-1 bg-card border border-border">
          <div className="text-3xl font-black text-green-500">{approved.length}</div>
          <div className="text-sm text-muted-foreground">منشور</div>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-10 text-muted-foreground">جاري التحميل...</div>
      ) : reviews.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground">لا توجد تقييمات بعد</div>
      ) : (
        <div className="space-y-4">
          {reviews.map(r => (
            <div key={r.id} className="rounded-xl p-5 bg-card border border-border">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="font-bold text-foreground">{r.customer_name}</span>
                    {r.service && <span className="text-xs text-muted-foreground">{r.service}</span>}
                    {r.order_number && <span className="text-xs text-muted-foreground">#{r.order_number}</span>}
                    <Badge variant={r.is_approved ? 'default' : 'secondary'}>
                      {r.is_approved ? 'منشور' : 'بانتظار الموافقة'}
                    </Badge>
                  </div>
                  <div className="flex gap-0.5 mb-2">
                    {[...Array(5)].map((_, s) => (
                      <Star key={s} className="w-4 h-4"
                        fill={s < r.rating ? '#C9A84C' : 'none'}
                        style={{ color: s < r.rating ? '#C9A84C' : 'rgba(201,168,76,0.2)' }} />
                    ))}
                  </div>
                  <p className="text-sm text-muted-foreground">{r.text}</p>
                </div>
                <div className="flex gap-2 shrink-0">
                  {!r.is_approved && (
                    <Button size="sm" onClick={() => approveMutation.mutate(r.id)}
                      disabled={approveMutation.isPending}
                      className="bg-green-600 hover:bg-green-700 text-white">
                      <Check className="w-4 h-4" />
                      موافقة
                    </Button>
                  )}
                  <Button size="sm" variant="destructive" onClick={() => deleteMutation.mutate(r.id)}
                    disabled={deleteMutation.isPending}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}