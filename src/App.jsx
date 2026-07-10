import { Toaster } from "@/components/ui/toaster"
import { SpeedInsights } from '@vercel/speed-insights/react';
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import { useEffect, lazy, Suspense } from 'react';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import { LanguageProvider } from '@/lib/i18n/LanguageContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import { runPhotoCleanup } from '@/lib/photoCleanup';

import GeminiAssistant from './components/ai/GeminiAssistant';

// ── Lazy loaded pages (code splitting) ──────────────
const StaffOrders = lazy(() => import('./pages/StaffOrders'));
const CalendarView = lazy(() => import('./pages/CalendarView'));
const ZATCASettings = lazy(() => import('./pages/ZATCASettings'));
const AboutUs = lazy(() => import('./pages/AboutUs'));
const PrivacyPolicy = lazy(() => import('./pages/PrivacyPolicy'));
const ShippingPolicy = lazy(() => import('./pages/ShippingPolicy'));
const SocialSettings = lazy(() => import('./pages/SocialSettings'));
const LoyaltyDashboard = lazy(() => import('./pages/LoyaltyDashboard'));
const PinLogin = lazy(() => import('./pages/PinLogin'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const NewOrder = lazy(() => import('./pages/NewOrder'));
const Orders = lazy(() => import('./pages/Orders'));
const OrderDetails = lazy(() => import('./pages/OrderDetails'));
const ScanBarcode = lazy(() => import('./pages/ScanBarcode'));
const Customers = lazy(() => import('./pages/Customers'));
const Employees = lazy(() => import('./pages/Employees'));
const Leaderboard = lazy(() => import('./pages/Leaderboard'));
const Settings = lazy(() => import('./pages/Settings'));
const BarcodeOnly = lazy(() => import('./pages/BarcodeOnly'));
const BookingWizard = lazy(() => import('./pages/BookingWizard'));
const MyBookings = lazy(() => import('./pages/MyBookings'));
const BookingAdmin = lazy(() => import('./pages/BookingAdmin'));
const ServicesAdmin = lazy(() => import('./pages/ServicesAdmin'));
const WorkingHoursAdmin = lazy(() => import('./pages/WorkingHoursAdmin'));
const BranchesAdmin = lazy(() => import('./pages/BranchesAdmin'));
const AuditLog = lazy(() => import('./pages/AuditLog'));
const SiteAnalytics = lazy(() => import('./pages/SiteAnalytics'));
const Reviews = lazy(() => import('./pages/Reviews'));
const ReviewsAdmin = lazy(() => import('./pages/ReviewsAdmin'));
const BrandsAdmin = lazy(() => import('./pages/BrandsAdmin'));
const Shop = lazy(() => import('./pages/Shop'));
const ShopAdmin = lazy(() => import('./pages/ShopAdmin'));
const RepairPolicy = lazy(() => import('./pages/RepairPolicy'));
const OperationsDashboard = lazy(() => import('./pages/OperationsDashboard'));
const SalesSystem = lazy(() => import('./pages/SalesSystem'));
const WorkshopSystem = lazy(() => import('./pages/WorkshopSystem'));

import AppLayout from './components/pos/AppLayout';
import BookingLanding from './pages/BookingLanding';

const AuthenticatedApp = () => {
  const { authError, navigateToLogin } = useAuth();

  // تنظيف صور الطلبات المكتملة بعد أسبوعين — يعمل مرة يومياً
  useEffect(() => { runPhotoCleanup(); }, []);

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
      <Suspense fallback={
        <div className="fixed inset-0 flex items-center justify-center" style={{ background: '#060300' }}>
          <div className="flex flex-col items-center gap-4">
            <div className="w-10 h-10 rounded-full border-2 border-yellow-500 border-t-transparent animate-spin" />
            <p className="text-xs font-bold tracking-widest" style={{ color: '#C9A84C' }}>إبرة وخيط</p>
          </div>
        </div>
      }>
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
          <Route path="/calendar" element={<CalendarView />} />
          <Route path="/staff" element={<StaffOrders />} />
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
      </Suspense>
      <GeminiAssistant />
    </>
  );
};

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <LanguageProvider>
          <Router>
            <AuthenticatedApp />
          </Router>
          <Toaster />
          <SpeedInsights />
        </LanguageProvider>
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App