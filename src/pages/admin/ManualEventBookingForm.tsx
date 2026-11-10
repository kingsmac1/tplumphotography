import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { X } from "lucide-react";
import { useBodyScrollLock } from "./useBodyScrollLock";
import { paymentStatusOptions, formatMoney } from "./formOptions";
import { PaymentFields, paymentForSave, friendlyPaymentError } from "./payment";
import { announcePayment } from "@/features/invoices/events";
import CustomSelect from "./CustomSelect";
import { EVENT_TYPES, OTHER_EVENT_TYPE } from "@/data/eventTypes";

interface Props {
  onClose: () => void;
  onSuccess: () => void;
  /** Pass the existing row to edit it instead of creating a new one. */
  record?: Record<string, unknown>;
}

const emptyForm = {
  full_name: "", phone: "", email: "",
  event_choice: "", event_other: "",
  event_start_date: "", event_end_date: "", event_time: "",
  venue: "", expected_guests: "",
  agreed_amount: "", notes: "", payment_status: "Not Paid", amount_paid: "",
};

const str = (v: unknown) => (v === null || v === undefined ? "" : String(v));

const formFromRecord = (record: Record<string, unknown>) => {
  const type = str(record.event_type);
  const isPreset = (EVENT_TYPES as string[]).includes(type);
  return {
    full_name: str(record.full_name),
    phone: str(record.phone),
    email: str(record.email),
    event_choice: isPreset ? type : type ? OTHER_EVENT_TYPE : "",
    event_other: isPreset ? "" : type,
    event_start_date: str(record.event_start_date),
    event_end_date: str(record.event_end_date),
    event_time: str(record.event_time),
    venue: str(record.venue),
    expected_guests: str(record.expected_guests),
    agreed_amount: str(record.agreed_amount),
    notes: str(record.notes),
    payment_status: str(record.payment_status) || "Not Paid",
    amount_paid: str(record.amount_paid),
  };
};

const inputCls = "w-full border border-border bg-background px-4 py-2 text-sm font-body outline-none focus:border-foreground";
const labelCls = "block text-xs font-body font-bold tracking-widest mb-2";

export default function ManualEventBookingForm({ onClose, onSuccess, record }: Props) {
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

  const eventType = form.event_choice === OTHER_EVENT_TYPE ? form.event_other.trim() : form.event_choice;

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.full_name.trim()) e.full_name = "Full name is required";
    if (!form.phone.trim()) e.phone = "WhatsApp number is required";
    if (!eventType) e.event_choice = form.event_choice === OTHER_EVENT_TYPE ? "Tell us what event this is" : "Pick an event type";
    if (!form.event_start_date) e.event_start_date = "Start date is required";
    if (form.agreed_amount === "" || isNaN(Number(form.agreed_amount)) || Number(form.agreed_amount) < 0) e.agreed_amount = "Enter the agreed amount";
    if (form.expected_guests && (isNaN(Number(form.expected_guests)) || Number(form.expected_guests) < 0)) e.expected_guests = "Must be a number";
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
    const payload = {
      full_name: form.full_name,
      phone: form.phone,
      email: form.email || null,
      event_type: eventType,
      event_start_date: form.event_start_date,
      event_end_date: form.event_end_date || null,
      event_time: form.event_time || null,
      venue: form.venue || null,
      expected_guests: form.expected_guests ? Number(form.expected_guests) : null,
      agreed_amount: Number(form.agreed_amount) || 0,
      notes: form.notes || null,
      ...paymentForSave(form.payment_status, form.amount_paid, Number(form.agreed_amount) || 0, record ? { status: str(record.payment_status) || "Not Paid", amount: record.amount_paid == null ? null : Number(record.amount_paid) } : undefined),
    };

    if (isEdit) {
      const { data, error: err } = await supabase
        .from("event_bookings")
        .update(payload)
        .eq("id", record!.id as string)
        .select("id");
      if (err) { setError(`Save failed: ${friendlyPaymentError(err.message)}`); setSaving(false); return; }
      if (!data || data.length === 0) { setError("Nothing was saved. Make sure your account is an admin in the staff table."); setSaving(false); return; }
      if ("payment_updated_at" in payload) announcePayment("event_bookings", data.map((r) => r.id), String((payload as Record<string, unknown>).payment_status));
    } else {
      const { data: added, error: err } = await supabase.from("event_bookings").insert({ ...payload, source: "manual" }).select("id");
      if (err) { setError(`Save failed: ${friendlyPaymentError(err.message)}`); setSaving(false); return; }
      if ("payment_updated_at" in payload) announcePayment("event_bookings", (added ?? []).map((r) => r.id), String((payload as Record<string, unknown>).payment_status));
    }
    onSuccess();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 overflow-hidden">
      <div className="bg-background border border-border max-w-lg w-full max-h-[85vh] min-h-0 overflow-y-auto overscroll-contain p-6" data-lenis-prevent style={{ scrollbarGutter: "stable" }}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-display text-2xl font-bold">{isEdit ? "Edit Event Booking" : "Add Event Booking Manually"}</h2>
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
          <div>
            <label className={labelCls}>Event Type *</label>
            <CustomSelect
              value={form.event_choice}
              onChange={(v) => set("event_choice", v)}
              options={[{ value: "", label: "Select an event type" }, ...EVENT_TYPES.map((t) => ({ value: t, label: t })), { value: OTHER_EVENT_TYPE, label: OTHER_EVENT_TYPE }]}
            />
            {fieldErrors.event_choice && <p className="text-xs text-destructive mt-1 font-body">{fieldErrors.event_choice}</p>}
          </div>
          {form.event_choice === OTHER_EVENT_TYPE && (
            <div>
              <label className={labelCls}>Describe the Event *</label>
              <input className={inputCls} value={form.event_other} onChange={(e) => set("event_other", e.target.value)} placeholder="e.g. Charity gala" />
            </div>
          )}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className={labelCls}>Start Date *</label>
              <input className={inputCls + (fieldErrors.event_start_date ? " border-destructive" : "")} type="date" value={form.event_start_date} onChange={(e) => set("event_start_date", e.target.value)} />
              {fieldErrors.event_start_date && <p className="text-xs text-destructive mt-1 font-body">{fieldErrors.event_start_date}</p>}
            </div>
            <div><label className={labelCls}>End Date</label><input className={inputCls} type="date" value={form.event_end_date} onChange={(e) => set("event_end_date", e.target.value)} /></div>
            <div><label className={labelCls}>Start Time</label><input className={inputCls} type="time" value={form.event_time} onChange={(e) => set("event_time", e.target.value)} /></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className={labelCls}>Venue</label><input className={inputCls} value={form.venue} onChange={(e) => set("venue", e.target.value)} /></div>
            <div>
              <label className={labelCls}>Expected Guests</label>
              <input className={inputCls + (fieldErrors.expected_guests ? " border-destructive" : "")} type="number" min={0} value={form.expected_guests} onChange={(e) => set("expected_guests", e.target.value)} />
              {fieldErrors.expected_guests && <p className="text-xs text-destructive mt-1 font-body">{fieldErrors.expected_guests}</p>}
            </div>
          </div>
          <div>
            <label className={labelCls}>Agreed Amount ($) *</label>
            <input className={inputCls + (fieldErrors.agreed_amount ? " border-destructive" : "")} type="number" min={0} value={form.agreed_amount} onChange={(e) => set("agreed_amount", e.target.value)} />
            {fieldErrors.agreed_amount && <p className="text-xs text-destructive mt-1 font-body">{fieldErrors.agreed_amount}</p>}
          </div>
          <div className="border border-border px-4 py-3 flex justify-between items-center text-sm font-body">
            <span className="text-muted-foreground">Agreed total</span>
            <span className="font-display text-lg font-bold">{formatMoney(Number(form.agreed_amount) || 0)}</span>
          </div>
          <div><label className={labelCls}>Notes</label><textarea className={inputCls + " resize-y"} rows={3} value={form.notes} onChange={(e) => set("notes", e.target.value)} /></div>
          <PaymentFields status={form.payment_status} amount={form.amount_paid} total={Number(form.agreed_amount) || 0} error={fieldErrors.amount_paid} onStatus={(v) => set("payment_status", v)} onAmount={(v) => set("amount_paid", v)} />
          <div className="flex justify-end gap-3 pt-4 border-t border-border">
            <button type="button" onClick={onClose} className="px-6 py-2 text-sm font-body font-medium border border-border hover:bg-muted/50 rounded-md transition-colors">Cancel</button>
            <button type="submit" disabled={saving} className={`px-6 py-2 text-sm font-body font-medium rounded-md transition-colors ${saving ? "bg-muted text-muted-foreground cursor-not-allowed" : "bg-primary text-primary-foreground hover:opacity-90"}`}>{saving ? "Saving..." : isEdit ? "Save Changes" : "Save Booking"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
