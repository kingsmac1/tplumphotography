/** Default resumption times (Mountain Time): 9:00 Monday-Friday, 10:00 Saturday, Sunday is a day off.
 *  Admins can override these — see attendanceSchedule.ts. */
export type AttendanceStatus = "on_time" | "late" | "off_day";

const TZ = "America/Edmonton";
// index = day of week (0 = Sunday)
export const BASE_RESUME_MINUTES: (number | null)[] = [null, 9 * 60, 9 * 60, 9 * 60, 9 * 60, 9 * 60, 10 * 60];

/** Minutes of grace after resumption time before a check-in counts as late (default; adjustable by admins). */
export const DEFAULT_GRACE_MINUTES = 30;

export const RESUMPTION_NOTE =
  "Default resumption: 9:00 AM Mon–Fri · 10:00 AM Saturday. A staff member is marked late once they check in more than the grace period after that time. Both can be adjusted below.";

export const localToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date());
export const localDateOf = (iso: string) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date(iso));

/** Minutes after midnight (Mountain Time) for a timestamp. */
export const lagosMinutes = (iso: string) => {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(new Date(iso));
  const h = Number(parts.find((p) => p.type === "hour")?.value ?? 0) % 24;
  const m = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  return h * 60 + m;
};

export const dayOfWeek = (date: string) => new Date(`${date}T12:00:00Z`).getUTCDay();

export const minutesToTimeStr = (min: number) => {
  const h = Math.floor(min / 60) % 24;
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
};
export const timeStrToMinutes = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
};
export const formatTime = (min: number) => {
  const h = Math.floor(min / 60) % 24;
  const m = min % 60;
  const period = h < 12 ? "AM" : "PM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${period}`;
};

/**
 * Status for a check-in given that day's effective resumption time (null = day off, e.g. Sunday)
 * and the grace period in minutes. Late is counted from `resumeMinutes + graceMinutes` onward.
 */
export const computeStatus = (
  resumeMinutes: number | null,
  graceMinutes: number,
  checkedInAt: string,
): { status: AttendanceStatus; lateByMin: number } => {
  if (resumeMinutes === null) return { status: "off_day", lateByMin: 0 };
  const late = lagosMinutes(checkedInAt) - (resumeMinutes + graceMinutes);
  return late > 0 ? { status: "late", lateByMin: late } : { status: "on_time", lateByMin: 0 };
};

export const formatLate = (min: number) => (min >= 60 ? `${Math.floor(min / 60)}h ${min % 60}m` : `${min} min`);

/** Every working day (Mon–Sat, excluding the given days off) from `from` to `to`, inclusive. */
export const workingDays = (from: string, to: string, daysOff: Set<string>) => {
  const out: string[] = [];
  if (from > to) return out;
  const d = new Date(`${from}T12:00:00Z`);
  const end = new Date(`${to}T12:00:00Z`);
  while (d <= end) {
    const iso = d.toISOString().slice(0, 10);
    if (d.getUTCDay() !== 0 && !daysOff.has(iso)) out.push(iso);
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
};
