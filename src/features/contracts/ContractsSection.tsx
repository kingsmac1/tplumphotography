import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Copy, FileSignature, Loader2, Plus, Printer, Search, Send, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { formatMoney } from "@/pages/admin/formOptions";
import { depositFor } from "@/lib/pricing";
import SignaturePad, { fillPlaceholders } from "./SignaturePad";
import { ContractPaper, SignatureBlocks } from "./ContractPaper";
import { DEFAULT_WEDDING_PACKAGES } from "@/data/weddingDefaults";

/**
 * Contracts & e-signing (new for Tplum; DMI has none). Hash routes:
 *   #contracts                     list + templates
 *   #contracts/<id>                one contract (edit while draft, send, countersign, void, print)
 *   #contracts/booking/<table>/<id> new contract pre-filled from a booking
 */
type Template = { id: string; name: string; body: string; sample: boolean; active: boolean };
type Contract = {
  id: string; number: string; created_at: string; template_id: string | null; booking_table: string | null; booking_id: string | null; title: string;
  client_name: string; client_email: string; body: string; status: string; public_token: string; sent_at: string | null; viewed_at: string | null;
  signed_at: string | null; signer_name: string | null; signer_ip: string | null; signer_user_agent: string | null; signature_data: string | null; body_hash: string | null;
  studio_signed_at: string | null; studio_signer_name: string | null; studio_signature_data: string | null;
};

/** Both parties sign: 'signed' = the client signed and the studio still has to; 'countersigned' = signed by both. */
const STATUS_LABEL: Record<string, string> = { draft: "Draft", sent: "Sent", viewed: "Opened", signed: "Awaiting studio signature", countersigned: "Signed by both", void: "Void" };
const STATUS_TONE: Record<string, string> = { draft: "border-border text-muted-foreground", sent: "border-blue-600 text-blue-700", viewed: "border-amber-600 text-amber-700", signed: "border-green-600 text-green-700", countersigned: "border-green-700 text-green-800", void: "border-border text-muted-foreground line-through" };
const btn = "inline-flex items-center gap-2 px-4 py-2 text-sm border border-border hover:border-foreground disabled:opacity-40";
const primary = "inline-flex items-center gap-2 px-4 py-2 text-sm bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-40";
const input = "w-full border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-foreground";
const fmt = (iso?: string | null) => (iso ? new Date(iso).toLocaleString("en-CA", { timeZone: "America/Edmonton", dateStyle: "medium", timeStyle: "short" }) : "—");
const pathFromHash = () => (typeof window === "undefined" ? [] : /^#contracts\/(.+)/.exec(window.location.hash)?.[1].split("/").filter(Boolean) ?? []);

export const PLACEHOLDERS = [
  "client_name", "client_email", "client_phone", "event_date", "event_time", "venue", "package", "package_details", "extras",
  "coverage", "tax_label", "tax", "total", "retainer", "second_payment", "second_payment_due", "final_payment", "final_payment_due",
  "deposit", "balance", "balance_due_date", "kiddies_balance", "kiddies_terms", "business_name", "today",
];

type Kind = "wedding" | "kiddies" | "other";
const longDay = (iso: string) => (iso ? new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-CA", { dateStyle: "long", timeZone: "UTC" }) : "");
const isoDay = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const round2 = (n: number) => Math.round(n * 100) / 100;
/** "60 Mins Studio Session · Up to 2 Outfits" or a wedding package's list → "- " bullet lines */
const bullets = (items: string[]) => items.map((x) => x.trim()).filter(Boolean).map((x) => `- ${x}`).join("\n");

/** Values every contract can use, with or without a booking (business name, today, the kiddies terms). */
async function baseValues(): Promise<{ values: Record<string, string>; settings: Record<string, unknown> | null }> {
  const { data: s } = await supabase.from("business_settings").select("*").eq("id", 1).maybeSingle();
  return {
    settings: s,
    values: {
      business_name: String(s?.business_name ?? "Tplum Photography"),
      today: new Date().toLocaleDateString("en-CA", { dateStyle: "long", timeZone: "America/Edmonton" }),
      kiddies_terms: String(s?.kiddies_terms ?? ""),
    },
  };
}

async function bookingValues(table: string, id: string): Promise<{ values: Record<string, string>; name: string; email: string; title: string; kind: Kind }> {
  const [{ data: b }, base] = await Promise.all([supabase.from(table).select("*").eq("id", id).maybeSingle(), baseValues()]);
  const s = base.settings as Record<string, any> | null;
  if (!b) return { values: base.values, name: "", email: "", title: "Photography Agreement", kind: "other" };
  const kind: Kind = b.source === "wedding_form" || /wedding/i.test(String(b.shoot_type ?? "")) ? "wedding" : /kiddies/i.test(String(b.shoot_setting ?? "")) ? "kiddies" : "other";
  // Fees: the booking's price before tax, plus GST. Website session bookings already carry their tax; weddings and
  // events don't, so the contract adds the tax from Settings (as on Tplum's paper contract: $2,500 + 5% GST = $2,625).
  const gross = Number(table === "event_bookings" ? b.agreed_amount : b.grand_total) || 0;
  const bookedTax = Number(b.tax_total) || 0;
  const coverage = round2(gross - bookedTax);
  const rate = s?.booking_tax_enabled ? Number(s.booking_tax_rate) || 0 : 0;
  const taxName = String(b.tax_name || s?.booking_tax_name || "GST");
  const tax = bookedTax > 0 ? bookedTax : round2((coverage * rate) / 100);
  const taxRate = bookedTax > 0 && coverage > 0 ? round2((bookedTax / coverage) * 100) : rate;
  const total = round2(coverage + tax);
  const deposit = s ? depositFor(total, { deposit_mode: s.deposit_mode, deposit_percent: Number(s.deposit_percent), deposit_fixed: Number(s.deposit_fixed) }) : 0;
  // Payment schedule from the wedding contract: 20% retainer, 30% second payment, 50% final payment.
  const retainer = round2(total * 0.2);
  const second = round2(total * 0.3);
  const final = round2(total - retainer - second);
  const date = String(b.shoot_date ?? b.rental_date ?? b.event_start_date ?? "");
  const eventMs = date ? Date.parse(`${date}T12:00:00Z`) : 0;
  const finalDue = eventMs ? isoDay(eventMs - Number(s?.balance_due_days_before ?? 14) * 86400000) : "";
  const secondDue = eventMs ? isoDay(Date.now() + Math.max(0, (Date.parse(`${finalDue}T12:00:00Z`) - Date.now()) / 2)) : "";
  const pkgName = String(b.selected_service || b.space_name || b.event_type || "");
  let details: string[] = [];
  if (kind === "wedding") {
    const { data: wp } = await supabase.from("wedding_packages").select("name, includes");
    const found = ((wp as { name: string; includes: string[] }[] | null) ?? []).find((p) => p.name === pkgName) ?? DEFAULT_WEDDING_PACKAGES.find((p) => p.name === pkgName);
    details = found?.includes ?? [];
  } else if (table === "bookings" && pkgName) {
    const { data: bp } = await supabase.from("booking_prices").select("name, description").eq("name", pkgName).limit(1);
    details = String((bp as { description: string }[] | null)?.[0]?.description ?? "").split(/\s*·\s*/);
  }
  if (b.selected_extras) details.push(`Add-ons: ${String(b.selected_extras).replace(/\s*\|\s*/g, ", ")}`);
  return {
    kind,
    name: b.full_name ?? "", email: String(b.email ?? "").toLowerCase(),
    title: kind === "wedding" ? "Wedding Photography Contract" : kind === "kiddies" ? "Tplum Kiddies Session Agreement" : "Photography Agreement",
    values: {
      ...base.values,
      client_name: b.full_name ?? "", client_email: b.email ?? "", client_phone: b.phone ?? "", event_date: longDay(date),
      event_time: String(b.shoot_time ?? b.rental_time ?? b.event_time ?? "").slice(0, 5), venue: b.location || b.venue || b.shoot_setting || "",
      package: pkgName, package_details: bullets(details.length ? details : [pkgName]), extras: b.selected_extras || "None",
      coverage: formatMoney(coverage), tax_label: `${taxRate}% ${taxName}`, tax: formatMoney(tax), total: formatMoney(total),
      retainer: formatMoney(retainer), second_payment: formatMoney(second), final_payment: formatMoney(final),
      second_payment_due: longDay(secondDue), final_payment_due: longDay(finalDue),
      deposit: formatMoney(deposit), balance: formatMoney(Math.max(0, total - deposit)), balance_due_date: longDay(finalDue),
      kiddies_balance: formatMoney(Math.max(0, total - 150)),
    },
  };
}

/** Write / Preview tabs over a contract text box: the preview is the client's exact sheet. */
function TextWithPreview({ title, value, onChange, rows = 24, label }: { title: string; value: string; onChange: (v: string) => void; rows?: number; label: string }) {
  const [view, setView] = useState<"write" | "preview">("write");
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm">{label}</span>
        <div className="inline-flex border border-border" role="tablist">
          {(["write", "preview"] as const).map((v) => (
            <button key={v} type="button" role="tab" aria-selected={view === v} onClick={() => setView(v)} className={`px-4 py-1.5 text-xs ${view === v ? "bg-foreground text-background" : ""}`}>{v === "write" ? "Write" : "Preview"}</button>
          ))}
        </div>
      </div>
      {view === "write"
        ? <textarea className={`${input} font-mono`} rows={rows} value={value} onChange={(e) => onChange(e.target.value)} aria-label={label} />
        : <div className="p-3 md:p-6" style={{ background: "#f1ede6" }}><ContractPaper title={title} body={value} /></div>}
      <p className="text-xs text-muted-foreground">Format: <code>Label:: value</code> lines make the details panel · <code>## </code> section · <code>### </code> sub-heading · <code>- </code> bullet · <code>**bold**</code> · blank line = new paragraph.</p>
    </div>
  );
}

export default function ContractsSection() {
  const [path, setPath] = useState<string[]>(pathFromHash());
  useEffect(() => { const on = () => setPath(pathFromHash()); window.addEventListener("hashchange", on); return () => window.removeEventListener("hashchange", on); }, []);
  if (path[0] === "booking" && path[1] && path[2]) return <NewContract table={path[1]} bookingId={path[2]} />;
  if (path[0] === "new") return <NewContract />;
  if (path[0]) return <ContractView id={path[0]} key={path[0]} />;
  return <ContractList />;
}

function ContractList() {
  const [tab, setTab] = useState<"contracts" | "templates">("contracts");
  const [rows, setRows] = useState<Contract[]>([]);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const load = useCallback(async () => {
    const { data } = await supabase.from("contracts").select("*").order("created_at", { ascending: false }).limit(5000);
    setRows((data as Contract[]) ?? []);
  }, []);
  useEffect(() => { void load(); }, [load]);
  const list = useMemo(() => rows.filter((r) => (!status || r.status === status) && (!q || `${r.number} ${r.client_name} ${r.client_email} ${r.title}`.toLowerCase().includes(q.toLowerCase()))), [rows, q, status]);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-4xl md:text-5xl">Contracts</h1>
        <div className="flex gap-2">
          <button className={tab === "contracts" ? primary : btn} onClick={() => setTab("contracts")}>Contracts</button>
          <button className={tab === "templates" ? primary : btn} onClick={() => setTab("templates")}>Templates</button>
        </div>
      </div>
      {tab === "templates" ? <Templates /> : (
        <>
          <div className="flex flex-wrap gap-3">
            <label className="relative flex-1 min-w-[220px]"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" /><input className={`${input} pl-9`} placeholder="Search number, client, email…" value={q} onChange={(e) => setQ(e.target.value)} /></label>
            <select className="border border-border bg-background px-3 py-2.5 text-sm" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Filter by status">
              <option value="">All statuses</option>{Object.keys(STATUS_TONE).map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
            </select>
            <a className={primary} href="#contracts/new"><Plus size={15} /> New contract</a>
          </div>
          <div className="border border-border overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs tracking-widest text-muted-foreground border-b border-border"><th className="p-3">CONTRACT</th><th className="p-3">CLIENT</th><th className="p-3">STATUS</th><th className="p-3">SENT</th><th className="p-3">SIGNED</th></tr></thead>
              <tbody>
                {list.map((r) => (
                  <tr key={r.id} className="border-b border-border hover:bg-muted/40 cursor-pointer" onClick={() => { window.location.hash = `#contracts/${r.id}`; }}>
                    <td className="p-3"><b>{r.number}</b><div className="text-xs text-muted-foreground">{r.title}</div></td>
                    <td className="p-3">{r.client_name}<div className="text-xs text-muted-foreground">{r.client_email}</div></td>
                    <td className="p-3"><span className={`text-[11px] font-bold tracking-wider border px-2 py-0.5 ${STATUS_TONE[r.status]}`}>{(STATUS_LABEL[r.status] ?? r.status).toUpperCase()}</span></td>
                    <td className="p-3">{fmt(r.sent_at)}</td>
                    <td className="p-3">{fmt(r.signed_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!list.length && <p className="p-6 text-sm text-muted-foreground">{rows.length ? "Nothing matches." : "No contracts yet. Create one here, or press Contract on any booking to start with the client's details filled in."}</p>}
          </div>
        </>
      )}
    </div>
  );
}

function Templates() {
  const [rows, setRows] = useState<Template[]>([]);
  const [edit, setEdit] = useState<Template | null>(null);
  const [msg, setMsg] = useState("");
  const load = useCallback(async () => { const { data } = await supabase.from("contract_templates").select("*").order("created_at"); setRows((data as Template[]) ?? []); }, []);
  useEffect(() => { void load(); }, [load]);
  const save = async () => {
    if (!edit) return;
    const values = { name: edit.name.trim() || "Untitled", body: edit.body, active: edit.active, sample: false };
    const { error } = edit.id ? await supabase.from("contract_templates").update(values).eq("id", edit.id) : await supabase.from("contract_templates").insert(values);
    if (error) return setMsg(error.message);
    setMsg("Saved."); setEdit(null); void load();
  };
  const remove = async (t: Template) => { if (!window.confirm(`Delete the template “${t.name}”? Contracts already made from it are not changed.`)) return; await supabase.from("contract_templates").delete().eq("id", t.id); void load(); };
  if (edit) return (
    <div className="space-y-3 max-w-4xl">
      <input className={input} value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} placeholder="Template name" aria-label="Template name" />
      <p className="text-xs text-muted-foreground">Placeholders filled from the booking: {PLACEHOLDERS.map((p) => `{{${p}}}`).join(" ")}</p>
      <TextWithPreview title={edit.name || "Contract"} label="Template text" rows={26} value={edit.body} onChange={(v) => setEdit({ ...edit, body: v })} />
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={edit.active} onChange={(e) => setEdit({ ...edit, active: e.target.checked })} /> Available when creating contracts</label>
      <div className="flex gap-2"><button className={primary} onClick={() => void save()}>Save template</button><button className={btn} onClick={() => setEdit(null)}>Cancel</button></div>
      {msg && <p className="text-sm">{msg}</p>}
    </div>
  );
  return (
    <div className="space-y-3">
      <button className={primary} onClick={() => setEdit({ id: "", name: "", body: "", sample: false, active: true })}><Plus size={15} /> New template</button>
      <div className="border border-border divide-y divide-border">
        {rows.map((t) => (
          <div key={t.id} className="p-4 flex justify-between items-center gap-3">
            <div><b>{t.name}</b>{t.sample && <span className="sample-badge ml-2">Sample: edit me</span>}{!t.active && <span className="ml-2 text-xs text-muted-foreground">(off)</span>}</div>
            <div className="flex gap-2"><button className={btn} onClick={() => setEdit(t)}>Edit</button><button className={btn} onClick={() => void remove(t)} aria-label={`Delete ${t.name}`}><Trash2 size={14} /></button></div>
          </div>
        ))}
        {!rows.length && <p className="p-4 text-sm text-muted-foreground">No templates yet.</p>}
      </div>
    </div>
  );
}

function NewContract({ table, bookingId }: { table?: string; bookingId?: string }) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [tpl, setTpl] = useState("");
  const [form, setForm] = useState({ title: "Photography Agreement", client_name: "", client_email: "", body: "" });
  const [values, setValues] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  useEffect(() => {
    void (async () => {
      const { data } = await supabase.from("contract_templates").select("*").eq("active", true).order("created_at");
      const list = (data as Template[]) ?? [];
      setTemplates(list);
      let v: Record<string, string> = (await baseValues()).values;
      let f = { ...form };
      let kind: Kind = "other";
      if (table && bookingId) {
        const b = await bookingValues(table, bookingId);
        v = b.values; kind = b.kind; f = { ...f, title: b.title, client_name: b.name, client_email: b.email };
      }
      const kindOf = (n: string): Kind => (/wedding/i.test(n) ? "wedding" : /kiddies/i.test(n) ? "kiddies" : "other");
      const first = list.find((t) => kindOf(t.name) === kind) ?? list.find((t) => kindOf(t.name) === "wedding") ?? list[0];
      if (first && !(table && bookingId)) f.title = first.name;
      if (first) { setTpl(first.id); f.body = fillPlaceholders(first.body, v); }
      setValues(v); setForm(f);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const pick = (id: string) => { setTpl(id); const t = templates.find((x) => x.id === id); if (t) setForm((f) => ({ ...f, body: fillPlaceholders(t.body, { ...values, client_name: f.client_name, client_email: f.client_email }) })); };
  const create = async () => {
    if (!form.client_name.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.client_email)) return setMsg("Enter the client's name and email.");
    if (/\{\{\s*\w+\s*\}\}/.test(form.body) && !window.confirm("Some {{placeholders}} are still in the text. Create the contract anyway?")) return;
    setBusy(true);
    const { data, error } = await supabase.from("contracts").insert({ ...form, client_email: form.client_email.trim().toLowerCase(), template_id: tpl || null, booking_table: table ?? null, booking_id: bookingId ?? null }).select("id").single();
    setBusy(false);
    if (error) return setMsg(error.message);
    window.location.hash = `#contracts/${data.id}`;
  };
  return (
    <div className="space-y-4 max-w-4xl">
      <a href="#contracts" className="inline-flex items-center gap-2 text-sm"><ArrowLeft size={14} /> Contracts</a>
      <h1 className="font-display text-4xl">New contract</h1>
      <div className="grid sm:grid-cols-2 gap-3">
        <label className="text-sm">Template<select className={input} value={tpl} onChange={(e) => pick(e.target.value)}>{templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
        <label className="text-sm">Title<input className={input} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></label>
        <label className="text-sm">Client name<input className={input} value={form.client_name} onChange={(e) => setForm({ ...form, client_name: e.target.value })} /></label>
        <label className="text-sm">Client email<input type="email" className={input} value={form.client_email} onChange={(e) => setForm({ ...form, client_email: e.target.value })} /></label>
      </div>
      <TextWithPreview title={form.title} label="Contract text (what the client will sign)" value={form.body} onChange={(v) => setForm({ ...form, body: v })} />
      <button className={primary} disabled={busy} onClick={() => void create()}>{busy ? <Loader2 size={15} className="animate-spin" /> : <FileSignature size={15} />} Create contract</button>
      {msg && <p className="text-sm text-destructive">{msg}</p>}
    </div>
  );
}

function ContractView({ id }: { id: string }) {
  const [c, setC] = useState<Contract | null>(null);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const [sig, setSig] = useState(""); const [sigName, setSigName] = useState("");
  const [saved, setSaved] = useState<{ signer_name: string | null; signature_image: string | null } | null>(null);
  const [useSaved, setUseSaved] = useState(true); const [saveDefault, setSaveDefault] = useState(false);
  useEffect(() => { void supabase.from("contract_settings").select("signer_name, signature_image").eq("id", 1).maybeSingle().then(({ data }) => { setSaved(data); if (data?.signer_name) setSigName(data.signer_name); }); }, []);
  const load = useCallback(async () => { const { data } = await supabase.from("contracts").select("*").eq("id", id).maybeSingle(); setC(data as Contract); setBody((data as Contract)?.body ?? ""); }, [id]);
  useEffect(() => { void load(); }, [load]);
  if (!c) return <p className="text-sm text-muted-foreground">Loading…</p>;
  const link = `${window.location.origin}/contract/?t=${c.public_token}`;
  const editable = c.status === "draft" && !c.studio_signed_at;
  const canStudioSign = !c.studio_signed_at && (c.status === "draft" || c.status === "signed");
  const hasSaved = !!saved?.signature_image;
  const callCountersign = async (payload: Record<string, unknown>) => {
    setBusy(true); setMsg(null);
    const { data, error } = await supabase.functions.invoke("contract-countersign", { body: { contract_id: c.id, ...payload } });
    setBusy(false);
    let detail = error?.message; if (error) { try { detail = (await (error as { context?: Response }).context?.json())?.error || detail; } catch { /* keep */ } }
    return { data, error: error ? detail ?? "Something went wrong." : null };
  };
  const saveBody = async () => { const { error } = await supabase.from("contracts").update({ body }).eq("id", c.id); setMsg(error ? { ok: false, t: error.message } : { ok: true, t: "Saved." }); void load(); };
  const send = async () => {
    if (editable && body !== c.body) await supabase.from("contracts").update({ body }).eq("id", c.id);
    setBusy(true); setMsg(null);
    const { data, error } = await supabase.functions.invoke("contract-send", { body: { contract_id: c.id } });
    setBusy(false);
    let detail = error?.message; if (error) { try { detail = (await (error as { context?: Response }).context?.json())?.error || detail; } catch { /* keep */ } }
    setMsg(error ? { ok: false, t: detail ?? "Could not send." } : { ok: true, t: `Sent to ${c.client_email}. ${data?.link ? "" : ""}` });
    void load();
  };
  const countersign = async () => {
    if (editable && body !== c.body) { const { error } = await supabase.from("contracts").update({ body }).eq("id", c.id); if (error) return setMsg({ ok: false, t: error.message }); }
    const signature = hasSaved && useSaved ? saved!.signature_image! : sig;
    if (!signature || sigName.trim().length < 2) return setMsg({ ok: false, t: "Type your name and draw your signature." });
    const { data, error } = await callCountersign({ name: sigName.trim(), signature, save_default: !(hasSaved && useSaved) && saveDefault });
    if (error) setMsg({ ok: false, t: error });
    else {
      setMsg({ ok: true, t: data?.complete ? "Signed for Tplum Photography. The contract is now signed by both, and the client has been emailed the signed copy." : "Signed for Tplum Photography. You can now send it to the client." });
      if (!(hasSaved && useSaved) && saveDefault) setSaved({ signer_name: sigName.trim(), signature_image: signature });
    }
    void load();
  };
  const removeStudioSig = async () => {
    if (!window.confirm("Remove the studio signature? You can then edit the text and sign again.")) return;
    const { error } = await callCountersign({ action: "remove" });
    setMsg(error ? { ok: false, t: error } : { ok: true, t: "Studio signature removed. You can edit the contract again." }); void load();
  };
  const voidIt = async () => { if (!window.confirm("Void this contract? The client link stops working. This can't be undone.")) return; await supabase.from("contracts").update({ status: "void" }).eq("id", c.id); void load(); };
  return (
    <div className="space-y-4 max-w-4xl">
      <a href="#contracts" className="inline-flex items-center gap-2 text-sm"><ArrowLeft size={14} /> Contracts</a>
      <div className="flex flex-wrap justify-between items-start gap-3">
        <div><h1 className="font-display text-4xl">{c.title}</h1><p className="text-sm text-muted-foreground">{c.number} · {c.client_name} · {c.client_email}</p></div>
        <span className={`text-xs font-bold tracking-wider border px-2 py-1 ${STATUS_TONE[c.status]}`}>{(STATUS_LABEL[c.status] ?? c.status).toUpperCase()}</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {c.studio_signed_at && c.status !== "void" && c.status !== "signed" && c.status !== "countersigned" && <button className={primary} disabled={busy} onClick={() => void send()}>{busy ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />} {c.sent_at ? "Resend to client" : "Send to client"}</button>}
        {c.status !== "draft" && c.status !== "void" && <button className={btn} onClick={() => { void navigator.clipboard.writeText(link); setMsg({ ok: true, t: "Client link copied." }); }}><Copy size={15} /> Copy client link</button>}
        {c.status !== "draft" && <button className={btn} onClick={() => window.open(link, "_blank")}><Printer size={15} /> View / print</button>}
        {c.booking_id && <a className={btn} href={`#invoices/booking/${c.booking_table}/${c.booking_id}`}>Create invoice</a>}
        {c.status === "draft" && c.studio_signed_at && <button className={btn} disabled={busy} onClick={() => void removeStudioSig()}>Remove studio signature</button>}
        {c.status !== "void" && <button className={btn} onClick={() => void voidIt()}>Void</button>}
      </div>
      {msg && <p className={`text-sm ${msg.ok ? "text-green-700" : "text-destructive"}`} role="status">{msg.t}</p>}
      <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm border border-border p-4">
        <div><dt className="text-xs text-muted-foreground">SENT</dt><dd>{fmt(c.sent_at)}</dd></div>
        <div><dt className="text-xs text-muted-foreground">OPENED</dt><dd>{fmt(c.viewed_at)}</dd></div>
        <div><dt className="text-xs text-muted-foreground">SIGNED</dt><dd>{fmt(c.signed_at)}</dd></div>
        <div><dt className="text-xs text-muted-foreground">STUDIO SIGNED</dt><dd>{fmt(c.studio_signed_at)}</dd></div>
      </dl>
      {editable ? (
        <div className="space-y-2">
          <TextWithPreview title={c.title} label="Contract text" value={body} onChange={setBody} />
          <button className={btn} onClick={() => void saveBody()}>Save changes</button>
        </div>
      ) : (
        <div className="p-3 md:p-6" style={{ background: "#f1ede6" }}>
          <ContractPaper title={c.title} number={c.number} body={c.body}>
            <SignatureBlocks
              client={{ name: c.signer_name, date: c.signed_at ? fmt(c.signed_at) : null, image: c.signature_data }}
              studio={{ name: c.studio_signer_name, date: c.studio_signed_at ? fmt(c.studio_signed_at) : null, image: c.studio_signature_data }}
            />
          </ContractPaper>
        </div>
      )}
      {c.signature_data && (
        <div className="border border-border p-4 text-sm space-y-2">
          <p className="font-bold">Client signature</p>
          <img src={c.signature_data} alt={`Signature of ${c.signer_name}`} style={{ maxHeight: 90 }} />
          <p>{c.signer_name} · {fmt(c.signed_at)} · IP {c.signer_ip || "—"}</p>
          <p className="text-xs text-muted-foreground break-all">Device: {c.signer_user_agent} · Text fingerprint (SHA-256): {c.body_hash}</p>
        </div>
      )}
      {canStudioSign && (
        <div className="border border-border p-4 space-y-3 max-w-xl">
          <p className="font-bold">Studio signature</p>
          <p className="text-sm text-muted-foreground">{c.status === "signed" ? "The client has signed. Sign for Tplum Photography to complete the contract; the client is then emailed the fully signed copy." : "Contracts are signed by both parties. Sign for Tplum Photography first, then send it to the client. Once you sign, the text is locked."}</p>
          <input className={input} placeholder="Your full name" value={sigName} onChange={(e) => setSigName(e.target.value)} aria-label="Name of the person signing for Tplum Photography" />
          {hasSaved && (
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={useSaved} onChange={(e) => setUseSaved(e.target.checked)} /> Use my saved signature</label>
          )}
          {hasSaved && useSaved
            ? <div className="border border-border p-3 bg-white"><img src={saved!.signature_image!} alt="Saved studio signature" style={{ maxHeight: 90 }} /></div>
            : <>
                <SignaturePad onChange={setSig} />
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={saveDefault} onChange={(e) => setSaveDefault(e.target.checked)} /> Save this signature for future contracts</label>
              </>}
          <button className={primary} disabled={busy} onClick={() => void countersign()}>{busy ? <Loader2 size={15} className="animate-spin" /> : <FileSignature size={15} />} Sign for Tplum Photography</button>
        </div>
      )}
      {c.studio_signature_data && <div className="border border-border p-4 text-sm"><p className="font-bold">Studio signature</p><img src={c.studio_signature_data} alt="Studio signature" style={{ maxHeight: 90 }} /><p>{c.studio_signer_name} · {fmt(c.studio_signed_at)}</p></div>}
      <p className="text-xs text-muted-foreground">Contracts are signed by both Tplum Photography and the client. Once the studio signs, the text is locked (remove the studio signature to edit a draft). Signed contracts can't be changed: to change terms, void it and send a new one.</p>
    </div>
  );
}

export { formatMoney };
