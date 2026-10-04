import React, { useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
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

  // طباعة تلقائية أول ما بيانات الطلب تجهز — مرة وحدة فقط.
  // (كان الكود السابق يلغي مؤقّته بنفسه: setAutoPrinted يعيد التصيير
  // فيشتغل cleanup الـeffect ويمسح الـsetTimeout قبل ما ينفّذ، فما كانت
  // الطباعة التلقائية تشتغل أبداً. الحين نستخدم ref بدون إلغاء.)
  const autoPrintedRef = useRef(false);
  useEffect(() => {
    if (order && !autoPrintedRef.current) {
      autoPrintedRef.current = true;
      setTimeout(() => window.print(), 600);
    }
  }, [order]);

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
        /* نسخة الطباعة: حاوية مستقلة مرتبطة مباشرة بـ body (portal) — تظهر
           بالطباعة فقط، وكل شي ثاني بالصفحة يختفي. بدون position:fixed
           (كان يقصّ كل الملصقات بعد الأول لأن العناصر الثابتة ما تتوزع
           على صفحات) — الحين كل ملصق يطلع على ورقة 50×100مم مستقلة. */
        #bcd-print-root { display: none; }
        @media print {
          body > *:not(#bcd-print-root) { display: none !important; }
          html, body { margin: 0 !important; padding: 0 !important; background: #fff !important; height: auto !important; overflow: visible !important; }
          #bcd-print-root { display: block !important; }
          #bcd-print-root .bcd-label {
            width: 50mm !important; height: 100mm !important; overflow: hidden;
            page-break-after: always; break-after: page; page-break-inside: avoid; break-inside: avoid;
          }
          #bcd-print-root .bcd-label:last-child { page-break-after: auto; break-after: auto; }
          .bcd-no-print { display: none !important; }
          @page { size: 50mm 100mm; margin: 0; }
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

      <div id="bcd-preview-area" ref={containerRef} className="flex flex-wrap items-start justify-center gap-4">
        {pieces.map((piece, i) => (
          <BarcodeLabel key={i} order={order} piece={piece} pieceIndex={i} totalPieces={pieces.length} />
        ))}
      </div>

      {/* نسخة الطباعة (مخفية بالشاشة) — ملصق لكل قطعة، كل واحد بصفحة مستقلة */}
      {createPortal(
        <div id="bcd-print-root">
          {pieces.map((piece, i) => (
            <BarcodeLabel key={i} order={order} piece={piece} pieceIndex={i} totalPieces={pieces.length} />
          ))}
        </div>,
        document.body
      )}

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
