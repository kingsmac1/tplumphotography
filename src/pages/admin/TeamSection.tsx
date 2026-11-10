import { useEffect, useMemo, useState } from "react";
import { Search, Pencil, Trash2, X } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { callFn } from "@/features/gallery/api";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import CustomSelect from "./CustomSelect";
import ConfirmDialog from "./ConfirmDialog";
import { useBodyScrollLock } from "./useBodyScrollLock";

/**
 * Every login on the website (clients and the team). The admin decides who is Staff or Admin; anyone else is a client.
 * New staff create an account at /account like a client, then get a role here. Staff use /checkin as their dashboard.
 */

type Role = "client" | "staff" | "admin";
interface Account {
  id: string;
  email: string;
  full_name: string;
  role: Role;
  job_title: string;
  joined: string;
}

/** The studio's primary (owner) login: never listed, so it can't be demoted or deleted from here. */
const HIDDEN_ACCOUNTS = new Set(["emkaydigitals@gmail.com"]);

const ROLE_LABEL: Record<Role, string> = { client: "Client", staff: "Staff", admin: "Admin" };
const ROLE_TONE: Record<Role, string> = {
  client: "bg-muted text-muted-foreground",
  staff: "bg-blue-100 text-blue-800",
  admin: "bg-foreground text-background",
};
const inputCls = "w-full border border-border bg-background px-3 py-2 text-sm font-body outline-none focus:border-foreground";
const fmtDay = (iso: string) => (iso ? new Date(iso).toLocaleDateString("en-CA", { day: "numeric", month: "short", year: "numeric" }) : "—");

const TeamSection = () => {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [me, setMe] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [roleChange, setRoleChange] = useState<{ a: Account; to: Role } | null>(null);
  const [editing, setEditing] = useState<Account | null>(null);
  const [deleting, setDeleting] = useState<Account | null>(null);

  const load = async () => {
    setLoading(true);
    const [u, p, s] = await Promise.all([
      supabase.auth.getUser(),
      supabase.from("profiles").select("id, email, full_name, created_at").order("created_at", { ascending: false }).limit(5000),
      supabase.from("staff").select("*"),
    ]);
    const err = p.error?.message || s.error?.message;
    if (err) { setError(err); setLoading(false); return; }
    setError("");
    setMe(u.data.user?.id ?? "");
    const staff = new Map((s.data ?? []).map((r: { id: string; role: Role; full_name: string; job_title?: string; created_at: string }) => [r.id, r]));
    const list: Account[] = (p.data ?? []).map((r: { id: string; email: string; full_name: string; created_at: string }) => {
      const st = staff.get(r.id);
      staff.delete(r.id);
      return { id: r.id, email: r.email, full_name: st?.full_name || r.full_name || "", role: st?.role ?? "client", job_title: st?.job_title ?? "", joined: r.created_at };
    });
    // staff without a profile row (older logins)
    staff.forEach((st) => list.push({ id: st.id, email: "", full_name: st.full_name, role: st.role, job_title: st.job_title ?? "", joined: st.created_at }));
    setAccounts(list.filter((a) => !HIDDEN_ACCOUNTS.has(a.email.toLowerCase())));
    setLoading(false);
  };
  useEffect(() => { void load(); }, []);

  const view = useMemo(() => {
    const q = search.trim().toLowerCase();
    const rank: Record<Role, number> = { admin: 0, staff: 1, client: 2 };
    return accounts
      .filter((a) => (!roleFilter || a.role === roleFilter) && (!q || `${a.full_name} ${a.email} ${a.job_title}`.toLowerCase().includes(q)))
      .sort((a, b) => rank[a.role] - rank[b.role] || a.full_name.localeCompare(b.full_name));
  }, [accounts, search, roleFilter]);
  const counts = useMemo(() => ({
    admin: accounts.filter((a) => a.role === "admin").length,
    staff: accounts.filter((a) => a.role === "staff").length,
    client: accounts.filter((a) => a.role === "client").length,
  }), [accounts]);

  const applyRole = async (a: Account, to: Role) => {
    const name = a.full_name || a.email.split("@")[0];
    const res =
      to === "client"
        ? await supabase.from("staff").delete().eq("id", a.id).select("id")
        : a.role === "client"
          ? await supabase.from("staff").insert({ id: a.id, full_name: name, role: to }).select("id")
          : await supabase.from("staff").update({ role: to }).eq("id", a.id).select("id");
    if (res.error) throw new Error(res.error.message);
    if (!res.data?.length) throw new Error("Nothing changed. Your account needs to be an admin to change roles.");
    setNotice(`${name} is now ${to === "client" ? "a client (no staff access)" : `${to === "admin" ? "an" : "a"} ${ROLE_LABEL[to]}`}.`);
    setRoleChange(null);
    await load();
  };

  if (loading) return <div className="p-4 text-muted-foreground">Loading accounts…</div>;

  return (
    <div className="space-y-6">
      <div className="border border-border p-4 text-sm font-body leading-relaxed">
        <p className="font-bold">Adding a new staff member</p>
        <p className="text-muted-foreground">
          Ask them to create an account at <b className="text-foreground">dmi.com.ng/account</b> and confirm their email. They then appear below as a
          Client — change them to <b className="text-foreground">Staff</b>. Staff sign in at <b className="text-foreground">dmi.com.ng/checkin</b> to check in
          and see their own attendance. <b className="text-foreground">Admin</b> gives full access to this dashboard.
        </p>
      </div>

      {error && <p className="p-3 border border-destructive/30 bg-destructive/10 text-sm text-destructive">{error}</p>}
      {notice && (
        <p className="flex items-start justify-between gap-3 p-3 border border-border text-sm font-body">
          {notice}
          <button onClick={() => setNotice("")} aria-label="Dismiss"><X size={14} /></button>
        </p>
      )}

      <div className="border border-border">
        <div className="p-4 border-b border-border flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[220px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name or email…" className={inputCls + " pl-10"} />
          </div>
          <CustomSelect
            value={roleFilter}
            onChange={setRoleFilter}
            options={[
              { value: "", label: `Everyone (${accounts.length})` },
              { value: "admin", label: `Admins (${counts.admin})` },
              { value: "staff", label: `Staff (${counts.staff})` },
              { value: "client", label: `Clients (${counts.client})` },
            ]}
            className="w-full sm:w-48"
          />
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Account</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Job title</TableHead>
              <TableHead>Joined</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {view.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No accounts found</TableCell></TableRow>
            ) : (
              view.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="max-w-[280px]">
                    <p className="font-medium truncate">{a.full_name || "—"}{a.id === me && <span className="ml-2 text-xs text-muted-foreground">(you)</span>}</p>
                    <p className="text-xs text-muted-foreground truncate">{a.email || "—"}</p>
                  </TableCell>
                  <TableCell>
                    {a.id === me ? (
                      <span className={`px-2 py-0.5 text-[11px] font-semibold rounded-full ${ROLE_TONE[a.role]}`}>{ROLE_LABEL[a.role]}</span>
                    ) : (
                      <CustomSelect
                        value={a.role}
                        onChange={(v) => v !== a.role && setRoleChange({ a, to: v as Role })}
                        options={(["client", "staff", "admin"] as Role[]).map((r) => ({ value: r, label: ROLE_LABEL[r] }))}
                        className="w-32"
                      />
                    )}
                  </TableCell>
                  <TableCell className="text-sm max-w-[200px] truncate">{a.role === "client" ? <span className="text-muted-foreground">—</span> : a.job_title || <span className="text-muted-foreground">—</span>}</TableCell>
                  <TableCell className="text-sm whitespace-nowrap">{fmtDay(a.joined)}</TableCell>
                  <TableCell className="whitespace-nowrap">
                    <div className="flex items-center gap-1">
                      <button onClick={() => setEditing(a)} aria-label="Edit account" className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded transition-colors">
                        <Pencil size={14} />
                      </button>
                      {a.id !== me && a.email && (
                        <button onClick={() => setDeleting(a)} aria-label="Delete account" className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded transition-colors">
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {roleChange && (
        <ConfirmDialog
          title={`Make ${roleChange.a.full_name || roleChange.a.email} ${roleChange.to === "admin" ? "an Admin" : roleChange.to === "staff" ? "Staff" : "a Client"}?`}
          message={
            roleChange.to === "admin"
              ? "Admins can see and change everything in this dashboard: bookings, finance, accounts and settings."
              : roleChange.to === "staff"
                ? "They can sign in at dmi.com.ng/checkin to check in and see their own attendance. They can't open this dashboard."
                : "They lose all staff access and keep a normal client account. Their past check-ins stay in the attendance records."
          }
          confirmLabel="Change role"
          destructive={roleChange.to === "client"}
          onClose={() => setRoleChange(null)}
          onConfirm={() => applyRole(roleChange.a, roleChange.to)}
        />
      )}
      {editing && <EditAccount a={editing} onClose={() => setEditing(null)} onSaved={async (msg) => { setEditing(null); setNotice(msg); await load(); }} />}
      {deleting && <DeleteAccount a={deleting} onClose={() => setDeleting(null)} onDeleted={async (msg) => { setDeleting(null); setNotice(msg); await load(); }} />}
    </div>
  );
};

function Dialog({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  useBodyScrollLock(true);
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-label={title} className="w-full max-w-md bg-background border border-border p-6">
        <div className="flex items-start justify-between gap-4 mb-4">
          <h3 className="font-display text-xl font-bold">{title}</h3>
          <button onClick={onClose} aria-label="Close" className="text-muted-foreground hover:text-foreground"><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function EditAccount({ a, onClose, onSaved }: { a: Account; onClose: () => void; onSaved: (msg: string) => void }) {
  const [name, setName] = useState(a.full_name);
  const [title, setTitle] = useState(a.job_title);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const save = async () => {
    setBusy(true);
    setErr("");
    const full_name = name.trim();
    const p = a.email ? await supabase.from("profiles").update({ full_name }).eq("id", a.id) : { error: null };
    const s = a.role !== "client" ? await supabase.from("staff").update({ full_name, job_title: title.trim() }).eq("id", a.id) : { error: null };
    const e = p.error?.message || s.error?.message;
    setBusy(false);
    if (e) return setErr(/job_title/.test(e) ? "Job titles need supabase/staff-portal.sql to be run in Supabase first." : e);
    onSaved(`${full_name || a.email} saved.`);
  };
  return (
    <Dialog title="Edit account" onClose={onClose}>
      <div className="space-y-4 text-sm font-body">
        <p className="text-muted-foreground">{a.email}</p>
        <label className="block">
          <span className="text-xs font-bold tracking-widest text-muted-foreground">FULL NAME</span>
          <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls + " mt-1"} />
        </label>
        {a.role !== "client" && (
          <label className="block">
            <span className="text-xs font-bold tracking-widest text-muted-foreground">JOB TITLE</span>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Photographer, Editor, Front desk" className={inputCls + " mt-1"} />
          </label>
        )}
        <p className="text-xs text-muted-foreground">To change their role, use the Role menu in the table.</p>
        {err && <p className="text-destructive">{err}</p>}
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 border border-border">Cancel</button>
          <button onClick={() => void save()} disabled={busy} className="px-4 py-2 bg-primary text-primary-foreground disabled:opacity-50">{busy ? "Saving…" : "Save"}</button>
        </div>
      </div>
    </Dialog>
  );
}

/** Deleting a login can't be undone, so the admin types the account's email to confirm (checked again on the server). */
function DeleteAccount({ a, onClose, onDeleted }: { a: Account; onClose: () => void; onDeleted: (msg: string) => void }) {
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const matches = typed.trim().toLowerCase() === a.email.toLowerCase();
  const del = async () => {
    setBusy(true);
    setErr("");
    const r = await callFn("account-delete", { user_id: a.id, confirm_email: typed.trim() });
    setBusy(false);
    if (!r.ok) return setErr(r.status === 404 && /not found/i.test(r.error) ? "The account-delete function isn't deployed yet (see supabase/functions/account-delete)." : r.error);
    onDeleted(`${a.full_name || a.email}'s account was deleted.`);
  };
  return (
    <Dialog title="Delete this account?" onClose={onClose}>
      <div className="space-y-4 text-sm font-body">
        <p>
          This permanently deletes the login for <b>{a.full_name || a.email}</b>
          {a.role === "staff" ? ", their staff access and their check-in history" : ""}. They can't sign in again unless they create a new account.
          Their bookings and galleries are kept. <b>This can't be undone.</b>
        </p>
        {a.role === "admin" ? (
          <p className="p-3 border border-destructive/30 bg-destructive/10 text-destructive">This is an admin account. Change it to Staff or Client first, then delete it.</p>
        ) : (
          <label className="block">
            <span className="text-muted-foreground">Type <b className="text-foreground select-all">{a.email}</b> to confirm.</span>
            <input value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" spellCheck={false} className={inputCls + " mt-2"} placeholder={a.email} />
          </label>
        )}
        {err && <p className="text-destructive">{err}</p>}
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 border border-border">Cancel</button>
          <button
            onClick={() => void del()}
            disabled={busy || !matches || a.role === "admin"}
            className="px-4 py-2 bg-destructive text-destructive-foreground disabled:opacity-40"
          >
            {busy ? "Deleting…" : "Delete account"}
          </button>
        </div>
      </div>
    </Dialog>
  );
}

export default TeamSection;
