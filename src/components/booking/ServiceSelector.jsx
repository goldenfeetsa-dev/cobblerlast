import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { db } from '@/api/supabaseApi';
import { Scissors, ShoppingBag, Check, Clock, Tag } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SarAmount } from '@/components/shared/SarCurrency';

const categoryIcons = { shoes: Scissors, bags: ShoppingBag };
const categoryLabels = { shoes: 'أحذية', bags: 'شنط' };

export default function ServiceSelector({ selectedService, onSelect }) {
  const { data: services = [], isLoading } = useQuery({
    queryKey: ['public-services'],
    queryFn: () => db.Service.filter({ is_active: true }),
  });

  const shoes = services.filter(s => s.category === 'shoes');
  const bags = services.filter(s => s.category === 'bags');

  if (isLoading) return (
    <div className="flex items-center justify-center h-40">
      <div className="w-8 h-8 border-3 border-white/20 border-t-[#ece8df] rounded-full animate-spin" />
    </div>
  );

  const renderCategory = (label, icon, items) => {
    const Icon = icon;
    if (!items.length) return null;
    return (
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-3">
          <Icon className="w-5 h-5 text-[#bdb8ad]" />
          <h3 className="font-bold text-[#ece8df] text-sm uppercase tracking-wide">{label}</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {items.map(service => {
            const isSelected = selectedService?.id === service.id;
            return (
              <button
                key={service.id}
                onClick={() => onSelect(service)}
                className={cn(
                  "text-right p-4 rounded-none border-2 transition-all hover:border-white/30 hover:bg-white/5",
                  isSelected ? "border-[#ece8df] bg-[#ece8df]/10" : "border-white/10 bg-[#131315]"
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <p className="font-bold text-[#ece8df] mb-0.5">{service.name_ar}</p>
                    {service.description && <p className="text-xs text-[#bdb8ad] leading-relaxed">{service.description}</p>}
                    <div className="flex items-center gap-3 mt-2">
                      <span className="flex items-center gap-1 text-[#ece8df] font-bold text-sm">
                        <Tag className="w-3.5 h-3.5" />
                        <SarAmount value={service.price} />
                      </span>
                      <span className="flex items-center gap-1 text-[#8d8a82] text-xs">
                        <Clock className="w-3 h-3" />
                        {service.duration_minutes} دقيقة
                      </span>
                    </div>
                  </div>
                  {isSelected && (
                    <div className="w-6 h-6 bg-[#ece8df] rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Check className="w-3.5 h-3.5 text-[#0b0b0c]" />
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div>
      <h2 className="text-xl font-bold text-[#ece8df] mb-1">اختر الخدمة</h2>
      <p className="text-[#bdb8ad] text-sm mb-6">حدد نوع الإصلاح الذي تحتاجه</p>
      {renderCategory('إصلاح الأحذية', Scissors, shoes)}
      {renderCategory('إصلاح الشنط', ShoppingBag, bags)}
      {services.length === 0 && (
        <div className="text-center py-12 text-[#8d8a82]">
          <Scissors className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>لا توجد خدمات متاحة حالياً</p>
        </div>
      )}
    </div>
  );
}