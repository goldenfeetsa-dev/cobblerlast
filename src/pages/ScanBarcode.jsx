import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ScanBarcode as ScanIcon, Search, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';

export default function ScanBarcode() {
  const [code, setCode] = useState('');
  const navigate = useNavigate();

  const { data: orders } = useQuery({
    queryKey: ['orders'],
    queryFn: () => base44.entities.Order.list('-created_date', 500),
    initialData: [],
  });

  const handleScan = (e) => {
    e.preventDefault();
    const trimmed = code.trim();
    if (!trimmed) return;

    const order = orders.find(o => o.order_number === trimmed);
    if (order) {
      navigate(`/orders/${order.id}`);
    } else {
      toast.error('لم يتم العثور على طلب بهذا الباركود');
    }
  };

  // Auto-detect scanner input (scanner sends characters quickly + Enter)
  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleScan(e);
    }
  };

  return (
    <div className="max-w-lg mx-auto pt-20">
      <div className="text-center mb-10">
        <div className="w-20 h-20 rounded-2xl bg-primary/10 mx-auto flex items-center justify-center mb-4">
          <ScanIcon className="w-10 h-10 text-primary" />
        </div>
        <h1 className="text-2xl font-bold">مسح الباركود</h1>
        <p className="text-muted-foreground mt-1">امسح أو اكتب رقم باركود الطلب</p>
      </div>

      <Card>
        <CardContent className="p-6">
          <form onSubmit={handleScan} className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input
                autoFocus
                value={code}
                onChange={e => setCode(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="امسح الباركود أو اكتب رقم الطلب..."
                className="pl-11 h-14 text-lg font-mono"
              />
            </div>
            <Button type="submit" className="w-full h-12 bg-primary hover:bg-primary/90" disabled={!code.trim()}>
              بحث عن الطلب
              <ArrowRight className="w-4 h-4 mr-2 rotate-180" />
            </Button>
          </form>

          <p className="text-xs text-center text-muted-foreground mt-4">
            استخدم ماسح الباركود أو أدخل رقم الطلب يدوياً (مثال: NT2604XXXX)
          </p>
        </CardContent>
      </Card>
    </div>
  );
}