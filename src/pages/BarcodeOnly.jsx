import React, { useRef, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '@/api/supabaseApi';
import { useQuery } from '@tanstack/react-query';
import BarcodeLabel, { getOrderPieces } from '@/components/pos/BarcodeLabel';
import { Button } from '@/components/ui/button';
import { ArrowRight, Printer, Download, PackageSearch } from 'lucide-react';
import html2canvas from 'html2canvas';

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
  const pieces = getOrderPieces(order);

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
          .bcd-label { page-break-after: always; width: 50mm !important; height: auto !important; }
          .bcd-label:last-child { page-break-after: auto; }
          @page { size: 50mm auto; margin: 0; }
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
          <BarcodeLabel key={i} order={order} piece={piece} pieceIndex={i} totalPieces={pieces.length} />
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
