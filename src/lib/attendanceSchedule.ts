import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { BASE_RESUME_MINUTES, DEFAULT_GRACE_MINUTES, dayOfWeek } from "@/lib/attendanceRules";

export type TimeOverride = {
  id: string;
  start_date: string;
  end_date: string | null;
  resumption_minutes: number;
  note: string | null;
  created_at: string;
};

/**
 * The studio's resumption-time rules: the 9am/10am defaults, plus any admin overrides
 * (a single day, a run of days, or "from this date onward"). Where overrides overlap for
 * a date, the most recently created one wins — so fixing a mistake is just adding a new one.
 */
export const useAttendanceSchedule = () => {
  const [grace, setGrace] = useState(DEFAULT_GRACE_MINUTES);
  const [overrides, setOverrides] = useState<TimeOverride[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const [s, o] = await Promise.all([
      supabase.from("attendance_settings").select("grace_minutes").eq("id", 1).maybeSingle(),
      supabase.from("attendance_time_overrides").select("*").order("start_date", { ascending: false }).limit(1000),
    ]);
    if (s.error || o.error) setError((s.error ?? o.error)!.message);
    else setError("");
    if (s.data?.grace_minutes != null) setGrace(s.data.grace_minutes);
    setOverrides((o.data as TimeOverride[]) || []);
    setLoaded(true);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const resumeMinutesFor = useCallback(
    (date: string): number | null => {
      const matches = overrides.filter((ov) => ov.start_date <= date && (!ov.end_date || ov.end_date >= date));
      if (matches.length > 0) {
        // Most recently created override for that date wins.
        return matches.reduce((best, m) => (m.created_at > best.created_at ? m : best)).resumption_minutes;
      }
      return BASE_RESUME_MINUTES[dayOfWeek(date)];
    },
    [overrides],
  );

  return { loaded, error, grace, overrides, resumeMinutesFor, refresh: load };
};
