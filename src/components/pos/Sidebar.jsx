import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { 
  LayoutDashboard, PlusCircle, ListOrdered, Users, UserCog, 
  ScanBarcode, LogOut, Scissors, Trophy, Menu, X, Settings,
  Wrench, Clock, ExternalLink, MapPin, ClipboardList, Globe, BookOpen, Star, Tag, ShoppingBag, Factory, ShoppingCart, Shield, CalendarDays, Receipt, Wallet, Award, Truck, Scale
} from 'lucide-react';
import { getSession, clearSession } from '@/lib/sessionStore';
import { isFullAdmin, isFinanceUser, isWorker, ROLES } from '@/lib/roles';

// ─── Groups: مرتبة حسب الاستخدام الأكثر، الإعدادات دائماً آخراً
const navGroups = [
  {
    label: null, // no header for main ops
    items: [
      { path: '/pos', icon: LayoutDashboard, label: 'لوحة التحكم', adminOnly: true },
      { path: '/new-order', icon: PlusCircle, label: 'طلب جديد' },
      { path: '/staff', icon: Scissors, label: 'مهامي 🔧', workerOnly: true },
      { path: '/orders', icon: ListOrdered, label: 'الطلبات' },
      { path: '/invoices', icon: Receipt, label: 'الفواتير', financeOnly: true },
      { path: '/calendar', icon: CalendarDays, label: 'الجدولة المرئية' },
      { path: '/scan', icon: ScanBarcode, label: 'مسح الباركود' },
    ]
  },
  {
    label: 'الأنظمة',
    items: [
      { path: '/sales', icon: ShoppingCart, label: 'المبيعات والمخازن' },
      { path: '/suppliers', icon: Truck, label: 'الموردون', ownerOnly: true },
      { path: '/tax-compliance', icon: Scale, label: 'الامتثال الضريبي', financeOnly: true },
      { path: '/workshop', icon: Wrench, label: 'العهدة والورشة' },
      { path: '/operations', icon: Factory, label: 'الخطة الثانية ⚡', adminOnly: true },
    ]
  },
  {
    label: 'العملاء والفريق',
    items: [
      { path: '/customers', icon: Users, label: 'العملاء' },
      { path: '/employees', icon: UserCog, label: 'الموظفون', adminOnly: true },
      { path: '/leaderboard', icon: Trophy, label: 'المتصدرون', adminOnly: true },
    ]
  },
  {
    label: 'التقارير',
    financeOnly: true,
    items: [
      { path: '/financial-reports', icon: Wallet, label: 'التقارير المالية', financeOnly: true },
      { path: '/audit', icon: ClipboardList, label: 'لوحة التدقيق', adminOnly: true },
      { path: '/site-analytics', icon: Globe, label: 'إحصائيات الموقع', adminOnly: true },
    ]
  },
  {
    label: 'المحتوى والموقع',
    adminOnly: true,
    items: [
      { path: '/admin/bookings', icon: BookOpen, label: 'الحجوزات' },
      { path: '/admin/reviews', icon: Star, label: 'التقييمات', adminOnly: true },
      { path: '/admin/brands', icon: Tag, label: 'الماركات', adminOnly: true },
      { path: '/admin/shop', icon: ShoppingBag, label: 'المتجر', adminOnly: true },
    ]
  },
  {
    label: 'الإعدادات',
    adminOnly: true,
    items: [
      { path: '/admin/services', icon: Wrench, label: 'إدارة الخدمات', adminOnly: true },
      { path: '/admin/working-hours', icon: Clock, label: 'أوقات العمل', adminOnly: true },
      { path: '/admin/branches', icon: MapPin, label: 'الفروع', adminOnly: true },
      { path: '/zatca', icon: Shield, label: 'زاتكا ZATCA', financeOnly: true },
      { path: '/social-settings', icon: Globe, label: 'التواصل الاجتماعي', adminOnly: true },
      { path: '/loyalty', icon: Star, label: 'بطاقات الولاء', adminOnly: false },
      { path: '/loyalty-members', icon: Award, label: 'برنامج الولاء (النقاط)', adminOnly: false },
      { path: '/settings', icon: Settings, label: 'الإعدادات', adminOnly: true },
    ]
  },
];

export default function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const session  = getSession();
  const isAdmin  = isFullAdmin(session?.role);   // owner/admin/manager فقط
  const isFinance = isFinanceUser(session?.role); // isAdmin + محاسب
  const isWorkerRole = isWorker(session?.role);   // العامل فقط (وليس الكاشير)
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = () => {
    clearSession();
    // تنقّل ناعم عبر الراوتر بدل إعادة تحميل الصفحة بالكامل (أخف وأسرع على الجهاز)
    navigate('/login', { replace: true });
  };

  const sidebarContent = (
    <>
      {/* Logo */}
      <div className="p-5 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center shrink-0">
            <Scissors className="w-4 h-4 text-primary-foreground" />
          </div>
          <div>
            <h1 className="font-bold text-sm">إبرة وخيط الإسكافي</h1>
            <p className="text-[10px] text-sidebar-foreground/50">نظام نقاط البيع</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-3 px-2 overflow-y-auto space-y-0.5">
        {navGroups.map((group, gi) => {
          if (group.adminOnly && !isAdmin) return null;
          if (group.financeOnly && !isFinance) return null;
          const visibleItems = group.items.filter(item => {
            if (item.adminOnly && !isAdmin) return false;
            if (item.financeOnly && !isFinance) return false; // تقارير/زاتكا/فواتير - إدارة + محاسب
            if (item.ownerOnly && session?.role !== ROLES.OWNER) return false; // الموردون - المالك فقط
            if (item.workerOnly && !isWorkerRole) return false; // مهامي - للعامل فقط (وليس الكاشير)
            return true;
          });
          if (visibleItems.length === 0) return null;
          return (
            <div key={gi} className={gi > 0 ? 'pt-2' : ''}>
              {group.label && (
                <p className="text-[10px] font-bold uppercase tracking-widest text-sidebar-foreground/30 px-3 py-1.5">
                  {group.label}
                </p>
              )}
              {visibleItems.map(item => {
                const Icon = item.icon;
                const active = location.pathname === item.path;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setMobileOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                      active
                        ? 'bg-sidebar-primary text-sidebar-primary-foreground'
                        : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                    }`}
                  >
                    <Icon className="w-[17px] h-[17px] shrink-0" />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          );
        })}
      </nav>

      {/* Booking Website Link */}
      <div className="px-3 pb-3">
        <a
          href="/booking"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium bg-primary/20 text-primary hover:bg-primary/30 transition-all w-full"
        >
          <ExternalLink className="w-[18px] h-[18px] shrink-0" />
          <span>موقع الحجز الإلكتروني</span>
        </a>
      </div>

      {/* User info + Logout */}
      <div className="p-4 border-t border-sidebar-border">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">{session?.name || 'Staff'}</p>
            <p className="text-xs text-sidebar-foreground/50 capitalize">{session?.role || 'staff'}</p>
          </div>
          <button
            onClick={handleLogout}
            className="p-2 rounded-lg hover:bg-sidebar-accent text-sidebar-foreground/50 hover:text-sidebar-foreground transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile header — الموقع RTL بالكامل (dir="rtl" على html)، فزر الهمبرغر
          والقائمة المنسدلة لازم يكونوا على اليمين مثل باقي الواجهة، مو اليسار */}
      <div className="lg:hidden fixed top-0 right-0 left-0 h-14 bg-sidebar text-sidebar-foreground flex items-center px-4 z-50 border-b border-sidebar-border">
        <button onClick={() => setMobileOpen(true)} className="p-2">
          <Menu className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2 mr-2">
          <Scissors className="w-4 h-4 text-primary" />
          <span className="font-bold text-sm">إبرة وخيط الإسكافي</span>
        </div>
      </div>

      {/* Mobile overlay — تنزلق القائمة من اليمين (مطابقة لاتجاه RTL)
          بدل اليسار، عشان تفتح من نفس جهة زر الهمبرغر ولا تربك المستخدم */}
      <AnimatePresence>
        {mobileOpen && (
          <div className="lg:hidden fixed inset-0 z-50">
            <motion.div
              className="absolute inset-0 bg-black/50"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setMobileOpen(false)}
            />
            <motion.aside
              className="absolute right-0 top-0 bottom-0 w-64 bg-sidebar text-sidebar-foreground flex flex-col"
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'tween', ease: [0.32, 0.72, 0, 1], duration: 0.28 }}
            >
              <button onClick={() => setMobileOpen(false)} className="absolute top-4 left-4 p-1 text-sidebar-foreground/50">
                <X className="w-5 h-5" />
              </button>
              {sidebarContent}
            </motion.aside>
          </div>
        )}
      </AnimatePresence>

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex fixed right-0 top-0 bottom-0 w-64 bg-sidebar text-sidebar-foreground flex-col z-50">
        {sidebarContent}
      </aside>
    </>
  );
}