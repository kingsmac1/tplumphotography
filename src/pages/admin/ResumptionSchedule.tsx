import { useState } from "react";
import { Clock, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { formatTime, timeStrToMinutes } from "@/lib/attendanceRules";
import type { useAttendanceSchedule } from "@/lib/attendanceSchedule";

const inputCls = "border border-border bg-background px-3 py-2 text-sm font-body outline-none focus:border-foreground";

const fmtDate = (d: string) =>
  new Date(`${d}T12:00:00Z`).toLocaleDateString("en-CA", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

type Scope = "day" | "days" | "forever";

const addDaysIso = (iso: string, n: number) => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

const rangeLabel = (startDate: string, endDate: string | null, today: string) => {
  if (!endDate) return `${fmtDate(startDate)} onward`;
  if (startDate === endDate) return startDate === today ? "Today only" : fmtDate(startDate);
  return `${fmtDate(startDate)} – ${fmtDate(endDate)}`;
};

const ResumptionSchedule = ({ schedule, today }: { schedule: ReturnType<typeof useAttendanceSchedule>; today: string }) => {
  const [open, setOpen] = useState(false);
  const [time, setTime] = useState("09:00");
  const [scope, setScope] = useState<Scope>("day");
  const [startDate, setStartDate] = useState(today);
  const [days, setDays] = useState("7");
  const [note, setNote] = useState("");
  const [graceInput, setGraceInput] = useState(String(schedule.grace));
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const resumption_minutes = timeStrToMinutes(time);
    if (!startDate) return setMsg({ ok: false, text: "Choose a date." });
    let end_date: string | null;
    if (scope === "day") end_date = startDate;
    else if (scope === "forever") end_date = null;
    else {
      const n = Math.max(1, Math.round(Number(days)) || 1);
      end_date = addDaysIso(startDate, n - 1);
    }
    setSaving(true);
    const { error } = await supabase.from("attendance_time_overrides").insert({
      start_date: startDate,
      end_date,
      resumption_minutes,
      note: note.trim() || null,
    });
    setSaving(false);
    if (error) return setMsg({ ok: false, text: error.message });
    setMsg({ ok: true, text: `Saved. Resumption is now ${formatTime(resumption_minutes)} for ${rangeLabel(startDate, end_date, today).toLowerCase()}.` });
    setNote("");
    await schedule.refresh();
  };

  const removeOverride = async (id: string) => {
    const { error } = await supabase.from("attendance_time_overrides").delete().eq("id", id);
    if (error) return setMsg({ ok: false, text: error.message });
    await schedule.refresh();
  };

  const saveGrace = async () => {
    const n = Math.round(Number(graceInput));
    if (!Number.isFinite(n) || n < 0) return setMsg({ ok: false, text: "Enter a valid number of minutes." });
    const { error } = await supabase.from("attendance_settings").update({ grace_minutes: n }).eq("id", 1);
    if (error) return setMsg({ ok: false, text: error.message });
    setMsg({ ok: true, text: `Grace period saved: staff have ${n} minute${n === 1 ? "" : "s"} after resumption before they're marked late.` });
    await schedule.refresh();
  };

  return (
    <div className="px-4 pb-4">
      <button onClick={() => setOpen((o) => !o)} className="inline-flex items-center gap-2 text-xs font-body font-bold tracking-widest underline text-muted-foreground hover:text-foreground">
        <Clock size={14} /> {open ? "HIDE" : "SET"} RESUMPTION TIME
      </button>
      {open && (
        <div className="mt-3 border border-border p-4 space-y-5">
          {/* Grace period */}
          <div>
            <label className="text-xs font-body font-bold tracking-widest">LATE STARTS COUNTING (MINUTES AFTER RESUMPTION)
              <div className="flex items-center gap-2 mt-1">
                <input type="number" min={0} className={inputCls + " w-28 font-normal"} value={graceInput} onChange={(e) => setGraceInput(e.target.value)} />
                <button onClick={() => void saveGrace()} className="px-3 py-2 text-xs font-body font-bold tracking-widest border border-border hover:border-foreground">SAVE</button>
              </div>
            </label>
            <p className="text-[11px] text-muted-foreground font-body mt-1">e.g. 30 means a 9:00 AM resumption only counts as late after 9:30 AM.</p>
          </div>

          <div className="border-t border-border pt-4">
            <p className="text-xs font-body font-bold tracking-widest mb-3">CHANGE THE RESUMPTION TIME</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <label className="text-xs font-body font-bold tracking-widest">NEW TIME
                <input type="time" className={inputCls + " w-full mt-1 font-normal"} value={time} onChange={(e) => setTime(e.target.value)} />
              </label>
              <label className="text-xs font-body font-bold tracking-widest">DATE
                <input type="date" className={inputCls + " w-full mt-1 font-normal"} value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                <span className="block text-[11px] font-normal text-muted-foreground mt-1 normal-case tracking-normal">Past, today or a future date</span>
              </label>
              <label className="text-xs font-body font-bold tracking-widest">APPLIES TO
                <select className={inputCls + " w-full mt-1 font-normal"} value={scope} onChange={(e) => setScope(e.target.value as Scope)}>
                  <option value="day">That one day only</option>
                  <option value="days">That day + a number of days after</option>
                  <option value="forever">That day onward, until changed again</option>
                </select>
              </label>
            </div>
            {scope === "days" && (
              <label className="text-xs font-body font-bold tracking-widest block mt-3">FOR HOW MANY DAYS (INCLUDING THE START DATE)
                <input type="number" min={1} className={inputCls + " w-28 mt-1 font-normal block"} value={days} onChange={(e) => setDays(e.target.value)} />
              </label>
            )}
            <label className="text-xs font-body font-bold tracking-widest block mt-3">NOTE (OPTIONAL)
              <input className={inputCls + " w-full mt-1 font-normal"} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Ramadan hours, public holiday eve" />
            </label>
            <button onClick={() => void save()} disabled={saving} className="mt-3 px-4 py-2 text-xs font-body font-bold tracking-widest bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50">
              {saving ? "SAVING…" : "SAVE RESUMPTION TIME"}
            </button>
          </div>

          {msg && <p className={`text-xs font-body ${msg.ok ? "" : "text-destructive"}`}>{msg.text}</p>}

          {schedule.overrides.length > 0 && (
            <div className="border-t border-border pt-4">
              <p className="text-xs font-body font-bold tracking-widest mb-2">CURRENT ADJUSTMENTS</p>
              <ul className="divide-y divide-border border border-border">
                {schedule.overrides.map((ov) => (
                  <li key={ov.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm font-body">
                    <span>
                      <b>{formatTime(ov.resumption_minutes)}</b> · {rangeLabel(ov.start_date, ov.end_date, today)}
                      {ov.note ? <span className="text-muted-foreground"> — {ov.note}</span> : null}
                    </span>
                    <button onClick={() => void removeOverride(ov.id)} className="p-1 text-muted-foreground hover:text-destructive shrink-0" aria-label="Remove this adjustment">
                      <Trash2 size={14} />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ResumptionSchedule;
