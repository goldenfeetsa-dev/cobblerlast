import { Helmet } from 'react-helmet-async';
import React, { useEffect } from 'react';
import { openCustomerDisplay } from '@/lib/customerDisplay';
import { Outlet, Navigate, useLocation, useNavigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import OrderNotifications from './OrderNotifications';
import RealtimeSync from './RealtimeSync';
import { getSession } from '@/lib/sessionStore';
import { useGlobalBarcodeScanner } from '@/hooks/useGlobalBarcodeScanner';
import { db } from '@/api/supabaseApi';
import { toast } from 'sonner';
import { isCashier, isWorker, WORKER_ALLOWED_PREFIXES, CASHIER_DENIED_PREFIXES,
} from '@/lib/roles';

export default function AppLayout() {
  const session  = getSession();
  const location = useLocation();
  const navigate = useNavigate();

  // الهوية الرسمية لنظام الكاشير (html.pos) — تُزال عند مغادرة النظام
  useEffect(() => {
    document.documentElement.classList.add('pos');
    return () => document.documentElement.classList.remove('pos');
  }, []);

  // قارئ الباركود يعمل من أي شاشة داخل نقطة البيع (بما فيها "طلب جديد")
  // بدون الحاجة للذهاب لصفحة "مسح الباركود" — بمجرد مسح أي كود يفتح الطلب مباشرة
  useGlobalBarcodeScanner(async (code) => {
    // الباركود ممكن يكون لقطعة مفردة برقم فرعي (NT123-2) — نشيله قبل
    // البحث عشان يلقى الطلب الأصلي بغض النظر عن أي قطعة تحديداً انمسحت
    const baseCode = code.replace(/-\d+$/, '');
    try {
      const matches = await db.Order.filter({ order_number: baseCode }, '-created_at', 1);
      if (matches?.[0]) {
        toast.success(`📦 فُتح الطلب ${baseCode}`);
        navigate(`/orders/${matches[0].id}`);
      } else {
        toast.error(`لا يوجد طلب بالرقم ${baseCode}`);
      }
    } catch {
      toast.error('تعذّر البحث عن الباركود، تحقق من الاتصال');
    }
  }, { enabled: !!session });

  // غير مسجّل → login
  if (!session) return <Navigate to="/login" replace />;

  // ── العامل (staff): يُحوَّل لصفحة مهامه فقط إذا حاول فتح صفحة إدارية ──
  if (isWorker(session.role) && !WORKER_ALLOWED_PREFIXES.some(p => location.pathname.startsWith(p))) {
    return <Navigate to="/staff" replace />;
  }

  // ── الكاشير: له كل صفحات التشغيل اليومي (طلب جديد، طلبات، عملاء، مبيعات...)
  //    وممنوع فقط من صفحات الإدارة/التقارير/الإعدادات ──
  if (isCashier(session.role) && CASHIER_DENIED_PREFIXES.some(p => location.pathname.startsWith(p))) {
    return <Navigate to="/new-order" replace />;
  }

  return (
    <div className="min-h-screen pos-shell">
      <Helmet>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      <RealtimeSync />
      <OrderNotifications />
      <button type="button" onClick={openCustomerDisplay} className="fixed bottom-4 left-4 z-40 px-3 h-9 rounded-full text-xs font-bold shadow-lg" style={{ background: '#0b0b0c', color: '#ece8df', border: '1px solid rgba(201,168,76,.6)' }} title="افتح شاشة العميل ثم اسحبها للشاشة الثانية">شاشة العميل</button>
      <Sidebar />
      <main className="lg:mr-64 min-h-screen pt-14 lg:pt-0">
        <div className="p-4 sm:p-6 lg:p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
