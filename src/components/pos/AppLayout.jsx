import React from 'react';
import { Outlet, Navigate, useLocation, useNavigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import OrderNotifications from './OrderNotifications';
import { getSession } from '@/lib/sessionStore';
import { useGlobalBarcodeScanner } from '@/hooks/useGlobalBarcodeScanner';
import { base44 } from '@/api/supabaseApi';
import { toast } from 'sonner';

const ADMIN_ROLES  = ['admin', 'owner', 'manager', 'accountant'];
const STAFF_ROLES  = ['staff', 'cashier'];

// صفحات مسموحة للعامل فقط
const STAFF_ALLOWED = ['/staff', '/scan', '/orders'];

export default function AppLayout() {
  const session  = getSession();
  const location = useLocation();
  const navigate = useNavigate();

  // قارئ الباركود يعمل من أي شاشة داخل نقطة البيع (بما فيها "طلب جديد")
  // بدون الحاجة للذهاب لصفحة "مسح الباركود" — بمجرد مسح أي كود يفتح الطلب مباشرة
  useGlobalBarcodeScanner(async (code) => {
    try {
      const matches = await base44.entities.Order.filter({ order_number: code }, '-created_at', 1);
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

  const isAdmin = ADMIN_ROLES.includes(session.role);
  const isStaff = STAFF_ROLES.includes(session.role);

  // العامل يُحوَّل لصفحته إذا حاول فتح صفحة إدارة
  if (isStaff && !STAFF_ALLOWED.some(p => location.pathname.startsWith(p))) {
    return <Navigate to="/staff" replace />;
  }

  return (
    <div className="min-h-screen bg-background">
      <OrderNotifications />
      <Sidebar />
      <main className="lg:ml-64 min-h-screen pt-14 lg:pt-0">
        <div className="p-4 sm:p-6 lg:p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
