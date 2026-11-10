import { useEffect, useState, type ReactNode } from "react";
import { Loader2, Upload } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { markManaged } from "@/lib/content";
import { DEFAULT_BOOKING_EXTRAS, DEFAULT_BOOKING_PRICES } from "@/data/pricingDefaults";
import { DEFAULT_WEDDING_EXTRAS, DEFAULT_WEDDING_PACKAGES } from "@/data/weddingDefaults";
import { DEFAULT_STUDIO_SPACE_EXTRAS, DEFAULT_STUDIO_SPACE_PRICES } from "@/data/studioSpaceDefaults";
import { DEFAULT_ACADEMY_PLANS } from "@/data/academyDefaults";
import EntityManager, { type EntityConfig } from "./EntityManager";

const money = (n: number) => new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD", minimumFractionDigits: 0 }).format(n);
const slugify = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

const locationOptions = [
  { value: "uyo", label: "Uyo" },
  { value: "lagos", label: "Lagos" },
  { value: "abuja", label: "Abuja" },
];
const settingOptions = [
  { value: "indoor", label: "Indoor" },
  { value: "outdoor", label: "Outdoor" },
];

const statusBadge = (on: boolean) => (
  <span className={`inline-block px-2 py-0.5 text-[11px] font-body font-bold tracking-wider border ${on ? "border-green-600 text-green-700" : "border-border text-muted-foreground"}`}>
    {on ? "ACTIVE" : "OFF"}
  </span>
);
const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : "");

const bookingPrices: EntityConfig = {
  title: "Booking prices", noun: "price", table: "booking_prices", idKey: "id", uuid: true, gated: true,
  orderBy: { column: "sort_order", ascending: true }, reorderKey: "sort_order",
  toggle: { key: "active", on: "TURN ON", off: "TURN OFF" },
  filters: [
    { key: "location", label: "Location", options: locationOptions },
    { key: "setting", label: "Setting", options: settingOptions },
  ],
  intro: "The packages clients choose from on the Booking page. Change a price in its box; it updates on the website straight away.",
  newDefaults: { location: "uyo", setting: "indoor", service_id: "", name: "", description: "", price: 0, pricing_mode: "bundle", sort_order: 0, active: true },
  beforeSave: (p) => { if (!p.service_id) p.service_id = slugify(String(p.name)); },
  fields: [
    { key: "location", label: "Location", type: "select", options: locationOptions, half: true },
    { key: "setting", label: "Setting", type: "select", options: settingOptions, half: true },
    { key: "name", label: "Package name", type: "text", required: true, help: "e.g. Individual, Couple, Group/Family" },
    { key: "description", label: "Short description", type: "text", help: "e.g. 1 outfit · 3 edited images" },
    { key: "price", label: "Price ($)", type: "number", required: true, half: true },
    { key: "pricing_mode", label: "Pricing type", type: "select", half: true, options: [{ value: "bundle", label: "Flat price" }, { value: "per_outfit", label: "Price × number of outfits" }] },
    { key: "active", label: "Shown on the Booking page", type: "bool" },
  ],
  columns: [
    { label: "Location", render: (r) => cap(r.location) },
    { label: "Setting", render: (r) => cap(r.setting) },
    { label: "Package", render: (r) => <span className="font-medium">{r.name}</span> },
    { label: "Description", render: (r) => r.description || "—" },
    { label: "Price ($)", render: () => null, inline: { key: "price" } },
    { label: "Status", render: (r) => statusBadge(r.active) },
  ],
};

const bookingExtras: EntityConfig = {
  title: "Booking extras", noun: "extra", table: "booking_extras", idKey: "id", uuid: true, gated: true,
  orderBy: { column: "sort_order", ascending: true }, reorderKey: "sort_order",
  toggle: { key: "active", on: "TURN ON", off: "TURN OFF" },
  filters: [{ key: "location", label: "Location", options: locationOptions }],
  intro: "Add-ons shown on the Booking page. “Same as package” extras (like Extra Outfit) cost whatever package the client picked.",
  newDefaults: { location: "uyo", name: "", description: "", price: 0, max_qty: null, follows_package: false, sort_order: 0, active: true },
  fields: [
    { key: "location", label: "Location", type: "select", options: locationOptions, half: true },
    { key: "name", label: "Extra name", type: "text", required: true, half: true },
    { key: "description", label: "Short description", type: "text" },
    { key: "price", label: "Price ($)", type: "number", half: true, help: "Ignored when “same price as the package” is ticked." },
    { key: "max_qty", label: "Maximum quantity", type: "number", nullable: true, half: true, help: "Leave empty for a simple tick box. A number lets the client choose how many, up to that number." },
    { key: "follows_package", label: "Same price as the package the client picked", type: "bool" },
    { key: "active", label: "Shown on the Booking page", type: "bool" },
  ],
  columns: [
    { label: "Location", render: (r) => cap(r.location) },
    { label: "Extra", render: (r) => <span className="font-medium">{r.name}</span> },
    { label: "Description", render: (r) => r.description || "—" },
    { label: "Price ($)", render: () => null, inline: { key: "price" } },
    { label: "Notes", render: (r) => [r.follows_package ? "same as package" : "", r.max_qty ? `up to ${r.max_qty}` : ""].filter(Boolean).join(" · ") || "—" },
    { label: "Status", render: (r) => statusBadge(r.active) },
  ],
};

const weddingPackages: EntityConfig = {
  title: "Wedding packages", noun: "package", table: "wedding_packages", idKey: "id", slugFrom: "name", gated: true,
  orderBy: { column: "sort_order", ascending: true }, reorderKey: "sort_order",
  toggle: { key: "active", on: "TURN ON", off: "TURN OFF" },
  filters: [{ key: "location", label: "Location", options: locationOptions }],
  intro: "Packages shown on the Weddings page, priced per location (Uyo, Lagos, Abuja). Use the Location filter, then change a price in its box. Leave “two events” empty for single-price packages such as Court Marriage.",
  newDefaults: { location: "uyo", name: "", tagline: "", includes: [], one_event: 0, two_events: null, featured: false, sort_order: 0, active: true },
  fields: [
    { key: "location", label: "Location", type: "select", options: locationOptions, half: true },
    { key: "name", label: "Package name", type: "text", required: true, half: true },
    { key: "tagline", label: "Tagline", type: "text", half: true },
    { key: "includes", label: "What's included", type: "lines", rows: 9, help: "One item per line." },
    { key: "one_event", label: "Price — one event ($)", type: "number", required: true, half: true },
    { key: "two_events", label: "Price — two events ($)", type: "number", nullable: true, half: true, help: "Leave empty if there is only one price." },
    { key: "featured", label: "Highlight as the recommended package", type: "bool" },
    { key: "active", label: "Shown on the Weddings page", type: "bool" },
  ],
  columns: [
    { label: "Location", render: (r) => cap(r.location || "uyo") },
    { label: "Package", render: (r) => <span className="font-medium">{r.name}{r.featured ? " ★" : ""}</span> },
    { label: "Tagline", render: (r) => r.tagline || "—" },
    { label: "One event ($)", render: () => null, inline: { key: "one_event" } },
    { label: "Two events", render: (r) => (r.two_events ? money(r.two_events) : "—") },
    { label: "Status", render: (r) => statusBadge(r.active) },
  ],
};

const weddingExtras: EntityConfig = {
  title: "Wedding add-ons", noun: "add-on", table: "wedding_extras", idKey: "id", uuid: true, gated: true,
  orderBy: { column: "sort_order", ascending: true }, reorderKey: "sort_order",
  toggle: { key: "active", on: "TURN ON", off: "TURN OFF" },
  filters: [{ key: "location", label: "Location", options: locationOptions }],
  intro: "Add-ons shown on the Weddings page, priced per location. Use the Location filter, then change a price in its box.",
  newDefaults: { location: "uyo", name: "", price: 0, sort_order: 0, active: true },
  fields: [
    { key: "location", label: "Location", type: "select", options: locationOptions, half: true },
    { key: "name", label: "Add-on name", type: "text", required: true, half: true },
    { key: "price", label: "Price ($)", type: "number", required: true, half: true },
    { key: "active", label: "Shown on the Weddings page", type: "bool" },
  ],
  columns: [
    { label: "Location", render: (r) => cap(r.location || "uyo") },
    { label: "Add-on", render: (r) => <span className="font-medium">{r.name}</span> },
    { label: "Price ($)", render: () => null, inline: { key: "price" } },
    { label: "Status", render: (r) => statusBadge(r.active) },
  ],
};

const studioSpacePrices: EntityConfig = {
  title: "Studio space prices", noun: "space", table: "studio_space_prices", idKey: "id", slugFrom: "name", gated: true,
  orderBy: { column: "sort_order", ascending: true }, reorderKey: "sort_order",
  toggle: { key: "active", on: "TURN ON", off: "TURN OFF" },
  intro: "Spaces shown on the /studiospace rental page.",
  newDefaults: { name: "", description: "30 minutes", price: 0, duration_minutes: 30, sort_order: 0, active: true },
  fields: [
    { key: "name", label: "Space name", type: "text", required: true },
    { key: "description", label: "Short description", type: "text", half: true },
    { key: "duration_minutes", label: "Duration (minutes)", type: "number", half: true },
    { key: "price", label: "Price ($)", type: "number", required: true, half: true },
    { key: "active", label: "Shown on the rental page", type: "bool" },
  ],
  columns: [
    { label: "Space", render: (r) => <span className="font-medium">{r.name}</span> },
    { label: "Description", render: (r) => r.description || "—" },
    { label: "Duration (min)", render: (r) => r.duration_minutes },
    { label: "Price ($)", render: () => null, inline: { key: "price" } },
    { label: "Status", render: (r) => statusBadge(r.active) },
  ],
};

const studioSpaceExtras: EntityConfig = {
  title: "Studio space extras", noun: "extra", table: "studio_space_extras", idKey: "id", slugFrom: "name", gated: true,
  orderBy: { column: "sort_order", ascending: true }, reorderKey: "sort_order",
  toggle: { key: "active", on: "TURN ON", off: "TURN OFF" },
  intro: "Add-ons shown on the rental page. “Same as space” extras (like Extra 30 Minutes) cost whatever space the client picked.",
  newDefaults: { name: "", description: "", price: 0, max_qty: null, follows_package: false, sort_order: 0, active: true },
  fields: [
    { key: "name", label: "Extra name", type: "text", required: true, half: true },
    { key: "description", label: "Short description", type: "text", half: true },
    { key: "price", label: "Price ($)", type: "number", half: true, help: "Ignored when “same price as the space” is ticked." },
    { key: "max_qty", label: "Maximum quantity", type: "number", nullable: true, half: true },
    { key: "follows_package", label: "Same price as the space the client picked", type: "bool" },
    { key: "active", label: "Shown on the rental page", type: "bool" },
  ],
  columns: [
    { label: "Extra", render: (r) => <span className="font-medium">{r.name}</span> },
    { label: "Description", render: (r) => r.description || "—" },
    { label: "Price ($)", render: () => null, inline: { key: "price" } },
    { label: "Notes", render: (r) => [r.follows_package ? "same as space" : "", r.max_qty ? `up to ${r.max_qty}` : ""].filter(Boolean).join(" · ") || "—" },
    { label: "Status", render: (r) => statusBadge(r.active) },
  ],
};

const academyPlans: EntityConfig = {
  title: "Academy plans", noun: "plan", table: "academy_plans", idKey: "id", slugFrom: "name", gated: true,
  orderBy: { column: "sort_order", ascending: true }, reorderKey: "sort_order",
  toggle: { key: "active", on: "TURN ON", off: "TURN OFF" },
  intro: "The tuition plans shown on the Academy page's application form. Mark one plan “headline tuition fee” — that's the figure shown as the page's Tuition Fee.",
  newDefaults: { name: "", amount: 0, description: "", is_full_payment: false, sort_order: 0, active: true },
  fields: [
    { key: "name", label: "Plan name", type: "text", required: true, help: "e.g. Full Payment, Part Payment – First Installment" },
    { key: "amount", label: "Amount ($)", type: "number", required: true, half: true },
    { key: "is_full_payment", label: "Show as the headline Tuition Fee", type: "bool", half: true },
    { key: "description", label: "Description shown under the plan", type: "textarea", rows: 2, help: "e.g. installment breakdown or payment terms" },
    { key: "active", label: "Shown on the Academy page", type: "bool" },
  ],
  columns: [
    { label: "Plan", render: (r) => <span className="font-medium">{r.name}{r.is_full_payment ? " ★" : ""}</span> },
    { label: "Amount ($)", render: () => null, inline: { key: "amount" } },
    { label: "Description", render: (r) => <span className="block max-w-[280px] truncate">{r.description || "—"}</span> },
    { label: "Status", render: (r) => statusBadge(r.active) },
  ],
};

/** Shows a one-time "load current prices" step for a group of price tables. */
const Gate = ({ flagKey, label, importAll, children }: { flagKey: string; label: string; importAll: () => Promise<void>; children: ReactNode }) => {
  const [managed, setManaged] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  useEffect(() => {
    supabase.from("content_flags").select("managed").eq("key", flagKey).maybeSingle().then(({ data }) => setManaged(!!data?.managed));
  }, [flagKey]);
  if (managed === null) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (!managed) {
    return (
      <div className="border border-dashed border-border p-8 max-w-2xl">
        <p className="font-display text-xl font-bold mb-2">{label}</p>
        <p className="text-sm font-body text-muted-foreground mb-4">
          The website is showing its built-in prices. Load them into the dashboard to start editing — nothing changes on the site until you change a price.
        </p>
        {err && <p className="text-sm text-destructive mb-3">{err}</p>}
        <button
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-body font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50"
          disabled={busy}
          onClick={async () => {
            setBusy(true); setErr("");
            try { await importAll(); await markManaged(flagKey); setManaged(true); }
            catch (e) { setErr(e instanceof Error ? e.message : "Import failed"); }
            finally { setBusy(false); }
          }}
        >
          {busy ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />} Load current prices
        </button>
      </div>
    );
  }
  return <>{children}</>;
};

const strip = <T extends { id: string }>(rows: T[]) => rows.map(({ id: _id, ...rest }) => rest);

const importBooking = async () => {
  const a = await supabase.from("booking_prices").insert(strip(DEFAULT_BOOKING_PRICES));
  if (a.error) throw new Error(a.error.message);
  const b = await supabase.from("booking_extras").insert(strip(DEFAULT_BOOKING_EXTRAS));
  if (b.error) throw new Error(b.error.message);
};

// Same default prices for all three locations. Uyo keeps the plain id ("pearl") so it matches rows
// created before locations existed; Lagos and Abuja get a location prefix.
const importWedding = async () => {
  const a = await supabase.from("wedding_packages").insert(
    locationOptions.flatMap((loc) =>
      DEFAULT_WEDDING_PACKAGES.map((p, i) => ({
        id: loc.value === "uyo" ? p.id : `${loc.value}-${p.id}`,
        location: loc.value, name: p.name, tagline: p.tagline, includes: p.includes, one_event: p.oneEvent,
        two_events: p.twoEvents ?? null, featured: !!p.featured, sort_order: i + 1, active: true,
      })),
    ),
  );
  if (a.error) throw new Error(a.error.message);
  const b = await supabase.from("wedding_extras").insert(
    locationOptions.flatMap((loc) =>
      DEFAULT_WEDDING_EXTRAS.map((e, i) => ({ location: loc.value, name: e.name, price: e.price, sort_order: i + 1, active: true })),
    ),
  );
  if (b.error) throw new Error(b.error.message);
};

// Studio space ids are meaningful text (e.g. "backdrop-no-ac"), not database-generated,
// so — unlike booking prices — the id is kept rather than stripped.
const importStudioSpace = async () => {
  const a = await supabase.from("studio_space_prices").insert(
    DEFAULT_STUDIO_SPACE_PRICES.map((p, i) => ({ ...p, sort_order: i + 1, active: true })),
  );
  if (a.error) throw new Error(a.error.message);
  const b = await supabase.from("studio_space_extras").insert(
    DEFAULT_STUDIO_SPACE_EXTRAS.map(({ followsSpace, ...rest }, i) => ({ ...rest, follows_package: !!followsSpace, sort_order: i + 1, active: true })),
  );
  if (b.error) throw new Error(b.error.message);
};

const importAcademyPlans = async () => {
  const { error } = await supabase.from("academy_plans").insert(
    DEFAULT_ACADEMY_PLANS.map((p, i) => ({
      id: p.id, name: p.name, amount: p.amount, description: p.description, is_full_payment: p.isFullPayment, sort_order: i + 1, active: true,
    })),
  );
  if (error) throw new Error(error.message);
};

const tabs = [
  { id: "booking", label: "Booking prices" },
  { id: "extras", label: "Booking extras" },
  { id: "wpackages", label: "Wedding packages" },
  { id: "wextras", label: "Wedding add-ons" },
  { id: "sspace", label: "Studio space prices" },
  { id: "sextras", label: "Studio space extras" },
  { id: "academy", label: "Academy plans" },
] as const;

const PricingManager = () => {
  const [tab, setTab] = useState<(typeof tabs)[number]["id"]>("booking");
  return (
    <div>
      <div className="flex gap-2 mb-6 overflow-x-auto">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 text-xs font-body font-bold tracking-widest border whitespace-nowrap transition-colors ${
              tab === t.id ? "bg-foreground text-background border-foreground" : "border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label.toUpperCase()}
          </button>
        ))}
      </div>
      {(tab === "booking" || tab === "extras") && (
        <Gate flagKey="booking_prices" label="Booking prices" importAll={importBooking}>
          {tab === "booking" ? <EntityManager key="bp" cfg={bookingPrices} /> : <EntityManager key="be" cfg={bookingExtras} />}
        </Gate>
      )}
      {(tab === "wpackages" || tab === "wextras") && (
        <Gate flagKey="wedding_prices" label="Wedding prices" importAll={importWedding}>
          {tab === "wpackages" ? <EntityManager key="wp" cfg={weddingPackages} /> : <EntityManager key="we" cfg={weddingExtras} />}
        </Gate>
      )}
      {(tab === "sspace" || tab === "sextras") && (
        <Gate flagKey="studio_space_prices" label="Studio space prices" importAll={importStudioSpace}>
          {tab === "sspace" ? <EntityManager key="sp" cfg={studioSpacePrices} /> : <EntityManager key="se" cfg={studioSpaceExtras} />}
        </Gate>
      )}
      {tab === "academy" && (
        <Gate flagKey="academy_plans" label="Academy plans" importAll={importAcademyPlans}>
          <EntityManager key="ap" cfg={academyPlans} />
        </Gate>
      )}
    </div>
  );
};

export default PricingManager;
