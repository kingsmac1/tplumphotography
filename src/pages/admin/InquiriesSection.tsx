import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { ContactActions, formatPhone } from "./contact";

type Row = { id: string; created_at: string; form: string; first_name: string; last_name: string; email: string; phone: string; service: string; event_date: string; location: string; instagram: string; heard_from: string; message: string; status: string };
const STATUSES = ["new", "replied", "booked", "archived"];
const PAGE = 25;
const fmt = (iso: string) => new Date(iso).toLocaleString("en-CA", { timeZone: "America/Edmonton", dateStyle: "medium", timeStyle: "short" });

/** Contact-form and event-request submissions (every one is also emailed to the studio). */
export default function InquiriesSection() {
  const [rows, setRows] = useState<Row[]>([]);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<string | null>(null);
  const [err, setErr] = useState("");
  const load = useCallback(async () => {
    const { data, error } = await supabase.from("contact_submissions").select("*").order("created_at", { ascending: false }).limit(5000);
    if (error) setErr(error.message);
    setRows((data as Row[]) ?? []);
  }, []);
  useEffect(() => { void load(); }, [load]);
  const list = useMemo(() => rows.filter((r) => (!status || r.status === status) && (!q || `${r.first_name} ${r.last_name} ${r.email} ${r.phone} ${r.service} ${r.location}`.toLowerCase().includes(q.toLowerCase()))), [rows, q, status]);
  const pages = Math.max(1, Math.ceil(list.length / PAGE));
  const view = list.slice((page - 1) * PAGE, page * PAGE);
  const setRowStatus = async (id: string, s: string) => {
    await supabase.from("contact_submissions").update({ status: s }).eq("id", id);
    setRows((x) => x.map((r) => (r.id === id ? { ...r, status: s } : r)));
  };
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <label className="relative flex-1 min-w-[220px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input className="w-full border border-border bg-background pl-9 pr-3 py-2.5 text-sm" placeholder="Search name, email, phone, service…" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
        </label>
        <select className="border border-border bg-background px-3 py-2.5 text-sm" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
          <option value="">All ({rows.length})</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s[0].toUpperCase() + s.slice(1)} ({rows.filter((r) => r.status === s).length})</option>)}
        </select>
      </div>
      {err && <p className="text-sm text-destructive">{err}</p>}
      <div className="border border-border divide-y divide-border">
        {view.map((r) => (
          <div key={r.id} className="p-4">
            <div className="flex flex-wrap items-center gap-3 justify-between cursor-pointer" onClick={() => setOpen(open === r.id ? null : r.id)}>
              <div className="min-w-0">
                <p className="font-bold">{r.first_name} {r.last_name} <span className="text-xs font-normal text-muted-foreground ml-2">{r.form === "event" ? "Event request" : "Contact form"} · {fmt(r.created_at)}</span></p>
                <p className="text-sm text-muted-foreground truncate">{[r.service, r.event_date && `for ${r.event_date}`, r.location].filter(Boolean).join(" · ")}</p>
              </div>
              <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                <ContactActions name={r.first_name} phone={r.phone} email={r.email} />
                <select className={`border px-2 py-1 text-xs ${r.status === "new" ? "border-foreground font-bold" : "border-border"}`} value={r.status} onChange={(e) => void setRowStatus(r.id, e.target.value)}>
                  {STATUSES.map((s) => <option key={s} value={s}>{s[0].toUpperCase() + s.slice(1)}</option>)}
                </select>
              </div>
            </div>
            {open === r.id && (
              <dl className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-sm">
                <dt className="text-muted-foreground">Email</dt><dd>{r.email}</dd>
                <dt className="text-muted-foreground">Phone</dt><dd>{formatPhone(r.phone)}</dd>
                {r.instagram && <><dt className="text-muted-foreground">Instagram</dt><dd>{r.instagram}</dd></>}
                {r.heard_from && <><dt className="text-muted-foreground">Heard about us</dt><dd>{r.heard_from}</dd></>}
                {r.message && <><dt className="text-muted-foreground sm:col-span-2">Message</dt><dd className="sm:col-span-2 whitespace-pre-line">{r.message}</dd></>}
              </dl>
            )}
          </div>
        ))}
        {!view.length && <p className="p-6 text-sm text-muted-foreground">{rows.length ? "Nothing matches that search." : "No enquiries yet. Contact-form messages appear here (and in your inbox)."}</p>}
      </div>
      {pages > 1 && (
        <div className="flex items-center justify-end gap-3 text-sm">
          <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="p-2 border border-border disabled:opacity-40" aria-label="Previous page"><ChevronLeft size={14} /></button>
          Page {page} of {pages}
          <button disabled={page >= pages} onClick={() => setPage(page + 1)} className="p-2 border border-border disabled:opacity-40" aria-label="Next page"><ChevronRight size={14} /></button>
        </div>
      )}
    </div>
  );
}
