import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, Plus, Pencil, Trash2, X, FileText } from "lucide-react";
import { bookingInvoiceHref } from "@/features/invoices/events";
import { formatMoney } from "./formOptions";
import DetailModal from "./DetailModal";
import { ContactActions } from "./contact";
import { PaymentCell, applyPayment, paymentPatch, PAYMENT_STATUSES, type PaymentPatch } from "./payment";
import CustomSelect from "./CustomSelect";
import ConfirmDialog from "./ConfirmDialog";
import ManualStudioSpaceForm from "./ManualStudioSpaceForm";
import { Checkbox } from "@/components/ui/checkbox";
import { useRowSelection, BulkActionBar, BulkButton, stickyCheckHead, stickyCheckCell, stickySnHead, stickySnCell } from "./bulk";

interface StudioBooking {
  id: string;
  created_at: string;
  full_name: string;
  phone: string;
  email: string | null;
  rental_date: string | null;
  rental_time: string | null;
  space_name: string;
  space_price: number;
  duration_minutes: number;
  selected_extras: string;
  extras_total: number;
  space_total: number;
  grand_total: number;
  notes: string | null;
  payment_status: string;
  amount_paid?: number | null;
  source: string;
}

interface Props { onAdd: () => void; }

const ALL = "";

const StudioSpaceTable = ({ onAdd }: Props) => {
  const [rows, setRows] = useState<StudioBooking[]>([]);
  const [search, setSearch] = useState("");
  const [paymentFilter, setPaymentFilter] = useState(ALL);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<StudioBooking | null>(null);
  const [editing, setEditing] = useState<StudioBooking | null>(null);
  const [deleting, setDeleting] = useState<StudioBooking | null>(null);
  const sel = useRowSelection();
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [bulkMsg, setBulkMsg] = useState("");
  const [visibleCount, setVisibleCount] = useState(200);
  const PAGE_SIZE = 200;

  const fetchRows = async () => {
    setLoading(true);
    const { data, error: fetchError } = await supabase.from("studio_bookings").select("*").order("created_at", { ascending: false });
    if (fetchError) setError(fetchError.message);
    else setRows((data as StudioBooking[]) || []);
    setLoading(false);
  };
  useEffect(() => { void fetchRows(); }, []);

  const updatePayment = async (id: string, patch: PaymentPatch) => {
    const msg = await applyPayment("studio_bookings", [id], patch);
    if (msg) setError(msg);
    else fetchRows();
  };

  const lc = (v: unknown) => (v ?? "").toString().toLowerCase();
  const paymentOptions = PAYMENT_STATUSES;

  const filtered = useMemo(() => rows.filter((r) => {
    const matchesSearch =
      lc(r.full_name).includes(search.toLowerCase()) ||
      lc(r.email).includes(search.toLowerCase()) ||
      lc(r.phone).includes(search.toLowerCase()) ||
      lc(r.space_name).includes(search.toLowerCase());
    return matchesSearch && (paymentFilter === ALL || (r.payment_status || "Not Paid") === paymentFilter);
  }), [rows, search, paymentFilter]);

  const filteredIds = filtered.map((r) => r.id);
  const selectedIds = filteredIds.filter((id) => sel.ids.has(id));
  const allSelected = filteredIds.length > 0 && selectedIds.length === filteredIds.length;

  const bulkSetPayment = async (status: string) => {
    setBulkMsg("Updating…");
    const msg = await applyPayment("studio_bookings", selectedIds, paymentPatch(status));
    if (msg) return setBulkMsg(msg);
    setBulkMsg(`${selectedIds.length} marked ${status}.`);
    sel.clear();
    fetchRows();
  };

  useEffect(() => { setVisibleCount(PAGE_SIZE); }, [search, paymentFilter]);

  const activeFilterCount = [paymentFilter].filter((f) => f !== ALL).length;

  if (loading) return <div className="p-4 text-muted-foreground">Loading studio space bookings...</div>;
  if (error) return <div className="p-4 text-destructive">{error}</div>;

  const detailFields = [
    { key: "created_at", label: "Requested", render: (v: unknown) => v ? new Date(String(v)).toLocaleString() : "—" },
    { key: "full_name", label: "Full Name" },
    { key: "phone", label: "WhatsApp" },
    { key: "email", label: "Email" },
    { key: "rental_date", label: "Rental Date" },
    { key: "rental_time", label: "Rental Time" },
    { key: "space_name", label: "Space" },
    { key: "duration_minutes", label: "Duration (minutes)" },
    { key: "selected_extras", label: "Extras" },
    { key: "extras_total", label: "Extras Total", render: (v: unknown) => formatMoney(Number(v)) },
    { key: "space_total", label: "Space Total", render: (v: unknown) => formatMoney(Number(v)) },
    { key: "grand_total", label: "Grand Total", render: (v: unknown) => formatMoney(Number(v)) },
    { key: "notes", label: "Notes" },
    { key: "source", label: "Source" },
    { key: "payment_status", label: "Payment Status" },
    { key: "amount_paid", label: "Amount Paid", render: (v: unknown) => (v == null ? "—" : formatMoney(Number(v))) },
  ];

  return (
    <div className="border border-border">
      <div className="p-4 border-b border-border space-y-3">
        <div className="flex items-center justify-between gap-2 sm:gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search studio space bookings..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-border bg-background text-sm outline-none focus:border-foreground"
            />
          </div>
          <button onClick={onAdd} className="inline-flex items-center gap-2 px-4 py-2 text-sm font-body font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90">
            <Plus size={16} /> <span className="hidden sm:inline">Add Studio Space Booking Manually</span><span className="sm:hidden">Add</span>
          </button>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
          <CustomSelect
            value={paymentFilter}
            onChange={setPaymentFilter}
            options={[{ value: ALL, label: "All Payment Status" }, ...paymentOptions.map((v) => ({ value: v, label: v }))]}
            className="col-span-2 sm:col-span-1 w-full sm:w-48"
          />
          {activeFilterCount > 0 && (
            <button onClick={() => setPaymentFilter(ALL)} className="col-span-2 sm:col-auto justify-self-start inline-flex items-center gap-1 px-3 py-2 text-xs font-body font-medium text-muted-foreground hover:text-foreground transition-colors">
              <X size={14} /> Clear filters ({activeFilterCount})
            </button>
          )}
        </div>
      </div>
      <div className="px-4 pt-4 pb-2">
        <h2 className="font-display text-xl font-bold tracking-wide">Studio Space Bookings</h2>
      </div>
      <div className="overflow-x-auto">
        <Table className="min-w-[1200px]" fitViewport>
          <TableHeader>
            <TableRow>
              <TableHead className={stickyCheckHead}>
                <Checkbox checked={allSelected ? true : selectedIds.length > 0 ? "indeterminate" : false} onCheckedChange={(v) => sel.setMany(filteredIds, v === true)} aria-label="Select all studio space bookings" />
              </TableHead>
              <TableHead className={stickySnHead}>S/N</TableHead>
              <TableHead>Requested</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>WhatsApp</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Space</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Time</TableHead>
              <TableHead>Extras</TableHead>
              <TableHead>Total</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow><TableCell colSpan={13} className="text-center py-8 text-muted-foreground">No studio space bookings found</TableCell></TableRow>
            ) : (
              filtered.slice(0, visibleCount).map((r, i) => (
                <TableRow key={r.id} onClick={() => setSelected(r)} className={`cursor-pointer ${sel.ids.has(r.id) ? "bg-muted/60" : ""}`}>
                  <TableCell onClick={(e) => e.stopPropagation()} className={stickyCheckCell(sel.ids.has(r.id))}>
                    <Checkbox checked={sel.ids.has(r.id)} onCheckedChange={() => sel.toggle(r.id)} aria-label={`Select booking for ${r.full_name || "client"}`} />
                  </TableCell>
                  <TableCell className={stickySnCell(sel.ids.has(r.id))}>{i + 1}</TableCell>
                  <TableCell className="text-sm whitespace-nowrap">{r.created_at ? new Date(r.created_at).toLocaleDateString() : "—"}</TableCell>
                  <TableCell className="font-medium whitespace-nowrap">{r.full_name || "—"}</TableCell>
                  <TableCell className="text-sm whitespace-nowrap">{r.phone || "—"}</TableCell>
                  <TableCell className="text-sm whitespace-nowrap">{r.email || "—"}</TableCell>
                  <TableCell className="text-sm whitespace-nowrap">{r.space_name || "—"}</TableCell>
                  <TableCell className="text-sm whitespace-nowrap">{r.rental_date || "—"}</TableCell>
                  <TableCell className="text-sm whitespace-nowrap">{r.rental_time || "—"}</TableCell>
                  <TableCell className="text-sm whitespace-nowrap max-w-[200px] truncate">{r.selected_extras || "—"}</TableCell>
                  <TableCell className="font-medium whitespace-nowrap">{formatMoney(r.grand_total)}</TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <PaymentCell status={r.payment_status} total={r.grand_total} amountPaid={r.amount_paid} onSave={(patch) => updatePayment(r.id, patch)} />
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()} className="whitespace-nowrap">
                    <div className="flex items-center gap-1">
                      <ContactActions name={r.full_name} phone={r.phone} email={r.email} />
                      <a href={bookingInvoiceHref("studio_bookings", r.id)} aria-label="Generate invoice" title="Generate invoice" className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded transition-colors">
                        <FileText size={14} />
                      </a>
                      <button onClick={() => setEditing(r)} aria-label="Edit booking" className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded transition-colors">
                        <Pencil size={14} />
                      </button>
                      <button onClick={() => setDeleting(r)} aria-label="Delete booking" className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded transition-colors">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      {filtered.length > visibleCount && (
        <div className="p-4 border-t border-border flex items-center justify-between">
          <p className="text-xs font-body text-muted-foreground">Showing {visibleCount} of {filtered.length} bookings</p>
          <button onClick={() => setVisibleCount((c) => c + PAGE_SIZE)} className="px-4 py-2 text-sm font-body font-medium border border-border hover:bg-muted/50 rounded-md transition-colors">Show More</button>
        </div>
      )}
      {selected && (
        <DetailModal title={`Studio Space · ${selected.full_name || "—"}`} record={selected as unknown as Record<string, unknown>} fields={detailFields} onClose={() => setSelected(null)} invoiceHref={bookingInvoiceHref("studio_bookings", selected.id)} />
      )}
      {editing && (
        <ManualStudioSpaceForm
          record={editing as unknown as Record<string, unknown>}
          onClose={() => setEditing(null)}
          onSuccess={() => { setEditing(null); fetchRows(); }}
        />
      )}
      <BulkActionBar count={selectedIds.length} noun="booking" message={bulkMsg} onClear={() => { sel.clear(); setBulkMsg(""); }}>
        <BulkButton onClick={() => void bulkSetPayment("Paid")}>MARK PAID</BulkButton>
        <BulkButton onClick={() => void bulkSetPayment("Not Paid")}>MARK NOT PAID</BulkButton>
        <BulkButton danger onClick={() => setBulkDeleting(true)}>DELETE</BulkButton>
      </BulkActionBar>
      {bulkDeleting && (
        <ConfirmDialog
          title={`Delete ${selectedIds.length} booking${selectedIds.length === 1 ? "" : "s"}?`}
          message={`This will permanently delete ${selectedIds.length} selected studio space booking${selectedIds.length === 1 ? "" : "s"}. This cannot be undone.`}
          confirmLabel={`Delete ${selectedIds.length}`}
          destructive
          onClose={() => setBulkDeleting(false)}
          onConfirm={async () => {
            const { data, error: delErr } = await supabase.from("studio_bookings").delete().in("id", selectedIds).select("id");
            if (delErr) throw new Error(delErr.message);
            if (!data || data.length === 0) throw new Error("Nothing was deleted. Make sure your account is an admin in the staff table.");
            setBulkDeleting(false);
            setBulkMsg(`${data.length} deleted${data.length < selectedIds.length ? ` (${selectedIds.length - data.length} could not be deleted)` : ""}.`);
            sel.clear();
            fetchRows();
          }}
        />
      )}
      {deleting && (
        <ConfirmDialog
          title="Delete this booking?"
          message={`This will permanently delete the studio space booking for ${deleting.full_name || "this client"}. This cannot be undone.`}
          confirmLabel="Delete"
          destructive
          onClose={() => setDeleting(null)}
          onConfirm={async () => {
            const { data: deletedRows, error: delErr } = await supabase.from("studio_bookings").delete().eq("id", deleting.id).select("id");
            if (delErr) throw new Error(delErr.message);
            if (!deletedRows || deletedRows.length === 0) throw new Error("Nothing was deleted. Your database is blocking deletes.");
            setDeleting(null);
            fetchRows();
          }}
        />
      )}
    </div>
  );
};

export default StudioSpaceTable;
