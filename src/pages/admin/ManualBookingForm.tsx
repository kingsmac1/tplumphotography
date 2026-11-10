import { useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Plus, X } from "lucide-react";
import { shootTypes, genderOptions, paymentStatusOptions, platformOptions } from "./formOptions";
import { useBodyScrollLock } from "./useBodyScrollLock";
import CustomSelect from "./CustomSelect";
import { PaymentFields, paymentForSave, friendlyPaymentError } from "./payment";
import { announcePayment } from "@/features/invoices/events";
import { useBookingPricing } from "@/lib/content";
import { BOOKING_LOCATIONS } from "@/data/pricingDefaults";

interface Props { onClose: () => void; onSuccess: () => void; initial?: { shoot_date?: string; shoot_time?: string } }

const OTHER = "Other";
const locationOptsList = [
  ...BOOKING_LOCATIONS.map((l) => ({ value: l.id, label: l.id.charAt(0).toUpperCase() + l.id.slice(1) })),
  { value: OTHER, label: OTHER },
];
const settingOptsList = [{ value: "indoor", label: "Indoor" }, { value: "outdoor", label: "Outdoor" }];
const shootTypeOptions = [...shootTypes.map((t) => ({ value: t, label: t })), { value: OTHER, label: OTHER }];
const genderOptsList = genderOptions.map((g) => ({ value: g, label: g }));
const platformOptsList = platformOptions.map((p) => ({ value: p, label: p }));
const paymentOptsList = paymentStatusOptions.map((p) => ({ value: p, label: p }));

const formatMoney = (n: number) =>
  new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD", minimumFractionDigits: 0 }).format(n);

const initialForm = {
  full_name: "", gender: "", shoot_type: "", shoot_type_other: "",
  shoot_date: "", shoot_time: "10:00", phone: "", email: "",
  date_of_birth: "", inspiration_links: "",
  location: "", shoot_setting: "",
  selected_service: "", selected_service_other: "", service_price: "", outfits: "1",
  discount: "", coupon_code: "", payment_status: "Not Paid", amount_paid: "", service_summary: "",
};

interface FieldProps {
  name: string;
  label: string;
  required?: boolean;
  fieldErrors: Record<string, string>;
  children: React.ReactNode;
}

// Defined at module scope (not inside the component) so its identity stays
// stable across re-renders. Defining it inside the component would make React
// treat it as a brand-new component type on every keystroke, forcing every
// input inside it to unmount and remount — which drops focus mid-type.
const Field = ({ name, label, required, fieldErrors, children }: FieldProps) => (
  <div>
    <label className="block text-xs font-body font-bold tracking-widest mb-2">{label}{required ? " *" : ""}</label>
    {children}
    {fieldErrors[name] && <p className="text-xs text-destructive mt-1 font-body">{fieldErrors[name]}</p>}
  </div>
);

export default function ManualBookingForm({ onClose, onSuccess, initial }: Props) {
  const [form, setForm] = useState({ ...initialForm, ...initial });
  const [socials, setSocials] = useState<{ platform: string; handle: string }[]>([{ platform: "Instagram", handle: "" }]);
  const [selectedExtras, setSelectedExtras] = useState<string[]>([]);
  const [extraQty, setExtraQty] = useState<Record<string, number>>({});
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useBodyScrollLock(true);

  const set = (field: string, value: string) => {
    setForm((p) => ({ ...p, [field]: value }));
    if (fieldErrors[field]) setFieldErrors((p) => { const n = { ...p }; delete n[field]; return n; });
  };

  // Same price list the public booking form reads, so the admin picks from the same services and extras.
  const pricing = useBookingPricing();
  const isCatalogLocation = BOOKING_LOCATIONS.some((l) => l.id === form.location);
  const services = useMemo(
    () => pricing.services
      .filter((r) => r.location === form.location && r.setting === form.shoot_setting)
      .sort((a, b) => a.sort_order - b.sort_order),
    [pricing.services, form.location, form.shoot_setting],
  );
  const chosenService = services.find((s) => s.name === form.selected_service);
  const isCustomService = form.selected_service === OTHER || (!!form.selected_service && !chosenService);

  // The price field starts from the rate card but stays editable for discounts and custom deals.
  const servicePrice = Number(form.service_price) || 0;
  const pricingMode = chosenService?.pricing_mode === "per_outfit" ? "per_outfit" : chosenService ? "bundle" : "manual";
  const outfits = Math.max(1, Number(form.outfits) || 1);
  const serviceTotal = pricingMode === "per_outfit" ? servicePrice * outfits : servicePrice;

  const availableExtras = useMemo(
    () => pricing.extras
      .filter((r) => r.location === form.location)
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((r) => ({
        name: r.name,
        desc: r.description,
        price: r.follows_package ? servicePrice : r.price,
        maxQty: r.max_qty ?? undefined,
        followsPackage: r.follows_package,
      })),
    [pricing.extras, form.location, servicePrice],
  );
  const qtyOf = (name: string) => extraQty[name] ?? 1;
  const lineTotal = (e: (typeof availableExtras)[number]) => e.price * (e.maxQty ? qtyOf(e.name) : 1);
  const pickedExtras = availableExtras.filter((e) => selectedExtras.includes(e.name));
  const extrasTotal = pickedExtras.reduce((sum, e) => sum + lineTotal(e), 0);
  const discount = Math.max(0, Number(form.discount) || 0);
  const grandTotal = Math.max(0, serviceTotal + extrasTotal - discount);

  const toggleExtra = (name: string) =>
    setSelectedExtras((p) => (p.includes(name) ? p.filter((n) => n !== name) : [...p, name]));
  const changeQty = (name: string, max: number, delta: number) =>
    setExtraQty((p) => ({ ...p, [name]: Math.min(max, Math.max(1, (p[name] ?? 1) + delta)) }));

  const pickLocation = (v: string) => {
    setForm((p) => ({ ...p, location: v, selected_service: "", selected_service_other: "", service_price: "" }));
    setSelectedExtras([]);
    setExtraQty({});
  };
  const pickSetting = (v: string) => {
    setForm((p) => ({ ...p, shoot_setting: v, selected_service: "", selected_service_other: "", service_price: "" }));
  };
  const pickService = (name: string) => {
    const svc = services.find((s) => s.name === name);
    setForm((p) => ({ ...p, selected_service: name, service_price: svc ? String(svc.price) : "" }));
    if (fieldErrors.selected_service) setFieldErrors((p) => { const n = { ...p }; delete n.selected_service; return n; });
  };

  const validate = (): Record<string, string> => {
    const e: Record<string, string> = {};
    if (!form.full_name.trim()) e.full_name = "Full name is required";
    if (!form.phone.trim()) e.phone = "WhatsApp number is required";
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = "Enter a valid email address";
    if (!form.shoot_type) e.shoot_type = "Select a shoot type";
    if (form.shoot_type === OTHER && !form.shoot_type_other.trim()) e.shoot_type_other = "Specify the shoot type";
    if (!form.shoot_date) e.shoot_date = "Shoot date is required";
    if (!form.location) e.location = "Select a location";
    if (!form.shoot_setting) e.shoot_setting = "Select a setting";
    if (!form.selected_service) e.selected_service = "Select a service";
    if (form.selected_service === OTHER && !form.selected_service_other.trim()) e.selected_service_other = "Specify the service";
    if (form.service_price && isNaN(Number(form.service_price))) e.service_price = "Service price must be a number";
    if (form.discount && isNaN(Number(form.discount))) e.discount = "Discount must be a number";
    if (form.payment_status === "Part Payment" && !(Number(form.amount_paid) > 0)) e.amount_paid = "Enter the amount paid so far";
    return e;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      setError("Please fix the highlighted fields below.");
      return;
    }
    setFieldErrors({});
    setSaving(true);

    const finalShootType = form.shoot_type === OTHER ? form.shoot_type_other : form.shoot_type;
    const finalService = form.selected_service === OTHER ? form.selected_service_other : form.selected_service;
    const locationLabel = form.location.charAt(0).toUpperCase() + form.location.slice(1);
    const settingLabel = form.shoot_setting.charAt(0).toUpperCase() + form.shoot_setting.slice(1);
    const extraLabel = (x: (typeof availableExtras)[number]) => (x.maxQty ? `${x.name} x${qtyOf(x.name)}` : x.name);
    // Same conventions as the public form: extra outfits add to the outfit count, extra edited pictures set the count.
    const extraOutfits = pickedExtras.filter((x) => x.followsPackage).reduce((n, x) => n + qtyOf(x.name), 0);
    const extraEdited = pickedExtras.some((x) => x.name === "Extra Edited Picture") ? qtyOf("Extra Edited Picture") : 0;
    const couponNote = discount > 0
      ? `${form.coupon_code.trim() ? `Coupon ${form.coupon_code.trim().toUpperCase()}` : "Discount"}: -${formatMoney(discount)}`
      : "";
    const serviceLine = pricingMode === "per_outfit"
      ? `${finalService} - ${formatMoney(servicePrice)} x ${outfits} outfit${outfits > 1 ? "s" : ""} = ${formatMoney(serviceTotal)}`
      : `${finalService} - ${formatMoney(serviceTotal)}`;
    const autoSummary = couponNote ? `${serviceLine} | ${couponNote}` : serviceLine;

    const payload: Record<string, unknown> = {
      full_name: form.full_name,
      gender: form.gender || null,
      shoot_type: finalShootType,
      shoot_date: form.shoot_date || null,
      shoot_time: form.shoot_time || null,
      phone: form.phone,
      email: form.email || null,
      date_of_birth: form.date_of_birth || null,
      social_handles: socials.filter((s) => s.handle.trim()).map((s) => `${s.platform}: ${s.handle.trim()}`).join(" | ") || null,
      inspiration_links: form.inspiration_links.split("\n").map((l) => l.trim()).filter(Boolean).join(" | ") || null,
      location: locationLabel,
      shoot_setting: settingLabel,
      selected_service: finalService || null,
      service_price: form.service_price ? servicePrice : null,
      service_pricing_mode: pricingMode,
      outfits: outfits + extraOutfits,
      selected_extras: pickedExtras.map(extraLabel).join(" | ") || null,
      extra_edited_count: extraEdited || 1,
      // The Total column reads grand_total, so it has to be set here (the public form does the same).
      service_total: serviceTotal,
      extras_total: extrasTotal,
      grand_total: grandTotal,
      service_summary: form.service_summary.trim() || autoSummary,
      ...paymentForSave(form.payment_status, form.amount_paid, grandTotal),
      source: "manual",
    };

    const { data: added, error: err } = await supabase.from("bookings").insert(payload).select("id");
    if (err) {
      setError(`Save failed: ${friendlyPaymentError(err.message)}`);
      setSaving(false);
      return;
    }
    if ("payment_updated_at" in payload) announcePayment("bookings", (added ?? []).map((r) => r.id), String(payload.payment_status));
    onSuccess();
    onClose();
  };

  const inputCls = "w-full border border-border bg-background px-4 py-2 text-sm font-body outline-none focus:border-foreground";
  const labelCls = "block text-xs font-body font-bold tracking-widest mb-2";
  const errBorder = (k: string) => (fieldErrors[k] ? " border-destructive" : "");

  const serviceOptsList = [
    ...services.map((s) => ({ value: s.name, label: `${s.name} · ${formatMoney(s.price)}` })),
    { value: OTHER, label: "Other (custom)" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 overflow-hidden">
      <div
        className="bg-background border border-border max-w-lg w-full max-h-[85vh] min-h-0 overflow-y-auto overscroll-contain p-6"
        data-lenis-prevent
        style={{ scrollbarGutter: "stable" }}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-display text-2xl font-bold">Add Booking Manually</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X size={20} /></button>
        </div>
        {error && <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md mb-4"><p className="text-sm text-destructive font-body">{error}</p></div>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <Field fieldErrors={fieldErrors} name="full_name" label="Full Name" required>
            <input className={inputCls + errBorder("full_name")} value={form.full_name} onChange={(e) => set("full_name", e.target.value)} />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field fieldErrors={fieldErrors} name="phone" label="WhatsApp Number" required>
              <input className={inputCls + errBorder("phone")} value={form.phone} onChange={(e) => set("phone", e.target.value)} />
            </Field>
            <Field fieldErrors={fieldErrors} name="email" label="Email">
              <input className={inputCls + errBorder("email")} type="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field fieldErrors={fieldErrors} name="gender" label="Gender">
              <CustomSelect value={form.gender} onChange={(v) => set("gender", v)} options={genderOptsList} placeholder="Select..." />
            </Field>
            <Field fieldErrors={fieldErrors} name="date_of_birth" label="Birthday (year ignored)">
              <input className={inputCls} type="date" value={form.date_of_birth} onChange={(e) => set("date_of_birth", e.target.value)} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field fieldErrors={fieldErrors} name="shoot_type" label="Shoot Type" required>
              <CustomSelect value={form.shoot_type} onChange={(v) => set("shoot_type", v)} options={shootTypeOptions} placeholder="Select..." hasError={!!fieldErrors.shoot_type} />
            </Field>
            <Field fieldErrors={fieldErrors} name="shoot_date" label="Shoot Date" required>
              <input className={inputCls + errBorder("shoot_date")} type="date" value={form.shoot_date} onChange={(e) => set("shoot_date", e.target.value)} />
            </Field>
          </div>
          {form.shoot_type === OTHER && (
            <Field fieldErrors={fieldErrors} name="shoot_type_other" label="Specify Shoot Type" required>
              <input className={inputCls + errBorder("shoot_type_other")} value={form.shoot_type_other} onChange={(e) => set("shoot_type_other", e.target.value)} />
            </Field>
          )}
          <Field fieldErrors={fieldErrors} name="shoot_time" label="Shoot Time">
            <input className={inputCls} type="time" value={form.shoot_time} onChange={(e) => set("shoot_time", e.target.value)} />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field fieldErrors={fieldErrors} name="location" label="Location" required>
              <CustomSelect value={form.location} onChange={pickLocation} options={locationOptsList} placeholder="Select..." hasError={!!fieldErrors.location} />
            </Field>
            <Field fieldErrors={fieldErrors} name="shoot_setting" label="Setting" required>
              <CustomSelect value={form.shoot_setting} onChange={pickSetting} options={settingOptsList} placeholder="Select..." hasError={!!fieldErrors.shoot_setting} />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field fieldErrors={fieldErrors} name="selected_service" label="Service" required>
              <CustomSelect value={form.selected_service} onChange={pickService} options={serviceOptsList} placeholder="Select..." hasError={!!fieldErrors.selected_service} />
            </Field>
            <Field fieldErrors={fieldErrors} name="service_price" label={pricingMode === "per_outfit" ? "Price per Outfit (NGN)" : "Service Price (NGN)"}>
              <input className={inputCls + errBorder("service_price")} type="number" min="0" value={form.service_price} onChange={(e) => set("service_price", e.target.value)} />
            </Field>
          </div>
          {form.selected_service === OTHER && (
            <Field fieldErrors={fieldErrors} name="selected_service_other" label="Specify Service" required>
              <input className={inputCls + errBorder("selected_service_other")} value={form.selected_service_other} onChange={(e) => set("selected_service_other", e.target.value)} />
            </Field>
          )}
          {(pricingMode === "per_outfit" || isCustomService || !chosenService) && (
            <Field fieldErrors={fieldErrors} name="outfits" label="Outfits">
              <input className={inputCls} type="number" min="1" value={form.outfits} onChange={(e) => set("outfits", e.target.value)} />
            </Field>
          )}
          {chosenService && <p className="text-xs font-body text-muted-foreground -mt-2">{chosenService.description}</p>}

          <div>
            <label className={labelCls}>Extras</label>
            {!isCatalogLocation ? (
              <p className="text-xs font-body text-muted-foreground">Pick Lagos, Abuja or Uyo to choose from the extras price list.</p>
            ) : availableExtras.length === 0 ? (
              <p className="text-xs font-body text-muted-foreground">No extras are set up for this location.</p>
            ) : (
              <div className="space-y-2 mt-1">
                {availableExtras.map((ex) => {
                  const on = selectedExtras.includes(ex.name);
                  return (
                    <div key={ex.name}>
                      <button
                        type="button"
                        onClick={() => toggleExtra(ex.name)}
                        className={`w-full flex items-center justify-between gap-3 border px-3 py-2 text-left text-sm font-body ${on ? "border-foreground bg-foreground text-background" : "border-border hover:border-foreground"}`}
                      >
                        <span>
                          <span className="block font-bold">{ex.name}</span>
                          <span className="block text-xs opacity-70">{ex.desc}</span>
                        </span>
                        <span className="font-bold whitespace-nowrap">{ex.price ? formatMoney(ex.price) : "Package price"}</span>
                      </button>
                      {on && ex.maxQty && (
                        <div className="flex items-center gap-3 mt-2 px-1">
                          <span className="text-xs font-body font-bold tracking-widest">HOW MANY</span>
                          <button type="button" onClick={() => changeQty(ex.name, ex.maxQty!, -1)} disabled={qtyOf(ex.name) <= 1} className="w-8 h-8 border border-border disabled:opacity-30">−</button>
                          <span className="font-display text-lg font-bold w-6 text-center">{qtyOf(ex.name)}</span>
                          <button type="button" onClick={() => changeQty(ex.name, ex.maxQty!, 1)} disabled={qtyOf(ex.name) >= ex.maxQty} className="w-8 h-8 border border-border disabled:opacity-30">+</button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field fieldErrors={fieldErrors} name="coupon_code" label="Coupon Code">
              <input className={inputCls} value={form.coupon_code} onChange={(e) => set("coupon_code", e.target.value)} placeholder="Optional" />
            </Field>
            <Field fieldErrors={fieldErrors} name="discount" label="Discount (NGN)">
              <input className={inputCls + errBorder("discount")} type="number" min="0" value={form.discount} onChange={(e) => set("discount", e.target.value)} placeholder="0" />
            </Field>
          </div>

          <div className="border border-border p-4 space-y-1 text-sm font-body">
            <div className="flex justify-between"><span className="text-muted-foreground">Service{pricingMode === "per_outfit" ? ` (${formatMoney(servicePrice)} × ${outfits})` : ""}</span><span>{formatMoney(serviceTotal)}</span></div>
            {pickedExtras.map((e) => (
              <div key={e.name} className="flex justify-between"><span className="text-muted-foreground">{e.maxQty ? `${e.name} x${qtyOf(e.name)}` : e.name}</span><span>{formatMoney(lineTotal(e))}</span></div>
            ))}
            {discount > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Discount</span><span>-{formatMoney(discount)}</span></div>}
            <div className="flex justify-between pt-2 mt-2 border-t border-border font-bold"><span>Total</span><span>{formatMoney(grandTotal)}</span></div>
          </div>

          <div>
            <label className={labelCls}>Social Handles</label>
            <div className="space-y-2">
              {socials.map((s, i) => (
                <div key={i} className="grid grid-cols-[130px_1fr_auto] gap-2 items-center">
                  <CustomSelect value={s.platform} onChange={(v) => setSocials((p) => p.map((x, j) => (j === i ? { ...x, platform: v } : x)))} options={platformOptsList} />
                  <input className={inputCls} placeholder="@handle" value={s.handle} onChange={(e) => setSocials((p) => p.map((x, j) => (j === i ? { ...x, handle: e.target.value } : x)))} />
                  {socials.length > 1 && (
                    <button type="button" onClick={() => setSocials((p) => p.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-foreground" aria-label="Remove handle"><X size={16} /></button>
                  )}
                </div>
              ))}
              <button type="button" onClick={() => setSocials((p) => [...p, { platform: "Instagram", handle: "" }])} className="inline-flex items-center gap-1 text-xs font-body font-bold tracking-widest text-muted-foreground hover:text-foreground"><Plus size={14} /> ADD HANDLE</button>
            </div>
          </div>
          <Field fieldErrors={fieldErrors} name="inspiration_links" label="Inspiration Links (one per line)">
            <textarea className={inputCls + " resize-y"} rows={3} value={form.inspiration_links} onChange={(e) => set("inspiration_links", e.target.value)} />
          </Field>
          <Field fieldErrors={fieldErrors} name="service_summary" label="Service Summary (optional — auto-filled if blank)">
            <input className={inputCls} value={form.service_summary} onChange={(e) => set("service_summary", e.target.value)} />
          </Field>
          <PaymentFields status={form.payment_status} amount={form.amount_paid} total={grandTotal} error={fieldErrors.amount_paid} onStatus={(v) => set("payment_status", v)} onAmount={(v) => set("amount_paid", v)} />
          <div className="flex justify-end gap-3 pt-4 border-t border-border">
            <button type="button" onClick={onClose} className="px-6 py-2 text-sm font-body font-medium border border-border hover:bg-muted/50 rounded-md transition-colors">Cancel</button>
            <button type="submit" disabled={saving} className={`px-6 py-2 text-sm font-body font-medium rounded-md transition-colors ${saving ? "bg-muted text-muted-foreground cursor-not-allowed" : "bg-primary text-primary-foreground hover:opacity-90"}`}>{saving ? "Saving..." : "Save Booking"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
