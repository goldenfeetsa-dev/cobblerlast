import { useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { MessageCircle } from 'lucide-react';

// نفس queryKey المستخدم بـ useSiteData داخل BookingLanding.jsx —
// react-query يدمج الطلبين تلقائياً (نفس الكاش)، فما يصير طلب شبكة إضافي.
function useWhatsappNumber() {
  const { data } = useQuery({
    queryKey: ['site-data-public'],
    queryFn: async () => {
      const res = await fetch('/api/public/site-data');
      if (!res.ok) throw new Error('site_data_failed');
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
    retry: 2,
  });
  return data?.settings?.social_whatsapp || '966549678191';
}

// الصفحات العامة (زوار/عملاء) فقط — عمداً قائمة بيضاء صريحة بدل استثناء
// مسارات الإدارة، عشان أي صفحة إدارية جديدة تُضاف مستقبلاً ما تظهر فيها
// الأداة بالخطأ لو نسينا نستثنيها.
const PUBLIC_PATHS = [
  '/', '/booking', '/book', '/my-bookings', '/my-loyalty',
  '/reviews', '/shop', '/repair-policy', '/about', '/privacy', '/shipping-policy',
];

export default function FloatingWhatsApp() {
  const location = useLocation();
  const whatsapp = useWhatsappNumber();

  const isPublicPage =
    PUBLIC_PATHS.includes(location.pathname) || location.pathname.startsWith('/barcode/');

  if (!isPublicPage) return null;

  return (
    <a
      href={`https://wa.me/${whatsapp}?text=${encodeURIComponent('مرحباً، أبي أتواصل معكم بخصوص طلب/استفسار 🙏')}`}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="تواصل معنا عبر واتساب"
      className="fixed z-50 flex items-center justify-center w-14 h-14 rounded-full shadow-lg transition-transform hover:scale-110"
      style={{
        bottom: '24px',
        insetInlineEnd: '20px', // "end" بدل right — يوقف بجهة اليد الطبيعية بغض النظر عن اتجاه اللغة (ar/en)
        background: '#25D366',
        boxShadow: '0 6px 20px rgba(37,211,102,0.45)',
      }}
    >
      <MessageCircle className="w-7 h-7 text-white" fill="white" strokeWidth={0} />
    </a>
  );
}
