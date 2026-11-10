import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Download, Search, X } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { ContactActions, formatPhone } from "./contact";
import { formatMoney } from "./formOptions";

/**
 * Clients: everyone who booked, rented the studio, asked for an event, made an enquiry, got an invoice or signed up,
 * grouped by email. One click shows their whole history (DMI kept this per booking table; Tplum adds the combined view).
 */
type Activity = { kind: string; date: string; title: string; amount?: number; paid?: number; href?: string; status?: string };
type Client = { email: string; name: string; phone: string; activities: Activity[]; booked: number; paid: number; last: string; account: boolean };
const PAGE = 25;
const day = (s?: string | null) => (s ? String(s).slice(0, 10) : "");
const fmt = (d: string) => (d ? new Date(`${d}T12:00:00Z`).toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }) : "");

export default function ClientsSection() {
  const [clients, setClients] = useState<Client[] | null>(null);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<"last" | "paid" | "name">("last");
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<Client | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    (async () => {
      const [b, s, e, inv, c, ct, p] = await Promise.all([
        supabase.from("bookings").select("id, created_at, full_name, email, phone, shoot_date, shoot_type, selected_service, grand_total, amount_paid, payment_status, status").limit(10000),
        supabase.from("studio_bookings").select("id, created_at, full_name, email, phone, rental_date, space_name, grand_total, amount_paid, payment_status, status").limit(10000),
        supabase.from("event_bookings").select("id, created_at, full_name, email, phone, event_start_date, event_type, agreed_amount, amount_paid, payment_status").limit(10000),
        supabase.from("invoices").select("id, number, created_at, client_name, client_email, total, paid, status").limit(10000),
        supabase.from("contracts").select("id, number, created_at, client_name, client_email, title, status").limit(10000),
        supabase.from("contact_submissions").select("id, created_at, first_name, last_name, email, phone, service").limit(10000),
        supabase.from("profiles").select("email, full_name, phone, created_at").limit(10000),
      ]);
      const firstErr = [b, s, e, inv, c, ct, p].find((x) => x.error)?.error;
      if (firstErr) setErr(firstErr.message);
      const map = new Map<string, Client>();
      const get = (email: string, name: string, phone: string) => {
        const k = email.trim().toLowerCase();
        if (!k) return null;
        let cl = map.get(k);
        if (!cl) { cl = { email: k, name: name || "", phone: phone || "", activities: [], booked: 0, paid: 0, last: "", account: false }; map.set(k, cl); }
        if (!cl.name && name) cl.name = name;
        if (!cl.phone && phone) cl.phone = phone;
        return cl;
      };
      const add = (cl: Client | null, a: Activity) => { if (!cl) return; cl.activities.push(a); if (a.date > cl.last) cl.last = a.date; };
      for (const r of b.data ?? []) {
        const cl = get(r.email ?? "", r.full_name, r.phone);
        if (cl && r.status !== "cancelled" && r.status !== "pending_payment") { cl.booked += Number(r.grand_total) || 0; cl.paid += Number(r.amount_paid) || (r.payment_status === "Paid" ? Number(r.grand_total) || 0 : 0); }
        add(cl, { kind: "Booking", date: day(r.shoot_date || r.created_at), title: r.selected_service || r.shoot_type || "Session", amount: Number(r.grand_total) || 0, paid: Number(r.amount_paid) || 0, status: r.status === "confirmed" ? r.payment_status : r.status, href: `#galleries/${r.id}` });
      }
      for (const r of s.data ?? []) {
        const cl = get(r.email ?? "", r.full_name, r.phone);
        if (cl && r.status !== "cancelled" && r.status !== "pending_payment") { cl.booked += Number(r.grand_total) || 0; cl.paid += Number(r.amount_paid) || 0; }
        add(cl, { kind: "Studio rental", date: day(r.rental_date || r.created_at), title: r.space_name, amount: Number(r.grand_total) || 0, status: r.payment_status });
      }
      for (const r of e.data ?? []) {
        const cl = get(r.email ?? "", r.full_name, r.phone);
        if (cl) { cl.booked += Number(r.agreed_amount) || 0; cl.paid += Number(r.amount_paid) || 0; }
        add(cl, { kind: "Event", date: day(r.event_start_date || r.created_at), title: r.event_type, amount: Number(r.agreed_amount) || 0, status: r.payment_status });
      }
      for (const r of inv.data ?? []) add(get(r.client_email ?? "", r.client_name, ""), { kind: "Invoice", date: day(r.created_at), title: r.number, amount: Number(r.total) || 0, paid: Number(r.paid) || 0, status: r.status, href: `#invoices/${r.id}` });
      for (const r of c.data ?? []) add(get(r.client_email ?? "", r.client_name, ""), { kind: "Contract", date: day(r.created_at), title: `${r.number} · ${r.title}`, status: r.status, href: `#contracts/${r.id}` });
      for (const r of ct.data ?? []) add(get(r.email ?? "", `${r.first_name} ${r.last_name}`.trim(), r.phone), { kind: "Enquiry", date: day(r.created_at), title: r.service, href: "#inquiries" });
      for (const r of p.data ?? []) { const cl = get(r.email ?? "", r.full_name, r.phone); if (cl) cl.account = true; }
      for (const cl of map.values()) cl.activities.sort((a, z) => z.date.localeCompare(a.date));
      setClients([...map.values()]);
    })();
  }, []);

  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    const filtered = (clients ?? []).filter((c) => !t || `${c.name} ${c.email} ${c.phone}`.toLowerCase().includes(t));
    return filtered.sort((a, b) => (sort === "name" ? a.name.localeCompare(b.name) : sort === "paid" ? b.paid - a.paid : b.last.localeCompare(a.last)));
  }, [clients, q, sort]);
  const pages = Math.max(1, Math.ceil(list.length / PAGE));
  const view = list.slice((page - 1) * PAGE, page * PAGE);

  const exportCsv = () => {
    const lines = [["Name", "Email", "Phone", "Booked (CAD)", "Paid (CAD)", "Last activity", "Has account"], ...list.map((c) => [c.name, c.email, formatPhone(c.phone), c.booked.toFixed(2), c.paid.toFixed(2), c.last, c.account ? "yes" : "no"])];
    const blob = new Blob([lines.map((l) => l.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n")], { type: "text/csv" });
    const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: "tplum-clients.csv" });
    a.click();
  };

  if (!clients) return <p className="text-sm text-muted-foreground">Loading clients…</p>;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <label className="relative flex-1 min-w-[220px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input className="w-full border border-border bg-background pl-9 pr-3 py-2.5 text-sm" placeholder={`Search ${clients.length} clients by name, email or phone…`} value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
        </label>
        <select className="border border-border bg-background px-3 py-2.5 text-sm" value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} aria-label="Sort">
          <option value="last">Most recent</option><option value="paid">Highest paid</option><option value="name">Name A–Z</option>
        </select>
        <button onClick={exportCsv} className="inline-flex items-center gap-2 border border-border px-3 py-2.5 text-sm hover:border-foreground"><Download size={14} /> Export CSV</button>
      </div>
      {err && <p className="text-sm text-destructive">{err}</p>}
      <div className="border border-border overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-xs tracking-widest text-muted-foreground border-b border-border"><th className="p-3">CLIENT</th><th className="p-3">CONTACT</th><th className="p-3 text-right">BOOKED</th><th className="p-3 text-right">PAID</th><th className="p-3">LAST ACTIVITY</th><th className="p-3"></th></tr></thead>
          <tbody>
            {view.map((c) => (
              <tr key={c.email} className="border-b border-border hover:bg-muted/40 cursor-pointer" onClick={() => setOpen(c)}>
                <td className="p-3"><b>{c.name || "—"}</b>{c.account && <span className="ml-2 text-[10px] tracking-widest border border-border px-1">ACCOUNT</span>}<div className="text-xs text-muted-foreground">{c.activities.length} item{c.activities.length === 1 ? "" : "s"}</div></td>
                <td className="p-3"><div>{c.email}</div><div className="text-xs text-muted-foreground">{formatPhone(c.phone)}</div></td>
                <td className="p-3 text-right">{formatMoney(c.booked)}</td>
                <td className="p-3 text-right">{formatMoney(c.paid)}</td>
                <td className="p-3">{fmt(c.last)}</td>
                <td className="p-3" onClick={(e) => e.stopPropagation()}><ContactActions name={c.name} phone={c.phone} email={c.email} /></td>
              </tr>
            ))}
          </tbody>
        </table>
        {!view.length && <p className="p-6 text-sm text-muted-foreground">{clients.length ? "No client matches that search." : "No clients yet."}</p>}
      </div>
      {pages > 1 && (
        <div className="flex items-center justify-end gap-3 text-sm">
          <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="p-2 border border-border disabled:opacity-40" aria-label="Previous page"><ChevronLeft size={14} /></button>
          Page {page} of {pages}
          <button disabled={page >= pages} onClick={() => setPage(page + 1)} className="p-2 border border-border disabled:opacity-40" aria-label="Next page"><ChevronRight size={14} /></button>
        </div>
      )}
      {open && (
        <div className="fixed inset-0 z-50 bg-black/50 flex justify-end" onClick={() => setOpen(null)}>
          <aside className="w-full max-w-lg h-full bg-background overflow-y-auto p-6" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={`Client ${open.name}`}>
            <div className="flex justify-between items-start gap-3">
              <div><h2 className="font-display text-3xl">{open.name || open.email}</h2><p className="text-sm text-muted-foreground">{open.email} · {formatPhone(open.phone)}</p></div>
              <button onClick={() => setOpen(null)} aria-label="Close"><X size={20} /></button>
            </div>
            <div className="mt-4 flex gap-6 text-sm"><div><div className="text-xs text-muted-foreground">BOOKED</div><b>{formatMoney(open.booked)}</b></div><div><div className="text-xs text-muted-foreground">PAID</div><b>{formatMoney(open.paid)}</b></div><div><div className="text-xs text-muted-foreground">OWING</div><b>{formatMoney(Math.max(0, open.booked - open.paid))}</b></div></div>
            <div className="mt-3"><ContactActions name={open.name} phone={open.phone} email={open.email} /></div>
            <h3 className="mt-6 text-xs tracking-widest text-muted-foreground">HISTORY</h3>
            <ul className="mt-2 divide-y divide-border border border-border">
              {open.activities.map((a, i) => (
                <li key={i} className="p-3 text-sm flex justify-between gap-3">
                  <div><div className="text-xs text-muted-foreground">{a.kind} · {fmt(a.date)}{a.status ? ` · ${a.status}` : ""}</div>{a.href ? <a className="underline" href={a.href} onClick={() => setOpen(null)}>{a.title}</a> : a.title}</div>
                  {a.amount !== undefined && <div className="text-right whitespace-nowrap">{formatMoney(a.amount)}{a.paid ? <div className="text-xs text-muted-foreground">paid {formatMoney(a.paid)}</div> : null}</div>}
                </li>
              ))}
            </ul>
          </aside>
        </div>
      )}
    </div>
  );
}
