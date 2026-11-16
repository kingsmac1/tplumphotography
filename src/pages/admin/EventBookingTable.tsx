import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, Plus, Pencil, Trash2, X, FileText } from "lucide-react";
import { bookingInvoiceHref } from "@/features/invoices/events";
import { computeDelivery, matchesDeliveryFilter, byPriority, DELIVERY_FILTERS } from "@/features/delivery/model";
import { eventInput, refreshDeliveries, setDelivered, useDeliverySettings, useNow } from "@/features/delivery/useDeliveries";
import { DeliveryBadge, DeliveryPanel } from "@/features/delivery/ui";
import { formatMoney } from "./formOptions";
import DetailModal from "./DetailModal";
import { ContactActions } from "./contact";
import { PaymentCell, applyPayment, paymentPatch, PAYMENT_STATUSES, type PaymentPatch } from "./payment";
import CustomSelect from "./CustomSelect";
import ConfirmDialog from "./ConfirmDialog";
import ManualEventBookingForm from "./ManualEventBookingForm";
import { Checkbox } from "@/components/ui/checkbox";
import { useRowSelection, BulkActionBar, BulkButton, stickyCheckHead, stickyCheckCell, stickySnHead, stickySnCell } from "./bulk";

interface EventBooking {
  id: string;
  created_at: string;
  full_name: string;
  phone: string;
  email: string | null;
  event_type: string;
  event_start_date: string | null;
  event_end_date: string | null;
  event_time: string | null;
  venue: string | null;
  expected_guests: number | null;
  agreed_amount: number;
  notes: string | null;
  payment_status: string;
  amount_paid?: number | null;
  source: string;
  delivered_at?: string | null;
  delivered_via?: string | null;
  delivered_by?: string | null;
}

interface Props { onAdd: () => void; }

const ALL = "";

const evDay = (iso: string) => {
  const d = new Date(`${iso}T12:00:00`);
  return d.toLocaleDateString("en-CA", { day: "numeric", month: "short", ...(d.getFullYear() !== new Date().getFullYear() ? { year: "numeric" } : {}) });
};
/** "Dec 16" or "Dec 16 – Dec 18" (the year only when it isn't this year) */
const eventDates = (r: EventBooking) =>
  r.event_start_date ? `${evDay(r.event_start_date)}${r.event_end_date && r.event_end_date !== r.event_start_date ? ` – ${evDay(r.event_end_date)}` : ""}` : "—";

const EventBookingTable = ({ onAdd }: Props) => {
  const [rows, setRows] = useState<EventBooking[]>([]);
  const [search, setSearch] = useState("");
  const [paymentFilter, setPaymentFilter] = useState(ALL);
  const [deliveryFilter, setDeliveryFilter] = useState(ALL);
  const { settings: deliverySettings } = useDeliverySettings();
  const now = useNow();
  const deliveryOf = (r: EventBooking) => computeDelivery(eventInput(r), deliverySettings, now);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<EventBooking | null>(null);
  const [editing, setEditing] = useState<EventBooking | null>(null);
  const [deleting, setDeleting] = useState<EventBooking | null>(null);
  const sel = useRowSelection();
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [bulkMsg, setBulkMsg] = useState("");
  const [visibleCount, setVisibleCount] = useState(200);
  const PAGE_SIZE = 200;

  const fetchRows = async () => {
    setLoading(true);
    const { data, error: fetchError } = await supabase.from("event_bookings").select("*").order("created_at", { ascending: false });
    if (fetchError) setError(fetchError.message);
    else setRows((data as EventBooking[]) || []);
    setLoading(false);
  };
  useEffect(() => { void fetchRows(); }, []);

  const updatePayment = async (id: string, patch: PaymentPatch) => {
    const msg = await applyPayment("event_bookings", [id], patch);
    if (msg) setError(msg);
    else fetchRows();
  };

  const lc = (v: unknown) => (v ?? "").toString().toLowerCase();
  const paymentOptions = PAYMENT_STATUSES;

  const filtered = useMemo(() => rows.filter((r) => {
    const q = search.toLowerCase();
    const matchesSearch =
      lc(r.full_name).includes(q) ||
      lc(r.email).includes(q) ||
      lc(r.phone).includes(q) ||
      lc(r.event_type).includes(q) ||
      lc(r.venue).includes(q);
    return matchesSearch && (paymentFilter === ALL || (r.payment_status || "Not Paid") === paymentFilter) &&
      (deliveryFilter === ALL || matchesDeliveryFilter(deliveryOf(r), deliveryFilter));
  }).map((r) => ({ r, d: deliveryOf(r) })).sort((a, b) => (deliveryFilter === ALL ? 0 : byPriority(a, b))).map((x) => x.r),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [rows, search, paymentFilter, deliveryFilter, deliverySettings, now]);

  const filteredIds = filtered.map((r) => r.id);
  const selectedIds = filteredIds.filter((id) => sel.ids.has(id));
  const allSelected = filteredIds.length > 0 && selectedIds.length === filteredIds.length;

  const bulkSetPayment = async (status: string) => {
    setBulkMsg("Updating…");
    const msg = await applyPayment("event_bookings", selectedIds, paymentPatch(status));
    if (msg) return setBulkMsg(msg);
    setBulkMsg(`${selectedIds.length} marked ${status}.`);
    sel.clear();
    fetchRows();
  };

  const bulkDeliver = async () => {
    const ids = filtered.filter((r) => sel.ids.has(r.id) && deliveryOf(r).state !== "delivered").map((r) => r.id);
    if (!ids.length) return setBulkMsg("Those are already delivered.");
    if (!window.confirm(`Mark ${ids.length} event${ids.length === 1 ? "" : "s"} delivered now?\n\nTo use another date, open an event and mark it there.`)) return;
    setBulkMsg("Updating…");
    const msg = await setDelivered("event_bookings", ids, true);
    if (msg) return setBulkMsg(msg);
    setBulkMsg(`${ids.length} marked delivered.`);
    sel.clear();
    fetchRows();
  };

  useEffect(() => { setVisibleCount(PAGE_SIZE); }, [search, paymentFilter, deliveryFilter]);

  const activeFilterCount = [paymentFilter, deliveryFilter].filter((f) => f !== ALL).length;

  if (loading) return <div className="p-4 text-muted-foreground">Loading event bookings...</div>;
  if (error) return <div className="p-4 text-destructive">{error}</div>;

  const detailFields = [
    { key: "created_at", label: "Requested", render: (v: unknown) => v ? new Date(String(v)).toLocaleString() : "—" },
    { key: "full_name", label: "Full Name" },
    { key: "phone", label: "WhatsApp" },
    { key: "email", label: "Email" },
    { key: "event_type", label: "Event Type" },
    { key: "event_start_date", label: "Start Date" },
    { key: "event_end_date", label: "End Date" },
    { key: "event_time", label: "Start Time" },
    { key: "venue", label: "Venue" },
    { key: "expected_guests", label: "Expected Guests" },
    { key: "agreed_amount", label: "Agreed Amount", render: (v: unknown) => formatMoney(Number(v)) },
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
              placeholder="Search event bookings..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-border bg-background text-sm outline-none focus:border-foreground"
            />
          </div>
          <button onClick={onAdd} className="inline-flex items-center gap-2 px-4 py-2 text-sm font-body font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90">
            <Plus size={16} /> <span className="hidden sm:inline">Add Event Booking Manually</span><span className="sm:hidden">Add</span>
          </button>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
          <CustomSelect
            value={paymentFilter}
            onChange={setPaymentFilter}
            options={[{ value: ALL, label: "All Payment Status" }, ...paymentOptions.map((v) => ({ value: v, label: v }))]}
            className="w-full sm:w-48"
          />
          <CustomSelect
            value={deliveryFilter}
            onChange={setDeliveryFilter}
            options={[{ value: ALL, label: "All Delivery States" }, ...DELIVERY_FILTERS]}
            className="w-full sm:w-56"
          />
          {activeFilterCount > 0 && (
            <button onClick={() => { setPaymentFilter(ALL); setDeliveryFilter(ALL); }} className="col-span-2 sm:col-auto justify-self-start inline-flex items-center gap-1 px-3 py-2 text-xs font-body font-medium text-muted-foreground hover:text-foreground transition-colors">
              <X size={14} /> Clear filters ({activeFilterCount})
            </button>
          )}
        </div>
      </div>
      <div className="px-4 pt-4 pb-2">
        <h2 className="font-display text-xl font-bold tracking-wide">Event Bookings</h2>
      </div>
      <div>
        <Table fitViewport containerClassName="md:overflow-x-hidden" className="md:table-fixed md:[&_td]:px-2.5 md:[&_th]:px-2.5">
          <TableHeader>
            <TableRow>
              <TableHead className={stickyCheckHead}>
                <Checkbox checked={allSelected ? true : selectedIds.length > 0 ? "indeterminate" : false} onCheckedChange={(v) => sel.setMany(filteredIds, v === true)} aria-label="Select all event bookings" />
              </TableHead>
              <TableHead className={stickySnHead}>S/N</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Event</TableHead>
              <TableHead className="md:w-[150px]">Dates</TableHead>
              <TableHead className="md:w-[156px]">Amount &amp; payment</TableHead>
              <TableHead className="md:w-[164px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No event bookings found</TableCell></TableRow>
            ) : (
              filtered.slice(0, visibleCount).map((r, i) => (
                <TableRow key={r.id} onClick={() => setSelected(r)} className={`cursor-pointer ${sel.ids.has(r.id) ? "bg-muted/60" : ""}`}>
                  <TableCell onClick={(e) => e.stopPropagation()} className={stickyCheckCell(sel.ids.has(r.id))}>
                    <Checkbox checked={sel.ids.has(r.id)} onCheckedChange={() => sel.toggle(r.id)} aria-label={`Select booking for ${r.full_name || "client"}`} />
                  </TableCell>
                  <TableCell className={stickySnCell(sel.ids.has(r.id))}>{i + 1}</TableCell>
                  <TableCell className="max-w-[220px] md:max-w-none">
                    <p className="font-medium truncate">{r.full_name || "—"}</p>
                    <p className="text-xs text-muted-foreground truncate">{r.phone || r.email || "—"}</p>
                  </TableCell>
                  <TableCell className="max-w-[220px] md:max-w-none">
                    <p className="text-sm truncate">{r.event_type || "—"}</p>
                    <p className="text-xs text-muted-foreground truncate">{[r.venue, r.expected_guests ? `${r.expected_guests} guests` : ""].filter(Boolean).join(" · ") || "—"}</p>
                  </TableCell>
                  <TableCell>
                    <p className="text-sm truncate">{eventDates(r)}</p>
                    <p className="text-xs text-muted-foreground truncate">{r.event_time ? `${r.event_time} · ` : ""}Requested {r.created_at ? new Date(r.created_at).toLocaleDateString("en-CA", { day: "numeric", month: "short" }) : "—"}</p>
                    {(() => { const d = deliveryOf(r); return d.state !== "untracked" && d.state !== "upcoming" ? <DeliveryBadge d={d} wrap className="mt-1 max-w-full align-top" /> : null; })()}
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <p className="text-sm font-medium mb-1 whitespace-nowrap">{formatMoney(r.agreed_amount)}</p>
                    <PaymentCell status={r.payment_status} total={r.agreed_amount} amountPaid={r.amount_paid} onSave={(patch) => updatePayment(r.id, patch)} />
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()} className="whitespace-nowrap">
                    <div className="flex items-center gap-0.5">
                      <ContactActions name={r.full_name} phone={r.phone} email={r.email} />
                      <a href={bookingInvoiceHref("event_bookings", r.id)} aria-label="Generate invoice" title="Generate invoice" className="p-1 text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded transition-colors">
                        <FileText size={14} />
                      </a>
                      <button onClick={() => setEditing(r)} aria-label="Edit booking" title="Edit booking" className="p-1 text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded transition-colors">
                        <Pencil size={14} />
                      </button>
                      <button onClick={() => setDeleting(r)} aria-label="Delete booking" className="p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded transition-colors">
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
      {selected && (() => {
        // kept in step with the list (marking it delivered reloads the list)
        const live = rows.find((x) => x.id === selected.id) ?? selected;
        return (
          <DetailModal
            title={`Event · ${live.full_name || "—"}`}
            record={live as unknown as Record<string, unknown>}
            fields={detailFields}
            onClose={() => setSelected(null)}
            onEdit={() => { setEditing(live); setSelected(null); }}
            invoiceHref={bookingInvoiceHref("event_bookings", live.id)}
            top={<DeliveryPanel table="event_bookings" id={live.id} name={live.full_name} d={deliveryOf(live)} onChanged={() => { fetchRows(); void refreshDeliveries(); }} />}
          />
        );
      })()}
      {editing && (
        <ManualEventBookingForm
          record={editing as unknown as Record<string, unknown>}
          onClose={() => setEditing(null)}
          onSuccess={() => { setEditing(null); fetchRows(); }}
        />
      )}
      <BulkActionBar count={selectedIds.length} noun="booking" message={bulkMsg} onClear={() => { sel.clear(); setBulkMsg(""); }}>
        <BulkButton onClick={() => void bulkSetPayment("Paid")}>MARK PAID</BulkButton>
        <BulkButton onClick={() => void bulkSetPayment("Not Paid")}>MARK NOT PAID</BulkButton>
        <BulkButton onClick={() => void bulkDeliver()}>MARK DELIVERED</BulkButton>
        <BulkButton danger onClick={() => setBulkDeleting(true)}>DELETE</BulkButton>
      </BulkActionBar>
      {bulkDeleting && (
        <ConfirmDialog
          title={`Delete ${selectedIds.length} booking${selectedIds.length === 1 ? "" : "s"}?`}
          message={`This will permanently delete ${selectedIds.length} selected event booking${selectedIds.length === 1 ? "" : "s"}. This cannot be undone.`}
          confirmLabel={`Delete ${selectedIds.length}`}
          destructive
          onClose={() => setBulkDeleting(false)}
          onConfirm={async () => {
            const { data, error: delErr } = await supabase.from("event_bookings").delete().in("id", selectedIds).select("id");
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
          message={`This will permanently delete the event booking for ${deleting.full_name || "this client"}. This cannot be undone.`}
          confirmLabel="Delete"
          destructive
          onClose={() => setDeleting(null)}
          onConfirm={async () => {
            const { data: deletedRows, error: delErr } = await supabase.from("event_bookings").delete().eq("id", deleting.id).select("id");
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

export default EventBookingTable;
