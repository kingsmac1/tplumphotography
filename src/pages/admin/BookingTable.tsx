import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, Plus, Pencil, Trash2, X, GalleryHorizontalEnd, FileText } from "lucide-react";
import { bookingInvoiceHref } from "@/features/invoices/events";
import { byBooking, useGalleryIndex } from "@/features/gallery/admin/useGalleryIndex";
import { bookingGalleryStage, GALLERY_STAGE_FILTERS } from "@/features/gallery/status";
import { computeDelivery, matchesDeliveryFilter, byPriority, DELIVERY_FILTERS } from "@/features/delivery/model";
import { photoInput, refreshDeliveries, setDelivered, useDeliverySettings, useNow } from "@/features/delivery/useDeliveries";
import { DeliveryBadge, DeliveryPanel } from "@/features/delivery/ui";
import { deleteGalleries, galleriesOfBookings } from "@/features/gallery/admin/galleryActions";
import { formatMoney } from "./formOptions";
import DetailModal from "./DetailModal";
import InspirationGallery from "./InspirationGallery";
import CustomSelect from "./CustomSelect";
import EditForm from "./EditForm";
import ConfirmDialog from "./ConfirmDialog";
import { ContactActions } from "./contact";
import { PaymentCell, applyPayment, paymentPatch, PAYMENT_STATUSES, type PaymentPatch } from "./payment";
import { Checkbox } from "@/components/ui/checkbox";
import { useRowSelection, BulkActionBar, BulkButton, stickyCheckHead, stickyCheckCell, stickySnHead, stickySnCell } from "./bulk";

interface Booking {
  id: string;
  created_at: string;
  full_name: string;
  gender: string;
  phone: string;
  email: string;
  shoot_type: string;
  shoot_date: string;
  shoot_time: string;
  location: string;
  shoot_setting: string;
  selected_service: string;
  outfits: number | null;
  selected_extras: string;
  grand_total: number;
  payment_status: string;
  amount_paid?: number | null;
  source: string;
  duration_minutes?: number | null;
  delivered_at?: string | null;
  delivered_via?: string | null;
  delivered_by?: string | null;
}

interface BookingTableProps {
  onAdd: () => void;
  /** Restricts the list to one origin ("booking_form" = Photography, "wedding_form" = Wedding). Omit for all. */
  restrictSource?: string;
  /** Shown instead of "Bookings" as the section heading. */
  title?: string;
}

const ALL = "";

/** Badge colours for the gallery stage (tones from bookingGalleryStage). */
const STAGE_TONE: Record<string, string> = {
  grey: "bg-muted text-muted-foreground",
  blue: "bg-blue-100 text-blue-800",
  violet: "bg-violet-100 text-violet-800",
  amber: "bg-amber-100 text-amber-800",
  gold: "bg-yellow-100 text-yellow-900",
  green: "bg-green-100 text-green-800",
};

const shortDay = (d?: string | null) =>
  d ? new Date(d.length === 10 ? `${d}T12:00:00` : d).toLocaleDateString("en-CA", { day: "numeric", month: "short", year: "numeric" }) : "";
const shortTime = (t?: string | null) => {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  return Number.isNaN(h) ? t : `${((h + 11) % 12) + 1}:${String(m || 0).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
};

const BookingTable = ({ onAdd, restrictSource, title = "Bookings" }: BookingTableProps) => {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [search, setSearch] = useState("");
  const [shootTypeFilter, setShootTypeFilter] = useState(ALL);
  const [locationFilter, setLocationFilter] = useState(ALL);
  const [serviceFilter, setServiceFilter] = useState(ALL);
  const [paymentFilter, setPaymentFilter] = useState(ALL);
  const [galleryFilter, setGalleryFilter] = useState(ALL);
  const [shootTimingFilter, setShootTimingFilter] = useState(ALL); // ALL | "upcoming" | "past"
  const [deliveryFilter, setDeliveryFilter] = useState(ALL);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<Booking | null>(null);
  const [editing, setEditing] = useState<Booking | null>(null);
  const [deleting, setDeleting] = useState<Booking | null>(null);
  const sel = useRowSelection();
  const gx = useGalleryIndex();
  const galleriesOf = useMemo(() => byBooking(gx.galleries), [gx.galleries]);
  const stageOf = (id: string) => bookingGalleryStage(galleriesOf.get(id), (gid) => gx.stats.get(gid)?.picks);
  const { settings: deliverySettings } = useDeliverySettings();
  const now = useNow();
  const deliveryOf = (b: Booking) => computeDelivery(photoInput(b, galleriesOf.get(b.id)), deliverySettings, now);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [bulkMsg, setBulkMsg] = useState("");

  useEffect(() => {
    fetchBookings();
  }, []);

  const fetchBookings = async () => {
    setLoading(true);
    let query = supabase.from("bookings").select("*").order("created_at", { ascending: false });
    if (restrictSource) query = query.eq("source", restrictSource);
    const { data, error: fetchError } = await query;
    if (fetchError) setError(fetchError.message);
    else setBookings(data || []);
    setLoading(false);
  };

  const updatePayment = async (id: string, patch: PaymentPatch) => {
    const msg = await applyPayment("bookings", [id], patch);
    if (msg) setError(msg);
    else fetchBookings();
  };

  const [visibleCount, setVisibleCount] = useState(200);
  const PAGE_SIZE = 200;

  const lc = (v: unknown) => (v ?? "").toString().toLowerCase();

  // Filter option lists are derived from whatever values actually exist in the
  // data, rather than hardcoded, so a filter never offers an option with zero results.
  const distinct = (key: keyof Booking) =>
    Array.from(new Set(bookings.map((b) => (b[key] as string) || "").filter(Boolean))).sort();

  const shootTypeOptions = useMemo(() => distinct("shoot_type"), [bookings]);
  const locationOptions = useMemo(() => distinct("location"), [bookings]);
  const serviceOptions = useMemo(() => distinct("selected_service"), [bookings]);
  const paymentOptions = PAYMENT_STATUSES;

  // Today at midnight, as YYYY-MM-DD, so date-only comparisons ("2026-09-02" >= today)
  // work regardless of the time component on shoot_date.
  const todayStr = new Date().toISOString().split("T")[0];

  const filteredBookings = bookings.filter(b => {
    const matchesSearch =
      lc(b.full_name).includes(search.toLowerCase()) ||
      lc(b.email).includes(search.toLowerCase()) ||
      lc(b.phone).includes(search.toLowerCase()) ||
      lc(b.shoot_type).includes(search.toLowerCase()) ||
      lc(b.location).includes(search.toLowerCase()) ||
      lc(b.payment_status).includes(search.toLowerCase());

    const matchesTiming =
      shootTimingFilter === ALL ||
      (b.shoot_date && (
        shootTimingFilter === "upcoming" ? b.shoot_date >= todayStr : b.shoot_date < todayStr
      ));

    return (
      matchesSearch &&
      (shootTypeFilter === ALL || b.shoot_type === shootTypeFilter) &&
      (locationFilter === ALL || b.location === locationFilter) &&
      (serviceFilter === ALL || b.selected_service === serviceFilter) &&
      (paymentFilter === ALL || (b.payment_status || "Not Paid") === paymentFilter) &&
      (galleryFilter === ALL || stageOf(b.id).key === galleryFilter) &&
      (deliveryFilter === ALL || matchesDeliveryFilter(deliveryOf(b), deliveryFilter)) &&
      matchesTiming
    );
  });
  // a delivery filter lists the most urgent first
  if (deliveryFilter !== ALL) {
    const ranked = filteredBookings.map((b) => ({ b, d: deliveryOf(b) })).sort(byPriority);
    filteredBookings.splice(0, filteredBookings.length, ...ranked.map((x) => x.b));
  }

  // Only rows currently in the filtered list count as selected, so nothing hidden by a filter is touched.
  const filteredIds = filteredBookings.map((b) => b.id);
  const selectedIds = filteredIds.filter((id) => sel.ids.has(id));
  const allSelected = filteredIds.length > 0 && selectedIds.length === filteredIds.length;

  const bulkSetPayment = async (status: string) => {
    setBulkMsg("Updating…");
    const msg = await applyPayment("bookings", selectedIds, paymentPatch(status));
    if (msg) return setBulkMsg(msg);
    setBulkMsg(`${selectedIds.length} marked ${status}.`);
    sel.clear();
    fetchBookings();
  };

  const bulkDeliver = async () => {
    const ids = filteredBookings.filter((b) => sel.ids.has(b.id) && deliveryOf(b).state !== "delivered").map((b) => b.id);
    if (!ids.length) return setBulkMsg("Those are already delivered.");
    if (!window.confirm(`Mark ${ids.length} booking${ids.length === 1 ? "" : "s"} delivered now?\n\nTo use another date, open a booking and mark it there.`)) return;
    setBulkMsg("Updating…");
    const msg = await setDelivered("bookings", ids, true);
    if (msg) return setBulkMsg(msg);
    setBulkMsg(`${ids.length} marked delivered.`);
    sel.clear();
    fetchBookings();
  };

  const activeFilterCount = [shootTypeFilter, locationFilter, serviceFilter, paymentFilter, galleryFilter, shootTimingFilter, deliveryFilter].filter((f) => f !== ALL).length;

  const clearFilters = () => {
    setShootTypeFilter(ALL);
    setLocationFilter(ALL);
    setServiceFilter(ALL);
    setPaymentFilter(ALL);
    setGalleryFilter(ALL);
    setShootTimingFilter(ALL);
    setDeliveryFilter(ALL);
  };

  // Reset pagination when the search query or any filter changes so a new
  // filtered set doesn't leave the user stranded on an out-of-range page.
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [search, shootTypeFilter, locationFilter, serviceFilter, paymentFilter, galleryFilter, shootTimingFilter, deliveryFilter]);

  if (loading) return <div className="p-4 text-muted-foreground">Loading bookings...</div>;
  if (error) return <div className="p-4 text-destructive">{error}</div>;

  const detailFields = [
    { key: "created_at", label: "Created", render: (v: unknown) => v ? new Date(String(v)).toLocaleString() : "—" },
    { key: "full_name", label: "Full Name" },
    { key: "gender", label: "Gender" },
    { key: "phone", label: "WhatsApp" },
    { key: "email", label: "Email" },
    { key: "date_of_birth", label: "Birthday", render: (v: unknown) => {
      // Only day & month are meaningful (stored with placeholder year 2000 for new bookings).
      const m = /^\d{4}-(\d{2})-(\d{2})/.exec(String(v ?? ""));
      if (!m) return v ? String(v) : "—";
      return `${Number(m[2])} ${new Date(2000, Number(m[1]) - 1, 1).toLocaleString("en-CA", { month: "long" })}`;
    } },
    { key: "shoot_type", label: "Shoot Type" },
    { key: "shoot_date", label: "Shoot Date" },
    { key: "shoot_time", label: "Shoot Time" },
    { key: "location", label: "Location" },
    { key: "shoot_setting", label: "Setting" },
    { key: "selected_service", label: "Service" },
    { key: "service_price", label: "Service Price", render: (v: unknown) => formatMoney(Number(v)) },
    { key: "outfits", label: "Outfits" },
    { key: "selected_extras", label: "Extras" },
    { key: "extra_edited_count", label: "Extra Edited Count" },
    { key: "service_total", label: "Service Total", render: (v: unknown) => formatMoney(Number(v)) },
    { key: "extras_total", label: "Extras Total", render: (v: unknown) => formatMoney(Number(v)) },
    { key: "grand_total", label: "Grand Total", render: (v: unknown) => formatMoney(Number(v)) },
    { key: "social_handles", label: "Social Handles" },
    { key: "inspiration_links", label: "Inspiration Links" },
    { key: "service_summary", label: "Service Summary" },
    { key: "source", label: "Source" },
    { key: "payment_status", label: "Payment Status" },
    { key: "amount_paid", label: "Amount Paid", render: (v: unknown) => (v == null ? "—" : formatMoney(Number(v))) },
    { key: "id", label: "Client Gallery", render: (v: unknown) => stageOf(String(v)).label },
  ];
  // the open booking, kept in step with the list (marking it delivered reloads the list)
  const selectedLive = selected ? bookings.find((b) => b.id === selected.id) ?? selected : null;

  return (
    <div className="border border-border">
      <div className="p-4 border-b border-border space-y-3">
        <div className="flex items-center justify-between gap-2 sm:gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search bookings..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-border bg-background text-sm outline-none focus:border-foreground"
            />
          </div>
          <button
            onClick={onAdd}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-body font-medium transition-colors bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
          >
            <Plus size={16} /> <span className="hidden sm:inline">Add Booking Manually</span><span className="sm:hidden">Add</span>
          </button>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
          <CustomSelect
            value={shootTypeFilter}
            onChange={setShootTypeFilter}
            options={[{ value: ALL, label: "All Shoot Types" }, ...shootTypeOptions.map(v => ({ value: v, label: v }))]}
            className="w-full sm:w-44"
          />
          <CustomSelect
            value={locationFilter}
            onChange={setLocationFilter}
            options={[{ value: ALL, label: "All Locations" }, ...locationOptions.map(v => ({ value: v, label: v }))]}
            className="w-full sm:w-44"
          />
          <CustomSelect
            value={serviceFilter}
            onChange={setServiceFilter}
            options={[{ value: ALL, label: "All Services" }, ...serviceOptions.map(v => ({ value: v, label: v }))]}
            className="w-full sm:w-44"
          />
          <CustomSelect
            value={shootTimingFilter}
            onChange={setShootTimingFilter}
            options={[
              { value: ALL, label: "Past/Upcoming" },
              { value: "upcoming", label: "Upcoming Shoots" },
              { value: "past", label: "Past Shoots" },
            ]}
            className="w-full sm:w-44"
          />
          <CustomSelect
            value={paymentFilter}
            onChange={setPaymentFilter}
            options={[{ value: ALL, label: "All Payment Status" }, ...paymentOptions.map(v => ({ value: v, label: v }))]}
            className="w-full sm:w-48"
          />
          <CustomSelect
            value={galleryFilter}
            onChange={setGalleryFilter}
            options={[{ value: ALL, label: "All Gallery Stages" }, ...GALLERY_STAGE_FILTERS]}
            className="w-full sm:w-56"
          />
          <CustomSelect
            value={deliveryFilter}
            onChange={setDeliveryFilter}
            options={[{ value: ALL, label: "All Delivery States" }, ...DELIVERY_FILTERS]}
            className="w-full sm:w-56"
          />
          {activeFilterCount > 0 && (
            <button
              onClick={clearFilters}
              className="col-span-2 sm:col-auto justify-self-start inline-flex items-center gap-1 px-3 py-2 text-xs font-body font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              <X size={14} /> Clear filters ({activeFilterCount})
            </button>
          )}
        </div>
      </div>
      <div className="px-4 pt-4 pb-2">
        <h2 className="font-display text-xl font-bold tracking-wide">{title}</h2>
      </div>
      {/* Only what's needed to scan the list fits the width; every other field is in the booking detail (click a row). */}
      <div>
        <Table fitViewport className="md:table-fixed">
          <TableHeader>
            <TableRow>
              <TableHead className={stickyCheckHead}>
                <Checkbox
                  checked={allSelected ? true : selectedIds.length > 0 ? "indeterminate" : false}
                  onCheckedChange={(v) => sel.setMany(filteredIds, v === true)}
                  aria-label="Select all bookings"
                />
              </TableHead>
              <TableHead className={stickySnHead}>S/N</TableHead>
              <TableHead className="md:w-[21%]">Client</TableHead>
              <TableHead className="md:w-[19%]">Shoot</TableHead>
              <TableHead className="md:w-[12%]">Session</TableHead>
              <TableHead className="md:w-[10%] text-right">Total</TableHead>
              <TableHead className="md:w-[150px]">Payment</TableHead>
              <TableHead className="md:w-[17%]">Gallery</TableHead>
              <TableHead className="md:w-[164px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredBookings.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">No bookings found</TableCell>
              </TableRow>
            ) : (
              filteredBookings.slice(0, visibleCount).map((b, i) => {
                const stage = stageOf(b.id);
                const delivery = deliveryOf(b);
                return (
                <TableRow key={b.id} onClick={() => setSelected(b)} className={`cursor-pointer align-top ${sel.ids.has(b.id) ? "bg-muted/60" : ""}`}>
                  <TableCell onClick={(e) => e.stopPropagation()} className={stickyCheckCell(sel.ids.has(b.id))}>
                    <Checkbox checked={sel.ids.has(b.id)} onCheckedChange={() => sel.toggle(b.id)} aria-label={`Select booking for ${b.full_name || "client"}`} />
                  </TableCell>
                  <TableCell className={stickySnCell(sel.ids.has(b.id))}>{i + 1}</TableCell>
                  <TableCell className="max-w-[220px] md:max-w-none">
                    <p className="font-medium truncate">{b.full_name || "—"}</p>
                    <p className="text-xs text-muted-foreground truncate">{b.phone || b.email || "—"}</p>
                  </TableCell>
                  <TableCell className="max-w-[220px] md:max-w-none">
                    <p className="text-sm truncate">{b.shoot_type || "—"}</p>
                    <p className="text-xs text-muted-foreground truncate">{[b.selected_service, b.location].filter(Boolean).join(" · ") || "—"}</p>
                  </TableCell>
                  <TableCell className="whitespace-nowrap md:whitespace-normal">
                    <p className="text-sm truncate">{shortDay(b.shoot_date) || "TBC"}</p>
                    <p className="text-xs text-muted-foreground truncate">{shortTime(b.shoot_time) || `Booked ${shortDay(b.created_at)}`}</p>
                    {delivery.state !== "untracked" && delivery.state !== "upcoming" && <DeliveryBadge d={delivery} wrap className="mt-1 max-w-full align-top" />}
                  </TableCell>
                  <TableCell className="text-right font-medium whitespace-nowrap md:truncate">{formatMoney(b.grand_total)}</TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <PaymentCell status={b.payment_status} total={b.grand_total} amountPaid={b.amount_paid} onSave={(patch) => updatePayment(b.id, patch)} />
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <a
                      href={`#galleries/${b.id}`}
                      title="Open the client gallery for this booking"
                      className="inline-flex max-w-full items-center gap-1.5 group"
                    >
                      <GalleryHorizontalEnd size={14} className="shrink-0 text-muted-foreground group-hover:text-foreground" />
                      <span className={`whitespace-nowrap md:whitespace-normal md:leading-tight px-2 py-0.5 text-[11px] font-body font-semibold rounded-full md:rounded-lg ${STAGE_TONE[stage.tone] ?? STAGE_TONE.grey}`}>
                        {stage.label}
                      </span>
                    </a>
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()} className="whitespace-nowrap">
                    <div className="flex items-center gap-1">
                      <ContactActions name={b.full_name} phone={b.phone} email={b.email} />
                      <a href={bookingInvoiceHref("bookings", b.id)} aria-label="Generate invoice" title="Generate invoice" className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded transition-colors">
                        <FileText size={14} />
                      </a>
                      <button
                        onClick={() => setEditing(b)}
                        aria-label="Edit booking"
                        className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded transition-colors"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => setDeleting(b)}
                        aria-label="Delete booking"
                        className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </TableCell>
                </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
      {filteredBookings.length > visibleCount && (
        <div className="p-4 border-t border-border flex items-center justify-between">
          <p className="text-xs font-body text-muted-foreground">
            Showing {visibleCount} of {filteredBookings.length} bookings
          </p>
          <button
            onClick={() => setVisibleCount(c => c + PAGE_SIZE)}
            className="px-4 py-2 text-sm font-body font-medium border border-border hover:bg-muted/50 rounded-md transition-colors"
          >
            Show More
          </button>
        </div>
      )}
      {selectedLive && (
        <DetailModal
          title={`Booking · ${selectedLive.full_name || "—"}`}
          record={selectedLive as unknown as Record<string, unknown>}
          fields={detailFields}
          onClose={() => setSelected(null)}
          invoiceHref={bookingInvoiceHref("bookings", selectedLive.id)}
          top={<DeliveryPanel table="bookings" id={selectedLive.id} name={selectedLive.full_name} d={deliveryOf(selectedLive)} onChanged={() => { fetchBookings(); void refreshDeliveries(); }} />}
        >
          <InspirationGallery bookingId={selectedLive.id} />
        </DetailModal>
      )}
      {editing && (
        <EditForm
          table="bookings"
          record={editing as unknown as Record<string, unknown>}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); fetchBookings(); }}
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
          message={`This will permanently delete ${selectedIds.length} selected booking${selectedIds.length === 1 ? "" : "s"}, with their client galleries and photos. This cannot be undone.`}
          confirmLabel={`Delete ${selectedIds.length}`}
          destructive
          onClose={() => setBulkDeleting(false)}
          onConfirm={async () => {
            await deleteGalleries(await galleriesOfBookings(selectedIds));
            const { data, error: delErr } = await supabase.from("bookings").delete().in("id", selectedIds).select("id");
            if (delErr) throw new Error(delErr.message);
            if (!data || data.length === 0) {
              throw new Error("Nothing was deleted. Your database is blocking deletes — make sure your account is an admin in the staff table.");
            }
            setBulkDeleting(false);
            setBulkMsg(`${data.length} deleted${data.length < selectedIds.length ? ` (${selectedIds.length - data.length} could not be deleted)` : ""}.`);
            sel.clear();
            fetchBookings();
          }}
        />
      )}
      {deleting && (
        <ConfirmDialog
          title="Delete this booking?"
          message={`This will permanently delete the booking for ${deleting.full_name || "this client"}, with its client galleries and photos. This cannot be undone.`}
          confirmLabel="Delete"
          destructive
          onClose={() => setDeleting(null)}
          onConfirm={async () => {
            // .select() returns the deleted rows, so a silent no-op (e.g. a missing
            // Supabase DELETE policy) shows up as an empty result instead of looking like success.
            await deleteGalleries(await galleriesOfBookings([deleting.id]));
            const { data: deletedRows, error: delErr } = await supabase
              .from("bookings")
              .delete()
              .eq("id", deleting.id)
              .select("id");
            if (delErr) throw new Error(delErr.message);
            if (!deletedRows || deletedRows.length === 0) {
              throw new Error("Nothing was deleted. Your database is blocking deletes — add a DELETE policy for the bookings table in Supabase.");
            }
            setDeleting(null);
            fetchBookings();
          }}
        />
      )}
    </div>
  );
};

export default BookingTable;