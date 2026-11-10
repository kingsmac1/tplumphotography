import { useEffect, useMemo, useState } from "react";
import { Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { dayOfWeek, computeStatus, formatLate, localDateOf, localToday, workingDays } from "@/lib/attendanceRules";
import { useAttendanceSchedule } from "@/lib/attendanceSchedule";

interface Person { id: string; name: string; startDate: string | null }
interface Rec { staff_id: string; full_name: string; check_date: string; checked_in_at: string }

const inputCls = "border border-border bg-background px-3 py-2 text-sm font-body outline-none focus:border-foreground";
const fmtDay = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-CA", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString("en-CA", { timeZone: "America/Edmonton", hour: "2-digit", minute: "2-digit" });
const monthStart = (offset = 0) => {
  const [y, m] = localToday().split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + offset, 1));
  return d.toISOString().slice(0, 10);
};
const monthEnd = (offset = 0) => {
  const [y, m] = localToday().split("-").map(Number);
  return new Date(Date.UTC(y, m + offset, 0)).toISOString().slice(0, 10);
};

const Badge = ({ kind, children }: { kind: "ok" | "late" | "absent" | "muted"; children: React.ReactNode }) => (
  <span className={`inline-block px-2 py-0.5 text-[11px] font-body font-bold tracking-wider border ${
    kind === "ok" ? "border-green-600 text-green-700" : kind === "late" ? "border-amber-500 text-amber-700" : kind === "absent" ? "border-red-500 text-red-600" : "border-border text-muted-foreground"
  }`}>{children}</span>
);

const AttendanceReport = () => {
  const today = localToday();
  const [from, setFrom] = useState(monthStart());
  const [to, setTo] = useState(today);
  const [staffId, setStaffId] = useState("all");
  const [staff, setStaff] = useState<Person[]>([]);
  const [rows, setRows] = useState<Rec[]>([]);
  const [daysOff, setDaysOff] = useState<{ day: string; note: string }[]>([]);
  const [allDaysOff, setAllDaysOff] = useState<{ day: string; note: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [offDay, setOffDay] = useState("");
  const [offNote, setOffNote] = useState("");
  const schedule = useAttendanceSchedule();

  const load = async () => {
    setLoading(true);
    const [s, a, d, all] = await Promise.all([
      supabase.from("staff").select("id, full_name, role, created_at"),
      supabase.from("attendance").select("staff_id, full_name, check_date, checked_in_at").gte("check_date", from).lte("check_date", to).limit(20000),
      supabase.from("attendance_days_off").select("day, note").gte("day", from).lte("day", to),
      supabase.from("attendance_days_off").select("day, note").order("day", { ascending: false }).limit(60),
    ]);
    const err = s.error || a.error || d.error;
    if (err) { setError(err.message); setLoading(false); return; }
    setError("");
    setStaff(
      (s.data || [])
        .filter((r: { role: string }) => r.role === "staff")
        .map((r: { id: string; full_name: string; created_at: string }) => ({ id: r.id, name: r.full_name || "(no name)", startDate: r.created_at ? localDateOf(r.created_at) : null })),
    );
    setRows((a.data as Rec[]) || []);
    setDaysOff((d.data as { day: string; note: string }[]) || []);
    setAllDaysOff((all.data as { day: string; note: string }[]) || []);
    setLoading(false);
  };
  useEffect(() => { void load(); /* eslint-disable-next-line */ }, [from, to]);

  const people = useMemo(() => {
    const map = new Map<string, Person>(staff.map((p) => [p.id, p]));
    rows.forEach((r) => { if (!map.has(r.staff_id)) map.set(r.staff_id, { id: r.staff_id, name: r.full_name, startDate: null }); });
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [staff, rows]);

  const offSet = useMemo(() => new Set(daysOff.map((d) => d.day)), [daysOff]);

  const report = useMemo(() => {
    if (!schedule.loaded) return [];
    const selected = staffId === "all" ? people : people.filter((p) => p.id === staffId);
    return selected.map((p) => {
      const start = p.startDate && p.startDate > from ? p.startDate : from;
      const end = to < today ? to : today;
      const recs = new Map(rows.filter((r) => r.staff_id === p.id).map((r) => [r.check_date, r]));
      const days = workingDays(start, end, offSet);
      let onTime = 0, late = 0, absent = 0, pending = 0;
      const detail = days.map((d) => {
        const rec = recs.get(d);
        if (!rec) {
          if (d === today) { pending++; return { day: d, kind: "pending" as const, time: "", lateBy: 0 }; }
          absent++;
          return { day: d, kind: "absent" as const, time: "", lateBy: 0 };
        }
        const st = computeStatus(schedule.resumeMinutesFor(d), schedule.grace, rec.checked_in_at);
        if (st.status === "late") late++; else onTime++;
        return { day: d, kind: st.status === "late" ? ("late" as const) : ("on_time" as const), time: fmtTime(rec.checked_in_at), lateBy: st.lateByMin };
      });
      const attended = onTime + late;
      const rate = attended + absent > 0 ? Math.round((attended / (attended + absent)) * 100) : null;
      return { person: p, onTime, late, absent, pending, workingDays: days.length, rate, detail };
    });
  }, [people, rows, staffId, from, to, today, offSet, schedule]);

  const totals = report.reduce((t, r) => ({ onTime: t.onTime + r.onTime, late: t.late + r.late, absent: t.absent + r.absent }), { onTime: 0, late: 0, absent: 0 });

  const addOff = async () => {
    if (!offDay) return;
    const { error: e } = await supabase.from("attendance_days_off").upsert({ day: offDay, note: offNote.trim() }, { onConflict: "day" });
    if (e) return setError(e.message);
    setOffDay(""); setOffNote("");
    await load();
  };
  const removeOff = async (day: string) => {
    const { error: e } = await supabase.from("attendance_days_off").delete().eq("day", day);
    if (e) return setError(e.message);
    await load();
  };

  const single = staffId !== "all" ? report[0] : null;

  return (
    <div className="space-y-6">
      <div className="border border-border p-4 space-y-3">
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-xs font-body font-bold tracking-widest">STAFF
            <select className={inputCls + " block mt-1 font-normal min-w-[180px]"} value={staffId} onChange={(e) => setStaffId(e.target.value)}>
              <option value="all">All staff</option>
              {people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </label>
          <label className="text-xs font-body font-bold tracking-widest">FROM
            <input type="date" className={inputCls + " block mt-1 font-normal"} value={from} onChange={(e) => setFrom(e.target.value)} />
          </label>
          <label className="text-xs font-body font-bold tracking-widest">TO
            <input type="date" className={inputCls + " block mt-1 font-normal"} value={to} onChange={(e) => setTo(e.target.value)} />
          </label>
          <div className="flex flex-wrap gap-2 pb-0.5">
            <button className="px-3 py-2 text-xs font-body border border-border hover:border-foreground" onClick={() => { setFrom(monthStart()); setTo(today); }}>This month</button>
            <button className="px-3 py-2 text-xs font-body border border-border hover:border-foreground" onClick={() => { setFrom(monthStart(-1)); setTo(monthEnd(-1)); }}>Last month</button>
            <button className="px-3 py-2 text-xs font-body border border-border hover:border-foreground" onClick={() => { const d = new Date(`${today}T12:00:00Z`); d.setUTCDate(d.getUTCDate() - 6); setFrom(d.toISOString().slice(0, 10)); setTo(today); }}>Last 7 days</button>
          </div>
        </div>
        <p className="text-xs font-body text-muted-foreground">
          Resumption time and the late grace period are set in the Check-ins tab and apply here too (currently {schedule.grace} minute{schedule.grace === 1 ? "" : "s"} of grace).
          Sundays and the days off listed below are not counted. A day with no check-in counts as absent once it has passed.
        </p>
      </div>

      {error && <p className="text-sm text-destructive font-body">{error}</p>}

      <div className="border border-border">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Staff</TableHead>
                <TableHead>On time</TableHead>
                <TableHead>Late</TableHead>
                <TableHead>Absent</TableHead>
                <TableHead>Working days</TableHead>
                <TableHead>Attendance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading || !schedule.loaded ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
              ) : report.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No staff found. Create staff logins in Supabase (see the setup guide).</TableCell></TableRow>
              ) : (
                <>
                  {report.map((r) => (
                    <TableRow key={r.person.id}>
                      <TableCell className="font-medium whitespace-nowrap">{r.person.name}</TableCell>
                      <TableCell><Badge kind="ok">{r.onTime}</Badge></TableCell>
                      <TableCell><Badge kind="late">{r.late}</Badge></TableCell>
                      <TableCell><Badge kind="absent">{r.absent}</Badge></TableCell>
                      <TableCell>{r.workingDays}{r.pending ? " (today pending)" : ""}</TableCell>
                      <TableCell>{r.rate === null ? "—" : `${r.rate}%`}</TableCell>
                    </TableRow>
                  ))}
                  {report.length > 1 && (
                    <TableRow className="font-bold bg-muted/40">
                      <TableCell>All staff</TableCell>
                      <TableCell>{totals.onTime}</TableCell>
                      <TableCell>{totals.late}</TableCell>
                      <TableCell>{totals.absent}</TableCell>
                      <TableCell />
                      <TableCell />
                    </TableRow>
                  )}
                </>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {single && single.detail.length > 0 && (
        <div className="border border-border">
          <p className="px-4 pt-4 pb-2 font-display text-lg font-bold">{single.person.name} — day by day</p>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow><TableHead>Date</TableHead><TableHead>Status</TableHead><TableHead>Check-in</TableHead></TableRow>
              </TableHeader>
              <TableBody>
                {[...single.detail].reverse().map((d) => (
                  <TableRow key={d.day}>
                    <TableCell className="whitespace-nowrap">{fmtDay(d.day)}{dayOfWeek(d.day) === 6 ? " (Sat)" : ""}</TableCell>
                    <TableCell>
                      {d.kind === "on_time" && <Badge kind="ok">ON TIME</Badge>}
                      {d.kind === "late" && <Badge kind="late">LATE · {formatLate(d.lateBy)}</Badge>}
                      {d.kind === "absent" && <Badge kind="absent">ABSENT</Badge>}
                      {d.kind === "pending" && <Badge kind="muted">TODAY · NOT YET</Badge>}
                    </TableCell>
                    <TableCell>{d.time || "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      <div className="border border-border p-4 space-y-3">
        <p className="text-xs font-body font-bold tracking-widest">DAYS OFF &amp; PUBLIC HOLIDAYS</p>
        <p className="text-xs font-body text-muted-foreground">Add days the office is closed so nobody is marked absent for them.</p>
        <div className="flex flex-wrap items-end gap-3">
          <input type="date" className={inputCls} value={offDay} onChange={(e) => setOffDay(e.target.value)} />
          <input className={inputCls + " w-56"} placeholder="Reason (e.g. Independence Day)" value={offNote} onChange={(e) => setOffNote(e.target.value)} />
          <button className="px-4 py-2 text-sm font-body font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90" onClick={() => void addOff()}>Add day off</button>
        </div>
        {allDaysOff.length > 0 && (
          <ul className="divide-y divide-border border border-border">
            {allDaysOff.map((d) => (
              <li key={d.day} className="flex items-center justify-between px-3 py-2 text-sm font-body">
                <span>{fmtDay(d.day)}{d.note ? ` — ${d.note}` : ""}</span>
                <button className="p-1 text-muted-foreground hover:text-destructive" onClick={() => void removeOff(d.day)} aria-label="Remove day off"><Trash2 size={14} /></button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default AttendanceReport;
