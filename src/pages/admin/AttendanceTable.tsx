import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, X, MapPin } from "lucide-react";
import { formatLate, computeStatus } from "@/lib/attendanceRules";
import { useAttendanceSchedule } from "@/lib/attendanceSchedule";
import { Checkbox } from "@/components/ui/checkbox";
import ConfirmDialog from "./ConfirmDialog";
import ResumptionSchedule from "./ResumptionSchedule";
import { useRowSelection, BulkActionBar, BulkButton, stickyCheckHead, stickyCheckCell, stickySnHead, stickySnCell } from "./bulk";

interface AttendanceRow {
  id: string;
  full_name: string;
  check_date: string;
  checked_in_at: string;
  distance_m: number | null;
  ip_address: string | null;
}

const localToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Edmonton" }).format(new Date());
const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-CA", { timeZone: "America/Edmonton", hour: "2-digit", minute: "2-digit" });
const fmtDate = (d: string) =>
  new Date(d + "T00:00:00").toLocaleDateString("en-CA", { weekday: "short", day: "numeric", month: "short", year: "numeric" });

const inputCls = "border border-border bg-background px-3 py-2 text-sm font-body outline-none focus:border-foreground";

const OfficeLocation = () => {
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [radius, setRadius] = useState("100");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    supabase.from("office_settings").select("latitude, longitude, radius_m").eq("id", 1).maybeSingle().then(({ data }) => {
      if (data) {
        setLat(String(data.latitude));
        setLng(String(data.longitude));
        setRadius(String(data.radius_m));
      }
    });
  }, []);

  const useMyLocation = () => {
    navigator.geolocation?.getCurrentPosition(
      (p) => {
        setLat(String(p.coords.latitude));
        setLng(String(p.coords.longitude));
        setMsg({ ok: true, text: "Filled with your current location. Press Save." });
      },
      () => setMsg({ ok: false, text: "Couldn't read your location. Allow location access and try again." }),
      { enableHighAccuracy: true, timeout: 20000 },
    );
  };

  const save = async () => {
    const latitude = Number(lat);
    const longitude = Number(lng);
    const radius_m = Math.round(Number(radius));
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180 || !(radius_m > 0)) {
      setMsg({ ok: false, text: "Enter a valid latitude, longitude and radius." });
      return;
    }
    const { data, error } = await supabase
      .from("office_settings")
      .update({ latitude, longitude, radius_m })
      .eq("id", 1)
      .select("id");
    if (error) setMsg({ ok: false, text: error.message });
    else if (!data || data.length === 0) setMsg({ ok: false, text: "Not saved. Make sure your account is an admin in the staff table (see setup guide)." });
    else setMsg({ ok: true, text: "Office location saved." });
  };

  return (
    <div className="px-4 pb-4">
      <button onClick={() => setOpen((o) => !o)} className="inline-flex items-center gap-2 text-xs font-body font-bold tracking-widest underline text-muted-foreground hover:text-foreground">
        <MapPin size={14} /> {open ? "HIDE" : "SET"} OFFICE LOCATION
      </button>
      {open && (
        <div className="mt-3 border border-border p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <label className="text-xs font-body font-bold tracking-widest">LATITUDE
              <input className={inputCls + " w-full mt-1 font-normal"} value={lat} onChange={(e) => setLat(e.target.value)} placeholder="e.g. 5.0377" />
            </label>
            <label className="text-xs font-body font-bold tracking-widest">LONGITUDE
              <input className={inputCls + " w-full mt-1 font-normal"} value={lng} onChange={(e) => setLng(e.target.value)} placeholder="e.g. 7.9128" />
            </label>
            <label className="text-xs font-body font-bold tracking-widest">ALLOWED RADIUS (METRES)
              <input className={inputCls + " w-full mt-1 font-normal"} value={radius} onChange={(e) => setRadius(e.target.value)} />
            </label>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button onClick={useMyLocation} className="px-4 py-2 text-xs font-body font-bold tracking-widest border border-border hover:border-foreground">USE MY CURRENT LOCATION</button>
            <button onClick={() => void save()} className="px-4 py-2 text-xs font-body font-bold tracking-widest bg-primary text-primary-foreground hover:opacity-90">SAVE</button>
            {msg && <span className={`text-xs font-body ${msg.ok ? "" : "text-destructive"}`}>{msg.text}</span>}
          </div>
        </div>
      )}
    </div>
  );
};

const AttendanceTable = () => {
  const [rows, setRows] = useState<AttendanceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState(localToday());
  const [to, setTo] = useState(localToday());
  const sel = useRowSelection();
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [bulkMsg, setBulkMsg] = useState("");
  const schedule = useAttendanceSchedule();

  useEffect(() => {
    supabase
      .from("attendance")
      .select("id, full_name, check_date, checked_in_at, distance_m, ip_address")
      .order("check_date", { ascending: false })
      .order("checked_in_at", { ascending: false })
      .limit(5000)
      .then(({ data, error: err }) => {
        if (err) setError(err.message);
        else setRows((data as AttendanceRow[]) || []);
        setLoading(false);
      });
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (q && !r.full_name.toLowerCase().includes(q)) return false;
      if (from && r.check_date < from) return false;
      if (to && r.check_date > to) return false;
      return true;
    });
  }, [rows, search, from, to]);

  const filteredIds = filtered.map((r) => r.id);
  const selectedIds = filteredIds.filter((id) => sel.ids.has(id));
  const allSelected = filteredIds.length > 0 && selectedIds.length === filteredIds.length;

  const isToday = from === localToday() && to === localToday();
  const filtersActive = !!search || !isToday;

  return (
    <div className="border border-border">
      <div className="p-4 border-b border-border space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search by staff name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-border bg-background text-sm outline-none focus:border-foreground"
            />
          </div>
          <label className="text-xs font-body text-muted-foreground flex items-center gap-2">From
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={inputCls} />
          </label>
          <label className="text-xs font-body text-muted-foreground flex items-center gap-2">To
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={inputCls} />
          </label>
          <button onClick={() => { setFrom(""); setTo(""); }} className="text-xs font-body underline text-muted-foreground hover:text-foreground">All dates</button>
          {filtersActive && (
            <button
              onClick={() => { setSearch(""); setFrom(localToday()); setTo(localToday()); }}
              className="inline-flex items-center gap-1 px-3 py-2 text-xs font-body font-medium text-muted-foreground hover:text-foreground"
            >
              <X size={14} /> Reset to today
            </button>
          )}
        </div>
      </div>
      <div className="px-4 pt-4 pb-2 flex items-baseline justify-between">
        <h2 className="font-display text-xl font-bold tracking-wide">Staff Attendance</h2>
        <span className="text-sm font-body text-muted-foreground">{filtered.length} check-in{filtered.length === 1 ? "" : "s"}</span>
      </div>
      <OfficeLocation />
      <ResumptionSchedule schedule={schedule} today={localToday()} />
      <div className="overflow-x-auto">
        <Table fitViewport>
          <TableHeader>
            <TableRow>
              <TableHead className={stickyCheckHead}>
                <Checkbox
                  checked={allSelected ? true : selectedIds.length > 0 ? "indeterminate" : false}
                  onCheckedChange={(v) => sel.setMany(filteredIds, v === true)}
                  aria-label="Select all check-ins"
                />
              </TableHead>
              <TableHead className={stickySnHead}>S/N</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Check-in time</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Distance from office</TableHead>
              <TableHead>IP address</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
            ) : error ? (
              <TableRow><TableCell colSpan={8} className="text-center py-8 text-destructive">{error}</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No check-ins found</TableCell></TableRow>
            ) : (
              filtered.map((r, i) => (
                <TableRow key={r.id} className={sel.ids.has(r.id) ? "bg-muted/60" : ""}>
                  <TableCell className={stickyCheckCell(sel.ids.has(r.id))}>
                    <Checkbox checked={sel.ids.has(r.id)} onCheckedChange={() => sel.toggle(r.id)} aria-label={`Select check-in for ${r.full_name}`} />
                  </TableCell>
                  <TableCell className={stickySnCell(sel.ids.has(r.id))}>{i + 1}</TableCell>
                  <TableCell className="whitespace-nowrap">{fmtDate(r.check_date)}</TableCell>
                  <TableCell className="font-medium whitespace-nowrap">{r.full_name}</TableCell>
                  <TableCell className="whitespace-nowrap">{fmtTime(r.checked_in_at)}</TableCell>
                  <TableCell className="whitespace-nowrap">
                    {(() => {
                      if (!schedule.loaded) return <span className="text-xs text-muted-foreground">…</span>;
                      const st = computeStatus(schedule.resumeMinutesFor(r.check_date), schedule.grace, r.checked_in_at);
                      return st.status === "late" ? (
                        <span className="inline-block px-2 py-0.5 text-[11px] font-body font-bold tracking-wider border border-amber-500 text-amber-700">LATE · {formatLate(st.lateByMin)}</span>
                      ) : st.status === "off_day" ? (
                        <span className="inline-block px-2 py-0.5 text-[11px] font-body font-bold tracking-wider border border-border text-muted-foreground">OFF DAY</span>
                      ) : (
                        <span className="inline-block px-2 py-0.5 text-[11px] font-body font-bold tracking-wider border border-green-600 text-green-700">ON TIME</span>
                      );
                    })()}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">{r.distance_m != null ? `${r.distance_m} m` : "—"}</TableCell>
                  <TableCell className="whitespace-nowrap">{r.ip_address || "—"}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      <BulkActionBar count={selectedIds.length} noun="check-in" message={bulkMsg} onClear={() => { sel.clear(); setBulkMsg(""); }}>
        <BulkButton danger onClick={() => setBulkDeleting(true)}>DELETE</BulkButton>
      </BulkActionBar>
      {bulkDeleting && (
        <ConfirmDialog
          title={`Delete ${selectedIds.length} check-in${selectedIds.length === 1 ? "" : "s"}?`}
          message={`This will permanently delete ${selectedIds.length} selected attendance record${selectedIds.length === 1 ? "" : "s"}. This cannot be undone.`}
          confirmLabel={`Delete ${selectedIds.length}`}
          destructive
          onClose={() => setBulkDeleting(false)}
          onConfirm={async () => {
            const { data, error: delErr } = await supabase.from("attendance").delete().in("id", selectedIds).select("id");
            if (delErr) throw new Error(delErr.message);
            if (!data || data.length === 0) throw new Error("Nothing was deleted. Make sure your account is an admin in the staff table.");
            const gone = new Set(data.map((d: { id: string }) => d.id));
            setRows((prev) => prev.filter((r) => !gone.has(r.id)));
            setBulkDeleting(false);
            setBulkMsg(`${data.length} deleted.`);
            sel.clear();
          }}
        />
      )}
    </div>
  );
};

export default AttendanceTable;
