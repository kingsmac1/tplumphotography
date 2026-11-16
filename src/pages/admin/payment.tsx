import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import CustomSelect from "./CustomSelect";
import { useBodyScrollLock } from "./useBodyScrollLock";
import { formatMoney } from "./formOptions";
import { announcePayment } from "@/features/invoices/events";

export const PAYMENT_STATUSES = ["Not Paid", "Part Payment", "Paid"];

export type PaymentPatch = { payment_status: string; amount_paid: number | null; payment_updated_at: string };

/**
 * What to save when a payment status changes. Only Part Payment keeps an amount (Paid counts as the full total).
 * payment_updated_at is what tells the email job a payment was just recorded, so the client gets an acknowledgement.
 */
export const paymentPatch = (status: string, amountPaid?: number | null): PaymentPatch => ({
  payment_status: status,
  amount_paid: status === "Part Payment" ? Math.max(0, Number(amountPaid) || 0) : null,
  payment_updated_at: new Date().toISOString(),
});

/** Money actually received so far for a booking. */
export const receivedAmount = (status: string | null | undefined, total: number | null | undefined, amountPaid: number | null | undefined): number => {
  const t = Number(total) || 0;
  if (status === "Paid") return t;
  if (status === "Part Payment") return Math.min(Number(amountPaid) || 0, t || Number(amountPaid) || 0);
  return 0;
};

/**
 * Saves a payment change to the given rows. If the database hasn't had the part-payment SQL run yet,
 * a plain Paid / Not Paid still saves (without the extras) and Part Payment explains what is missing.
 * Returns an error message, or "" on success.
 */
export const applyPayment = async (table: string, ids: string[], patch: PaymentPatch): Promise<string> => {
  const first = await supabase.from(table).update(patch).in("id", ids).select("id");
  // a payment was recorded: the dashboard asks whether to send the client an updated invoice
  if (!first.error) { announcePayment(table, (first.data ?? []).map((r) => r.id), patch.payment_status); return ""; }
  const missingColumn = /amount_paid|payment_updated_at/i.test(first.error.message);
  if (!missingColumn) return first.error.message;
  if (patch.payment_status === "Part Payment") return "Part payments need the database update first. Run supabase/part-payments.sql in the Supabase SQL editor.";
  const retry = await supabase.from(table).update({ payment_status: patch.payment_status }).in("id", ids).select("id");
  if (!retry.error) announcePayment(table, (retry.data ?? []).map((r) => r.id), patch.payment_status);
  return retry.error?.message ?? "";
};

/** select(...) that also asks for amount_paid, falling back to the plain columns if that column doesn't exist yet. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const selectWithPaid = async (table: string, columns: string): Promise<{ data: any[] | null; error: { message: string } | null }> => {
  // The column list is built at runtime, so the result is deliberately loosely typed.
  const withPaid = await supabase.from(table).select(`${columns}, amount_paid` as "*");
  if (!withPaid.error) return withPaid as unknown as { data: any[] | null; error: null };
  return (await supabase.from(table).select(columns as "*")) as unknown as { data: any[] | null; error: { message: string } | null };
};

type CellProps = {
  status: string | null | undefined;
  total: number | null | undefined;
  amountPaid: number | null | undefined;
  onSave: (patch: PaymentPatch) => void | Promise<void>;
};

/** Payment status dropdown. Choosing Part Payment asks how much has been paid. */
export const PaymentCell = ({ status, total, amountPaid, onSave }: CellProps) => {
  const current = status || "Not Paid";
  const [asking, setAsking] = useState(false);
  const paid = receivedAmount(current, total, amountPaid);
  const left = Math.max((Number(total) || 0) - paid, 0);

  return (
    <div>
      <CustomSelect
        value={current}
        onChange={(v) => (v === "Part Payment" ? setAsking(true) : void onSave(paymentPatch(v)))}
        options={PAYMENT_STATUSES.map((p) => ({ value: p, label: p }))}
        className="min-w-[130px]"
      />
      {current === "Part Payment" && (
        <button type="button" onClick={() => setAsking(true)} className="block mt-1 text-[11px] font-body text-muted-foreground hover:text-foreground underline-offset-2 hover:underline text-left whitespace-nowrap">
          {formatMoney(paid)} paid · {formatMoney(left)} left
        </button>
      )}
      {asking && (
        <PartPaymentDialog
          total={Number(total) || 0}
          initial={current === "Part Payment" ? Number(amountPaid) || 0 : 0}
          onClose={() => setAsking(false)}
          onSave={async (amount) => {
            // Paying the whole amount is simply "Paid".
            const t = Number(total) || 0;
            await onSave(t > 0 && amount >= t ? paymentPatch("Paid") : paymentPatch("Part Payment", amount));
            setAsking(false);
          }}
        />
      )}
    </div>
  );
};

const PartPaymentDialog = ({ total, initial, onClose, onSave }: { total: number; initial: number; onClose: () => void; onSave: (amount: number) => void | Promise<void> }) => {
  useBodyScrollLock(true);
  const [value, setValue] = useState(initial ? String(initial) : "");
  const [saving, setSaving] = useState(false);
  const amount = Number(value) || 0;
  const invalid = amount <= 0;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="bg-background border border-border max-w-sm w-full p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
        <h2 className="font-display text-xl font-bold">Part payment</h2>
        <label className="block">
          <span className="block text-xs font-body font-bold tracking-widest mb-2">AMOUNT PAID SO FAR ($ CAD)</span>
          <input autoFocus type="number" min="0" value={value} onChange={(e) => setValue(e.target.value)}
            className="w-full border border-border bg-background px-4 py-2 text-sm font-body outline-none focus:border-foreground" />
        </label>
        {total > 0 && (
          <p className="text-xs font-body text-muted-foreground">
            Total {formatMoney(total)} · Balance {formatMoney(Math.max(total - amount, 0))}
            {amount >= total && " — this covers the full amount, so it will be marked Paid."}
          </p>
        )}
        <p className="text-xs font-body text-muted-foreground">The client is emailed a part-payment acknowledgement with the balance.</p>
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-body border border-border hover:bg-muted/50 rounded-md">Cancel</button>
          <button type="button" disabled={invalid || saving} onClick={async () => { setSaving(true); await onSave(amount); setSaving(false); }}
            className="px-4 py-2 text-sm font-body font-medium rounded-md bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50">
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
};

/** Rewords the database's "column does not exist" error into what to do about it. */
export const friendlyPaymentError = (message: string): string =>
  /amount_paid|payment_updated_at/i.test(message)
    ? "Part payments need the database update first. Run supabase/part-payments.sql in the Supabase SQL editor."
    : message;

/**
 * The payment columns a form should save. Paying the full total counts as Paid. A new Not Paid entry, or an edit
 * that leaves payment untouched, saves only the status, so those saves never depend on the newer columns.
 */
export const paymentForSave = (
  status: string,
  amountText: string,
  total: number,
  prev?: { status: string; amount: number | null },
): Record<string, unknown> => {
  const amount = Number(amountText) || 0;
  const effective = status === "Part Payment" && total > 0 && amount >= total ? "Paid" : status;
  const unchanged = prev && prev.status === effective && (effective !== "Part Payment" || (Number(prev.amount) || 0) === amount);
  if (unchanged || (!prev && effective === "Not Paid")) return { payment_status: effective };
  return paymentPatch(effective, amount);
};

/** Payment status plus, for Part Payment, the amount paid so far. */
export const PaymentFields = ({ status, amount, total, onStatus, onAmount, error }: {
  status: string; amount: string; total: number; error?: string;
  onStatus: (v: string) => void; onAmount: (v: string) => void;
}) => (
  <>
    <div>
      <label className="block text-xs font-body font-bold tracking-widest mb-2">Payment Status</label>
      <CustomSelect value={status || "Not Paid"} onChange={onStatus} options={PAYMENT_STATUSES.map((p) => ({ value: p, label: p }))} />
    </div>
    {status === "Part Payment" && (
      <div>
        <label className="block text-xs font-body font-bold tracking-widest mb-2">AMOUNT PAID SO FAR ($ CAD) *</label>
        <input type="number" min="0" value={amount} onChange={(e) => onAmount(e.target.value)}
          className={`w-full border bg-background px-4 py-2 text-sm font-body outline-none focus:border-foreground ${error ? "border-destructive" : "border-border"}`} />
        {error && <p className="text-xs text-destructive mt-1 font-body">{error}</p>}
        {total > 0 && <p className="text-xs font-body text-muted-foreground mt-1">Balance {formatMoney(Math.max(total - (Number(amount) || 0), 0))} of {formatMoney(total)}. The client is emailed an acknowledgement.</p>}
      </div>
    )}
  </>
);
