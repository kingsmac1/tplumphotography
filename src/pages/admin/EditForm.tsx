import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useBodyScrollLock } from "./useBodyScrollLock";
import CustomSelect from "./CustomSelect";
import { PaymentFields, paymentForSave, friendlyPaymentError } from "./payment";
import { announcePayment } from "@/features/invoices/events";
import { academyBatchOptions } from "@/data/academyBatches";
import {
  shootTypes, genderOptions, locationOptions, settingOptions,
  serviceOptions, paymentStatusOptions, academyPaymentStatusOptions,
} from "./formOptions";

interface EditFormProps {
  table: "bookings" | "academy_applications";
  record: Record<string, unknown>;
  onClose: () => void;
  onSaved: () => void;
}

const inputCls = "w-full border border-border bg-background px-4 py-2 text-sm font-body outline-none focus:border-foreground";
const labelCls = "block text-xs font-body font-bold tracking-widest mb-2";
const errCls = "text-xs text-destructive mt-1 font-body";

const shootTypeOptions = [
  ...shootTypes.map((t) => ({ value: t, label: t })),
  { value: "Other", label: "Other" },
];
const locationOptsList = locationOptions.map((l) => ({ value: l, label: l }));
const settingOptsList = settingOptions.map((s) => ({ value: s, label: s }));
const serviceOptsList = serviceOptions.map((s) => ({ value: s, label: s }));
const genderOptsList = genderOptions.map((g) => ({ value: g, label: g }));
const yesNoList = [{ value: "no", label: "No" }, { value: "yes", label: "Yes" }];

interface FieldProps {
  name: string;
  label: string;
  required?: boolean;
  fieldErrors: Record<string, string>;
  children: React.ReactNode;
}

// Defined at module scope (not inside the component) so its identity stays
// stable across re-renders — see ManualBookingForm.tsx for the full explanation.
const Field = ({ name, label, required, fieldErrors, children }: FieldProps) => (
  <div>
    <label className={labelCls}>{label}{required ? " *" : ""}</label>
    {children}
    {fieldErrors[name] && <p className={errCls}>{fieldErrors[name]}</p>}
  </div>
);

export default function EditForm({ table, record, onClose, onSaved }: EditFormProps) {
  useBodyScrollLock(true);
  const [form, setForm] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  // Initialize form state from the existing record. Dates are kept as YYYY-MM-DD
  // strings so they slot back into <input type="date"> cleanly.
  useEffect(() => {
    const init: Record<string, string> = {};
    const fields = table === "bookings"
      ? [
          "full_name", "gender", "shoot_type", "shoot_date", "shoot_time",
          "phone", "email", "date_of_birth", "social_handles",
          "inspiration_links", "location", "shoot_setting", "selected_service",
          "service_price", "outfits", "selected_extras", "extra_edited_count",
          "service_summary", "source", "payment_status", "amount_paid",
        ]
      : [
          "full_name", "email", "phone", "guardian_phone", "state_of_origin",
          "dob", "social_handle", "academic_year_batch", "background",
          "trained_before", "owns_gear", "gear_names", "session", "referral",
          "plan", "interest_area", "amount", "payment_status",
        ];
    for (const f of fields) {
      const v = record[f];
      init[f] = v === null || v === undefined ? "" : String(v);
    }
    setForm(init);
  }, [record, table]);

  const set = (field: string, value: string) => {
    setForm((p) => ({ ...p, [field]: value }));
    if (fieldErrors[field]) {
      setFieldErrors((p) => {
        const n = { ...p };
        delete n[field];
        return n;
      });
    }
  };

  const validate = (): Record<string, string> => {
    const e: Record<string, string> = {};
    if (table === "bookings") {
      if (!form.full_name?.trim()) e.full_name = "Full name is required";
      if (!form.phone?.trim()) e.phone = "WhatsApp number is required";
      if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = "Enter a valid email address";
      if (!form.shoot_type) e.shoot_type = "Shoot type is required";
      if (!form.shoot_date) e.shoot_date = "Shoot date is required";
      if (!form.location) e.location = "Location is required";
      if (!form.shoot_setting) e.shoot_setting = "Setting is required";
      if (form.service_price && isNaN(Number(form.service_price))) e.service_price = "Service price must be a number";
      if (form.payment_status === "Part Payment" && !(Number(form.amount_paid) > 0)) e.amount_paid = "Enter the amount paid so far";
      if (form.outfits && (isNaN(Number(form.outfits)) || Number(form.outfits) < 1)) e.outfits = "Outfits must be positive";
    } else {
      if (!form.full_name?.trim()) e.full_name = "Full name is required";
      if (!form.email?.trim()) e.email = "Email is required";
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = "Enter a valid email address";
      if (!form.phone?.trim()) e.phone = "Phone is required";
      if (!form.dob) e.dob = "Date of birth is required";
    }
    return e;
  };

  const handleSave = async () => {
    setError("");
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      setError("Please fix the highlighted fields below.");
      return;
    }
    setFieldErrors({});
    setSaving(true);

    // Build the update payload. Coerce numeric fields, leave everything else as-is.
    const payload: Record<string, unknown> = { ...form };
    if (table === "bookings") {
      if (payload.service_price) payload.service_price = Number(payload.service_price);
      if (payload.outfits) payload.outfits = Number(payload.outfits);
      if (payload.extra_edited_count) payload.extra_edited_count = Number(payload.extra_edited_count);
      // Keep the Total column in step with the price: recompute when price/outfits changed or the total was never set.
      const price = Number(form.service_price) || 0;
      const outfits = Number(form.outfits) || 1;
      const changed = price !== (Number(record.service_price) || 0) || outfits !== (Number(record.outfits) || 1);
      if (changed || !Number(record.grand_total)) {
        const serviceTotal = record.service_pricing_mode === "per_outfit" ? price * outfits : price;
        payload.service_total = serviceTotal;
        payload.grand_total = serviceTotal + (Number(record.extras_total) || 0);
      }
      // Only touch the payment columns when payment actually changed, so unrelated edits never depend on them.
      delete payload.amount_paid;
      delete payload.payment_status;
      Object.assign(payload, paymentForSave(
        form.payment_status || "Not Paid", form.amount_paid, Number(payload.grand_total ?? record.grand_total) || 0,
        { status: String(record.payment_status || "Not Paid"), amount: record.amount_paid == null ? null : Number(record.amount_paid) },
      ));
    } else {
      payload.amount = Number(payload.amount) || 0;
    }

    const { error: err } = await supabase.from(table).update(payload).eq("id", record.id as string);
    if (err) {
      setError(`Save failed: ${friendlyPaymentError(err.message)}`);
      setSaving(false);
      return;
    }
    if ("payment_updated_at" in payload) announcePayment(table, [record.id as string], String(payload.payment_status));
    onSaved();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 overflow-hidden">
      <div
        className="bg-background border border-border max-w-2xl w-full max-h-[90vh] min-h-0 overflow-y-auto overscroll-contain p-6"
        data-lenis-prevent
        style={{ scrollbarGutter: "stable" }}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-display text-2xl font-bold">Edit {table === "bookings" ? "Booking" : "Application"}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X size={20} /></button>
        </div>
        {error && <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md mb-4"><p className="text-sm text-destructive font-body">{error}</p></div>}
        <div className="space-y-4">
          {table === "bookings" && (
            <>
              <Field fieldErrors={fieldErrors} name="full_name" label="Full Name" required>
                <input className={inputCls + (fieldErrors.full_name ? " border-destructive" : "")} value={form.full_name || ""} onChange={e => set("full_name", e.target.value)} />
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field fieldErrors={fieldErrors} name="phone" label="WhatsApp Number" required>
                  <input className={inputCls + (fieldErrors.phone ? " border-destructive" : "")} value={form.phone || ""} onChange={e => set("phone", e.target.value)} />
                </Field>
                <Field fieldErrors={fieldErrors} name="email" label="Email">
                  <input className={inputCls + (fieldErrors.email ? " border-destructive" : "")} type="email" value={form.email || ""} onChange={e => set("email", e.target.value)} />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Field fieldErrors={fieldErrors} name="shoot_type" label="Shoot Type" required>
                  <CustomSelect value={form.shoot_type || ""} onChange={v => set("shoot_type", v)} options={shootTypeOptions} placeholder="Select..." hasError={!!fieldErrors.shoot_type} />
                </Field>
                <Field fieldErrors={fieldErrors} name="shoot_date" label="Shoot Date" required>
                  <input className={inputCls + (fieldErrors.shoot_date ? " border-destructive" : "")} type="date" value={form.shoot_date || ""} onChange={e => set("shoot_date", e.target.value)} />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Field fieldErrors={fieldErrors} name="location" label="Location" required>
                  <CustomSelect value={form.location || ""} onChange={v => set("location", v)} options={locationOptsList} placeholder="Select..." hasError={!!fieldErrors.location} />
                </Field>
                <Field fieldErrors={fieldErrors} name="shoot_setting" label="Setting" required>
                  <CustomSelect value={form.shoot_setting || ""} onChange={v => set("shoot_setting", v)} options={settingOptsList} placeholder="Select..." hasError={!!fieldErrors.shoot_setting} />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Field fieldErrors={fieldErrors} name="selected_service" label="Service">
                  <CustomSelect value={form.selected_service || ""} onChange={v => set("selected_service", v)} options={serviceOptsList} placeholder="Select..." />
                </Field>
                <Field fieldErrors={fieldErrors} name="service_price" label="Service Price (NGN)">
                  <input className={inputCls + (fieldErrors.service_price ? " border-destructive" : "")} type="number" value={form.service_price || ""} onChange={e => set("service_price", e.target.value)} />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Field fieldErrors={fieldErrors} name="outfits" label="Outfits">
                  <input className={inputCls + (fieldErrors.outfits ? " border-destructive" : "")} type="number" value={form.outfits || ""} onChange={e => set("outfits", e.target.value)} />
                </Field>
                <Field fieldErrors={fieldErrors} name="shoot_time" label="Shoot Time">
                  <input className={inputCls} type="time" value={form.shoot_time || ""} onChange={e => set("shoot_time", e.target.value)} />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Field fieldErrors={fieldErrors} name="gender" label="Gender">
                  <CustomSelect value={form.gender || ""} onChange={v => set("gender", v)} options={genderOptsList} placeholder="Select..." />
                </Field>
                <Field fieldErrors={fieldErrors} name="date_of_birth" label="Birthday (year ignored)">
                  <input className={inputCls} type="date" value={form.date_of_birth || ""} onChange={e => set("date_of_birth", e.target.value)} />
                </Field>
              </div>
              <Field fieldErrors={fieldErrors} name="selected_extras" label="Selected Extras">
                <input className={inputCls} value={form.selected_extras || ""} onChange={e => set("selected_extras", e.target.value)} />
              </Field>
              <Field fieldErrors={fieldErrors} name="social_handles" label="Social Handles">
                <input className={inputCls} value={form.social_handles || ""} onChange={e => set("social_handles", e.target.value)} />
              </Field>
              <Field fieldErrors={fieldErrors} name="inspiration_links" label="Inspiration Links">
                <textarea className={inputCls + " resize-y"} rows={3} value={form.inspiration_links || ""} onChange={e => set("inspiration_links", e.target.value)} />
              </Field>
              <Field fieldErrors={fieldErrors} name="service_summary" label="Service Summary">
                <input className={inputCls} value={form.service_summary || ""} onChange={e => set("service_summary", e.target.value)} />
              </Field>
              <PaymentFields status={form.payment_status} amount={form.amount_paid || ""} total={Number(record.grand_total) || 0} error={fieldErrors.amount_paid} onStatus={(v) => set("payment_status", v)} onAmount={(v) => set("amount_paid", v)} />
            </>
          )}
          {table === "academy_applications" && (
            <>
              <Field fieldErrors={fieldErrors} name="full_name" label="Full Name" required>
                <input className={inputCls + (fieldErrors.full_name ? " border-destructive" : "")} value={form.full_name || ""} onChange={e => set("full_name", e.target.value)} />
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field fieldErrors={fieldErrors} name="email" label="Email" required>
                  <input className={inputCls + (fieldErrors.email ? " border-destructive" : "")} type="email" value={form.email || ""} onChange={e => set("email", e.target.value)} />
                </Field>
                <Field fieldErrors={fieldErrors} name="phone" label="Phone" required>
                  <input className={inputCls + (fieldErrors.phone ? " border-destructive" : "")} value={form.phone || ""} onChange={e => set("phone", e.target.value)} />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Field fieldErrors={fieldErrors} name="guardian_phone" label="Guardian Phone">
                  <input className={inputCls} value={form.guardian_phone || ""} onChange={e => set("guardian_phone", e.target.value)} />
                </Field>
                <Field fieldErrors={fieldErrors} name="state_of_origin" label="State of Origin">
                  <input className={inputCls} value={form.state_of_origin || ""} onChange={e => set("state_of_origin", e.target.value)} />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Field fieldErrors={fieldErrors} name="dob" label="Date of Birth" required>
                  <input className={inputCls + (fieldErrors.dob ? " border-destructive" : "")} type="date" value={form.dob || ""} onChange={e => set("dob", e.target.value)} />
                </Field>
                <Field fieldErrors={fieldErrors} name="social_handle" label="Social Handle">
                  <input className={inputCls} value={form.social_handle || ""} onChange={e => set("social_handle", e.target.value)} />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Field fieldErrors={fieldErrors} name="academic_year_batch" label="Academic Year/Batch">
                  <select className={inputCls} value={form.academic_year_batch || ""} onChange={e => set("academic_year_batch", e.target.value)}>
                    <option value="">Select year and batch</option>
                    {academyBatchOptions([-1, 0, 1]).map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    {form.academic_year_batch && !academyBatchOptions([-1, 0, 1]).some(o => o.value === form.academic_year_batch) && (
                      <option value={form.academic_year_batch}>{form.academic_year_batch} (old entry, please pick a batch)</option>
                    )}
                  </select>
                </Field>
                <Field fieldErrors={fieldErrors} name="session" label="Session">
                  <input className={inputCls} value={form.session || ""} onChange={e => set("session", e.target.value)} />
                </Field>
              </div>
              <Field fieldErrors={fieldErrors} name="background" label="Background">
                <input className={inputCls} value={form.background || ""} onChange={e => set("background", e.target.value)} />
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field fieldErrors={fieldErrors} name="trained_before" label="Trained Before">
                  <CustomSelect value={form.trained_before || "no"} onChange={v => set("trained_before", v)} options={yesNoList} />
                </Field>
                <Field fieldErrors={fieldErrors} name="owns_gear" label="Owns Gear">
                  <CustomSelect value={form.owns_gear || "no"} onChange={v => set("owns_gear", v)} options={yesNoList} />
                </Field>
              </div>
              <Field fieldErrors={fieldErrors} name="gear_names" label="Gear Names">
                <input className={inputCls} value={form.gear_names || ""} onChange={e => set("gear_names", e.target.value)} />
              </Field>
              <Field fieldErrors={fieldErrors} name="plan" label="Plan">
                <input className={inputCls} value={form.plan || ""} onChange={e => set("plan", e.target.value)} />
              </Field>
              <Field fieldErrors={fieldErrors} name="referral" label="Referral">
                <input className={inputCls} value={form.referral || ""} onChange={e => set("referral", e.target.value)} />
              </Field>
              <Field fieldErrors={fieldErrors} name="interest_area" label="Interest Area">
                <input className={inputCls} value={form.interest_area || ""} onChange={e => set("interest_area", e.target.value)} />
              </Field>
              <Field fieldErrors={fieldErrors} name="why_learn" label="Why Learn">
                <textarea className={inputCls + " resize-y"} rows={3} value={form.why_learn || ""} onChange={e => set("why_learn", e.target.value)} />
              </Field>
              <Field fieldErrors={fieldErrors} name="achieve" label="Goals to Achieve">
                <textarea className={inputCls + " resize-y"} rows={3} value={form.achieve || ""} onChange={e => set("achieve", e.target.value)} />
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field fieldErrors={fieldErrors} name="amount" label="Amount (NGN)">
                  <input className={inputCls} type="number" value={form.amount || ""} onChange={e => set("amount", e.target.value)} />
                </Field>
                <Field fieldErrors={fieldErrors} name="payment_status" label="Payment Status">
                  <CustomSelect value={form.payment_status || "Not Paid"} onChange={v => set("payment_status", v)} options={academyPaymentStatusOptions.map(p => ({ value: p, label: p }))} />
                </Field>
              </div>
            </>
          )}
        </div>
        <div className="flex justify-end gap-3 pt-4 mt-4 border-t border-border">
          <button type="button" onClick={onClose} className="px-6 py-2 text-sm font-body font-medium border border-border hover:bg-muted/50 rounded-md transition-colors">Cancel</button>
          <button type="button" onClick={handleSave} disabled={saving} className={`px-6 py-2 text-sm font-body font-medium rounded-md transition-colors ${saving ? "bg-muted text-muted-foreground cursor-not-allowed" : "bg-primary text-primary-foreground hover:opacity-90"}`}>{saving ? "Saving..." : "Save Changes"}</button>
        </div>
      </div>
    </div>
  );
}