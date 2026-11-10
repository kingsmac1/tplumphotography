import { useState, useEffect, lazy, Suspense } from "react";
import { useNavigate } from "@/lib/router-compat";
import AdminLogin from "./AdminLogin";
import BookingsSection from "./BookingsSection";
import CalendarSection from "./CalendarSection";
import AcademyTable from "./AcademyTable";
import AttendanceSection from "./AttendanceSection";
import TeamSection from "./TeamSection";
import Finance from "./Finance";
import PromoManager from "./PromoManager";
import StudioSpacePromoManager from "./StudioSpacePromoManager";
import EmailsSection from "./EmailsSection";
import ContentManager from "./ContentManager";
import BlogManager from "./BlogManager";
import StoreManager from "./StoreManager";
import PricingManager from "./PricingManager";
import ReviewsManager from "./ReviewsManager";
import ManualAcademyForm from "./ManualAcademyForm";
import { COMPOSE_EVENT } from "./contact";
import { supabase } from "@/lib/supabaseClient";
import Overview from "./Overview";
import { GalleryAdminProvider } from "@/features/gallery/admin/kit/data";
import { BillingProvider, useBilling } from "@/features/billing/BillingProvider";
import { BillingBanner } from "@/features/billing/BillingBanner";
import { BillingSection } from "@/features/billing/BillingSection";
import { GalleryPaywall } from "@/features/billing/GalleryPaywall";
// Client galleries (proofs, selections, finals) — loaded only when the section is opened
const GalleriesSection = lazy(() => import("@/features/gallery/admin/GalleriesSection").then((m) => ({ default: m.GalleriesSection })));
const GalleryManager = lazy(() => import("@/features/gallery/admin/GalleryManager").then((m) => ({ default: m.GalleryManager })));
// Invoices — loaded only when the section is opened
const InvoicesSection = lazy(() => import("@/features/invoices/InvoicesSection").then((m) => ({ default: m.InvoicesSection })));
const InvoiceEditor = lazy(() => import("@/features/invoices/InvoiceEditor").then((m) => ({ default: m.InvoiceEditor })));
import { InvoicePrompt } from "@/features/invoices/InvoicePrompt";
import { canLeaveInvoice } from "@/features/invoices/guard";
// Deliveries (the 48–72 hour promise) — loaded only when the section is opened; the menu count is small and always on
const DeliveriesSection = lazy(() => import("@/features/delivery/DeliveriesSection").then((m) => ({ default: m.DeliveriesSection })));
import { DeliveryMenuCount } from "@/features/delivery/MenuCount";
import brandLogo from "@/assets/tplum-logo-dark.png";
import brandLogoWhite from "@/assets/tplum-logo-white.png";
import { LogOut, LayoutDashboard, CalendarDays, GraduationCap, UserCheck, Tag, Images, Star, Newspaper, ShoppingBag, BadgeDollarSign, Wallet, Ellipsis, X, Mail, CalendarRange, GalleryHorizontalEnd, Users, CreditCard, FileText, Timer } from "lucide-react";

type SectionId = "overview" | "bookings" | "deliveries" | "galleries" | "calendar" | "finance" | "invoices" | "academy" | "reviews" | "attendance" | "team" | "content" | "blog" | "store" | "pricing" | "promos" | "emails" | "billing";
const sections: { id: SectionId; label: string; short: string; icon: typeof LayoutDashboard; group?: string }[] = [
  { id: "overview", label: "Overview", short: "Home", icon: LayoutDashboard },
  { id: "bookings", label: "Bookings", short: "Bookings", icon: CalendarDays, group: "BUSINESS" },
  { id: "deliveries", label: "Deliveries", short: "Deliveries", icon: Timer },
  { id: "galleries", label: "Client Galleries", short: "Galleries", icon: GalleryHorizontalEnd },
  { id: "calendar", label: "Calendar", short: "Calendar", icon: CalendarRange },
  { id: "finance", label: "Finance", short: "Finance", icon: Wallet },
  { id: "invoices", label: "Invoices", short: "Invoices", icon: FileText },
  { id: "academy", label: "Academy Applications", short: "Academy", icon: GraduationCap },
  { id: "reviews", label: "Reviews", short: "Reviews", icon: Star },
  { id: "attendance", label: "Staff Attendance", short: "Attendance", icon: UserCheck, group: "TEAM" },
  { id: "team", label: "Team & Accounts", short: "Team", icon: Users },
  { id: "content", label: "Images & Galleries", short: "Images", icon: Images, group: "WEBSITE" },
  { id: "blog", label: "Blog", short: "Blog", icon: Newspaper },
  { id: "store", label: "Store", short: "Store", icon: ShoppingBag },
  { id: "pricing", label: "Prices", short: "Prices", icon: BadgeDollarSign },
  { id: "promos", label: "Promo Codes", short: "Promos", icon: Tag },
  { id: "emails", label: "Emails & Messaging", short: "Emails", icon: Mail, group: "WEBSITE" },
  { id: "billing", label: "Billing", short: "Billing", icon: CreditCard, group: "ACCOUNT" },
];
// The mobile bottom bar shows these; everything else is under "More".
const mobilePrimary: SectionId[] = ["overview", "bookings", "attendance", "reviews"];

const sectionFromHash = (): SectionId => {
  if (typeof window === "undefined") return "overview";
  const h = window.location.hash.replace("#", "").split("/")[0];
  return sections.some((sec) => sec.id === h) ? (h as SectionId) : "overview";
};
// #galleries/<booking id> opens that booking's Gallery Manager
const galleryBookingFromHash = () => (typeof window === "undefined" ? null : /^#galleries\/([0-9a-f-]{36})/i.exec(window.location.hash)?.[1] ?? null);
// #galleries/g/<gallery id> opens a gallery made for someone without a booking
const galleryOnlyFromHash = () => (typeof window === "undefined" ? null : /^#galleries\/g\/([0-9a-f-]{36})/i.exec(window.location.hash)?.[1] ?? null);
// #invoices/new, #invoices/<id>, #invoices/booking/<table>/<booking id>[/send] … (see InvoiceEditor)
const invoicePathFromHash = () => (typeof window === "undefined" ? [] : /^#invoices\/(.+)/.exec(window.location.hash)?.[1].split("/").filter(Boolean) ?? []);

const AdminDashboardInner = () => {
  const navigate = useNavigate();
  const { billing, active: billingActive } = useBilling();
  // the Billing page only exists once Emkay Digitals has switched billing on for this studio
  const visibleSections = sections.filter((sec) => sec.id !== "billing" || billingActive);
  const galleriesPaused = billingActive && !!billing && !billing.gallery_enabled;
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [pendingReviews, setPendingReviews] = useState(0);
  const [showAcademyForm, setShowAcademyForm] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [active, setActive] = useState<SectionId>("overview");
  const [moreOpen, setMoreOpen] = useState(false);
  const [galleryBooking, setGalleryBooking] = useState<string | null>(null);
  const [galleryOnly, setGalleryOnly] = useState<string | null>(null);
  const [invoicePath, setInvoicePath] = useState<string[]>([]);

  // Remember the selected section across refreshes via the URL hash.
  useEffect(() => {
    const sync = () => { setActive(sectionFromHash()); setGalleryBooking(galleryBookingFromHash()); setGalleryOnly(galleryOnlyFromHash()); setInvoicePath(invoicePathFromHash()); };
    sync();
    // gallery links (#galleries/<booking id>) change the hash from inside the page
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);
  // A table's Email button asks for the messenger; the address itself travels via sessionStorage.
  useEffect(() => {
    const open = () => selectSection("emails");
    window.addEventListener(COMPOSE_EVENT, open);
    return () => window.removeEventListener(COMPOSE_EVENT, open);
  });
  const selectSection = (id: SectionId) => {
    if (!canLeaveInvoice()) return; // unsaved invoice: the admin chose to stay
    setActive(id);
    setInvoicePath([]);
    setGalleryBooking(null);
    setGalleryOnly(null);
    setMoreOpen(false);
    if (typeof window !== "undefined") {
      window.history.replaceState(null, "", `#${id}`);
      window.scrollTo({ top: 0 });
    }
  };

  useEffect(() => {
    const checkAuth = async () => {
      const { data } = await supabase.auth.getUser();
      const authed = !!data.user;
      setIsAuthenticated(authed);
      if (!authed) { navigate("/admin/login"); return; }
      // Staff-role accounts only have access to the check-in page; clients (no staff record) go to their own area.
      const { data: staff } = await supabase.from("staff").select("role").eq("id", data.user!.id).maybeSingle();
      if (!staff) { window.location.replace("/account"); return; }
      if (staff.role === "staff") navigate("/checkin");
    };
    checkAuth();
    void loadPendingReviews();
    // Once per visit. Re-running this on every render looped endlessly and used up the Supabase quota.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Shown on the Overview as a shortcut to the reviews waiting for approval.
  const loadPendingReviews = async () => {
    const { count } = await supabase.from("reviews").select("id", { count: "exact", head: true }).eq("status", "pending");
    setPendingReviews(count ?? 0);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setIsAuthenticated(false);
    navigate("/admin/login");
  };

  if (isAuthenticated === null) {
    return <div className="dash min-h-screen text-foreground flex items-center justify-center">Loading...</div>;
  }
  if (!isAuthenticated) return <AdminLogin />;

  const current = sections.find((sec) => sec.id === active)!;

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 px-6 py-6 border-b border-white/10">
        <img src={brandLogoWhite} alt="DMI" className="h-10 w-auto" />
        <span className="font-display text-lg font-bold">Admin</span>
      </div>
      <nav data-lenis-prevent className="flex-1 min-h-0 overflow-y-auto overscroll-contain py-4">
        {visibleSections.map((sec) => {
          const Icon = sec.icon;
          const isActive = sec.id === active;
          return (
            <div key={sec.id}>
            {sec.group && <p className="px-6 pt-5 pb-1 text-[10px] font-body font-bold tracking-widest text-white/35">{sec.group}</p>}
            <button
              onClick={() => selectSection(sec.id)}
              className={`w-full flex items-center gap-3 px-6 py-2.5 text-sm font-body text-left border-l-4 transition-colors ${
                isActive
                  ? "border-white bg-white/10 font-bold text-white"
                  : "border-transparent text-white/60 hover:bg-white/5 hover:text-white"
              }`}
            >
              <Icon size={18} /> {sec.label}
              {sec.id === "deliveries" && <DeliveryMenuCount />}
            </button>
            </div>
          );
        })}
      </nav>
      <div className="p-4 border-t border-white/10">
        <button
          onClick={handleLogout}
          className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-body font-medium border border-white/20 text-white hover:bg-white/10 rounded-md transition-colors"
        >
          <LogOut size={16} /> LOGOUT
        </button>
      </div>
    </div>
  );

  return (
    <div className="dash min-h-screen text-foreground">
      {/* Fixed left panel (desktop) */}
      <aside className="hidden md:block fixed inset-y-0 left-0 w-64 bg-neutral-950 text-white z-40">
        {sidebar}
      </aside>

      {/* Bottom menu (mobile) */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 grid grid-cols-5 border-t border-white/10 bg-neutral-950 text-white pb-[env(safe-area-inset-bottom)]">
        {sections.filter((sec) => mobilePrimary.includes(sec.id)).map((sec) => {
          const Icon = sec.icon;
          const isActive = sec.id === active;
          return (
            <button
              key={sec.id}
              onClick={() => selectSection(sec.id)}
              aria-label={sec.label}
              className={`flex flex-col items-center gap-1 py-2.5 text-[10px] font-body transition-colors ${
                isActive ? "text-white font-bold border-t-2 border-white -mt-px" : "text-white/55"
              }`}
            >
              <Icon size={20} />
              {sec.short}
            </button>
          );
        })}
        <button
          onClick={() => setMoreOpen(true)}
          aria-label="More"
          className={`flex flex-col items-center gap-1 py-2.5 text-[10px] font-body transition-colors ${
            !mobilePrimary.includes(active) ? "text-white font-bold border-t-2 border-white -mt-px" : "text-white/55"
          }`}
        >
          <span className="relative"><Ellipsis size={20} />{!mobilePrimary.includes("deliveries") && <DeliveryMenuCount compact />}</span>
          More
        </button>
      </nav>

      {moreOpen && (
        <div className="md:hidden fixed inset-0 z-50 bg-black/60 flex items-end" onClick={() => setMoreOpen(false)}>
          <div className="w-full bg-neutral-950 text-white p-4 pb-8 rounded-t-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <p className="font-display text-lg font-bold">Menu</p>
              <button onClick={() => setMoreOpen(false)} aria-label="Close menu"><X size={20} /></button>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {visibleSections.map((sec) => {
                const Icon = sec.icon;
                return (
                  <button
                    key={sec.id}
                    onClick={() => selectSection(sec.id)}
                    className={`flex flex-col items-center gap-2 py-4 text-[11px] font-body border ${sec.id === active ? "border-white bg-white/10 font-bold" : "border-white/15 text-white/70"}`}
                  >
                    <span className="relative"><Icon size={22} />{sec.id === "deliveries" && <DeliveryMenuCount compact />}</span>
                    {sec.short}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <div className="md:ml-64">
        {/* Mobile top bar */}
        <header className="md:hidden sticky top-0 z-30 flex items-center justify-between border-b border-border bg-background px-4 py-3">
          <img src={brandLogo} alt="DMI" className="h-8 w-auto" />
          <span className="font-display text-lg font-bold">{current.label}</span>
          <button onClick={handleLogout} aria-label="Logout" className="p-1 text-muted-foreground hover:text-foreground"><LogOut size={20} /></button>
        </header>

        <main className="dash-main px-4 sm:px-6 md:px-10 py-6 md:py-10 pb-28 md:pb-10">
          <BillingBanner />
          {active !== "galleries" && active !== "invoices" && active !== "deliveries" && <h1 className="hidden md:block font-display text-4xl md:text-5xl font-bold mb-8">{current.label}</h1>}

          {active === "overview" && <Overview pendingReviews={pendingReviews} onNavigate={selectSection} />}

          {active === "bookings" && <BookingsSection onDataChanged={() => {}} />}
          {active === "billing" && <BillingSection />}
          {active === "galleries" && galleriesPaused && <GalleryPaywall />}
          {active === "galleries" && !galleriesPaused && (
            <GalleryAdminProvider>
              <Suspense fallback={<p className="text-muted-foreground">Loading…</p>}>
                {galleryBooking ? <GalleryManager key={galleryBooking} bookingId={galleryBooking} /> : galleryOnly ? <GalleryManager key={galleryOnly} galleryId={galleryOnly} /> : <GalleriesSection />}
              </Suspense>
            </GalleryAdminProvider>
          )}
          {active === "deliveries" && (
            <GalleryAdminProvider>
              <Suspense fallback={<p className="text-muted-foreground">Loading…</p>}>
                <DeliveriesSection />
              </Suspense>
            </GalleryAdminProvider>
          )}
          {active === "calendar" && <CalendarSection />}
          {active === "finance" && <Finance />}
          {active === "invoices" && (
            <GalleryAdminProvider>
              <Suspense fallback={<p className="text-muted-foreground">Loading…</p>}>
                {invoicePath.length ? <InvoiceEditor key={invoicePath.join("/")} path={invoicePath} /> : <InvoicesSection />}
              </Suspense>
            </GalleryAdminProvider>
          )}
          {active === "academy" && <AcademyTable key={"academy-" + refreshKey} onAdd={() => setShowAcademyForm(true)} />}
          {active === "attendance" && <AttendanceSection />}
          {active === "team" && <TeamSection />}
          {active === "emails" && <EmailsSection />}
          {active === "promos" && (
            <div className="space-y-10">
              <PromoManager />
              <StudioSpacePromoManager />
            </div>
          )}
          {active === "content" && <ContentManager />}
          {active === "blog" && <BlogManager />}
          {active === "store" && <StoreManager />}
          {active === "pricing" && <PricingManager />}
          {active === "reviews" && <ReviewsManager />}
        </main>
      </div>

      {/* after any payment is recorded: "send an updated invoice?" */}
      <InvoicePrompt />

      {showAcademyForm && (
        <ManualAcademyForm
          onClose={() => setShowAcademyForm(false)}
          onSuccess={() => setRefreshKey(k => k + 1)}
        />
      )}
    </div>
  );
};

const AdminDashboard = () => (
  <BillingProvider>
    <AdminDashboardInner />
  </BillingProvider>
);

export default AdminDashboard;
