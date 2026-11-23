import { useState, useEffect, lazy, Suspense } from "react";
import { useNavigate } from "@/lib/router-compat";
import AdminLogin from "./AdminLogin";
import BookingsSection from "./BookingsSection";
import CalendarSection from "./CalendarSection";
import AttendanceSection from "./AttendanceSection";
import TeamSection from "./TeamSection";
import Finance from "./Finance";
import PromoManager from "./PromoManager";
import EmailsSection from "./EmailsSection";
import PricingManager from "./PricingManager";
import ClientsSection from "./ClientsSection";
import SettingsSection from "./SettingsSection";
import InstagramPanel from "./InstagramPanel";
import InquiriesSection from "./InquiriesSection";
import { COMPOSE_EVENT } from "./contact";
import { supabase, isSupabaseConfigured } from "@/lib/supabaseClient";
import Overview from "./Overview";
import { GalleryAdminProvider } from "@/features/gallery/admin/kit/data";
// Website CMS (page-by-page editor) and contracts — loaded only when opened
const WebsiteSection = lazy(() => import("@/features/cms/WebsiteSection"));
const ContractsSection = lazy(() => import("@/features/contracts/ContractsSection"));
const VideosSection = lazy(() => import("@/features/videos/VideosSection"));
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
import { ArrowUpRight, Search, LogOut, LayoutDashboard, CalendarDays, UserCheck, Tag, BadgeDollarSign, Wallet, Ellipsis, X, Mail, CalendarRange, GalleryHorizontalEnd, Users, FileText, Timer, Contact, FileSignature, Globe, Camera, Settings, Inbox, Clapperboard } from "lucide-react";

type SectionId = "overview" | "bookings" | "inquiries" | "deliveries" | "galleries" | "calendar" | "clients" | "finance" | "invoices" | "contracts" | "attendance" | "team" | "website" | "videos" | "instagram" | "pricing" | "promos" | "emails" | "settings";
const sections: { id: SectionId; label: string; short: string; icon: typeof LayoutDashboard; group?: string }[] = [
  { id: "overview", label: "Overview", short: "Home", icon: LayoutDashboard },
  { id: "bookings", label: "Bookings", short: "Bookings", icon: CalendarDays, group: "BUSINESS" },
  { id: "inquiries", label: "Enquiries", short: "Enquiries", icon: Inbox },
  { id: "calendar", label: "Calendar", short: "Calendar", icon: CalendarRange },
  { id: "clients", label: "Clients", short: "Clients", icon: Contact },
  { id: "deliveries", label: "Deliveries", short: "Deliveries", icon: Timer },
  { id: "galleries", label: "Client Galleries", short: "Galleries", icon: GalleryHorizontalEnd },
  { id: "invoices", label: "Invoices", short: "Invoices", icon: FileText },
  { id: "contracts", label: "Contracts", short: "Contracts", icon: FileSignature },
  { id: "finance", label: "Finance", short: "Finance", icon: Wallet },
  { id: "attendance", label: "Staff Check-in", short: "Check-in", icon: UserCheck, group: "TEAM" },
  { id: "team", label: "Team & Accounts", short: "Team", icon: Users },
  { id: "website", label: "Website", short: "Website", icon: Globe, group: "WEBSITE" },
  { id: "videos", label: "Videos", short: "Videos", icon: Clapperboard },
  { id: "instagram", label: "Instagram Feed", short: "Instagram", icon: Camera },
  { id: "pricing", label: "Prices & Packages", short: "Prices", icon: BadgeDollarSign },
  { id: "promos", label: "Promo Codes", short: "Promos", icon: Tag },
  { id: "emails", label: "Emails & Messaging", short: "Emails", icon: Mail },
  { id: "settings", label: "Settings", short: "Settings", icon: Settings, group: "ACCOUNT" },
];
// The mobile bottom bar shows these; everything else is under "More".
const mobilePrimary: SectionId[] = ["overview", "bookings", "calendar", "invoices"];

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

/** Things the top-bar search can open: every section, plus a few quick actions. */
const quickActions = [
  { label: "New invoice", hint: "Invoices", hash: "#invoices/new" },
  { label: "New contract", hint: "Contracts", hash: "#contracts/new" },
];

/** The admin's first name for the greeting, when the account has a real name (not just the email's first part). */
const firstName = (full: string | null | undefined, email: string | null | undefined) => {
  const f = (full ?? "").trim();
  if (!f || f.toLowerCase() === String(email ?? "").split("@")[0].toLowerCase()) return "";
  return f.split(/\s+/)[0];
};

function DashSearch({ onOpen }: { onOpen: (id: SectionId) => void }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const term = q.trim().toLowerCase();
  const results = [
    ...sections.filter((sec) => !term || `${sec.label} ${sec.short} ${sec.group ?? ""}`.toLowerCase().includes(term)).map((sec) => ({ key: sec.id, label: sec.label, hint: sec.group ? sec.group.charAt(0) + sec.group.slice(1).toLowerCase() : "Dashboard", go: () => onOpen(sec.id) })),
    ...quickActions.filter((a) => !term || a.label.toLowerCase().includes(term)).map((a) => ({ key: a.hash, label: a.label, hint: a.hint, go: () => { window.location.hash = a.hash; } })),
  ].slice(0, 8);
  const pick = (r: (typeof results)[number]) => { r.go(); setQ(""); setOpen(false); };
  return (
    <div className="relative w-full max-w-[280px]" onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setOpen(false); }}>
      <Search size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
      <input
        value={q} onChange={(e) => { setQ(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)}
        onKeyDown={(e) => { if (e.key === "Enter" && results[0]) pick(results[0]); if (e.key === "Escape") setOpen(false); }}
        placeholder="Search the dashboard" aria-label="Search the dashboard" role="combobox" aria-expanded={open} aria-controls="dash-search-list"
        className="w-full rounded-full bg-white pl-10 pr-4 py-2.5 text-sm font-body outline-none shadow-[var(--dash-shadow)] focus:ring-2 focus:ring-black/10"
      />
      {open && results.length > 0 && (
        <ul id="dash-search-list" role="listbox" className="absolute right-0 left-0 mt-2 z-50 rounded-2xl bg-white p-1.5 shadow-[0_18px_40px_-16px_rgba(0,0,0,.35)]">
          {results.map((r) => (
            <li key={r.key}>
              <button type="button" role="option" aria-selected={false} onClick={() => pick(r)} className="w-full flex items-center justify-between gap-3 rounded-xl px-3 py-2 text-left text-sm font-body hover:bg-[#f2f2f0]">
                <span>{r.label}</span><span className="text-[11px] text-muted-foreground">{r.hint}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const AdminDashboardInner = () => {
  const navigate = useNavigate();
  const visibleSections = sections;
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [pendingReviews] = useState(0);
  const [active, setActive] = useState<SectionId>("overview");
  const [moreOpen, setMoreOpen] = useState(false);
  const [galleryBooking, setGalleryBooking] = useState<string | null>(null);
  const [galleryOnly, setGalleryOnly] = useState<string | null>(null);
  const [invoicePath, setInvoicePath] = useState<string[]>([]);
  const [me, setMe] = useState<{ name: string; email: string }>({ name: "", email: "" });

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
      // Phase A preview only: on the local dev server, before Supabase is connected, open the dashboard without a login
      // so it can be looked around. Production builds never take this path.
      if (import.meta.env.DEV && !isSupabaseConfigured) { setIsAuthenticated(true); return; }
      const { data } = await supabase.auth.getUser();
      const authed = !!data.user;
      setIsAuthenticated(authed);
      if (!authed) { navigate("/dashboard/login"); return; }
      // Staff-role accounts only have access to the check-in page; clients (no staff record) go to their own area.
      const { data: staff } = await supabase.from("staff").select("role, full_name").eq("id", data.user!.id).maybeSingle();
      if (!staff) { window.location.replace("/account"); return; }
      setMe({ name: firstName(staff.full_name, data.user!.email), email: data.user!.email ?? "" });
      if (staff.role === "staff") navigate("/checkin");
    };
    checkAuth();
    // Once per visit. Re-running this on every render looped endlessly and used up the Supabase quota.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  const handleLogout = async () => {
    await supabase.auth.signOut();
    setIsAuthenticated(false);
    navigate("/dashboard/login");
  };

  if (isAuthenticated === null) {
    return <div className="app dash min-h-screen text-foreground flex items-center justify-center">Loading…</div>;
  }
  if (!isAuthenticated) return <AdminLogin />;

  const current = sections.find((sec) => sec.id === active)!;

  const initials = (me.name || me.email || "T").slice(0, 1).toUpperCase();
  // Sections that draw their own heading keep the top bar to search + avatar only
  const ownHeading = active === "galleries" || active === "invoices" || active === "deliveries" || active === "website";

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="px-6 pt-6 pb-4">
        <img src={brandLogoWhite} alt="Tplum Photography" className="h-9 w-auto" />
      </div>
      <nav data-lenis-prevent className="dash-nav flex-1 min-h-0 overflow-y-auto overscroll-contain px-3 pb-4" aria-label="Dashboard sections">
        {visibleSections.map((sec) => {
          const Icon = sec.icon;
          const isActive = sec.id === active;
          return (
            <div key={sec.id}>
              {sec.group && <p className="px-4 pt-3.5 pb-1 text-[10px] font-body font-bold tracking-widest text-white/30">{sec.group}</p>}
              <button
                onClick={() => selectSection(sec.id)}
                aria-current={isActive ? "page" : undefined}
                className={`w-full flex items-center gap-3 rounded-full px-4 py-[7px] text-[13.5px] font-body text-left transition-colors ${
                  isActive ? "bg-white text-[#0a0a0a] font-bold" : "text-white/65 hover:bg-white/10 hover:text-white"
                }`}
              >
                <Icon size={17} strokeWidth={isActive ? 2.25 : 1.75} /> <span className="flex-1">{sec.label}</span>
                {sec.id === "deliveries" && <DeliveryMenuCount />}
              </button>
            </div>
          );
        })}
      </nav>
      <div className="p-3">
        <a href="/" target="_blank" rel="noopener noreferrer" className="group relative flex items-center gap-3 overflow-hidden rounded-[20px] bg-[#ececea] text-[#0a0a0a] p-3.5 hover:bg-white transition-colors">
          <span aria-hidden="true" className="absolute -right-6 -bottom-8 w-20 h-20 rounded-full border-[10px] border-white/70" />
          <span className="relative min-w-0 flex-1">
            <span className="block font-display text-[17px] leading-tight">Your website</span>
            <span className="block text-[11px] font-body text-[#545454] mt-0.5">See what clients see</span>
          </span>
          <span className="relative grid place-items-center w-9 h-9 shrink-0 rounded-full bg-[#0a0a0a] text-white group-hover:bg-[#545454] transition-colors" aria-hidden="true"><ArrowUpRight size={17} /></span>
        </a>
        <button onClick={handleLogout} className="mt-1.5 w-full inline-flex items-center justify-center gap-2 rounded-full px-4 py-2.5 text-xs font-body font-bold tracking-widest text-white/60 hover:text-white hover:bg-white/10 transition-colors">
          <LogOut size={15} /> SIGN OUT
        </button>
      </div>
    </div>
  );

  return (
    <div className="app dash min-h-screen text-foreground">
      {/* Fixed left panel (desktop) */}
      <aside className="hidden md:block fixed top-4 bottom-4 left-4 w-60 rounded-[28px] bg-[#0a0a0a] text-white z-40 overflow-hidden">
        {sidebar}
      </aside>

      {/* Bottom menu (mobile) */}
      <nav className="md:hidden fixed bottom-[max(0.75rem,env(safe-area-inset-bottom))] inset-x-3 z-40 grid grid-cols-5 rounded-[22px] bg-[#0a0a0a] text-white px-1 shadow-[0_14px_30px_-12px_rgba(0,0,0,.5)]">
        {sections.filter((sec) => mobilePrimary.includes(sec.id)).map((sec) => {
          const Icon = sec.icon;
          const isActive = sec.id === active;
          return (
            <button
              key={sec.id}
              onClick={() => selectSection(sec.id)}
              aria-label={sec.label}
              className={`flex flex-col items-center gap-1 py-2.5 text-[10px] font-body transition-colors ${
                isActive ? "text-white font-bold" : "text-white/50"
              }`}
            >
              <span className={`grid place-items-center w-10 h-7 rounded-full ${isActive ? "bg-white text-[#0a0a0a]" : ""}`}><Icon size={18} /></span>
              {sec.short}
            </button>
          );
        })}
        <button
          onClick={() => setMoreOpen(true)}
          aria-label="More"
          className={`flex flex-col items-center gap-1 py-2.5 text-[10px] font-body transition-colors ${
            !mobilePrimary.includes(active) ? "text-white font-bold" : "text-white/50"
          }`}
        >
          <span className="relative"><Ellipsis size={20} />{!mobilePrimary.includes("deliveries") && <DeliveryMenuCount compact />}</span>
          More
        </button>
      </nav>

      {moreOpen && (
        <div className="md:hidden fixed inset-0 z-50 bg-black/60 flex items-end" onClick={() => setMoreOpen(false)}>
          <div className="w-full bg-[#0a0a0a] text-white p-4 pb-8 rounded-t-[28px]" onClick={(e) => e.stopPropagation()}>
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
                    className={`flex flex-col items-center gap-2 py-4 text-[11px] font-body rounded-2xl ${sec.id === active ? "bg-white text-[#0a0a0a] font-bold" : "bg-white/[0.06] text-white/70"}`}
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

      <div className="md:ml-[17rem]">
        {/* Mobile top bar */}
        <header className="md:hidden sticky top-0 z-30 flex items-center justify-between bg-[hsl(var(--dash-page))]/90 backdrop-blur px-4 py-3">
          <img src={brandLogo} alt="Tplum Photography" className="h-8 w-auto" />
          <span className="font-display text-lg font-bold">{current.label}</span>
          <button onClick={handleLogout} aria-label="Logout" className="p-1 text-muted-foreground hover:text-foreground"><LogOut size={20} /></button>
        </header>

        <main className="dash-main px-4 sm:px-6 md:pl-4 md:pr-8 py-6 md:py-8 pb-28 md:pb-10">
          {/* Top bar: greeting or section name, search, avatar */}
          <div className="hidden md:flex items-center justify-between gap-6 mb-7">
            <h1 className="font-display text-3xl lg:text-4xl leading-tight">
              {active === "overview" ? <>Welcome back{me.name ? `, ${me.name}` : ""}</> : ownHeading ? "" : current.label}
            </h1>
            <div className="flex items-center gap-3 flex-1 justify-end">
              <DashSearch onOpen={selectSection} />
              <button onClick={() => selectSection("settings")} title={me.email ? `Signed in as ${me.email}` : "Settings"} aria-label="Account settings"
                className="grid place-items-center w-10 h-10 shrink-0 rounded-full bg-[#0a0a0a] text-white font-display text-lg ring-4 ring-white shadow-[var(--dash-shadow)]">
                {initials}
              </button>
            </div>
          </div>
          {active === "overview" && <h1 className="md:hidden font-display text-3xl mb-5">Welcome back{me.name ? `, ${me.name}` : ""}</h1>}

          {active === "overview" && <Overview pendingReviews={pendingReviews} onNavigate={selectSection} />}

          {active === "bookings" && <BookingsSection onDataChanged={() => {}} />}
          {active === "inquiries" && <InquiriesSection />}
          {active === "clients" && <ClientsSection />}
          {active === "contracts" && <Suspense fallback={<p className="text-muted-foreground">Loading…</p>}><ContractsSection /></Suspense>}
          {active === "website" && <Suspense fallback={<p className="text-muted-foreground">Loading…</p>}><WebsiteSection /></Suspense>}
          {active === "videos" && <Suspense fallback={<p className="text-muted-foreground">Loading…</p>}><VideosSection /></Suspense>}
          {active === "instagram" && <InstagramPanel />}
          {active === "settings" && <SettingsSection />}
          {active === "galleries" && (
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
          {active === "attendance" && <AttendanceSection />}
          {active === "team" && <TeamSection />}
          {active === "emails" && <EmailsSection />}
          {active === "promos" && <PromoManager />}
          {active === "pricing" && <PricingManager />}
        </main>
      </div>

      {/* after any payment is recorded: "send an updated invoice?" */}
      <InvoicePrompt />

    </div>
  );
};

const AdminDashboard = () => <AdminDashboardInner />;

export default AdminDashboard;
