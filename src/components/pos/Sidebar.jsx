import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, PlusCircle, ListOrdered, Users, UserCog, 
  ScanBarcode, LogOut, Scissors, Trophy, Menu, X, Settings, Moon, Sun,
  Wrench, Clock, ExternalLink, MapPin, ClipboardList, Globe, BookOpen, Star, Tag, ShoppingBag, ShoppingCart, Shield, CalendarDays, Receipt, Wallet, Award, Truck, Scale, Briefcase, Undo2
, Sparkles, Landmark } from 'lucide-react';
import { getSession, clearSession } from '@/lib/sessionStore';
import { isFullAdmin, isFinanceUser, isWorker, ROLES } from '@/lib/roles';
import { queryClientInstance } from '@/lib/query-client';

const TONES = {
  '/pos':'tone-blue','/new-order':'tone-green','/staff':'tone-orange','/orders':'tone-indigo','/invoices':'tone-teal',
  '/calendar':'tone-red','/scan':'tone-gray','/assistant':'tone-purple','/sales':'tone-orange','/suppliers':'tone-gray',
  '/purchasing':'tone-pink','/returns':'tone-red','/admin/partners':'tone-indigo','/customers':'tone-blue','/employees':'tone-teal','/leaderboard':'tone-orange','/financial-reports':'tone-green',
  '/tax-dashboard':'tone-indigo','/accounting':'tone-orange','/audit':'tone-red','/site-analytics':'tone-blue','/admin/bookings':'tone-pink','/admin/reviews':'tone-orange',
  '/admin/brands':'tone-purple','/admin/shop':'tone-teal','/admin/services':'tone-gray','/admin/working-hours':'tone-blue',
  '/admin/branches':'tone-green','/admin/careers':'tone-indigo','/zatca':'tone-teal','/social-settings':'tone-pink',
  '/loyalty':'tone-orange','/loyalty-members':'tone-purple','/settings':'tone-gray',
};

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
      { path: '/assistant', icon: Sparkles, label: 'المساعد الذكي' },
    ]
  },
  {
    label: 'الأنظمة',
    items: [
      { path: '/sales', icon: ShoppingCart, label: 'المبيعات والمخازن' },
      { path: '/suppliers', icon: Truck, label: 'الموردون', ownerOnly: true },
      { path: '/purchasing', icon: ShoppingBag, label: 'المشتريات', financeOnly: true },
      { path: '/returns', icon: Undo2, label: 'المرتجعات' },
      { path: '/admin/partners', icon: Truck, label: 'الشركاء', adminOnly: true },
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
      { path: '/accounting', icon: Landmark, label: 'المركز المحاسبي', financeOnly: true },
      { path: '/financial-reports', icon: Wallet, label: 'التقارير المالية', financeOnly: true },
      { path: '/tax-dashboard', icon: Scale, label: 'لوحة الضرائب', financeOnly: true },
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
      { path: '/admin/careers', icon: Briefcase, label: 'الوظائف الشاغرة', adminOnly: true },
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

  // شبكة أمان: تقفل القائمة تلقائياً عند أي تغيّر بالمسار (تنقّل ببرنامج،
  // زر رجوع بالمتصفح، إلخ) — بجانب onClick على كل رابط. هذا يمنع بقاء
  // القائمة/الطبقة الخلفية (backdrop) شغالة وتحجب اللمس، وهو ما يبدو
  // للمستخدم وكأن الصفحة "علّقت" وما تستجيب.
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname, location.search]);
  useEffect(() => {
    const close = () => setMobileOpen(false);
    window.addEventListener('popstate', close);
    return () => window.removeEventListener('popstate', close);
  }, []);

  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains('dark'));
  const toggleDark = () => {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.classList.toggle('dark', next);
    try { localStorage.setItem('theme', next ? 'dark' : 'light'); } catch {}
  };

  const handleLogout = () => {
    clearSession();
    try { queryClientInstance.clear(); } catch {}
    fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }).catch(() => {});
    // تنقّل ناعم عبر الراوتر بدل إعادة تحميل الصفحة بالكامل (أخف وأسرع على الجهاز)
    navigate('/login', { replace: true });
  };

  const sidebarContent = (
    <>
      {/* Logo */}
      <div className="px-5 pt-6 pb-4">
        <img src="/images/cobblers-official-mark.png" alt="إبرة وخيط الإسكافي" className="h-11 w-auto object-contain" style={{ filter: 'var(--logo-filter, brightness(0))' }} />
        <p className="text-[11px] text-sidebar-foreground/60 mt-2 tracking-wide">نظام إدارة الورشة والمبيعات</p>
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
                <p className="text-[11px] font-semibold tracking-wider text-sidebar-foreground/45 px-3 pt-3 pb-1.5">
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
                    className={`flex items-center gap-3 px-2.5 py-1.5 text-[13.5px] rounded-xl transition-all ${
                      active
                        ? 'bg-white/80 dark:bg-white/10 text-foreground font-semibold shadow-[0_2px_10px_rgba(31,45,90,.10)]'
                        : 'text-sidebar-foreground hover:bg-white/50 dark:hover:bg-white/5'
                    }`}
                  >
                    <span className={`ios-tile ${TONES[item.path] || 'tone-gray'}`}><Icon className="w-[16px] h-[16px]" strokeWidth={2.2} /></span>
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
          className="flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-xl bg-white/50 dark:bg-white/5 border border-white/70 dark:border-white/10 text-sidebar-foreground hover:bg-white/80 transition-colors w-full"
        >
          <ExternalLink className="w-[18px] h-[18px] shrink-0" />
          <span>موقع الحجز الإلكتروني</span>
        </a>
      </div>

      {/* User info + Logout */}
      <div className="p-4 border-t border-black/5 dark:border-white/10">
        <button
          onClick={toggleDark}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-all w-full mb-2"
        >
          {isDark ? <Sun className="w-[18px] h-[18px] shrink-0" /> : <Moon className="w-[18px] h-[18px] shrink-0" />}
          <span>{isDark ? 'الوضع النهاري' : 'الوضع الليلي'}</span>
        </button>
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
          <img src="/images/cobblers-official-mark.png" alt="إبرة وخيط الإسكافي" className="w-6 h-6 object-contain" style={{ filter: 'brightness(0)' }} />
          <span className="font-bold text-sm">إبرة وخيط الإسكافي</span>
        </div>
      </div>

      {/* Mobile overlay — تنزلق القائمة من اليمين (مطابقة لاتجاه RTL)
          بدل اليسار، عشان تفتح من نفس جهة زر الهمبرغر ولا تربك المستخدم */}
      {/* القائمة تُزال فوراً عند الإغلاق (بدون AnimatePresence): كان انتظار انتهاء حركة الخروج
          يعلّق القائمة والطبقة الخلفية مفتوحة على بعض الجوالات فتحجب كل شيء */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-[60]">
          <style>{`@keyframes navIn{from{transform:translateX(100%)}to{transform:translateX(0)}}@keyframes navFade{from{opacity:0}to{opacity:1}}`}</style>
          <div
            className="absolute inset-0 bg-black/50"
            style={{ animation: 'navFade .2s ease-out' }}
            onClick={() => setMobileOpen(false)}
            onTouchEnd={() => setMobileOpen(false)}
          />
          <aside
            className="absolute right-0 top-0 bottom-0 w-64 bg-sidebar text-sidebar-foreground flex flex-col"
            style={{ animation: 'navIn .25s cubic-bezier(.32,.72,0,1)' }}
            onClickCapture={(e) => { if (e.target.closest && e.target.closest('a')) setMobileOpen(false); }}
          >
            <button onClick={() => setMobileOpen(false)} className="absolute top-4 left-4 p-1 text-sidebar-foreground/50">
              <X className="w-5 h-5" />
            </button>
            {sidebarContent}
          </aside>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex fixed right-0 top-0 bottom-0 w-64 bg-sidebar text-sidebar-foreground flex-col z-50">
        {sidebarContent}
      </aside>
    </>
  );
}