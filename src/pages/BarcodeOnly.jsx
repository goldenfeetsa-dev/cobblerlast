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

// بطاقة ملصق واحدة — تُستخدم لكل قطعة على حدة (مو للطلب كامل) عشان
// كل قطعة فعلية تاخذ ملصقها المستقل القابل للمسح بدل ملصق واحد
// يغطّي الطلب كامل وتضيع بقية القطع.
function LabelCard({ barcodeValue, order, piece, pieceIndex, totalPieces }) {
  return (
    <div className="bcd-label bg-white flex flex-col items-center" dir="rtl"
      style={{ width: '189px', padding: '10px 8px', fontFamily: "'Tajawal', 'Arial', sans-serif" }}>

      {totalPieces > 1 && (
        <div style={{ fontSize: '10px', fontWeight: '900', color: '#000', marginBottom: '3px' }}>
          قطعة {pieceIndex + 1} / {totalPieces}
        </div>
      )}

      <BarcodeDisplay value={barcodeValue} width={130} height={36} />

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
          <span style={{ flex: 1, fontSize: '10px', fontWeight: '900', color: '#000', padding: '3px 4px', textAlign: 'center' }}>{ITEM_TYPE_LABELS[piece.item_type] || piece.item_type}</span>
        </div>
        {(piece.description) && (
          <div style={{ display: 'flex', borderBottom: '1px solid #000' }}>
            <span style={{ width: '38%', fontSize: '9px', fontWeight: '700', color: '#000', padding: '3px 4px', borderLeft: '1px solid #000', background: '#f3f3f3' }}>التصليح</span>
            <span style={{ flex: 1, fontSize: '9px', fontWeight: '700', color: '#000', padding: '3px 4px', textAlign: 'center', lineHeight: '1.3' }}>
              {(piece.description || '').slice(0, 60)}
            </span>
          </div>
        )}
        <div style={{ display: 'flex' }}>
          <span style={{ width: '38%', fontSize: '9px', fontWeight: '700', color: '#000', padding: '3px 4px', borderLeft: '1px solid #000', background: '#f3f3f3' }}>التسليم</span>
          <span style={{ flex: 1, fontSize: '11px', fontWeight: '900', color: '#000', padding: '3px 4px', textAlign: 'center' }} dir="ltr">
            {order.delivery_date ? format(new Date(order.delivery_date), 'd/M') : '—'}
          </span>
        </div>
      </div>
    </div>
  );
}

export default function BarcodeOnly() {
  const navigate = useNavigate();
  const containerRef = useRef(null);
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

  const handleDownload = async () => {
    if (!containerRef.current) return;
    const canvas = await html2canvas(containerRef.current, { scale: 3, backgroundColor: '#ffffff' });
    const link = document.createElement('a');
    link.download = `باركود-${order?.order_number || orderId}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  const handlePrint = async () => {
    if (!containerRef.current) return;
    // نفتح النافذة فوراً (بشكل متزامن، قبل أي await) — لو فتحناها بعد
    // انتظار html2canvas، بعض المتصفحات تعتبرها نافذة منبثقة غير موثوقة
    // (فقدت سياق "تفاعل المستخدم" الحقيقي) وتحجبها بصمت بدون أي خطأ ظاهر.
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.write('<p style="font-family:sans-serif;text-align:center;margin-top:40px;">جارٍ التجهيز...</p>');

    // نصوّر كل ملصق قطعة على حدة (مو الحاوية كلها دفعة وحدة) — عشان
    // كل قطعة تطبع بصفحة/ملصق مستقل فعلياً على مكينة الباركود، بدل
    // صورة واحدة طويلة فيها كل الملصقات ملزّقة ببعض.
    const labelEls = containerRef.current.querySelectorAll('.bcd-label');
    const images = [];
    for (const el of labelEls) {
      const canvas = await html2canvas(el, { scale: 3, backgroundColor: '#ffffff' });
      images.push(canvas.toDataURL('image/png'));
    }

    printWindow.document.open();
    printWindow.document.write(`
      <html>
      <head>
        <meta charset="utf-8"/>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { background: white; }
          .page { width: 50mm; display: flex; justify-content: center; align-items: center; page-break-after: always; }
          .page:last-child { page-break-after: auto; }
          img { width: 50mm; display: block; }
          @media print { @page { size: 50mm auto; margin: 0; } }
        </style>
      </head>
      <body>
        ${images.map((src) => `<div class="page"><img src="${src}" /></div>`).join('')}
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

      {pieces.length > 1 && (
        <p className="text-sm font-bold text-muted-foreground -mb-4">
          {pieces.length} قطع — كل وحدة بملصقها المستقل
        </p>
      )}

      {/* تذكرة الطلب — مصمّمة بشكل شبكي مرتب لمقاس 50مم (مكينة الباركود
          الفعلية). ملصق مستقل لكل قطعة، مرقّمة فرعياً (NT123-1, -2...) */}
      <div ref={containerRef} className="flex flex-wrap items-start justify-center gap-4">
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

      <div className="flex gap-3">
        <Button onClick={handlePrint} className="bg-primary hover:bg-primary/90">
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
