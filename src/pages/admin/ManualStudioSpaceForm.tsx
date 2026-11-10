import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { X } from "lucide-react";
import { useBodyScrollLock } from "./useBodyScrollLock";
import { paymentStatusOptions } from "./formOptions";
import { PaymentFields, paymentForSave, friendlyPaymentError } from "./payment";
import { announcePayment } from "@/features/invoices/events";
import CustomSelect from "./CustomSelect";

interface Props {
  onClose: () => void;
  onSuccess: () => void;
  /** Pass the existing row to edit it instead of creating a new one — e.g. the client wants
   * a longer slot or more extras after the fact. */
  record?: Record<string, unknown>;
}

const emptyForm = {
  full_name: "", phone: "", email: "",
  rental_date: "", rental_time: "10:00",
  space_name: "", space_price: "", duration_minutes: "30",
  selected_extras: "", extras_total: "0",
  notes: "", payment_status: "Not Paid", amount_paid: "",
};

const str = (v: unknown) => (v === null || v === undefined ? "" : String(v));

const formFromRecord = (record: Record<string, unknown>) => ({
  full_name: str(record.full_name),
  phone: str(record.phone),
  email: str(record.email),
  rental_date: str(record.rental_date),
  rental_time: str(record.rental_time) || "10:00",
  space_name: str(record.space_name),
  space_price: str(record.space_price),
  duration_minutes: str(record.duration_minutes) || "30",
  selected_extras: str(record.selected_extras),
  extras_total: str(record.extras_total) || "0",
  notes: str(record.notes),
  payment_status: str(record.payment_status) || "Not Paid",
  amount_paid: str(record.amount_paid),
});

const inputCls = "w-full border border-border bg-background px-4 py-2 text-sm font-body outline-none focus:border-foreground";
const labelCls = "block text-xs font-body font-bold tracking-widest mb-2";

export default function ManualStudioSpaceForm({ onClose, onSuccess, record }: Props) {
  useBodyScrollLock(true);
  const isEdit = !!record;
  const [form, setForm] = useState(() => (record ? formFromRecord(record) : emptyForm));
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const set = (field: string, value: string) => {
    setForm((p) => ({ ...p, [field]: value }));
    if (fieldErrors[field]) setFieldErrors((p) => { const n = { ...p }; delete n[field]; return n; });
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.full_name.trim()) e.full_name = "Full name is required";
    if (!form.phone.trim()) e.phone = "WhatsApp number is required";
    if (!form.space_name.trim()) e.space_name = "Space is required";
    if (form.space_price && isNaN(Number(form.space_price))) e.space_price = "Must be a number";
    if (form.extras_total && isNaN(Number(form.extras_total))) e.extras_total = "Must be a number";
    if (form.payment_status === "Part Payment" && !(Number(form.amount_paid) > 0)) e.amount_paid = "Enter the amount paid so far";
    if (form.duration_minutes && (isNaN(Number(form.duration_minutes)) || Number(form.duration_minutes) <= 0)) e.duration_minutes = "Must be a positive number";
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
    const spacePrice = Number(form.space_price) || 0;
    const extrasTotal = Number(form.extras_total) || 0;
    const payload = {
      full_name: form.full_name,
      phone: form.phone,
      email: form.email || null,
      rental_date: form.rental_date || null,
      rental_time: form.rental_time || null,
      space_name: form.space_name,
      space_price: spacePrice,
      duration_minutes: Number(form.duration_minutes) || 30,
      selected_extras: form.selected_extras,
      extras_total: extrasTotal,
      space_total: spacePrice,
      grand_total: spacePrice + extrasTotal,
      notes: form.notes,
      ...paymentForSave(form.payment_status, form.amount_paid, spacePrice + extrasTotal, record ? { status: str(record.payment_status) || "Not Paid", amount: record.amount_paid == null ? null : Number(record.amount_paid) } : undefined),
    };

    if (isEdit) {
      const { data, error: err } = await supabase
        .from("studio_bookings")
        .update(payload)
        .eq("id", record!.id as string)
        .select("id");
      if (err) { setError(`Save failed: ${friendlyPaymentError(err.message)}`); setSaving(false); return; }
      if (!data || data.length === 0) { setError("Nothing was saved. Make sure your account is an admin in the staff table."); setSaving(false); return; }
      if ("payment_updated_at" in payload) announcePayment("studio_bookings", data.map((r) => r.id), String((payload as Record<string, unknown>).payment_status));
    } else {
      const { data: added, error: err } = await supabase.from("studio_bookings").insert({ ...payload, source: "manual" }).select("id");
      if (err) { setError(`Save failed: ${friendlyPaymentError(err.message)}`); setSaving(false); return; }
      if ("payment_updated_at" in payload) announcePayment("studio_bookings", (added ?? []).map((r) => r.id), String((payload as Record<string, unknown>).payment_status));
    }
    onSuccess();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 overflow-hidden">
      <div className="bg-background border border-border max-w-lg w-full max-h-[85vh] min-h-0 overflow-y-auto overscroll-contain p-6" data-lenis-prevent style={{ scrollbarGutter: "stable" }}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-display text-2xl font-bold">{isEdit ? "Edit Studio Space Booking" : "Add Studio Space Booking Manually"}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X size={20} /></button>
        </div>
        {error && <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md mb-4"><p className="text-sm text-destructive font-body">{error}</p></div>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className={labelCls}>Full Name *</label>
            <input className={inputCls + (fieldErrors.full_name ? " border-destructive" : "")} value={form.full_name} onChange={(e) => set("full_name", e.target.value)} />
            {fieldErrors.full_name && <p className="text-xs text-destructive mt-1 font-body">{fieldErrors.full_name}</p>}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>WhatsApp Number *</label>
              <input className={inputCls + (fieldErrors.phone ? " border-destructive" : "")} value={form.phone} onChange={(e) => set("phone", e.target.value)} />
              {fieldErrors.phone && <p className="text-xs text-destructive mt-1 font-body">{fieldErrors.phone}</p>}
            </div>
            <div><label className={labelCls}>Email</label><input className={inputCls} type="email" value={form.email} onChange={(e) => set("email", e.target.value)} /></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className={labelCls}>Rental Date</label><input className={inputCls} type="date" value={form.rental_date} onChange={(e) => set("rental_date", e.target.value)} /></div>
            <div><label className={labelCls}>Time</label><input className={inputCls} type="time" value={form.rental_time} onChange={(e) => set("rental_time", e.target.value)} /></div>
          </div>
          <div>
            <label className={labelCls}>Space *</label>
            <input className={inputCls + (fieldErrors.space_name ? " border-destructive" : "")} placeholder="e.g. Studio Backdrop (with AC)" value={form.space_name} onChange={(e) => set("space_name", e.target.value)} />
            {fieldErrors.space_name && <p className="text-xs text-destructive mt-1 font-body">{fieldErrors.space_name}</p>}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Space Price ($)</label>
              <input className={inputCls + (fieldErrors.space_price ? " border-destructive" : "")} type="number" value={form.space_price} onChange={(e) => set("space_price", e.target.value)} />
              {fieldErrors.space_price && <p className="text-xs text-destructive mt-1 font-body">{fieldErrors.space_price}</p>}
            </div>
            <div>
              <label className={labelCls}>Duration (minutes)</label>
              <input className={inputCls + (fieldErrors.duration_minutes ? " border-destructive" : "")} type="number" value={form.duration_minutes} onChange={(e) => set("duration_minutes", e.target.value)} />
              {fieldErrors.duration_minutes && <p className="text-xs text-destructive mt-1 font-body">{fieldErrors.duration_minutes}</p>}
              {isEdit && <p className="text-[11px] text-muted-foreground font-body mt-1">Extended their time? Update this and the price together.</p>}
            </div>
          </div>
          <div>
            <label className={labelCls}>Extras (free text, e.g. "Props x2 | Chairs x1")</label>
            <input className={inputCls} value={form.selected_extras} onChange={(e) => set("selected_extras", e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Extras Total ($)</label>
            <input className={inputCls + (fieldErrors.extras_total ? " border-destructive" : "")} type="number" value={form.extras_total} onChange={(e) => set("extras_total", e.target.value)} />
            {fieldErrors.extras_total && <p className="text-xs text-destructive mt-1 font-body">{fieldErrors.extras_total}</p>}
          </div>
          <div className="border border-border px-4 py-3 flex justify-between items-center text-sm font-body">
            <span className="text-muted-foreground">New total</span>
            <span className="font-display text-lg font-bold">
              {new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD", minimumFractionDigits: 0 }).format((Number(form.space_price) || 0) + (Number(form.extras_total) || 0))}
            </span>
          </div>
          <div><label className={labelCls}>Notes</label><textarea className={inputCls + " resize-y"} rows={3} value={form.notes} onChange={(e) => set("notes", e.target.value)} /></div>
          <PaymentFields status={form.payment_status} amount={form.amount_paid} total={(Number(form.space_price) || 0) + (Number(form.extras_total) || 0)} error={fieldErrors.amount_paid} onStatus={(v) => set("payment_status", v)} onAmount={(v) => set("amount_paid", v)} />
          <div className="flex justify-end gap-3 pt-4 border-t border-border">
            <button type="button" onClick={onClose} className="px-6 py-2 text-sm font-body font-medium border border-border hover:bg-muted/50 rounded-md transition-colors">Cancel</button>
            <button type="submit" disabled={saving} className={`px-6 py-2 text-sm font-body font-medium rounded-md transition-colors ${saving ? "bg-muted text-muted-foreground cursor-not-allowed" : "bg-primary text-primary-foreground hover:opacity-90"}`}>{saving ? "Saving..." : isEdit ? "Save Changes" : "Save Booking"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
