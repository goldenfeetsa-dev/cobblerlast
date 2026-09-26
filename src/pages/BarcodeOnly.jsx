import React, { useRef, useEffect, useState } from 'react';
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

// بطاقة ملصق واحدة — تُستخدم لكل قطعة على حدة (مو للطلب كامل) عشان
// كل قطعة فعلية تاخذ ملصقها المستقل القابل للمسح بدل ملصق واحد
// يغطّي الطلب كامل وتضيع بقية القطع.
//
// مقاس الملصق الفعلي المُشترى: 50×25مم (189×94.5px @96dpi) — طلب صريح:
// شي صغير عملي (مو بوليصة شحن)، فتركت بس أهم المعلومات للتعرّف السريع
// على القطعة (باركود + رقم + نوع + تاريخ تسليم). اسم/جوال العميل
// وتفاصيل التصليح موجودين بالفاتورة الأصلية، ما نكرّرهم هنا.
function LabelCard({ barcodeValue, order, piece, pieceIndex, totalPieces }) {
  return (
    <div className="bcd-label bg-white flex flex-col items-center justify-center" dir="rtl"
      style={{ width: '189px', height: '94.5px', padding: '4px 8px', fontFamily: "'Tajawal', 'Arial', sans-serif", boxSizing: 'border-box' }}>

      <BarcodeDisplay value={barcodeValue} width={140} height={30} />

      <div style={{ fontSize: '11px', fontWeight: '900', color: '#000', letterSpacing: '0.5px', margin: '2px 0' }} dir="ltr">
        {barcodeValue}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '9px', fontWeight: '700', color: '#000' }}>
        <span>{ITEM_TYPE_LABELS[piece.item_type] || piece.item_type}</span>
        <span style={{ color: '#999' }}>·</span>
        <span dir="ltr">{order.delivery_date ? format(new Date(order.delivery_date), 'd/M') : '—'}</span>
        {totalPieces > 1 && (
          <>
            <span style={{ color: '#999' }}>·</span>
            <span>{pieceIndex + 1}/{totalPieces}</span>
          </>
        )}
      </div>
    </div>
  );
}

export default function BarcodeOnly() {
  const navigate = useNavigate();
  const containerRef = useRef(null);
  const [autoPrinted, setAutoPrinted] = useState(false);
  const pathParts = window.location.pathname.split('/');
  const orderId = pathParts[pathParts.length - 1];

  const { data: order } = useQuery({
    queryKey: ['order', orderId],
    queryFn: () => db.Order.get(orderId),
    enabled: !!orderId,
  });

  // لو الطلب فيه أكثر من قطعة (order_items)، نصدر ملصق مستقل لكل قطعة
  // برقم فرعي (NT123-1, NT123-2...) — كل قطعة فعلية تاخذ ملصقها الخاص
  // بدل ملصق واحد للطلب كامل تضيع فيه بقية القطع
  const pieces = (order?.order_items && order.order_items.length > 0)
    ? order.order_items
    : (order ? [{ item_type: order.item_type, description: order.description || order.notes || '' }] : []);

  // طباعة تلقائية أول ما البيانات تجهز — نفس آلية الفاتورة بالضبط،
  // بضغطة وحدة بدون تأخير مصطنع
  useEffect(() => {
    if (order && !autoPrinted) {
      setAutoPrinted(true);
      const t = setTimeout(() => window.print(), 300);
      return () => clearTimeout(t);
    }
  }, [order, autoPrinted]);

  const handleDownload = async () => {
    if (!containerRef.current) return;
    const canvas = await html2canvas(containerRef.current, { scale: 3, backgroundColor: '#ffffff' });
    const link = document.createElement('a');
    link.download = `باركود-${order?.order_number || orderId}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
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
      {/* أنماط الطباعة — نفس آلية الفاتورة بالضبط: تطبع الصفحة الحالية
          مباشرة (بدون فتح أي نافذة/تبويب ثاني)، وتُخفي كل شيء إلا
          الملصقات. كل ملصق قطعة يصير صفحة طباعة مستقلة (page-break)
          فتخرج كل قطعة على ورقة منفصلة فعلياً من مكينة الباركود. */}
      <style>{`
        @media print {
          html, body { height: auto !important; overflow: visible !important; }
          body * { visibility: hidden; }
          #bcd-print-area, #bcd-print-area * { visibility: visible; }
          #bcd-print-area {
            position: fixed; top: 0; left: 0; right: 0;
            width: 50mm; height: auto; max-height: none; overflow: visible;
            margin: 0 auto; box-shadow: none !important;
          }
          .bcd-no-print { display: none !important; }
          .bcd-label { page-break-after: always; width: 50mm !important; height: 25mm !important; }
          .bcd-label:last-child { page-break-after: auto; }
          @page { size: 50mm 25mm; margin: 0; }
        }
      `}</style>

      <Button variant="ghost" className="absolute top-4 right-4 bcd-no-print" onClick={() => navigate(-1)}>
        <ArrowRight className="w-4 h-4 ml-2" />
        رجوع
      </Button>

      {pieces.length > 1 && (
        <p className="text-sm font-bold text-muted-foreground -mb-4 bcd-no-print">
          {pieces.length} قطع — كل وحدة بملصقها المستقل بورقة منفصلة
        </p>
      )}

      <div id="bcd-print-area" ref={containerRef} className="flex flex-wrap items-start justify-center gap-4">
        {pieces.map((piece, i) => (
          <LabelCard
            key={i}
            barcodeValue={pieces.length > 1 ? `${order.order_number}-${i + 1}` : order.order_number}
            order={order}
            piece={piece}
            pieceIndex={i}
            totalPieces={pieces.length}
          />
        ))}
      </div>

      <div className="flex gap-3 bcd-no-print">
        <Button onClick={() => window.print()} className="bg-primary hover:bg-primary/90">
          <Printer className="w-4 h-4 ml-2" />
          طباعة {pieces.length > 1 ? `(${pieces.length} ملصقات)` : ''}
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
