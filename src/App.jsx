import { Toaster } from "@/components/ui/toaster"
import { Toaster as SonnerToaster } from "@/components/ui/sonner"
import { SpeedInsights } from '@vercel/speed-insights/react';
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import { useEffect, lazy, Suspense } from 'react';
import HeadDedupe from '@/components/seo/HeadDedupe';
import LangByUrl from '@/components/seo/LangByUrl';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import { LanguageProvider } from '@/lib/i18n/LanguageContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import { runPhotoCleanup } from '@/lib/photoCleanup';

// ── Lazy loaded pages (code splitting) ──────────────
const StaffOrders = lazy(() => import('./pages/StaffOrders'));
const StaffOrderDetail = lazy(() => import('./pages/StaffOrderDetail'));
const CalendarView = lazy(() => import('./pages/CalendarView'));
const ZATCASettings = lazy(() => import('./pages/ZATCASettings'));
const FinancialReports = lazy(() => import('./pages/FinancialReports'));
const AboutUs = lazy(() => import('./pages/AboutUs'));
const PrivacyPolicy = lazy(() => import('./pages/PrivacyPolicy'));
const ShippingPolicy = lazy(() => import('./pages/ShippingPolicy'));
const SocialSettings = lazy(() => import('./pages/SocialSettings'));
const LoyaltyDashboard = lazy(() => import('./pages/LoyaltyDashboard'));
const LoyaltyMembersAdmin = lazy(() => import('./pages/LoyaltyMembersAdmin'));
const MyLoyalty = lazy(() => import('./pages/MyLoyalty'));
const PinLogin = lazy(() => import('./pages/PinLogin'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const NewOrder = lazy(() => import('./pages/NewOrder'));
const CustomerDisplay = lazy(() => import('./pages/CustomerDisplay'));
const Orders = lazy(() => import('./pages/Orders'));
const OrderDetails = lazy(() => import('./pages/OrderDetails'));
const ScanBarcode = lazy(() => import('./pages/ScanBarcode'));
const Customers = lazy(() => import('./pages/Customers'));
const Employees = lazy(() => import('./pages/Employees'));
const Leaderboard = lazy(() => import('./pages/Leaderboard'));
const Settings = lazy(() => import('./pages/Settings'));
const Assistant = lazy(() => import('./pages/Assistant'));
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
const AuctionMarket = lazy(() => import('./pages/AuctionMarket'));
const AuctionAdmin = lazy(() => import('./pages/AuctionAdmin'));
const RepairPolicy = lazy(() => import('./pages/RepairPolicy'));
const OperationsDashboard = lazy(() => import('./pages/OperationsDashboard'));
const SalesSystem = lazy(() => import('./pages/SalesSystem'));
const Invoices = lazy(() => import('./pages/Invoices'));
const WorkshopSystem = lazy(() => import('./pages/WorkshopSystem'));
const Suppliers = lazy(() => import('./pages/Suppliers'));
const Purchasing = lazy(() => import('./pages/Purchasing'));
const PartnerPortal = lazy(() => import('./pages/PartnerPortal'));
const PartnersAdmin = lazy(() => import('./pages/PartnersAdmin'));
const PartnerAccount = lazy(() => import('./pages/PartnerAccount'));
const ProductPage = lazy(() => import('./pages/ProductPage'));
const Returns = lazy(() => import('./pages/Returns'));
const ServicePage = lazy(() => import('./pages/ServicePage'));
const AreaPage = lazy(() => import('./pages/AreaPage'));
const TaxDashboard = lazy(() => import('./pages/TaxDashboard'));
const Careers = lazy(() => import('./pages/Careers'));
const TrackItem = lazy(() => import('./pages/TrackItem'));
const CareerDetail = lazy(() => import('./pages/CareerDetail'));
const CareersAdmin = lazy(() => import('./pages/CareersAdmin'));

import AppLayout from './components/pos/AppLayout';
import NoirTheme from './components/shared/NoirTheme';
const BookingLanding = lazy(() => import('./pages/BookingLanding'));

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
      <HeadDedupe />
      <LangByUrl />
      <Suspense fallback={
        <div className="fixed inset-0 flex items-center justify-center" style={{ background: '#060300' }} role="status" aria-label="Loading">
          <img src="/images/cobblers-official-mark-white.png" alt="" className="logo-glow" style={{ width: 120, height: 'auto' }} />
        </div>
      }>
      <Routes>
        {/* /login مخفية — لا تظهر في أي رابط، تدخل بكتابتها يدوياً */}
        <Route path="/login" element={<PinLogin />} />
        <Route path="/customer-display" element={<CustomerDisplay />} />

        {/* الصفحة الرئيسية = صفحة الحجز */}
        <Route path="/" element={<BookingLanding />} />
        <Route path="/booking" element={<BookingLanding />} />

        {/* معاينة تجريبية للهيرو ثلاثي الأبعاد — لا تُستبدل بها الصفحة
            الرئيسية إلا بعد موافقتك */}

        {/* Public pages */}
        <Route path="/book" element={<BookingWizard />} />
        <Route path="/my-bookings" element={<MyBookings />} />
        <Route path="/my-loyalty" element={<MyLoyalty />} />
        <Route path="/reviews" element={<Reviews />} />
        <Route path="/shop" element={<Shop />} />
        <Route path="/shop/:id" element={<ProductPage />} />
        <Route path="/auction" element={<AuctionMarket />} />
        <Route path="/repair-policy" element={<RepairPolicy />} />
        <Route path="/about" element={<AboutUs />} />
        <Route path="/privacy" element={<PrivacyPolicy />} />
        <Route path="/shipping-policy" element={<ShippingPolicy />} />
        <Route path="/careers" element={<Careers />} />
        <Route path="/track" element={<TrackItem />} />
        <Route path="/partner" element={<PartnerPortal />} />
        {/* ── النسخة الإنجليزية (/en/...) — رابط مستقل لكل صفحة عامة للفهرسة ── */}
        <Route path="/en" element={<BookingLanding />} />
        <Route path="/en/book" element={<BookingWizard />} />
        <Route path="/en/shop" element={<Shop />} />
        <Route path="/en/shop/:id" element={<ProductPage />} />
        <Route path="/en/auction" element={<AuctionMarket />} />
        <Route path="/en/reviews" element={<Reviews />} />
        <Route path="/en/about" element={<AboutUs />} />
        <Route path="/en/repair-policy" element={<RepairPolicy />} />
        <Route path="/en/track" element={<TrackItem />} />
        <Route path="/en/careers" element={<Careers />} />
        <Route path="/en/careers/:slug" element={<CareerDetail />} />
        <Route path="/en/shipping-policy" element={<ShippingPolicy />} />
        <Route path="/en/privacy" element={<PrivacyPolicy />} />
        <Route path="/services/:slug" element={<ServicePage />} />
        <Route path="/en/services/:slug" element={<ServicePage />} />
        <Route path="/areas/:slug" element={<AreaPage />} />
        <Route path="/en/areas/:slug" element={<AreaPage />} />
        <Route path="/careers/:slug" element={<CareerDetail />} />

        {/* Barcode standalone */}
        <Route path="/barcode/:id" element={<BarcodeOnly />} />

        {/* POS + Admin pages — محمية بـ AppLayout */}
        <Route element={<AppLayout />}>
          <Route path="/pos" element={<Dashboard />} />
          <Route path="/new-order" element={<NewOrder />} />
          <Route path="/orders" element={<Orders />} />
          <Route path="/orders/:id" element={<OrderDetails />} />
          <Route path="/invoices" element={<Invoices />} />
          <Route path="/scan" element={<ScanBarcode />} />
          <Route path="/customers" element={<Customers />} />
          <Route path="/employees" element={<Employees />} />
          <Route path="/leaderboard" element={<Leaderboard />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/assistant" element={<Assistant />} />
          <Route path="/social-settings" element={<SocialSettings />} />
          <Route path="/admin/bookings" element={<BookingAdmin />} />
          <Route path="/zatca" element={<ZATCASettings />} />
          <Route path="/financial-reports" element={<FinancialReports />} />
          <Route path="/loyalty" element={<LoyaltyDashboard />} />
          <Route path="/loyalty-members" element={<LoyaltyMembersAdmin />} />
          <Route path="/calendar" element={<CalendarView />} />
          <Route path="/staff" element={<StaffOrders />} />
          <Route path="/staff/:id" element={<StaffOrderDetail />} />
          <Route path="/admin/services" element={<ServicesAdmin />} />
          <Route path="/admin/working-hours" element={<WorkingHoursAdmin />} />
          <Route path="/admin/branches" element={<BranchesAdmin />} />
          <Route path="/admin/careers" element={<CareersAdmin />} />
          <Route path="/audit" element={<AuditLog />} />
          <Route path="/site-analytics" element={<SiteAnalytics />} />
          <Route path="/admin/reviews" element={<ReviewsAdmin />} />
          <Route path="/admin/brands" element={<BrandsAdmin />} />
          <Route path="/admin/shop" element={<ShopAdmin />} />
          <Route path="/admin/auction" element={<AuctionAdmin />} />
          <Route path="/operations" element={<OperationsDashboard />} />
          <Route path="/sales" element={<SalesSystem />} />
          <Route path="/workshop" element={<WorkshopSystem />} />
          <Route path="/suppliers" element={<Suppliers />} />
          <Route path="/purchasing" element={<Purchasing />} />
          <Route path="/returns" element={<Returns />} />
          <Route path="/admin/partners" element={<PartnersAdmin />} />
          <Route path="/admin/partners/:id" element={<PartnerAccount />} />
          <Route path="/tax-dashboard" element={<TaxDashboard />} />
      </Route>
        <Route path="*" element={<PageNotFound />} />
      </Routes>
      </Suspense>
      <NoirTheme />
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
          <SonnerToaster position="top-center" richColors closeButton />
          <SpeedInsights />
        </LanguageProvider>
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App