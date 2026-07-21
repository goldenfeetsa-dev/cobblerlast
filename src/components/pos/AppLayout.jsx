import React from 'react';
import { Outlet, Navigate, useLocation, useNavigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import OrderNotifications from './OrderNotifications';
import RealtimeSync from './RealtimeSync';
import { getSession } from '@/lib/sessionStore';
import { useGlobalBarcodeScanner } from '@/hooks/useGlobalBarcodeScanner';
import { db } from '@/api/supabaseApi';
import { toast } from 'sonner';
import {
  isFullAdmin, isFinanceUser, isCashier, isWorker,
  getHomePath, WORKER_ALLOWED_PREFIXES, CASHIER_DENIED_PREFIXES,
} from '@/lib/roles';

export default function AppLayout() {
  const session  = getSession();
  const location = useLocation();
  const navigate = useNavigate();

  // قارئ الباركود يعمل من أي شاشة داخل نقطة البيع (بما فيها "طلب جديد")
  // بدون الحاجة للذهاب لصفحة "مسح الباركود" — بمجرد مسح أي كود يفتح الطلب مباشرة
  useGlobalBarcodeScanner(async (code) => {
    try {
      const matches = await db.Order.filter({ order_number: code }, '-created_at', 1);
      if (matches?.[0]) {
        toast.success(`📦 فُتح الطلب ${code}`);
        navigate(`/orders/${matches[0].id}`);
      } else {
        toast.error(`لا يوجد طلب بالرقم ${code}`);
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
    <div className="min-h-screen bg-background">
      <RealtimeSync />
      <OrderNotifications />
      <Sidebar />
      <main className="lg:mr-64 min-h-screen pt-14 lg:pt-0">
        <div className="p-4 sm:p-6 lg:p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
