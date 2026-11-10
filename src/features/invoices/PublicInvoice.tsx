import { useEffect, useState } from "react";
import { supabase, isSupabaseConfigured } from "@/lib/supabaseClient";
import { callFunction } from "@/lib/functions";
import { InvoicePaper } from "./InvoicePaper";
import { STATUS_LABEL, money, normalizeDoc, type InvoiceDoc, type InvoiceStatus } from "./model";
import { buildInvoicePdf, downloadBytes } from "./pdf";
import "./invoices.css";

type Row = { id: string; number: string; doc: InvoiceDoc; status: InvoiceStatus; total: number; paid: number; balance: number; due_date: string | null; online_payments: boolean };

/** What the client sees at /invoice/<token>/: the invoice, a PDF download, and "Pay online" (Stripe, CAD) for the balance. */
export default function PublicInvoice({ token }: { token: string }) {
  const [inv, setInv] = useState<Row | null | undefined>(undefined);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState("");
  const justPaid = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("paid") === "1";

  useEffect(() => {
    if (!isSupabaseConfigured || !/^[0-9a-f]{40,80}$/.test(token)) { setInv(null); return; }
    supabase.rpc("invoice_by_token", { p_token: token }).then(({ data, error }) => {
      if (error) { setErr("We couldn't load this invoice. Please try again in a moment."); setInv(null); return; }
      setInv(data ? ({ ...(data as Row), doc: normalizeDoc((data as Row).doc) }) : null);
    });
  }, [token]);

  const pay = async () => {
    setErr(""); setBusy("pay");
    const r = await callFunction<{ url: string }>("invoice-pay", { token, returnUrl: window.location.origin });
    if (r.ok) window.location.href = r.data.url;
    else { setErr(r.error); setBusy(""); }
  };
  const pdf = async () => {
    if (!inv) return;
    setBusy("pdf");
    try { downloadBytes(await buildInvoicePdf(inv.doc), `Tplum-Photography-${inv.number}.pdf`); }
    catch { setErr("Couldn't create the PDF. Please try again."); }
    finally { setBusy(""); }
  };

  if (inv === undefined) return <div className="min-h-[60vh] grid place-items-center text-sm">Loading your invoice…</div>;
  if (!inv) {
    return (
      <div className="min-h-[60vh] grid place-items-center px-6 text-center">
        <div>
          <h1 className="font-display text-4xl mb-3">Invoice not found</h1>
          <p className="text-sm max-w-md">{err || "This link may be incomplete or the invoice was withdrawn. Please check the email you received, or contact us at info@tplumphotography.com."}</p>
        </div>
      </div>
    );
  }
  const owed = Number(inv.balance) > 0 && inv.status !== "void";
  return (
    <div className="max-w-4xl mx-auto px-4 py-10 md:py-16">
      <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
        <div>
          <p className="text-xs uppercase tracking-widest text-neutral-500">Invoice {inv.number}</p>
          <h1 className="font-display text-4xl md:text-5xl mt-1">{owed ? `${money(Number(inv.balance))} due` : "Paid in full"}</h1>
          <p className="text-sm mt-2">Status: {STATUS_LABEL[inv.status] ?? inv.status}{inv.due_date && owed ? ` · due ${new Date(`${inv.due_date}T12:00:00Z`).toLocaleDateString("en-CA", { dateStyle: "long", timeZone: "UTC" })}` : ""}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={pdf} disabled={!!busy} className="border border-black px-5 py-3 text-xs uppercase tracking-widest hover:bg-black hover:text-white transition disabled:opacity-50">{busy === "pdf" ? "Preparing…" : "Download PDF"}</button>
          {owed && inv.online_payments && (
            <button type="button" onClick={pay} disabled={!!busy} className="bg-black text-white px-5 py-3 text-xs uppercase tracking-widest hover:bg-neutral-800 transition disabled:opacity-50">{busy === "pay" ? "Opening secure payment…" : `Pay ${money(Number(inv.balance))} online`}</button>
          )}
        </div>
      </div>
      {justPaid && <p className="mb-6 border border-emerald-300 bg-emerald-50 text-emerald-900 px-4 py-3 text-sm">Thank you! Your payment was received. A receipt is on its way by email; this page updates once the payment is recorded (refresh in a minute).</p>}
      {err && <p className="mb-6 text-sm text-red-700">{err}</p>}
      {owed && !inv.online_payments && <p className="mb-6 text-sm">To pay, please follow the payment instructions on the invoice (e.g. Interac e-Transfer).</p>}
      <InvoicePaper doc={inv.doc} />
    </div>
  );
}
