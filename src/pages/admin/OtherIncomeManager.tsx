import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { formatMoney } from "./formOptions";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import ConfirmDialog from "./ConfirmDialog";
import { BulkActionBar, BulkButton, stickyCheckCell, stickyCheckHead, stickySnCell, stickySnHead, useRowSelection } from "./bulk";

interface Income { id: string; income_date: string; source: string; description: string; amount: number; note: string | null; created_at: string }

const inputCls = "border border-border bg-background px-3 py-2 text-sm font-body outline-none focus:border-foreground";
const localToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Edmonton" }).format(new Date());

const OtherIncomeManager = () => {
  const [rows, setRows] = useState<Income[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [search, setSearch] = useState("");

  const [incomeDate, setIncomeDate] = useState(localToday());
  const [source, setSource] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const [deleting, setDeleting] = useState<Income | null>(null);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [bulkMsg, setBulkMsg] = useState("");
  const sel = useRowSelection();

  const load = async () => {
    setLoading(true);
    const { data, error: err } = await supabase
      .from("other_income")
      .select("*")
      .order("income_date", { ascending: false })
      .order("created_at", { ascending: false });
    if (err) setError(err.message);
    else setError("");
    setRows((data as Income[]) || []);
    setLoading(false);
  };
  useEffect(() => { void load(); }, []);

  const addIncome = async () => {
    setMsg("");
    const amt = Math.round(Number(amount));
    if (!Number.isFinite(amt) || amt < 0) return setMsg("Enter a valid amount.");
    if (!description.trim() && !source.trim()) return setMsg("Add a source or a description so you can tell this entry apart later.");
    setSaving(true);
    const { error: err } = await supabase.from("other_income").insert({
      income_date: incomeDate, source: source.trim(), description: description.trim(), amount: amt, note: note.trim() || null,
    });
    setSaving(false);
    if (err) return setMsg(err.message);
    setSource(""); setDescription(""); setAmount(""); setNote("");
    await load();
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (from && r.income_date < from) return false;
      if (to && r.income_date > to) return false;
      if (q && !r.source.toLowerCase().includes(q) && !r.description.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [rows, from, to, search]);
  const total = filtered.reduce((sum, r) => sum + r.amount, 0);
  const filteredIds = filtered.map((r) => r.id);
  const selectedIds = filteredIds.filter((id) => sel.ids.has(id));
  const allSelected = filteredIds.length > 0 && selectedIds.length === filteredIds.length;

  return (
    <div className="space-y-6">
      <div className="border border-border p-4 space-y-3">
        <p className="text-xs font-body font-bold tracking-widest">ADD OTHER INCOME</p>
        <p className="text-xs font-body text-muted-foreground">
          For money that comes in outside photography, weddings, studio space and academy — e.g. print sales, equipment rented out, referral fees. It's added to Total Revenue on the Overview tab straight away.
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-xs font-body font-bold tracking-widest">DATE
            <input type="date" className={inputCls + " block mt-1 font-normal"} value={incomeDate} onChange={(e) => setIncomeDate(e.target.value)} />
          </label>
          <label className="text-xs font-body font-bold tracking-widest">SOURCE
            <input className={inputCls + " block mt-1 font-normal w-40"} value={source} onChange={(e) => setSource(e.target.value)} placeholder="e.g. Print sales" />
          </label>
          <label className="text-xs font-body font-bold tracking-widest">AMOUNT ($)
            <input type="number" className={inputCls + " block mt-1 font-normal w-32"} value={amount} onChange={(e) => setAmount(e.target.value)} />
          </label>
          <label className="text-xs font-body font-bold tracking-widest flex-1 min-w-[180px]">DESCRIPTION
            <input className={inputCls + " block mt-1 font-normal w-full"} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional details" />
          </label>
          <button
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-body font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50"
            disabled={saving}
            onClick={() => void addIncome()}
          >
            <Plus size={16} /> Add Income
          </button>
        </div>
        {msg && <p className="text-sm text-destructive font-body">{msg}</p>}
      </div>

      <div className="border border-border p-4 flex flex-wrap items-end gap-3">
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <input className={inputCls + " w-full"} placeholder="Search source or description…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <label className="text-xs font-body font-bold tracking-widest">FROM
          <input type="date" className={inputCls + " block mt-1 font-normal"} value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label className="text-xs font-body font-bold tracking-widest">TO
          <input type="date" className={inputCls + " block mt-1 font-normal"} value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
        {(search || from || to) && (
          <button className="text-xs font-body underline text-muted-foreground hover:text-foreground" onClick={() => { setSearch(""); setFrom(""); setTo(""); }}>Clear filters</button>
        )}
        <span className="ml-auto text-sm font-body"><b>{filtered.length}</b> entr{filtered.length === 1 ? "y" : "ies"} · <b>{formatMoney(total)}</b> total</span>
      </div>

      {error && <p className="text-sm text-destructive font-body">{error}</p>}

      <div className="border border-border">
        <div className="overflow-x-auto">
          <Table containerClassName="max-h-[60vh]">
            <TableHeader>
              <TableRow>
                <TableHead className={stickyCheckHead}>
                  <Checkbox checked={allSelected ? true : selectedIds.length > 0 ? "indeterminate" : false} onCheckedChange={(v) => sel.setMany(filteredIds, v === true)} aria-label="Select all income entries" />
                </TableHead>
                <TableHead className={stickySnHead}>S/N</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Note</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Loading…</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No other income recorded yet.</TableCell></TableRow>
              ) : (
                filtered.map((r, i) => (
                  <TableRow key={r.id} className={sel.ids.has(r.id) ? "bg-muted/60" : ""}>
                    <TableCell className={stickyCheckCell(sel.ids.has(r.id))}>
                      <Checkbox checked={sel.ids.has(r.id)} onCheckedChange={() => sel.toggle(r.id)} aria-label="Select income entry" />
                    </TableCell>
                    <TableCell className={stickySnCell(sel.ids.has(r.id))}>{i + 1}</TableCell>
                    <TableCell className="whitespace-nowrap">{r.income_date}</TableCell>
                    <TableCell className="whitespace-nowrap font-medium">{r.source || "—"}</TableCell>
                    <TableCell className="max-w-[260px] truncate">{r.description || "—"}</TableCell>
                    <TableCell className="whitespace-nowrap font-medium">{formatMoney(r.amount)}</TableCell>
                    <TableCell className="max-w-[200px] truncate text-muted-foreground">{r.note || "—"}</TableCell>
                    <TableCell>
                      <button onClick={() => setDeleting(r)} aria-label="Delete income entry" className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded transition-colors">
                        <Trash2 size={14} />
                      </button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <BulkActionBar count={selectedIds.length} noun="entry" message={bulkMsg} onClear={() => { sel.clear(); setBulkMsg(""); }}>
        <BulkButton danger onClick={() => setBulkDeleting(true)}>DELETE</BulkButton>
      </BulkActionBar>

      {bulkDeleting && (
        <ConfirmDialog
          title={`Delete ${selectedIds.length} income entr${selectedIds.length === 1 ? "y" : "ies"}?`}
          message="This cannot be undone."
          confirmLabel={`Delete ${selectedIds.length}`}
          destructive
          onClose={() => setBulkDeleting(false)}
          onConfirm={async () => {
            const { data, error: delErr } = await supabase.from("other_income").delete().in("id", selectedIds).select("id");
            if (delErr) throw new Error(delErr.message);
            if (!data || data.length === 0) throw new Error("Nothing was deleted. Make sure your account is an admin in the staff table.");
            setBulkDeleting(false);
            setBulkMsg(`${data.length} deleted.`);
            sel.clear();
            await load();
          }}
        />
      )}
      {deleting && (
        <ConfirmDialog
          title="Delete this income entry?"
          message="This cannot be undone."
          confirmLabel="Delete"
          destructive
          onClose={() => setDeleting(null)}
          onConfirm={async () => {
            const { data, error: delErr } = await supabase.from("other_income").delete().eq("id", deleting.id).select("id");
            if (delErr) throw new Error(delErr.message);
            if (!data || data.length === 0) throw new Error("Nothing was deleted.");
            setDeleting(null);
            await load();
          }}
        />
      )}
    </div>
  );
};

export default OtherIncomeManager;
