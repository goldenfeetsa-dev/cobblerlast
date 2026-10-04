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

const labelCell = { width: '38%', fontSize: '9px', fontWeight: 700, color: '#000', padding: '3px 4px', borderLeft: '1px solid #000', background: '#f3f3f3' };
const valueCell = { flex: 1, fontSize: '10px', fontWeight: 900, color: '#000', padding: '3px 4px', textAlign: 'center' };

/**
 * ملصق باركود لقطعة وحدة — جدول: العميل / رقم العميل / نوع القطعة /
 * التصليح / التسليم. يُستخدم بصفحة طباعة الباركود وبتبويب
 * "الفاتورة والباركود" بصفحة الطلب (نفس التصميم بالضبط بالمكانين).
 */
export default function BarcodeLabel({ order, piece, pieceIndex = 0, totalPieces = 1 }) {
  const barcodeValue = totalPieces > 1 ? `${order.order_number}-${pieceIndex + 1}` : order.order_number;
  const repair = pieceRepairText(piece);

  return (
    <div className="bcd-label bg-white flex flex-col items-center" dir="rtl"
      style={{ width: '189px', padding: '10px 8px', boxSizing: 'border-box', fontFamily: "'Tajawal', 'Arial', sans-serif" }}>

      {totalPieces > 1 && (
        <div style={{ fontSize: '10px', fontWeight: 900, color: '#000', marginBottom: '3px' }}>
          قطعة {pieceIndex + 1} / {totalPieces}
        </div>
      )}

      {/* BarcodeDisplay يطبع رقم الباركود تحته تلقائياً */}
      <BarcodeDisplay value={barcodeValue} width={130} height={36} />

      <div style={{ width: '100%', marginTop: '6px', border: '1px solid #000', borderRadius: '4px', overflow: 'hidden' }}>
        <div style={{ display: 'flex', borderBottom: '1px solid #000' }}>
          <span style={labelCell}>العميل</span>
          <span style={valueCell}>{order.customer_name}</span>
        </div>
        <div style={{ display: 'flex', borderBottom: '1px solid #000' }}>
          <span style={labelCell}>رقم العميل</span>
          <span style={valueCell} dir="ltr">{order.customer_phone || '—'}</span>
        </div>
        <div style={{ display: 'flex', borderBottom: '1px solid #000' }}>
          <span style={labelCell}>نوع القطعة</span>
          <span style={valueCell}>{ITEM_TYPE_LABELS[piece.item_type] || piece.item_type || '—'}</span>
        </div>
        {repair && (
          <div style={{ display: 'flex', borderBottom: '1px solid #000' }}>
            <span style={labelCell}>التصليح</span>
            <span style={{ ...valueCell, fontSize: '9px', fontWeight: 700, lineHeight: 1.35 }}>{repair.slice(0, 120)}</span>
          </div>
        )}
        <div style={{ display: 'flex' }}>
          <span style={labelCell}>التسليم</span>
          <span style={{ ...valueCell, fontSize: '11px' }} dir="ltr">
            {order.delivery_date ? format(new Date(order.delivery_date), 'd/M') : '—'}
          </span>
        </div>
      </div>
    </div>
  );
}
