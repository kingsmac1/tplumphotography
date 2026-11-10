import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Pencil, Trash2, X } from "lucide-react";
import ConfirmDialog from "./ConfirmDialog";
import { Checkbox } from "@/components/ui/checkbox";
import { useRowSelection, BulkActionBar, BulkButton, stickyCheckHead, stickyCheckCell, stickySnHead, stickySnCell } from "./bulk";

interface Promo {
  id: string;
  code: string;
  percent: number;
  label: string | null;
  active: boolean;
  expires_on: string | null;
}

const inputCls = "border border-border bg-background px-3 py-2 text-sm font-body outline-none focus:border-foreground";
const localToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Edmonton" }).format(new Date());

const PromoManager = () => {
  const [promos, setPromos] = useState<Promo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [code, setCode] = useState("");
  const [percent, setPercent] = useState("10");
  const [label, setLabel] = useState("");
  const [expires, setExpires] = useState("");
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const formRef = useRef<HTMLDivElement>(null);
  const [deleting, setDeleting] = useState<Promo | null>(null);
  const sel = useRowSelection();
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [bulkMsg, setBulkMsg] = useState("");

  const load = async () => {
    const { data, error: err } = await supabase.from("promos").select("*").order("created_at", { ascending: false });
    if (err) setError(err.message);
    else { setPromos((data as Promo[]) || []); setError(""); }
    setLoading(false);
  };

  useEffect(() => { void load(); }, []);

  const resetForm = () => {
    setEditingId(null);
    setCode(""); setLabel(""); setExpires(""); setPercent("10");
  };

  const startEdit = (p: Promo) => {
    setEditingId(p.id);
    setCode(p.code);
    setPercent(String(p.percent));
    setLabel(p.label || "");
    setExpires(p.expires_on || "");
    setError("");
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const save = async () => {
    const cleanCode = code.trim().toUpperCase().replace(/\s+/g, "");
    const pct = Number(percent);
    if (!cleanCode) return setError("Enter a promo code.");
    if (!(pct > 0 && pct <= 100)) return setError("Discount must be between 1 and 100.");
    setSaving(true);
    const fields = {
      code: cleanCode,
      percent: pct,
      label: label.trim() || null,
      expires_on: expires || null,
    };
    let err;
    if (editingId) {
      const { data, error: updErr } = await supabase.from("promos").update(fields).eq("id", editingId).select("id");
      err = updErr ?? (data && data.length === 0 ? { message: "Not saved. Make sure your account is an admin in the staff table." } : null);
    } else {
      ({ error: err } = await supabase.from("promos").insert({ ...fields, active: true }));
    }
    setSaving(false);
    if (err) return setError(err.message.includes("duplicate") ? "That code already exists." : err.message);
    setError("");
    resetForm();
    await load();
  };

  const patch = async (id: string, changes: Partial<Promo>) => {
    const { error: err } = await supabase.from("promos").update(changes).eq("id", id);
    if (err) setError(err.message);
    else await load();
  };

  const allIds = promos.map((p) => p.id);
  const selectedIds = allIds.filter((id) => sel.ids.has(id));
  const allSelected = allIds.length > 0 && selectedIds.length === allIds.length;

  const bulkSetActive = async (active: boolean) => {
    setBulkMsg("Updating…");
    const { data, error: updErr } = await supabase.from("promos").update({ active }).in("id", selectedIds).select("id");
    if (updErr) return setBulkMsg(updErr.message);
    setBulkMsg(`${data?.length ?? 0} promo${data?.length === 1 ? "" : "s"} turned ${active ? "on" : "off"}.`);
    sel.clear();
    await load();
  };

  return (
    <div className="border border-border">
      <div className="px-4 pt-4 pb-2">
        <h2 className="font-display text-xl font-bold tracking-wide">Promo Codes</h2>
        <p className="text-xs font-body text-muted-foreground mt-1">
          Every ACTIVE promo scrolls across the top of the homepage and can be entered on the booking page. Switch a promo OFF to stop it.
        </p>
      </div>

      <div ref={formRef} className={`p-4 border-b border-border ${editingId ? "bg-muted/40" : ""}`}>
        {editingId && <p className="text-xs font-body font-bold tracking-widest mb-3">EDITING PROMO</p>}
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-xs font-body font-bold tracking-widest">CODE
            <input className={inputCls + " block mt-1 uppercase font-normal w-40"} value={code} onChange={(e) => setCode(e.target.value)} placeholder="SUMMER20" />
          </label>
          <label className="text-xs font-body font-bold tracking-widest">% OFF
            <input className={inputCls + " block mt-1 font-normal w-24"} type="number" min={1} max={100} value={percent} onChange={(e) => setPercent(e.target.value)} />
          </label>
          <label className="text-xs font-body font-bold tracking-widest">OFFER NAME (OPTIONAL)
            <input className={inputCls + " block mt-1 font-normal w-56"} value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Summer offer" />
          </label>
          <label className="text-xs font-body font-bold tracking-widest">EXPIRES (OPTIONAL)
            <input className={inputCls + " block mt-1 font-normal"} type="date" value={expires} onChange={(e) => setExpires(e.target.value)} />
          </label>
          <button
            onClick={() => void save()}
            disabled={saving}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-body font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50"
          >
            {editingId ? <><Pencil size={16} /> Save Changes</> : <><Plus size={16} /> Add Promo</>}
          </button>
          {editingId && (
            <button
              onClick={resetForm}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-body font-medium border border-border rounded-md hover:bg-muted/50"
            >
              <X size={16} /> Cancel
            </button>
          )}
        </div>
        {error && <p className="text-sm text-destructive font-body mt-3">{error}</p>}
      </div>

      <div className="overflow-x-auto">
        <Table fitViewport>
          <TableHeader>
            <TableRow>
              <TableHead className={stickyCheckHead}>
                <Checkbox
                  checked={allSelected ? true : selectedIds.length > 0 ? "indeterminate" : false}
                  onCheckedChange={(v) => sel.setMany(allIds, v === true)}
                  aria-label="Select all promos"
                />
              </TableHead>
              <TableHead className={stickySnHead}>S/N</TableHead>
              <TableHead>Code</TableHead>
              <TableHead>Discount</TableHead>
              <TableHead>Offer name</TableHead>
              <TableHead>Expires</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
            ) : promos.length === 0 ? (
              <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No promos yet</TableCell></TableRow>
            ) : (
              promos.map((p, i) => {
                const expired = !!p.expires_on && p.expires_on < localToday();
                return (
                  <TableRow key={p.id} className={sel.ids.has(p.id) ? "bg-muted/60" : ""}>
                    <TableCell className={stickyCheckCell(sel.ids.has(p.id))}>
                      <Checkbox checked={sel.ids.has(p.id)} onCheckedChange={() => sel.toggle(p.id)} aria-label={`Select promo ${p.code}`} />
                    </TableCell>
                  <TableCell className={stickySnCell(sel.ids.has(p.id))}>{i + 1}</TableCell>
                    <TableCell className="font-bold tracking-widest">{p.code}</TableCell>
                    <TableCell>{p.percent}%</TableCell>
                    <TableCell>{p.label || "—"}</TableCell>
                    <TableCell>{p.expires_on || "Never"}{expired ? " (expired)" : ""}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <button
                          role="switch"
                          aria-checked={p.active}
                          aria-label={`${p.code} ${p.active ? "active" : "off"}`}
                          onClick={() => void patch(p.id, { active: !p.active })}
                          className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${p.active ? "bg-green-600" : "bg-muted-foreground/40"}`}
                        >
                          <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${p.active ? "translate-x-[22px]" : "translate-x-0.5"}`} />
                        </button>
                        <span className="text-xs font-body font-bold tracking-widest w-14">
                          {expired ? "EXPIRED" : p.active ? "ACTIVE" : "OFF"}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      <button onClick={() => startEdit(p)} className="p-2 text-muted-foreground hover:text-foreground" aria-label="Edit promo">
                        <Pencil size={16} />
                      </button>
                      <button onClick={() => setDeleting(p)} className="p-2 text-muted-foreground hover:text-destructive" aria-label="Delete promo">
                        <Trash2 size={16} />
                      </button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <BulkActionBar count={selectedIds.length} noun="promo" message={bulkMsg} onClear={() => { sel.clear(); setBulkMsg(""); }}>
        <BulkButton onClick={() => void bulkSetActive(true)}>TURN ON</BulkButton>
        <BulkButton onClick={() => void bulkSetActive(false)}>TURN OFF</BulkButton>
        <BulkButton danger onClick={() => setBulkDeleting(true)}>DELETE</BulkButton>
      </BulkActionBar>
      {bulkDeleting && (
        <ConfirmDialog
          title={`Delete ${selectedIds.length} promo${selectedIds.length === 1 ? "" : "s"}?`}
          message="The selected codes will stop working immediately."
          confirmLabel={`Delete ${selectedIds.length}`}
          destructive
          onClose={() => setBulkDeleting(false)}
          onConfirm={async () => {
            const { data, error: err } = await supabase.from("promos").delete().in("id", selectedIds).select("id");
            if (err) throw new Error(err.message);
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
          title="Delete this promo?"
          message={`The code ${deleting.code} will stop working immediately.`}
          confirmLabel="Delete"
          destructive
          onClose={() => setDeleting(null)}
          onConfirm={async () => {
            const { data, error: err } = await supabase.from("promos").delete().eq("id", deleting.id).select("id");
            if (err) throw new Error(err.message);
            if (!data || data.length === 0) throw new Error("Nothing was deleted. Make sure your account is an admin in the staff table.");
            setDeleting(null);
            await load();
          }}
        />
      )}
    </div>
  );
};

export default PromoManager;
