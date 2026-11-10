import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, X } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { formatMoney } from "./formOptions";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import ConfirmDialog from "./ConfirmDialog";
import { BulkActionBar, BulkButton, stickyCheckCell, stickyCheckHead, stickySnCell, stickySnHead, useRowSelection } from "./bulk";

interface Category { name: string; sort_order: number }
interface Expense { id: string; category: string; description: string; amount: number; expense_date: string; note: string | null; created_at: string }

const inputCls = "border border-border bg-background px-3 py-2 text-sm font-body outline-none focus:border-foreground";
const localToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Edmonton" }).format(new Date());

const ExpensesManager = () => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");

  const [categoryFilter, setCategoryFilter] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [expenseDate, setExpenseDate] = useState(localToday());
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const [newCategory, setNewCategory] = useState("");
  const [showCategoryBox, setShowCategoryBox] = useState(false);

  const [deleting, setDeleting] = useState<Expense | null>(null);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [bulkMsg, setBulkMsg] = useState("");
  const sel = useRowSelection();

  const load = async () => {
    setLoading(true);
    const [c, e] = await Promise.all([
      supabase.from("expense_categories").select("name, sort_order").order("sort_order", { ascending: true }),
      supabase.from("expenses").select("*").order("expense_date", { ascending: false }).order("created_at", { ascending: false }),
    ]);
    if (c.error || e.error) setError((c.error ?? e.error)!.message);
    else setError("");
    setCategories((c.data as Category[]) || []);
    setExpenses((e.data as Expense[]) || []);
    if (!category && c.data && c.data.length > 0) setCategory(c.data[0].name);
    setLoading(false);
  };
  useEffect(() => { void load(); /* eslint-disable-next-line */ }, []);

  const addCategory = async () => {
    const name = newCategory.trim();
    if (!name) return;
    const { error: err } = await supabase.from("expense_categories").insert({ name, sort_order: categories.length + 1 });
    if (err) return setMsg(err.message.includes("duplicate") ? "That category already exists." : err.message);
    setNewCategory("");
    setCategory(name);
    await load();
  };

  const removeCategory = async (name: string) => {
    const { error: err } = await supabase.from("expense_categories").delete().eq("name", name);
    if (err) return setMsg(err.message);
    await load();
  };

  const addExpense = async () => {
    setMsg("");
    const amt = Math.round(Number(amount));
    if (!category) return setMsg("Choose or add a category first.");
    if (!Number.isFinite(amt) || amt < 0) return setMsg("Enter a valid amount.");
    setSaving(true);
    const { error: err } = await supabase.from("expenses").insert({
      category, description: description.trim(), amount: amt, expense_date: expenseDate, note: note.trim() || null,
    });
    setSaving(false);
    if (err) return setMsg(err.message);
    setDescription(""); setAmount(""); setNote("");
    await load();
  };

  const filtered = useMemo(
    () => expenses.filter((e) => (!categoryFilter || e.category === categoryFilter) && (!from || e.expense_date >= from) && (!to || e.expense_date <= to)),
    [expenses, categoryFilter, from, to],
  );
  const total = filtered.reduce((sum, e) => sum + e.amount, 0);
  const filteredIds = filtered.map((e) => e.id);
  const selectedIds = filteredIds.filter((id) => sel.ids.has(id));
  const allSelected = filteredIds.length > 0 && selectedIds.length === filteredIds.length;

  return (
    <div className="space-y-6">
      <div className="border border-border p-4 space-y-4">
        <p className="text-xs font-body font-bold tracking-widest">ADD AN EXPENSE</p>
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-xs font-body font-bold tracking-widest">CATEGORY
            <select className={inputCls + " block mt-1 font-normal min-w-[160px]"} value={category} onChange={(e) => setCategory(e.target.value)}>
              {categories.length === 0 && <option value="">No categories yet</option>}
              {categories.map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}
            </select>
          </label>
          <button type="button" className="px-3 py-2 text-xs font-body border border-border hover:border-foreground" onClick={() => setShowCategoryBox((v) => !v)}>
            {showCategoryBox ? "HIDE CATEGORIES" : "MANAGE CATEGORIES"}
          </button>
          <label className="text-xs font-body font-bold tracking-widest">DATE
            <input type="date" className={inputCls + " block mt-1 font-normal"} value={expenseDate} onChange={(e) => setExpenseDate(e.target.value)} />
          </label>
          <label className="text-xs font-body font-bold tracking-widest">AMOUNT ($)
            <input type="number" className={inputCls + " block mt-1 font-normal w-32"} value={amount} onChange={(e) => setAmount(e.target.value)} />
          </label>
          <label className="text-xs font-body font-bold tracking-widest flex-1 min-w-[180px]">DESCRIPTION
            <input className={inputCls + " block mt-1 font-normal w-full"} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. Studio lighting kit" />
          </label>
          <button
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-body font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50"
            disabled={saving}
            onClick={() => void addExpense()}
          >
            <Plus size={16} /> Add Expense
          </button>
        </div>

        {showCategoryBox && (
          <div className="border-t border-border pt-4">
            <p className="text-xs font-body font-bold tracking-widest mb-2">CATEGORIES</p>
            <div className="flex flex-wrap items-center gap-2 mb-3">
              {categories.map((c) => (
                <span key={c.name} className="inline-flex items-center gap-1 border border-border px-3 py-1 text-xs font-body">
                  {c.name}
                  <button onClick={() => void removeCategory(c.name)} aria-label={`Remove ${c.name}`} className="text-muted-foreground hover:text-destructive"><X size={12} /></button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input className={inputCls + " w-48"} placeholder="New category name" value={newCategory} onChange={(e) => setNewCategory(e.target.value)} />
              <button className="px-3 py-2 text-xs font-body font-bold tracking-widest border border-border hover:border-foreground" onClick={() => void addCategory()}>ADD CATEGORY</button>
            </div>
            <p className="text-[11px] text-muted-foreground font-body mt-2">Removing a category doesn't delete past expenses recorded under it.</p>
          </div>
        )}
        {msg && <p className="text-sm text-destructive font-body">{msg}</p>}
      </div>

      <div className="border border-border p-4 flex flex-wrap items-end gap-3">
        <label className="text-xs font-body font-bold tracking-widest">CATEGORY
          <select className={inputCls + " block mt-1 font-normal"} value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
            <option value="">All categories</option>
            {categories.map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}
          </select>
        </label>
        <label className="text-xs font-body font-bold tracking-widest">FROM
          <input type="date" className={inputCls + " block mt-1 font-normal"} value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label className="text-xs font-body font-bold tracking-widest">TO
          <input type="date" className={inputCls + " block mt-1 font-normal"} value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
        {(categoryFilter || from || to) && (
          <button className="text-xs font-body underline text-muted-foreground hover:text-foreground" onClick={() => { setCategoryFilter(""); setFrom(""); setTo(""); }}>Clear filters</button>
        )}
        <span className="ml-auto text-sm font-body"><b>{filtered.length}</b> expense{filtered.length === 1 ? "" : "s"} · <b>{formatMoney(total)}</b> total</span>
      </div>

      {error && <p className="text-sm text-destructive font-body">{error}</p>}

      <div className="border border-border">
        <div className="overflow-x-auto">
          <Table containerClassName="max-h-[60vh]">
            <TableHeader>
              <TableRow>
                <TableHead className={stickyCheckHead}>
                  <Checkbox checked={allSelected ? true : selectedIds.length > 0 ? "indeterminate" : false} onCheckedChange={(v) => sel.setMany(filteredIds, v === true)} aria-label="Select all expenses" />
                </TableHead>
                <TableHead className={stickySnHead}>S/N</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Category</TableHead>
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
                <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No expenses recorded yet.</TableCell></TableRow>
              ) : (
                filtered.map((e, i) => (
                  <TableRow key={e.id} className={sel.ids.has(e.id) ? "bg-muted/60" : ""}>
                    <TableCell className={stickyCheckCell(sel.ids.has(e.id))}>
                      <Checkbox checked={sel.ids.has(e.id)} onCheckedChange={() => sel.toggle(e.id)} aria-label="Select expense" />
                    </TableCell>
                    <TableCell className={stickySnCell(sel.ids.has(e.id))}>{i + 1}</TableCell>
                    <TableCell className="whitespace-nowrap">{e.expense_date}</TableCell>
                    <TableCell className="whitespace-nowrap font-medium">{e.category}</TableCell>
                    <TableCell className="max-w-[260px] truncate">{e.description || "—"}</TableCell>
                    <TableCell className="whitespace-nowrap font-medium">{formatMoney(e.amount)}</TableCell>
                    <TableCell className="max-w-[200px] truncate text-muted-foreground">{e.note || "—"}</TableCell>
                    <TableCell>
                      <button onClick={() => setDeleting(e)} aria-label="Delete expense" className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded transition-colors">
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

      <BulkActionBar count={selectedIds.length} noun="expense" message={bulkMsg} onClear={() => { sel.clear(); setBulkMsg(""); }}>
        <BulkButton danger onClick={() => setBulkDeleting(true)}>DELETE</BulkButton>
      </BulkActionBar>

      {bulkDeleting && (
        <ConfirmDialog
          title={`Delete ${selectedIds.length} expense${selectedIds.length === 1 ? "" : "s"}?`}
          message="This cannot be undone."
          confirmLabel={`Delete ${selectedIds.length}`}
          destructive
          onClose={() => setBulkDeleting(false)}
          onConfirm={async () => {
            const { data, error: delErr } = await supabase.from("expenses").delete().in("id", selectedIds).select("id");
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
          title="Delete this expense?"
          message="This cannot be undone."
          confirmLabel="Delete"
          destructive
          onClose={() => setDeleting(null)}
          onConfirm={async () => {
            const { data, error: delErr } = await supabase.from("expenses").delete().eq("id", deleting.id).select("id");
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

export default ExpensesManager;
