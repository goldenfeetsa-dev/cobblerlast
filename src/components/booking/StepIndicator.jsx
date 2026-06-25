import React from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

const steps = [
  { id: 1, label: 'الخدمة' },
  { id: 2, label: 'الموعد' },
  { id: 3, label: 'بياناتك' },
  { id: 4, label: 'التأكيد' },
];

export default function StepIndicator({ currentStep }) {
  return (
    <div className="flex items-center justify-center gap-0 mb-8">
      {steps.map((step, idx) => (
        <React.Fragment key={step.id}>
          <div className="flex flex-col items-center">
            <div className={cn(
              "w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold transition-all",
              currentStep > step.id ? "bg-green-500 text-white" :
              currentStep === step.id ? "bg-amber-500 text-white shadow-lg shadow-amber-200" :
              "bg-stone-100 text-stone-400"
            )}>
              {currentStep > step.id ? <Check className="w-4 h-4" /> : step.id}
            </div>
            <span className={cn(
              "text-xs mt-1 font-medium",
              currentStep === step.id ? "text-amber-600" : "text-stone-400"
            )}>{step.label}</span>
          </div>
          {idx < steps.length - 1 && (
            <div className={cn(
              "h-0.5 w-12 mb-4 transition-all",
              currentStep > step.id ? "bg-green-400" : "bg-stone-200"
            )} />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}