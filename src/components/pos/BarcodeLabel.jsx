import React from 'react';
import { format } from 'date-fns';
import BarcodeDisplay from './BarcodeDisplay';

// تسميات الأصناف — نفس المستخدم بصفحة إنشاء الطلب
export const ITEM_TYPE_LABELS = {
  shoes: 'أحذية', bag: 'حقيبة', dress: 'فستان', suit: 'بدلة',
  jacket: 'جاكيت', pants: 'بنطال', shirt: 'قميص', other: 'أخرى',
};

// قطع الطلب: لو فيه order_items نستخدمها (ملصق لكل قطعة)، وإلا نرجع
// قطعة وحدة من بيانات الطلب العامة (طلبات قديمة بدون order_items)
export function getOrderPieces(order) {
  if (!order) return [];
  if (Array.isArray(order.order_items) && order.order_items.length > 0) return order.order_items;
  return [{ item_type: order.item_type, services: [], description: order.description || order.notes || '' }];
}

// نص التصليح للقطعة: خدماتها المختارة + ملاحظاتها
export function pieceRepairText(piece) {
  const services = Array.isArray(piece.services) ? piece.services.join('، ') : '';
  const note = (piece.description || '').trim();
  return [services, note].filter(Boolean).join(' — ');
}

/**
 * ملصق باركود لقطعة وحدة — مصمَّم لورق 50×100 مم بالضبط.
 * مصمَّم للطابعات الحرارية: أسود نقي على أبيض (بدون رمادي أو تعبئة
 * لأنها تطلع منقّطة/باهتة)، خطوط عريضة وكبيرة، وحدود واضحة.
 * الجدول يمتد لآخر الملصق: صف التصليح يتمدد ياخذ المساحة المتبقية.
 */
const LINE = '1.5px solid #000';
const lbl = { width: '37%', fontSize: '10.5px', fontWeight: 800, color: '#000', padding: '0 2px', borderLeft: LINE, display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center' };
const val = { flex: 1, fontSize: '13px', fontWeight: 900, color: '#000', padding: '4px 5px', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', lineHeight: 1.25, overflowWrap: 'anywhere' };
const rowBase = { display: 'flex', borderBottom: LINE, minHeight: '30px' };

export default function BarcodeLabel({ order, piece, pieceIndex = 0, totalPieces = 1 }) {
  const barcodeValue = totalPieces > 1 ? `${order.order_number}-${pieceIndex + 1}` : order.order_number;
  const repair = pieceRepairText(piece).slice(0, 150);

  return (
    <div className="bcd-label" dir="rtl"
      style={{
        width: '50mm', height: '100mm', boxSizing: 'border-box', padding: '9px 8px',
        background: '#fff', color: '#000', overflow: 'hidden',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        fontFamily: "'Almarai', 'Tajawal', 'Arial', sans-serif",
      }}>

      <div style={{ fontSize: '14px', fontWeight: 900, letterSpacing: '0.2px', lineHeight: 1.2 }}>إبرة وخيط الإسكافي</div>

      {totalPieces > 1 && (
        <div style={{ marginTop: '4px', fontSize: '12px', fontWeight: 900, border: LINE, borderRadius: '4px', padding: '1px 12px' }}>
          قطعة {pieceIndex + 1} / {totalPieces}
        </div>
      )}

      <div style={{ marginTop: '8px' }}>
        <BarcodeDisplay value={barcodeValue} width={170} height={60} showValue={false} />
      </div>
      <div dir="ltr" style={{ marginTop: '3px', marginBottom: '8px', fontSize: '14px', fontWeight: 900, letterSpacing: '1px', fontFamily: "'Courier New', monospace" }}>
        {barcodeValue}
      </div>

      {/* الجدول يمتد لآخر الملصق */}
      <div style={{ width: '100%', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', border: LINE, borderRadius: '6px', overflow: 'hidden' }}>
        <div style={rowBase}><span style={lbl}>العميل</span><span style={val}>{order.customer_name}</span></div>
        <div style={rowBase}><span style={lbl}>رقم العميل</span><span style={val} dir="ltr">{order.customer_phone || '—'}</span></div>
        <div style={rowBase}><span style={lbl}>نوع القطعة</span><span style={val}>{ITEM_TYPE_LABELS[piece.item_type] || piece.item_type || '—'}</span></div>
        <div style={{ ...rowBase, flex: 1, minHeight: 0 }}>
          <span style={lbl}>التصليح</span>
          <span style={{ ...val, fontSize: '11px', fontWeight: 800, lineHeight: 1.35 }}>{repair || '—'}</span>
        </div>
        <div style={{ ...rowBase, borderBottom: 'none', minHeight: '38px' }}>
          <span style={lbl}>التسليم</span>
          <span style={{ ...val, fontSize: '20px' }} dir="ltr">{order.delivery_date ? format(new Date(order.delivery_date), 'd/M') : '—'}</span>
        </div>
      </div>
    </div>
  );
}
