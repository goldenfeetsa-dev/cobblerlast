import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import { useEffect, lazy, Suspense } from 'react';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import { runPhotoCleanup } from '@/lib/photoCleanup';

import GeminiAssistant from './components/ai/GeminiAssistant';
import ZATCASettings from './pages/ZATCASettings';
import AboutUs from './pages/AboutUs';
import PrivacyPolicy from './pages/PrivacyPolicy';
import ShippingPolicy from './pages/ShippingPolicy';
import SocialSettings from './pages/SocialSettings';
import LoyaltyDashboard from './pages/LoyaltyDashboard';
import PinLogin from './pages/PinLogin';
import Dashboard from './pages/Dashboard';
import NewOrder from './pages/NewOrder';
import Orders from './pages/Orders';
import OrderDetails from './pages/OrderDetails';
import ScanBarcode from './pages/ScanBarcode';
import Customers from './pages/Customers';
import Employees from './pages/Employees';
import Leaderboard from './pages/Leaderboard';
import AppLayout from './components/pos/AppLayout';
import Settings from './pages/Settings';
import BarcodeOnly from './pages/BarcodeOnly';
import BookingLanding from './pages/BookingLanding';
import BookingWizard from './pages/BookingWizard';
import MyBookings from './pages/MyBookings';
import BookingAdmin from './pages/BookingAdmin';
import ServicesAdmin from './pages/ServicesAdmin';
import WorkingHoursAdmin from './pages/WorkingHoursAdmin';
import BranchesAdmin from './pages/BranchesAdmin';
import AuditLog from './pages/AuditLog';
import SiteAnalytics from './pages/SiteAnalytics';
import Reviews from './pages/Reviews';
import ReviewsAdmin from './pages/ReviewsAdmin';
import BrandsAdmin from './pages/BrandsAdmin';
import Shop from './pages/Shop';
import ShopAdmin from './pages/ShopAdmin';
import RepairPolicy from './pages/RepairPolicy';
import OperationsDashboard from './pages/OperationsDashboard';
import SalesSystem from './pages/SalesSystem';
import WorkshopSystem from './pages/WorkshopSystem';

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  // تنظيف صور الطلبات المكتملة بعد أسبوعين — يعمل مرة يومياً
  useEffect(() => { runPhotoCleanup(); }, []);

  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      navigateToLogin();
      return null;
    }
  }

  return (
    <>
      <Routes>
        {/* /login مخفية — لا تظهر في أي رابط، تدخل بكتابتها يدوياً */}
        <Route path="/login" element={<PinLogin />} />

        {/* الصفحة الرئيسية = صفحة الحجز */}
        <Route path="/" element={<BookingLanding />} />
        <Route path="/booking" element={<BookingLanding />} />

        {/* Public pages */}
        <Route path="/book" element={<BookingWizard />} />
        <Route path="/my-bookings" element={<MyBookings />} />
        <Route path="/reviews" element={<Reviews />} />
        <Route path="/shop" element={<Shop />} />
        <Route path="/repair-policy" element={<RepairPolicy />} />
        <Route path="/about" element={<AboutUs />} />
        <Route path="/privacy" element={<PrivacyPolicy />} />
        <Route path="/shipping-policy" element={<ShippingPolicy />} />

        {/* Barcode standalone */}
        <Route path="/barcode/:id" element={<BarcodeOnly />} />

        {/* POS + Admin pages — محمية بـ AppLayout */}
        <Route element={<AppLayout />}>
          <Route path="/pos" element={<Dashboard />} />
          <Route path="/new-order" element={<NewOrder />} />
          <Route path="/orders" element={<Orders />} />
          <Route path="/orders/:id" element={<OrderDetails />} />
          <Route path="/scan" element={<ScanBarcode />} />
          <Route path="/customers" element={<Customers />} />
          <Route path="/employees" element={<Employees />} />
          <Route path="/leaderboard" element={<Leaderboard />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/social-settings" element={<SocialSettings />} />
          <Route path="/admin/bookings" element={<BookingAdmin />} />
          <Route path="/zatca" element={<ZATCASettings />} />
          <Route path="/loyalty" element={<LoyaltyDashboard />} />
          <Route path="/admin/services" element={<ServicesAdmin />} />
          <Route path="/admin/working-hours" element={<WorkingHoursAdmin />} />
          <Route path="/admin/branches" element={<BranchesAdmin />} />
          <Route path="/audit" element={<AuditLog />} />
          <Route path="/site-analytics" element={<SiteAnalytics />} />
          <Route path="/admin/reviews" element={<ReviewsAdmin />} />
          <Route path="/admin/brands" element={<BrandsAdmin />} />
          <Route path="/admin/shop" element={<ShopAdmin />} />
          <Route path="/operations" element={<OperationsDashboard />} />
          <Route path="/sales" element={<SalesSystem />} />
          <Route path="/workshop" element={<WorkshopSystem />} />
      </Route>
        <Route path="*" element={<PageNotFound />} />
      </Routes>
      <GeminiAssistant />
    </>
  );
};

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App