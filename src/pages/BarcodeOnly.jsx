import React, { useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '@/api/supabaseApi';
import { useQuery } from '@tanstack/react-query';
import BarcodeDisplay from '@/components/pos/BarcodeDisplay';
import { Button } from '@/components/ui/button';
import { ArrowRight, Printer, Download, PackageSearch } from 'lucide-react';
import html2canvas from 'html2canvas';
import { format } from 'date-fns';

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
          img { width: 50mm; display: block; }
          @media print { body { width: 50mm; } @page { size: 50mm auto; margin: 0; } }
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

      {/* تذكرة الطلب — مصمّمة بشكل شبكي مرتب لمقاس 50مم (مكينة الباركود
          الفعلية)، بدل النص المكدّس السابق. الهدف: أي موظف يشوفها ويفهم
          كل المعلومات المهمة بلمحة واحدة بدون ما يقرأ سطر سطر. */}
      <div ref={barcodeRef} className="bg-white flex flex-col items-center" dir="rtl"
        style={{ width: '189px' /* ≈50mm @96dpi */, padding: '10px 8px', fontFamily: "'Tajawal', 'Arial', sans-serif" }}>

        <BarcodeDisplay value={order.order_number} width={130} height={36} />

        {/* شبكة معلومات مضغوطة بخطوط فاصلة واضحة — بدل نص عادي متتالي */}
        <div style={{ width: '100%', marginTop: '6px', border: '1px solid #000', borderRadius: '4px', overflow: 'hidden' }}>
          <div style={{ display: 'flex', borderBottom: '1px solid #000' }}>
            <span style={{ width: '38%', fontSize: '9px', fontWeight: '700', color: '#000', padding: '3px 4px', borderLeft: '1px solid #000', background: '#f3f3f3' }}>العميل</span>
            <span style={{ flex: 1, fontSize: '10px', fontWeight: '900', color: '#000', padding: '3px 4px', textAlign: 'center' }}>{order.customer_name}</span>
          </div>
          <div style={{ display: 'flex', borderBottom: '1px solid #000' }}>
            <span style={{ width: '38%', fontSize: '9px', fontWeight: '700', color: '#000', padding: '3px 4px', borderLeft: '1px solid #000', background: '#f3f3f3' }}>رقم العميل</span>
            <span style={{ flex: 1, fontSize: '10px', fontWeight: '900', color: '#000', padding: '3px 4px', textAlign: 'center' }} dir="ltr">{order.customer_phone || '—'}</span>
          </div>
          <div style={{ display: 'flex', borderBottom: '1px solid #000' }}>
            <span style={{ width: '38%', fontSize: '9px', fontWeight: '700', color: '#000', padding: '3px 4px', borderLeft: '1px solid #000', background: '#f3f3f3' }}>نوع القطعة</span>
            <span style={{ flex: 1, fontSize: '10px', fontWeight: '900', color: '#000', padding: '3px 4px', textAlign: 'center' }}>{ITEM_TYPE_LABELS[order.item_type] || order.item_type}</span>
          </div>
          {(order.description || order.notes) && (
            <div style={{ display: 'flex', borderBottom: '1px solid #000' }}>
              <span style={{ width: '38%', fontSize: '9px', fontWeight: '700', color: '#000', padding: '3px 4px', borderLeft: '1px solid #000', background: '#f3f3f3' }}>التصليح</span>
              <span style={{ flex: 1, fontSize: '9px', fontWeight: '700', color: '#000', padding: '3px 4px', textAlign: 'center', lineHeight: '1.3' }}>
                {(order.description || order.notes || '').slice(0, 60)}
              </span>
            </div>
          )}
          <div style={{ display: 'flex', background: '#000' }}>
            <span style={{ width: '38%', fontSize: '9px', fontWeight: '700', color: '#fff', padding: '3px 4px', borderLeft: '1px solid #fff' }}>التسليم</span>
            <span style={{ flex: 1, fontSize: '10px', fontWeight: '900', color: '#fff', padding: '3px 4px', textAlign: 'center' }} dir="ltr">
              {order.delivery_date ? format(new Date(order.delivery_date), 'd/M') : '—'}
            </span>
          </div>
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