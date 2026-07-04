import React from 'react';
import { Outlet, Navigate, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import OrderNotifications from './OrderNotifications';
import { getSession } from '@/lib/sessionStore';

const ADMIN_ROLES  = ['admin', 'owner', 'manager', 'accountant'];
const STAFF_ROLES  = ['staff', 'cashier'];

// صفحات مسموحة للعامل فقط
const STAFF_ALLOWED = ['/staff', '/scan', '/orders'];

export default function AppLayout() {
  const session  = getSession();
  const location = useLocation();

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
