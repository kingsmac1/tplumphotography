import { useState } from "react";
import EntityManager, { type EntityConfig } from "./EntityManager";
import BusinessSettingsPanel from "./BusinessSettingsPanel";

const money = (n: number) => new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD", minimumFractionDigits: 0 }).format(n);
const slugify = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

const settingOptions = [
  { value: "indoor", label: "Studio (indoor)" },
  { value: "outdoor", label: "On location (outdoor)" },
];

const statusBadge = (on: boolean) => (
  <span className={`inline-block px-2 py-0.5 text-[11px] font-body font-bold tracking-wider border ${on ? "border-green-600 text-green-700" : "border-border text-muted-foreground"}`}>
    {on ? "ACTIVE" : "OFF"}
  </span>
);
/** Placeholder prices seeded at launch carry this badge until the photographer edits them (never shown on the website). */
const sampleBadge = (r: Record<string, unknown>) => (r.sample ? <span className="sample-badge ml-2" title="Placeholder price. Change it and the badge disappears.">Sample: edit me</span> : null);
const clearSample = (p: Record<string, unknown>) => { p.sample = false; };
const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : "");

const bookingPrices: EntityConfig = {
  title: "Booking prices", noun: "price", table: "booking_prices", idKey: "id", uuid: true,
  orderBy: { column: "sort_order", ascending: true }, reorderKey: "sort_order",
  toggle: { key: "active", on: "TURN ON", off: "TURN OFF" },
  filters: [
    { key: "setting", label: "Setting", options: settingOptions },
  ],
  intro: "The session packages clients choose from on the Booking page. Change a price in its box; it updates on the website straight away. Prices marked “Sample: edit me” are placeholders.",
  newDefaults: { setting: "indoor", service_id: "", name: "", description: "", price: 0, pricing_mode: "bundle", duration_minutes: 60, sort_order: 0, active: true },
  beforeSave: (p) => { if (!p.service_id) p.service_id = slugify(String(p.name)); clearSample(p); },
  fields: [
    { key: "setting", label: "Setting", type: "select", options: settingOptions, half: true },
    { key: "name", label: "Package name", type: "text", required: true, help: "e.g. Individual, Couple, Group/Family" },
    { key: "description", label: "What's included", type: "text", help: "Separate items with “ · ”, e.g. 60 Mins Studio Session · Up to 2 Outfits · 7 Highly retouched images. Each item shows as its own line." },
    { key: "price", label: "Price ($, before GST)", type: "number", required: true, half: true },
    { key: "pricing_mode", label: "Pricing type", type: "select", half: true, options: [{ value: "bundle", label: "Flat price" }, { value: "per_outfit", label: "Price × number of outfits" }] },
    { key: "duration_minutes", label: "Session length (minutes)", type: "number", half: true, help: "How long the session is, e.g. 60, 90 or 120. The calendar keeps that much time free." },
    { key: "active", label: "Shown on the Booking page", type: "bool" },
  ],
  columns: [
    { label: "Setting", render: (r) => (r.setting === "outdoor" ? "On location" : "Studio") },
    { label: "Package", render: (r) => <span className="font-medium">{r.name}{sampleBadge(r)}</span> },
    { label: "Description", render: (r) => r.description || "—" },
    { label: "Price ($)", render: () => null, inline: { key: "price" } },
    { label: "Status", render: (r) => statusBadge(r.active) },
  ],
};

const bookingExtras: EntityConfig = {
  title: "Booking extras", noun: "extra", table: "booking_extras", beforeSave: clearSample, idKey: "id", uuid: true,
  orderBy: { column: "sort_order", ascending: true }, reorderKey: "sort_order",
  toggle: { key: "active", on: "TURN ON", off: "TURN OFF" },
  intro: "Add-ons shown on the Booking page. “Same as package” extras (like Extra Outfit) cost whatever package the client picked.",
  newDefaults: { name: "", description: "", price: 0, max_qty: null, follows_package: false, extra_minutes: 0, sort_order: 0, active: true },
  fields: [
    { key: "name", label: "Extra name", type: "text", required: true, half: true },
    { key: "description", label: "Short description", type: "text" },
    { key: "price", label: "Price ($)", type: "number", half: true, help: "Ignored when “same price as the package” is ticked." },
    { key: "max_qty", label: "Maximum quantity", type: "number", nullable: true, half: true, help: "Leave empty for a simple tick box. A number lets the client choose how many, up to that number." },
    { key: "extra_minutes", label: "Adds time to the session (minutes, per one)", type: "number", half: true, help: "e.g. 30 for “Extra 30 Minutes”. The booking calendar keeps that much more time free. 0 for extras that don't add time." },
    { key: "follows_package", label: "Same price as the package the client picked", type: "bool" },
    { key: "active", label: "Shown on the Booking page", type: "bool" },
  ],
  columns: [
    { label: "Extra", render: (r) => <span className="font-medium">{r.name}{sampleBadge(r)}</span> },
    { label: "Description", render: (r) => r.description || "—" },
    { label: "Price ($)", render: () => null, inline: { key: "price" } },
    { label: "Notes", render: (r) => [r.follows_package ? "same as package" : "", r.max_qty ? `up to ${r.max_qty}` : "", Number(r.extra_minutes) ? `+${r.extra_minutes} min each` : ""].filter(Boolean).join(" · ") || "—" },
    { label: "Status", render: (r) => statusBadge(r.active) },
  ],
};

const weddingPackages: EntityConfig = {
  title: "Wedding packages", noun: "package", table: "wedding_packages", beforeSave: clearSample, idKey: "id", slugFrom: "name",
  orderBy: { column: "sort_order", ascending: true }, reorderKey: "sort_order",
  toggle: { key: "active", on: "TURN ON", off: "TURN OFF" },
  intro: "Packages shown on the Wedding booking page. “Two days” is for couples who book two days of coverage (for example a traditional and a white wedding); leave it empty for single-price packages.",
  newDefaults: { name: "", tagline: "", includes: [], one_event: 0, two_events: null, featured: false, sort_order: 0, active: true },
  fields: [
    { key: "name", label: "Package name", type: "text", required: true, half: true },
    { key: "tagline", label: "Tagline", type: "text", half: true },
    { key: "includes", label: "What's included", type: "lines", rows: 9, help: "One item per line." },
    { key: "one_event", label: "Price — one day ($)", type: "number", required: true, half: true },
    { key: "two_events", label: "Price — two days ($)", type: "number", nullable: true, half: true, help: "Leave empty if there is only one price." },
    { key: "featured", label: "Highlight as the recommended package", type: "bool" },
    { key: "active", label: "Shown on the Weddings page", type: "bool" },
  ],
  columns: [
    { label: "Package", render: (r) => <span className="font-medium">{r.name}{r.featured ? " ★" : ""}{sampleBadge(r)}</span> },
    { label: "Tagline", render: (r) => r.tagline || "—" },
    { label: "One day ($)", render: () => null, inline: { key: "one_event" } },
    { label: "Two days", render: (r) => (r.two_events ? money(r.two_events) : "—") },
    { label: "Status", render: (r) => statusBadge(r.active) },
  ],
};

const weddingExtras: EntityConfig = {
  title: "Wedding add-ons", noun: "add-on", table: "wedding_extras", beforeSave: clearSample, idKey: "id", uuid: true,
  orderBy: { column: "sort_order", ascending: true }, reorderKey: "sort_order",
  toggle: { key: "active", on: "TURN ON", off: "TURN OFF" },
  intro: "Add-ons shown on the Wedding booking page. Change a price in its box.",
  newDefaults: { name: "", price: 0, sort_order: 0, active: true },
  fields: [
    { key: "name", label: "Add-on name", type: "text", required: true, half: true },
    { key: "price", label: "Price ($)", type: "number", required: true, half: true },
    { key: "active", label: "Shown on the Weddings page", type: "bool" },
  ],
  columns: [
    { label: "Add-on", render: (r) => <span className="font-medium">{r.name}{sampleBadge(r)}</span> },
    { label: "Price ($)", render: () => null, inline: { key: "price" } },
    { label: "Status", render: (r) => statusBadge(r.active) },
  ],
};

const studioSpacePrices: EntityConfig = {
  title: "Studio space prices", noun: "space", table: "studio_space_prices", beforeSave: clearSample, idKey: "id", slugFrom: "name",
  orderBy: { column: "sort_order", ascending: true }, reorderKey: "sort_order",
  toggle: { key: "active", on: "TURN ON", off: "TURN OFF" },
  intro: "Spaces shown on the Studio rental page (/studio-space/).",
  newDefaults: { name: "", description: "1 hour", price: 0, duration_minutes: 60, sort_order: 0, active: true },
  fields: [
    { key: "name", label: "Space name", type: "text", required: true },
    { key: "description", label: "Short description", type: "text", half: true },
    { key: "duration_minutes", label: "Duration (minutes)", type: "number", half: true },
    { key: "price", label: "Price ($)", type: "number", required: true, half: true },
    { key: "active", label: "Shown on the rental page", type: "bool" },
  ],
  columns: [
    { label: "Space", render: (r) => <span className="font-medium">{r.name}{sampleBadge(r)}</span> },
    { label: "Description", render: (r) => r.description || "—" },
    { label: "Duration (min)", render: (r) => r.duration_minutes },
    { label: "Price ($)", render: () => null, inline: { key: "price" } },
    { label: "Status", render: (r) => statusBadge(r.active) },
  ],
};

const studioSpaceExtras: EntityConfig = {
  title: "Studio space extras", noun: "extra", table: "studio_space_extras", beforeSave: clearSample, idKey: "id", slugFrom: "name",
  orderBy: { column: "sort_order", ascending: true }, reorderKey: "sort_order",
  toggle: { key: "active", on: "TURN ON", off: "TURN OFF" },
  intro: "Add-ons shown on the rental page. “Same as space” extras (like Extra Hour) cost whatever space the client picked.",
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
    { label: "Extra", render: (r) => <span className="font-medium">{r.name}{sampleBadge(r)}</span> },
    { label: "Description", render: (r) => r.description || "—" },
    { label: "Price ($)", render: () => null, inline: { key: "price" } },
    { label: "Notes", render: (r) => [r.follows_package ? "same as space" : "", r.max_qty ? `up to ${r.max_qty}` : ""].filter(Boolean).join(" · ") || "—" },
    { label: "Status", render: (r) => statusBadge(r.active) },
  ],
};

const tabs = [
  { id: "booking", label: "Session prices" },
  { id: "extras", label: "Session extras" },
  { id: "wpackages", label: "Wedding packages" },
  { id: "wextras", label: "Wedding add-ons" },
  { id: "deposit", label: "Deposit & terms" },
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
      {tab === "booking" && <EntityManager key="bp" cfg={bookingPrices} />}
      {tab === "extras" && <EntityManager key="be" cfg={bookingExtras} />}
      {tab === "wpackages" && <EntityManager key="wp" cfg={weddingPackages} />}
      {tab === "wextras" && <EntityManager key="we" cfg={weddingExtras} />}
      {tab === "deposit" && <BusinessSettingsPanel only="deposit" />}
    </div>
  );
};

export default PricingManager;
