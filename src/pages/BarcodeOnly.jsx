import React, { useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '@/api/supabaseApi';
import { useQuery } from '@tanstack/react-query';
import BarcodeDisplay from '@/components/pos/BarcodeDisplay';
import { Button } from '@/components/ui/button';
import { ArrowRight, Printer, Download, PackageSearch } from 'lucide-react';
import html2canvas from 'html2canvas';

// نفس تسميات الأصناف المستخدمة بصفحة إنشاء الطلب (NewOrder.jsx) —
// عشان يظهر نوع الخدمة بالعربي تحت الباركود بدل قيمة الكود الخام.
const ITEM_TYPE_LABELS = {
  shoes: 'أحذية', bag: 'حقيبة', dress: 'فستان', suit: 'بدلة',
  jacket: 'جاكيت', pants: 'بنطال', shirt: 'قميص', other: 'أخرى',
};

export default function BarcodeOnly() {
  const navigate = useNavigate();
  const barcodeRef = useRef(null);
  const pathParts = window.location.pathname.split('/');
  const orderId = pathParts[pathParts.length - 1];

  const { data: order } = useQuery({
    queryKey: ['order', orderId],
    queryFn: () => db.Order.get(orderId),
    enabled: !!orderId,
  });

  const handleDownload = async () => {
    if (!barcodeRef.current) return;
    const canvas = await html2canvas(barcodeRef.current, { scale: 3, backgroundColor: '#ffffff' });
    const link = document.createElement('a');
    link.download = `باركود-${order?.order_number || orderId}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  const handlePrint = async () => {
    if (!barcodeRef.current) return;
    const canvas = await html2canvas(barcodeRef.current, { scale: 3, backgroundColor: '#ffffff' });
    const imgData = canvas.toDataURL('image/png');
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.write(`
      <html>
      <head>
        <meta charset="utf-8"/>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { display: flex; justify-content: center; align-items: center; min-height: 100vh; background: white; }
          img { width: 80mm; display: block; }
          @media print { body { width: 80mm; } }
        </style>
      </head>
      <body>
        <img src="${imgData}" />
        <script>
          window.onload = function() { window.print(); window.close(); }
        </script>
      </body>
      </html>
    `);
    printWindow.document.close();
  };

  if (!order) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <p className="text-muted-foreground mb-4">الطلب غير موجود</p>
        <Button variant="outline" onClick={() => navigate('/orders')}>العودة</Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center gap-8">
      <Button variant="ghost" className="absolute top-4 right-4" onClick={() => navigate(-1)}>
        <ArrowRight className="w-4 h-4 ml-2" />
        رجوع
      </Button>

      <div ref={barcodeRef} className="bg-white p-6 flex flex-col items-center gap-3">
        <BarcodeDisplay value={order.order_number} width={280} height={80} />
        {/* اسم العميل صاحب الفاتورة + نوع الخدمة — تحت الباركود والرقم مباشرة */}
        <div className="flex flex-col items-center gap-0.5 text-center" dir="rtl">
          <span className="text-sm font-black text-gray-900">{order.customer_name}</span>
          <span className="text-xs font-bold text-gray-500">
            {ITEM_TYPE_LABELS[order.item_type] || order.item_type}
          </span>
        </div>
      </div>

      <div className="flex gap-3">
        <Button onClick={handlePrint} className="bg-primary hover:bg-primary/90">
          <Printer className="w-4 h-4 ml-2" />
          طباعة
        </Button>
        <Button onClick={handleDownload} variant="outline">
          <Download className="w-4 h-4 ml-2" />
          تنزيل صورة
        </Button>
        <Button onClick={() => navigate(`/orders/${orderId}`)} variant="outline">
          <PackageSearch className="w-4 h-4 ml-2" />
          فتح الطلب
        </Button>
      </div>
    </div>
  );
}