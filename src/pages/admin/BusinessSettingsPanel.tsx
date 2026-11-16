import { useEffect, useState } from "react";
import { Loader2, Save } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { resetContentCache } from "@/lib/content";

type Settings = Record<string, string | number | boolean>;

const labelCls = "block text-xs font-body font-bold tracking-widest mb-2";
const inputCls = "w-full border border-border bg-background px-4 py-3 text-sm font-body outline-none focus:border-foreground";

/**
 * Business details, deposit rules and booking terms (one row in business_settings).
 * The booking-create and invoice functions read these on the server, so changing them here
 * changes what clients are charged — nothing is hard-coded.
 */
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default function BusinessSettingsPanel({ only }: { only?: "deposit" | "business" | "hours" }) {
  const [s, setS] = useState<Settings | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    supabase.from("business_settings").select("*").eq("id", 1).maybeSingle().then(({ data, error }) => {
      if (error) setMsg(error.message);
      setS((data as Settings) ?? {});
    });
  }, []);

  if (!s) return <p className="text-sm text-muted-foreground">Loading…</p>;
  const set = (k: string, v: string | number | boolean) => setS((x) => ({ ...x!, [k]: v }));
  const text = (k: string, label: string, help?: string, type = "text") => (
    <div>
      <label className={labelCls}>{label}</label>
      <input type={type} className={inputCls} value={String(s[k] ?? "")} onChange={(e) => set(k, type === "number" ? Number(e.target.value) : e.target.value)} />
      {help && <p className="text-xs text-muted-foreground mt-1">{help}</p>}
    </div>
  );

  async function save() {
    setBusy(true); setMsg("");
    const { id: _id, updated_at: _u, ...patch } = s as Settings;
    const pct = Number(patch.deposit_percent);
    if (patch.deposit_mode === "percent" && (!(pct >= 0) || pct > 100)) { setBusy(false); return setMsg("Deposit percent must be between 0 and 100."); }
    const taxRate = Number(patch.booking_tax_rate ?? 0);
    if (patch.booking_tax_enabled && (!(taxRate >= 0) || taxRate > 30)) { setBusy(false); return setMsg("Tax rate must be between 0 and 30."); }
    const { error } = await supabase.from("business_settings").update(patch).eq("id", 1);
    setBusy(false);
    if (error) return setMsg(error.message);
    resetContentCache();
    setMsg("Saved.");
  }

  const showDeposit = !only || only === "deposit";
  const showBusiness = !only || only === "business";
  const showHours = !only || only === "hours";
  const hours = ((s.opening_hours as unknown) ?? {}) as Record<string, [string, string] | null>;
  const setDay = (d: number, v: [string, string] | null) => set("opening_hours", { ...hours, [d]: v } as unknown as string);

  return (
    <div className="border border-border p-6 space-y-6 max-w-3xl">
      {showDeposit && (
        <section className="space-y-4">
          <h2 className="font-display text-2xl">Deposit &amp; payment rules</h2>
          <p className="text-sm text-muted-foreground">Used when a client books and pays online, and to pre-fill invoices. Prices are always recalculated on the server.</p>
          <div>
            <label className={labelCls}>DEPOSIT TYPE</label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {[["percent", "Percentage of the total"], ["fixed", "Fixed amount"], ["full", "Full payment upfront"]].map(([v, l]) => (
                <button key={v} type="button" onClick={() => set("deposit_mode", v)} className={`border px-4 py-3 text-sm ${s.deposit_mode === v ? "border-foreground bg-foreground text-background" : "border-border hover:border-foreground"}`}>{l}</button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {s.deposit_mode === "percent" && text("deposit_percent", "DEPOSIT PERCENT (%)", "e.g. 30 means 30% of the booking total.", "number")}
            {s.deposit_mode === "fixed" && text("deposit_fixed", "DEPOSIT AMOUNT ($ CAD)", "If the booking total is lower, the client pays the total.", "number")}
            {text("balance_due_days_before", "BALANCE DUE (DAYS BEFORE THE DATE)", "Used for balance reminders and invoice due dates.", "number")}
          </div>
          <label className="flex items-center gap-3 text-sm">
            <input type="checkbox" checked={!!s.online_payments_enabled} onChange={(e) => set("online_payments_enabled", e.target.checked)} />
            Take the deposit by card when clients book online (Stripe)
          </label>
          <div className="border border-border p-4 space-y-3">
            <label className="flex items-center gap-3 text-sm font-medium">
              <input type="checkbox" checked={!!s.booking_tax_enabled} onChange={(e) => set("booking_tax_enabled", e.target.checked)} />
              Add sales tax to website bookings (prices show “+ GST”)
            </label>
            {!!s.booking_tax_enabled && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {text("booking_tax_name", "TAX NAME", "e.g. GST (Alberta) or HST.")}
                {text("booking_tax_rate", "TAX RATE (%)", "e.g. 5 for GST.", "number")}
              </div>
            )}
          </div>
          <div>
            <label className={labelCls}>NOTE UNDER THE ADD-ONS ON THE BOOKING PAGE</label>
            <input className={inputCls} value={String(s.session_note ?? "")} onChange={(e) => set("session_note", e.target.value)} />
            <p className="text-xs text-muted-foreground mt-1">e.g. “No unedited images.” Leave empty to show nothing.</p>
          </div>
          <div>
            <label className={labelCls}>BOOKING TERMS (SHOWN BEFORE PAYMENT)</label>
            <textarea rows={5} className={inputCls} value={String(s.booking_terms ?? "")} onChange={(e) => set("booking_terms", e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>CANCELLATION POLICY</label>
            <textarea rows={4} className={inputCls} value={String(s.cancellation_policy ?? "")} onChange={(e) => set("cancellation_policy", e.target.value)} />
          </div>
        </section>
      )}
      {showHours && (
        <section className="space-y-4">
          <h2 className="font-display text-2xl">Booking hours</h2>
          <p className="text-sm text-muted-foreground">When clients can book sessions on the website (each session's length comes from its package, plus any extra time the client adds). Close single dates or times from Calendar.</p>
          <div className="space-y-2">
            {DAYS.map((name, d) => {
              const v = hours[d] ?? hours[String(d) as unknown as number];
              return (
                <div key={d} className="flex flex-wrap items-center gap-3 text-sm">
                  <label className="w-32 flex items-center gap-2"><input type="checkbox" checked={!!v} onChange={(e) => setDay(d, e.target.checked ? ["10:00", "18:00"] : null)} /> {name}</label>
                  {v ? (
                    <>
                      <input type="time" className="border border-border px-2 py-1" value={v[0]} onChange={(e) => setDay(d, [e.target.value, v[1]])} />
                      <span>to</span>
                      <input type="time" className="border border-border px-2 py-1" value={v[1]} onChange={(e) => setDay(d, [v[0], e.target.value])} />
                    </>
                  ) : <span className="text-muted-foreground">Closed</span>}
                </div>
              );
            })}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {text("booking_horizon_days", "HOW FAR AHEAD CLIENTS CAN BOOK (DAYS)", undefined, "number")}
            {text("min_notice_hours", "MINIMUM NOTICE (HOURS)", "e.g. 24 = no same-day bookings.", "number")}
          </div>
        </section>
      )}
      {showBusiness && (
        <section className="space-y-4">
          <h2 className="font-display text-2xl">Business details</h2>
          <p className="text-sm text-muted-foreground">Used on invoices, contracts and emails. Placeholders in [square brackets] need your real details.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {text("business_name", "BUSINESS NAME")}
            {text("legal_name", "LEGAL NAME (IF DIFFERENT)")}
            {text("email", "BUSINESS EMAIL", undefined, "email")}
            {text("phone", "PHONE", "e.g. +1 (403) 493-5511")}
            {text("address", "STREET ADDRESS")}
            {text("city", "CITY")}
            {text("province", "PROVINCE", "e.g. AB")}
            {text("postal_code", "POSTAL CODE", "e.g. T2P 1J9")}
            {text("website", "WEBSITE")}
          </div>
        </section>
      )}
      <div className="flex items-center gap-3">
        <button onClick={() => void save()} disabled={busy} className="inline-flex items-center gap-2 px-5 py-3 text-sm bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50">
          {busy ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Save
        </button>
        {msg && <span className={`text-sm ${msg === "Saved." ? "text-green-700" : "text-destructive"}`}>{msg}</span>}
      </div>
    </div>
  );
}
