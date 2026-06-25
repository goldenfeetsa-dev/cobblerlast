import React from 'react';
import { User, Phone, Mail, MessageSquare } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export default function CustomerForm({ data, onChange, errors = {} }) {
  const field = (key, label, icon, placeholder, type = 'text') => {
    const Icon = icon;
    return (
      <div>
        <label className="text-sm font-medium text-stone-700 mb-1.5 flex items-center gap-1.5">
          <Icon className="w-4 h-4 text-stone-400" />
          {label}
          {['name', 'phone'].includes(key) && <span className="text-red-400">*</span>}
        </label>
        <Input
          type={type}
          value={data[key] || ''}
          onChange={e => onChange(key, e.target.value)}
          placeholder={placeholder}
          dir="rtl"
          className={cn("text-right", errors[key] && "border-red-400 focus-visible:ring-red-300")}
        />
        {errors[key] && <p className="text-xs text-red-500 mt-1">{errors[key]}</p>}
      </div>
    );
  };

  return (
    <div>
      <h2 className="text-xl font-bold text-stone-800 mb-1">بياناتك</h2>
      <p className="text-stone-500 text-sm mb-6">نحتاج بياناتك لتأكيد الحجز</p>
      <div className="space-y-4">
        {field('name', 'الاسم الكامل', User, 'أدخل اسمك الكامل')}
        {field('phone', 'رقم الجوال', Phone, '05XXXXXXXX', 'tel')}
        {field('email', 'البريد الإلكتروني (اختياري)', Mail, 'email@example.com', 'email')}
        <div>
          <label className="text-sm font-medium text-stone-700 mb-1.5 flex items-center gap-1.5">
            <MessageSquare className="w-4 h-4 text-stone-400" />
            ملاحظات إضافية (اختياري)
          </label>
          <textarea
            value={data.notes || ''}
            onChange={e => onChange('notes', e.target.value)}
            placeholder="أي تفاصيل إضافية عن الغرض أو الإصلاح المطلوب..."
            rows={3}
            dir="rtl"
            className="w-full text-right rounded-lg border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
          />
        </div>
      </div>
    </div>
  );
}