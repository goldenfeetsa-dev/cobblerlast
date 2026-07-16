import React, { useRef, useEffect } from 'react';
import BarcodeDisplay from './BarcodeDisplay';
import { Button } from '@/components/ui/button';
import { Printer, Download } from 'lucide-react';
import { format } from 'date-fns';
import { base44 } from '@/api/supabaseApi';
import { useQuery } from '@tanstack/react-query';
import html2canvas from 'html2canvas';
import { QRCodeSVG } from 'qrcode.react';
import { buildZatcaTLV, validateVATNumber } from '@/lib/zatca/zatcaUtils';

const ITEM_LABELS = {
  shoes: 'أحذية', bag: 'حقيبة', dress: 'فستان', suit: 'بدلة',
  jacket: 'جاكيت', pants: 'بنطال', shirt: 'قميص', other: 'أخرى'
};

// autoPrint: إذا كانت true، تُفتح نافذة الطباعة تلقائياً بمجرد جاهزية الفاتورة
// (تُستخدم مباشرة بعد إصدار طلب/فاتورة جديدة، بدون أي ضغطة إضافية من الموظف)
export default function ReceiptView({ order, autoPrint = false }) {
  const receiptRef = useRef(null);
  const hasAutoPrinted = useRef(false);

  // فاتورة منتج (من نظام المبيعات) لها مصفوفة items، بخلاف فاتورة الإصلاح
  // التي تحتوي خدمة واحدة فقط — نفرّق بينهما لعرض الأصناف بشكل صحيح
  const isProductInvoice = Array.isArray(order.items) && order.items.length > 0;

  const { data: settingsList, isFetched: settingsFetched } = useQuery({
    queryKey: ['app-settings'],
    queryFn: () => base44.entities.AppSettings.list(), staleTime: 0,
    initialData: [],
  });
  const settings = settingsList[0] || {};
  const shopName = settings.shop_name || 'مؤسسة إبرة وخيط الإسكافي للتجارة';
  const logoUrl = settings.logo_url || '/images/logo-cobblers.png';
  const header = settings.receipt_header || 'خدمات التصليح والخياطة للأحذية والحقائب الجلدية';
  const footer = settings.receipt_footer || 'شكراً لثقتكم بنا — نسعد بخدمتكم دائماً';
  const terms = settings.terms_conditions || '';
  const vatNumber = settings.vat_number || '314151483700003';
  const crNumber = settings.cr_number || '7051288830';
  const vatEnabled = settings.vat_enabled !== false;
  // رقم ضريبي سعودي صحيح: 15 رقم، يبدأ وينتهي بـ 3 — إذا فشل هذا الشرط
  // (فاضي أو خاطئ) فسيولّد الكود أدناه رقم "000000000000000" داخل QR،
  // وهذا بالضبط سبب رفض تطبيق زاتكا للفاتورة. نعرض تنبيهاً للموظف هنا
  // (لا يظهر عند الطباعة) بدل ما يكتشفه العميل بنفسه بعد المسح.
  const vatNumberValid = validateVATNumber(vatNumber);

  const subtotal = order.subtotal || (vatEnabled ? parseFloat((order.total_price / 1.15).toFixed(2)) : order.total_price);
  const vatAmount = order.vat_amount || (vatEnabled ? parseFloat((order.total_price - subtotal).toFixed(2)) : 0);
  const createdDate = order.created_at ? new Date(order.created_at) : new Date();

  // Use order's stored ZATCA QR if available (Phase 2 cleared), else build Phase 1 TLV
  const zatcaQR = order.zatca_qr || buildZatcaTLV({
    sellerName: shopName,
    vatNumber,
    invoiceDate: createdDate,
    totalAmount: order.total_price ?? 0,
    vatAmount: vatAmount ?? 0,
  });

  const handleDownload = async () => {
    if (!receiptRef.current) return;
    const canvas = await html2canvas(receiptRef.current, { scale: 3, backgroundColor: '#ffffff', useCORS: true });
    const link = document.createElement('a');
    link.download = `فاتورة-${order.order_number || order.invoice_number}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  // طباعة مباشرة عبر نافذة الطباعة الأصلية للمتصفح (window.print) بدل فتح
  // نافذة/تبويب جديد — هذا يتفادى مانع النوافذ المنبثقة (popup blocker) الذي
  // يمنع فتح نوافذ جديدة تلقائياً، ويسمح بتفعيل "الطباعة الفورية" مباشرة
  // بعد إنشاء الطلب/الفاتورة دون أي ضغطة إضافية من الموظف.
  const handlePrint = () => {
    window.print();
  };

  // الطباعة الفورية — تُفعَّل تلقائياً مرة واحدة فقط عند فتح الفاتورة بعد
  // إنشائها مباشرة (autoPrint=true)، بعد تأخير بسيط لضمان تحميل الشعار والصور
  useEffect(() => {
    if (!autoPrint || hasAutoPrinted.current || !settingsFetched) return;
    hasAutoPrinted.current = true;
    const timer = setTimeout(() => window.print(), 550);
    return () => clearTimeout(timer);
  }, [autoPrint, settingsFetched]);

  const Divider = ({ dashed = true }) => (
    <div style={{ borderTop: dashed ? '1px dashed #d1d5db' : '2px solid #111', margin: '10px 0' }} />
  );

  const Row = ({ label, value, bold = false, large = false }) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3px' }}>
      <span style={{ color: '#6b7280', fontSize: large ? '12px' : '10px' }}>{label}</span>
      <span style={{ fontWeight: bold ? 'bold' : 'normal', fontSize: large ? '13px' : '10px', color: '#111' }}>{value}</span>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* أنماط خاصة بالطباعة فقط — تُظهر الفاتورة وتُخفي كل شيء آخر بالصفحة */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #pos-receipt-print, #pos-receipt-print * { visibility: visible; }
          #pos-receipt-print { position: fixed; inset: 0; width: 80mm; margin: 0 auto; box-shadow: none !important; }
          .receipt-no-print { display: none !important; }
          @page { size: 80mm auto; margin: 0; }
        }
      `}</style>

      {/* تنبيه للموظف فقط — لا يظهر أبداً على الفاتورة المطبوعة أو المُنزّلة */}
      {vatEnabled && !vatNumberValid && (
        <div
          className="receipt-no-print"
          style={{
            maxWidth: '320px', margin: '0 auto', padding: '10px 14px',
            background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px',
            color: '#991b1b', fontSize: '12px', textAlign: 'center', lineHeight: '1.6',
          }}
        >
          الرقم الضريبي غير مُدخل أو غير صحيح — سيظهر في رمز QR كـ 000000000000000
          وسيُرفض من تطبيق زاتكا. الرجاء تعبئة الرقم الضريبي الصحيح (15 رقم، يبدأ وينتهي بـ 3)
          من صفحة الإعدادات قبل الطباعة.
        </div>
      )}

      {/* Receipt */}
      <div
        id="pos-receipt-print"
        ref={receiptRef}
        style={{
          background: '#ffffff',
          color: '#111111',
          padding: '20px 16px',
          borderRadius: '12px',
          maxWidth: '320px',
          margin: '0 auto',
          fontFamily: "'Tajawal', 'Arial', sans-serif",
          direction: 'rtl',
          boxShadow: '0 0 0 1px #e5e7eb',
        }}
      >
        {/* ── TOP HEADER ── */}
        <div style={{ textAlign: 'center', marginBottom: '10px' }}>
          {logoUrl && (
            <img src={logoUrl} alt="logo" crossOrigin="anonymous"
              style={{ height: '60px', margin: '0 auto 8px', objectFit: 'contain', display: 'block' }} />
          )}
          <div style={{ fontSize: '15px', fontWeight: '900', letterSpacing: '0.5px' }}>
            {shopName}
          </div>
          {header && (
            <div style={{ fontSize: '9px', color: '#6b7280', marginTop: '2px' }}>{header}</div>
          )}

          {/* ZATCA required fields — نعرضها بالعربي والإنجليزي معاً، وهذا هو
              الشكل المعتمد في أغلب الفواتير الضريبية المبسّطة بالسعودية */}
          <div style={{ marginTop: '6px', fontSize: '9px', color: '#374151', lineHeight: '1.7' }}>
            {crNumber && (
              <div>
                <span>السجل التجاري / CR No: </span>
                <span style={{ fontWeight: 'bold', direction: 'ltr', display: 'inline-block' }}>{crNumber}</span>
              </div>
            )}
            <div>
              <span>الرقم الضريبي / VAT No: </span>
              <span style={{ fontWeight: 'bold', direction: 'ltr', display: 'inline-block' }}>
                {vatNumber || '—'}
              </span>
            </div>
          </div>

          {vatEnabled && (
            <div style={{
              display: 'inline-block',
              marginTop: '6px',
              padding: '2px 10px',
              border: '1px solid #111',
              borderRadius: '4px',
              fontSize: '9px',
              fontWeight: 'bold',
              letterSpacing: '0.5px',
            }}>
              فاتورة ضريبية {order.is_b2b ? '(شركات)' : 'مبسطة'} — {order.is_b2b ? 'Tax Invoice (B2B)' : 'Simplified Tax Invoice'}
            </div>
          )}
        </div>

        <Divider />

        {/* ── ORDER INFO ── */}
        <div style={{ marginBottom: '2px' }}>
          <Row label="رقم الفاتورة / Invoice No" value={order.order_number || order.invoice_number} bold />
          <Row label="نوع الفاتورة" value={isProductInvoice ? 'بيع منتج' : 'خدمة إصلاح'} />
          <Row label="التاريخ والوقت / Date & Time" value={`${format(createdDate, 'dd/MM/yyyy')} — ${format(createdDate, 'HH:mm:ss')}`} />
          <Row label="الموظف" value={order.employee_name || '—'} />
          {order.branch_name && <Row label="الفرع" value={order.branch_name} />}
        </div>

        <Divider />

        {/* ── CUSTOMER ── */}
        <div style={{ fontSize: '9px', fontWeight: 'bold', color: '#6b7280', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          بيانات العميل
        </div>
        <div>
          <Row label="الاسم" value={order.customer_name} bold />
          {order.customer_phone && <Row label="الجوال" value={order.customer_phone} />}
        </div>

        {/* ── B2B BUYER (فاتورة شركة) ── */}
        {order.is_b2b && (
          <>
            <div style={{
              marginTop: '6px', padding: '6px 8px', borderRadius: '6px',
              background: '#f3f4f6', border: '1px dashed #9ca3af',
            }}>
              <div style={{ fontSize: '9px', fontWeight: 'bold', color: '#374151', marginBottom: '3px' }}>
                فاتورة صادرة لمنشأة / Tax Invoice for a Business (B2B)
              </div>
              <Row label="اسم الشركة" value={order.buyer_company_name || '—'} bold />
              <Row label="الرقم الضريبي للمشتري" value={order.buyer_vat_number || '—'} />
              {order.buyer_cr_number && <Row label="السجل التجاري للمشتري" value={order.buyer_cr_number} />}
              {order.buyer_address && <Row label="عنوان الشركة" value={order.buyer_address} />}
            </div>
          </>
        )}

        <Divider />

        {/* ── ITEMS ── */}
        <div style={{ fontSize: '9px', fontWeight: 'bold', color: '#6b7280', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          {isProductInvoice ? 'الأصناف المباعة' : 'تفاصيل الخدمة'}
        </div>

        {/* Table header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', fontWeight: 'bold', borderBottom: '1px solid #e5e7eb', paddingBottom: '3px', marginBottom: '4px' }}>
          <span style={{ flex: 3 }}>الصنف / الخدمة</span>
          <span style={{ flex: 1, textAlign: 'center' }}>الكمية</span>
          <span style={{ flex: 2, textAlign: 'left' }}>السعر</span>
        </div>

        {isProductInvoice ? (
          // فاتورة منتج — عدة أصناف
          order.items.map((line, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', marginBottom: '4px' }}>
              <span style={{ flex: 3 }}>{line.item_name}</span>
              <span style={{ flex: 1, textAlign: 'center' }}>{line.qty}</span>
              <span style={{ flex: 2, textAlign: 'left' }}>{(line.sell_price * line.qty).toFixed(2)} ر.س</span>
            </div>
          ))
        ) : (
          // فاتورة خدمة إصلاح — صنف واحد
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', marginBottom: '4px' }}>
            <span style={{ flex: 3 }}>{ITEM_LABELS[order.item_type] || order.item_type}</span>
            <span style={{ flex: 1, textAlign: 'center' }}>{order.quantity || 1}</span>
            <span style={{ flex: 2, textAlign: 'left' }}>{subtotal?.toFixed(2)} ر.س</span>
          </div>
        )}

        {/* Delivery fee if any */}
        {order.delivery_method === 'delivery' && (
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', marginBottom: '4px' }}>
            <span style={{ flex: 3 }}>رسوم التوصيل</span>
            <span style={{ flex: 1, textAlign: 'center' }}>1</span>
            <span style={{ flex: 2, textAlign: 'left' }}>—</span>
          </div>
        )}

        {/* Photos */}
        {order.photos && order.photos.length > 0 && (
          <div style={{ display: 'flex', gap: '4px', marginTop: '6px', flexWrap: 'wrap', justifyContent: 'center' }}>
            {order.photos.map((url, i) => (
              <img key={i} src={url} alt="" crossOrigin="anonymous"
                style={{ width: '52px', height: '52px', objectFit: 'cover', borderRadius: '6px', border: '1px solid #e5e7eb' }} />
            ))}
          </div>
        )}

        <Divider />

        {/* ── TOTALS ── */}
        <div>
          {vatEnabled ? (
            <>
              <Row label="المجموع قبل الضريبة" value={`${subtotal?.toFixed(2)} ر.س`} />
              <Row label="ضريبة القيمة المضافة (15%)" value={`${vatAmount?.toFixed(2)} ر.س`} />
            </>
          ) : (
            <Row label="المجموع" value={`${order.total_price?.toFixed(2)} ر.س`} />
          )}
        </div>

        {/* Grand total */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          background: '#111', color: '#fff', borderRadius: '6px',
          padding: '6px 10px', marginTop: '6px', fontSize: '13px', fontWeight: 'bold'
        }}>
          <span>الإجمالي شامل الضريبة</span>
          <span style={{ direction: 'ltr' }}>{order.total_price?.toFixed(2)} ر.س</span>
        </div>

        {/* Payment */}
        <div style={{ marginTop: '6px' }}>
          <Row
            label="حالة الدفع"
            value={order.payment_status === 'paid' ? 'مدفوع' : 'غير مدفوع'}
          />
          {order.payment_method && (
            <Row
              label="طريقة الدفع"
              value={order.payment_method === 'cash' ? 'نقد' : order.payment_method === 'network' ? 'شبكة / بطاقة' : order.payment_method}
            />
          )}
          <Row
            label="التسليم"
            value={order.delivery_method === 'delivery' ? 'توصيل' : 'استلام من المحل'}
          />
        </div>

        {order.notes && (
          <>
            <Divider />
            <div style={{ fontSize: '9px', color: '#374151' }}>
              <span style={{ fontWeight: 'bold' }}>ملاحظات: </span>{order.notes}
            </div>
          </>
        )}

        <Divider />

        {/* ── BARCODE ── */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '8px' }}>
          <div style={{ fontSize: '8px', color: '#9ca3af', marginBottom: '4px' }}>باركود الطلب</div>
          <BarcodeDisplay value={order.order_number} width={230} height={45} />
          <div style={{ fontSize: '9px', color: '#374151', marginTop: '2px', fontWeight: 'bold', letterSpacing: '1px' }}>
            {order.order_number}
          </div>
        </div>

        {/* ── ZATCA QR ── */}
        {vatEnabled && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: '4px' }}>
            <div style={{ fontSize: '8px', color: '#9ca3af', marginBottom: '4px' }}>
              رمز QR — التحقق من الفاتورة (ZATCA)
            </div>
            <QRCodeSVG value={zatcaQR} size={96} bgColor="#ffffff" fgColor="#000000" level="M" />
            {/* ZATCA submission status */}
            {order.zatca_status && (
              <div style={{
                marginTop: '4px',
                display: 'flex',
                alignItems: 'center',
                gap: '3px',
                fontSize: '7px',
                padding: '2px 6px',
                borderRadius: '99px',
                background: order.zatca_status === 'REPORTED' || order.zatca_status === 'CLEARED'
                  ? '#dcfce7' : order.zatca_status === 'REJECTED' ? '#fee2e2' : '#fef9c3',
                color: order.zatca_status === 'REPORTED' || order.zatca_status === 'CLEARED'
                  ? '#15803d' : order.zatca_status === 'REJECTED' ? '#b91c1c' : '#92400e',
              }}>
                {order.zatca_status === 'REPORTED' || order.zatca_status === 'CLEARED'
                  ? 'معتمدة من زاتكا'
                  : order.zatca_status === 'REJECTED'
                    ? 'مرفوضة من زاتكا'
                    : 'بانتظار الإرسال'}
              </div>
            )}
            <div style={{ fontSize: '7px', color: '#9ca3af', marginTop: '3px', textAlign: 'center', maxWidth: '200px', lineHeight: '1.4' }}>
              امسح الرمز للتحقق من صحة الفاتورة الضريبية وفق متطلبات هيئة الزكاة والضريبة والجمارك
            </div>
          </div>
        )}

        {terms && (
          <>
            <Divider />
            <div style={{ fontSize: '8px', color: '#9ca3af', textAlign: 'center', lineHeight: '1.5' }}>{terms}</div>
          </>
        )}

        {/* Footer */}
        <Divider dashed={false} />
        <div style={{ textAlign: 'center', fontSize: '9px', color: '#6b7280', lineHeight: '1.6' }}>
          <div style={{ fontWeight: 'bold' }}>{footer}</div>
          <div style={{ marginTop: '2px', color: '#9ca3af', fontSize: '8px' }}>
            تم الإصدار بتاريخ: {format(createdDate, 'dd/MM/yyyy HH:mm')}
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex justify-center gap-3 receipt-no-print">
        <Button onClick={handlePrint} className="bg-primary hover:bg-primary/90">
          <Printer className="w-4 h-4 ml-2" />
          طباعة
        </Button>
        <Button onClick={handleDownload} variant="outline">
          <Download className="w-4 h-4 ml-2" />
          تنزيل صورة
        </Button>
      </div>
    </div>
  );
}