import EntityManager, { type EntityConfig } from "./EntityManager";

const studioSpacePromos: EntityConfig = {
  title: "Studio space promos", noun: "promo", table: "studio_space_promos", idKey: "id", uuid: true,
  orderBy: { column: "created_at", ascending: false },
  toggle: { key: "active", on: "TURN ON", off: "TURN OFF" },
  intro: "Private discount codes for studio space rentals only. These are never listed or shown anywhere on the website — there's no public page or banner for them. Give the code directly to whoever has been told they qualify.",
  beforeSave: (p) => { p.code = String(p.code || "").toUpperCase().trim().replace(/\s+/g, ""); },
  newDefaults: { code: "", percent: 10, expires_on: null, note: "", active: true },
  fields: [
    { key: "code", label: "Code", type: "text", required: true, half: true, lockOnEdit: true, help: "What the client types on the rental page. Saved in capitals automatically." },
    { key: "percent", label: "Discount (%)", type: "number", required: true, half: true },
    { key: "expires_on", label: "Expires on (optional)", type: "date", half: true },
    { key: "active", label: "Active", type: "bool", half: true },
    { key: "note", label: "Private note (for you only — never shown to anyone)", type: "textarea", rows: 2, help: "e.g. who this code is for and why" },
  ],
  columns: [
    { label: "Code", render: (r) => <span className="font-mono font-bold tracking-widest">{r.code}</span> },
    { label: "Discount", render: () => null, inline: { key: "percent" } },
    { label: "Expires", render: (r) => r.expires_on || "Never" },
    { label: "Note", render: (r) => <span className="block max-w-[240px] truncate text-muted-foreground">{r.note || "—"}</span> },
    { label: "Status", switch: { key: "active" } },
  ],
};

const StudioSpacePromoManager = () => (
  <div className="border border-border">
    <div className="px-4 pt-4 pb-2">
      <h2 className="font-display text-xl font-bold tracking-wide">Studio Space Promos</h2>
      <p className="text-xs font-body text-muted-foreground mt-1">
        Separate from the codes above — these only apply on the studio space rental page and are never shown or listed anywhere on the site.
      </p>
    </div>
    <div className="p-4">
      <EntityManager cfg={studioSpacePromos} />
    </div>
  </div>
);

export default StudioSpacePromoManager;
