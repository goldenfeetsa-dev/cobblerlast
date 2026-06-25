import React from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Stamp, Plus, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';

export default function StampCard({ customer, stampsRequired = 10, isAdmin }) {
  const queryClient = useQueryClient();
  const stamps = customer.stamps || 0;

  const updateStamps = useMutation({
    mutationFn: (newStamps) => base44.entities.Customer.update(customer.id, { stamps: newStamps }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['customers'] }),
  });

  const addStamp = () => {
    const next = stamps + 1;
    if (next >= stampsRequired) {
      updateStamps.mutate(0);
      toast.success(`🎉 تم إكمال ${stampsRequired} طوابع! تم تصفير العداد.`);
    } else {
      updateStamps.mutate(next);
      toast.success(`تمت إضافة طابع (${next}/${stampsRequired})`);
    }
  };

  const resetStamps = () => {
    updateStamps.mutate(0);
    toast.info('تم تصفير عداد الطوابع');
  };

  return (
    <div className="mt-3 pt-3 border-t border-dashed border-border">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
          <Stamp className="w-3.5 h-3.5" />
          الطوابع
        </span>
        <span className="text-xs font-bold text-primary">{stamps}/{stampsRequired}</span>
      </div>

      {/* Stamp grid */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        {Array.from({ length: stampsRequired }).map((_, i) => (
          <div
            key={i}
            className={`w-7 h-7 rounded-full border-2 flex items-center justify-center text-xs transition-all ${
              i < stamps
                ? 'bg-primary border-primary text-white shadow-sm'
                : 'border-border bg-muted text-muted-foreground'
            }`}
          >
            {i < stamps ? '✦' : ''}
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <Button
          size="sm"
          className="flex-1 h-8 text-xs bg-primary hover:bg-primary/90"
          onClick={addStamp}
          disabled={updateStamps.isPending}
        >
          <Plus className="w-3.5 h-3.5 ml-1" />
          زيادة نقطة
        </Button>
        {isAdmin && (
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs"
            onClick={resetStamps}
            disabled={updateStamps.isPending}
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
}