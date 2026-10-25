import React from 'react';
import { Check } from 'lucide-react';

const steps = [
  { id: 1, label: 'الخدمة' },
  { id: 2, label: 'الموعد' },
  { id: 3, label: 'بياناتك' },
  { id: 4, label: 'التأكيد' },
];

// مؤشر خطوات خطّي: خط رفيع يتعبّأ بالعاجي مع التقدّم
export default function StepIndicator({ currentStep }) {
  return (
    <div className="mb-8" role="progressbar" aria-valuemin={1} aria-valuemax={4} aria-valuenow={currentStep}>
      <div className="flex gap-2">
        {steps.map((step) => (
          <div key={step.id} className="flex-1">
            <div className="h-[3px] bg-white/10 overflow-hidden">
              <div className="h-full bg-[#ece8df] transition-all duration-500 ease-out"
                style={{ width: currentStep >= step.id ? '100%' : '0%' }} />
            </div>
            <div className={`mt-2.5 flex items-center gap-1.5 text-xs transition-colors ${currentStep === step.id ? 'text-[#ece8df] font-semibold' : currentStep > step.id ? 'text-[#bdb8ad]' : 'text-[#8d8a82]'}`}>
              {currentStep > step.id ? <Check className="w-3.5 h-3.5" /> : <span>{step.id}</span>}
              <span>{step.label}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
