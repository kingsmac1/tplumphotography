import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { computeStatus, formatLate, localToday, workingDays } from "@/lib/attendanceRules";
import { useAttendanceSchedule } from "@/lib/attendanceSchedule";

/** A staff member's own attendance for one month: totals and every working day, on time / late / absent. */

type Rec = { check_date: string; checked_in_at: string };
type Kind = "on_time" | "late" | "absent" | "pending" | "unknown";

const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString("en-CA", { timeZone: "America/Edmonton", hour: "2-digit", minute: "2-digit" });
const fmtDay = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-CA", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
const monthOf = (offset: number) => {
  const [y, m] = localToday().split("-").map(Number);
  const first = new Date(Date.UTC(y, m - 1 + offset, 1));
  const last = new Date(Date.UTC(y, m + offset, 0));
  return {
    from: first.toISOString().slice(0, 10),
    to: last.toISOString().slice(0, 10),
    title: first.toLocaleDateString("en-CA", { month: "long", year: "numeric", timeZone: "UTC" }),
  };
};

const BADGE: Record<Kind, string> = {
  on_time: "border-green-600 text-green-700",
  late: "border-amber-500 text-amber-700",
  absent: "border-red-500 text-red-600",
  pending: "border-border text-muted-foreground",
  unknown: "border-border text-muted-foreground",
};
const LABEL: Record<Kind, string> = { on_time: "ON TIME", late: "LATE", absent: "ABSENT", pending: "TODAY", unknown: "CHECKED IN" };

export default function StaffReport({ userId, startedOn, refreshKey }: { userId: string; startedOn: string | null; refreshKey: number }) {
  const [offset, setOffset] = useState(0);
  const [rows, setRows] = useState<Rec[]>([]);
  const [daysOff, setDaysOff] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const schedule = useAttendanceSchedule();
  const month = monthOf(offset);
  const today = localToday();

  useEffect(() => {
    let live = true;
    setLoading(true);
    Promise.all([
      supabase.from("attendance").select("check_date, checked_in_at").eq("staff_id", userId).gte("check_date", month.from).lte("check_date", month.to),
      supabase.from("attendance_days_off").select("day").gte("day", month.from).lte("day", month.to),
    ]).then(([a, d]) => {
      if (!live) return;
      setRows((a.data as Rec[]) || []);
      setDaysOff(new Set(((d.data as { day: string }[]) || []).map((r) => r.day)));
      setLoading(false);
    });
    return () => { live = false; };
  }, [userId, month.from, month.to, refreshKey]);

  // Resumption times are only readable once supabase/staff-portal.sql has run; until then show times without on time / late.
  const knowsSchedule = schedule.loaded && !schedule.error;

  const report = useMemo(() => {
    const start = startedOn && startedOn > month.from ? startedOn : month.from;
    const end = month.to < today ? month.to : today;
    const recs = new Map(rows.map((r) => [r.check_date, r]));
    let onTime = 0, late = 0, absent = 0;
    const days = workingDays(start, end, daysOff).reverse().map((day) => {
      const rec = recs.get(day);
      if (!rec) {
        if (day === today) return { day, kind: "pending" as Kind, time: "", lateBy: 0 };
        absent++;
        return { day, kind: "absent" as Kind, time: "", lateBy: 0 };
      }
      if (!knowsSchedule) { onTime++; return { day, kind: "unknown" as Kind, time: fmtTime(rec.checked_in_at), lateBy: 0 }; }
      const st = computeStatus(schedule.resumeMinutesFor(day), schedule.grace, rec.checked_in_at);
      if (st.status === "late") late++; else onTime++;
      return { day, kind: (st.status === "late" ? "late" : "on_time") as Kind, time: fmtTime(rec.checked_in_at), lateBy: st.lateByMin };
    });
    const attended = onTime + late;
    const rate = attended + absent > 0 ? Math.round((attended / (attended + absent)) * 100) : null;
    return { days, onTime, late, absent, attended, rate };
  }, [rows, daysOff, month.from, month.to, today, startedOn, knowsSchedule, schedule]);

  const canBack = !startedOn || month.from > startedOn.slice(0, 7) + "-01";

  return (
    <section className="mt-10">
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs font-body font-bold tracking-widest text-muted-foreground">MY ATTENDANCE</p>
        <div className="flex items-center gap-2">
          <button onClick={() => setOffset((o) => o - 1)} disabled={!canBack} aria-label="Previous month" className="grid h-8 w-8 place-items-center border border-border disabled:opacity-30">
            <ChevronLeft size={15} />
          </button>
          <span className="min-w-[130px] text-center text-sm font-body font-bold">{month.title}</span>
          <button onClick={() => setOffset((o) => o + 1)} disabled={offset >= 0} aria-label="Next month" className="grid h-8 w-8 place-items-center border border-border disabled:opacity-30">
            <ChevronRight size={15} />
          </button>
        </div>
      </div>

      <div className={`grid grid-cols-2 sm:grid-cols-4 border border-border divide-x divide-y sm:divide-y-0 divide-border mb-6 transition-opacity ${loading ? "opacity-50" : ""}`}>
        {[
          ["DAYS PRESENT", report.attended],
          [knowsSchedule ? "ON TIME" : "CHECK-INS", report.onTime],
          ["LATE", knowsSchedule ? report.late : "—"],
          ["ABSENT", report.absent],
        ].map(([label, n]) => (
          <div key={label as string} className="p-4">
            <p className="text-[10px] font-body font-bold tracking-widest text-muted-foreground">{label}</p>
            <p className="font-display text-3xl font-bold mt-1">{n}</p>
          </div>
        ))}
      </div>
      {report.rate != null && (
        <div className="mb-6">
          <div className="flex justify-between text-xs font-body text-muted-foreground mb-1.5">
            <span>Attendance this month</span>
            <span className="font-bold text-foreground">{report.rate}%</span>
          </div>
          <div className="h-1.5 bg-muted"><div className="h-full bg-foreground transition-[width] duration-500" style={{ width: `${report.rate}%` }} /></div>
        </div>
      )}

      {report.days.length === 0 ? (
        <p className="text-sm font-body text-muted-foreground border border-border p-4">No working days in this month yet.</p>
      ) : (
        <ul className="border border-border divide-y divide-border">
          {report.days.map((d) => (
            <li key={d.day} className="flex items-center justify-between gap-3 px-4 py-3 text-sm font-body">
              <span>{fmtDay(d.day)}</span>
              <span className="flex items-center gap-3">
                {d.time && <span className="text-muted-foreground">{d.time}</span>}
                {d.kind === "late" && <span className="text-xs text-amber-700">{formatLate(d.lateBy)} late</span>}
                <span className={`inline-block px-2 py-0.5 text-[10px] font-bold tracking-wider border ${BADGE[d.kind]}`}>{LABEL[d.kind]}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-xs font-body text-muted-foreground">Sundays and studio days off don't count. Think a day is wrong? Speak to the admin.</p>
    </section>
  );
}

