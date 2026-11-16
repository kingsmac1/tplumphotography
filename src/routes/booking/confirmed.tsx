import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { getSiteContent } from "@/cms/content";
import { AppShell, privateHead } from "@/site/AppShell";
import { callFunction } from "@/lib/functions";
import { formatMoney } from "@/pages/admin/formOptions";
import { recallWhatsApp } from "@/lib/whatsapp";

type Status = { reference: string; kind: string; name: string; when: string; total: number; paid: number; balance: number; paymentStatus: string; status: string };

/**
 * After a booking: where Stripe Checkout returns the client (success or cancel), or, with online payment off,
 * where a wedding booking lands once its WhatsApp message has opened ("Open WhatsApp again" if it didn't).
 */
export const Route = createFileRoute("/booking/confirmed")({
  loader: () => getSiteContent(),
  head: () => privateHead("Booking confirmed | Tplum Photography"),
  validateSearch: (s: Record<string, unknown>) => ({ b: String(s.b ?? ""), session_id: String(s.session_id ?? ""), cancelled: s.cancelled === "1" || s.cancelled === 1 || s.cancelled === true }),
  component: Confirmed,
});

function Confirmed() {
  const { site } = Route.useLoaderData();
  const { b, session_id, cancelled } = Route.useSearch();
  const [st, setSt] = useState<Status | null>(null);
  const [err, setErr] = useState("");
  const [waLink, setWaLink] = useState("");
  useEffect(() => { if (b) setWaLink(recallWhatsApp(b)); }, [b]);
  useEffect(() => {
    let tries = 0;
    let stop = false;
    const poll = async () => {
      const res = await callFunction<Status>("booking-status", { b, session_id });
      if (stop) return;
      if (!res.ok) { setErr(res.error); return; }
      setSt(res.data);
      // the Stripe webhook may land a moment after the redirect: check again for up to ~20 s
      if (!cancelled && session_id && res.data.paid <= 0 && tries++ < 10) setTimeout(poll, 2000);
    };
    if (b) void poll();
    return () => { stop = true; };
  }, [b, session_id, cancelled]);
  return (
    <AppShell site={site}>
      <section className="pt-24 pb-24 px-6 text-center max-w-xl mx-auto">
        {cancelled ? (
          <>
            <h1 className="font-display text-5xl mb-4">Payment not completed</h1>
            <p className="text-muted-foreground">Your time is held for 30 minutes. You can go back and try again, or contact us at {site.contact.email.toLowerCase()}.</p>
            <a href="/booking/" className="inline-block mt-8 border border-foreground px-6 py-3 text-sm tracking-widest">BACK TO BOOKING</a>
          </>
        ) : (
          <>
            <h1 className="font-display text-5xl mb-4">{st && st.paid > 0 ? "You're booked!" : "Thank you!"}</h1>
            {err && <p className="text-destructive">{err}</p>}
            {!st && !err && <p className="text-muted-foreground">Confirming your booking…</p>}
            {st && (
              <div className="border border-border p-6 mt-6 text-left space-y-2 font-body text-sm">
                <p><span className="text-muted-foreground">Reference:</span> <strong>{st.reference}</strong></p>
                <p><span className="text-muted-foreground">Booking:</span> {st.kind}</p>
                {st.when && <p><span className="text-muted-foreground">When:</span> {st.when}</p>}
                <p><span className="text-muted-foreground">Total:</span> {formatMoney(st.total)}</p>
                <p><span className="text-muted-foreground">Paid:</span> {formatMoney(st.paid)}</p>
                {st.balance > 0 && <p><span className="text-muted-foreground">Balance due:</span> {formatMoney(st.balance)}</p>}
                <p className="pt-2">
                  {st.paid > 0
                    ? "A confirmation and payment receipt have been emailed to you."
                    : session_id
                      ? "We are confirming your payment. You'll receive an email shortly."
                      : "Nothing has been paid yet. Send us the WhatsApp message with your booking details and we'll confirm your date and arrange payment there."}
                </p>
              </div>
            )}
            {waLink && !session_id && (
              <a href={waLink} target="_blank" rel="noopener noreferrer" className="m-btn inline-block mt-8 bg-foreground text-background px-8 py-4 text-sm tracking-widest">
                OPEN WHATSAPP AGAIN
              </a>
            )}
          </>
        )}
      </section>
    </AppShell>
  );
}
