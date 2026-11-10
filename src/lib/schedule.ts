import { supabase, isSupabaseConfigured } from "@/lib/supabaseClient";

/**
 * Shoot booking calendar (DMI). Every session is a fixed 1-hour slot; times are Mountain Time
 * (America/Edmonton). Opening hours, how far ahead clients can book and the minimum notice are
 * editable in Dashboard -> Settings -> Booking hours; dates or slots can be closed from Dashboard -> Calendar.
 * The database refuses a website booking for a taken or closed time.
 */

export const SESSION_MINUTES = 60;

/** How far ahead clients can book. */
export let BOOKING_HORIZON_DAYS = 365;
/** Minimum notice before a session (hours). */
export let MIN_NOTICE_HOURS = 24;

export const TIME_ZONE = "America/Edmonton";

export type OpeningHours = Record<number, [open: string, close: string] | null>;
/** Opening hours per weekday (0 = Sunday). The last slot starts an hour before closing. Defaults until settings load. */
let hours: OpeningHours = {
  0: null,
  1: ["10:00", "18:00"],
  2: ["10:00", "18:00"],
  3: ["10:00", "18:00"],
  4: ["10:00", "18:00"],
  5: ["10:00", "18:00"],
  6: ["09:00", "17:00"],
};
/** Applies the studio's saved hours (business_settings.opening_hours) to the calendar. */
export function setBookingRules(rules: { opening_hours?: Record<string, [string, string] | null> | null; booking_horizon_days?: number; min_notice_hours?: number }) {
  if (rules.opening_hours) hours = Object.fromEntries(Object.entries(rules.opening_hours).map(([k, v]) => [Number(k), v])) as OpeningHours;
  if (rules.booking_horizon_days) BOOKING_HORIZON_DAYS = rules.booking_horizon_days;
  if (rules.min_notice_hours !== undefined) MIN_NOTICE_HOURS = rules.min_notice_hours;
}
export const getOpeningHours = () => hours;

export const toMinutes = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + (m || 0);
};

export const fromMinutes = (n: number) =>
  `${String(Math.floor(n / 60)).padStart(2, "0")}:${String(n % 60).padStart(2, "0")}`;

/** "14:00" → "2:00 PM" */
export function formatTime(t: string) {
  const n = toMinutes(t);
  const h = Math.floor(n / 60);
  const m = n % 60;
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}

export const slotLabel = (start: string, minutes = SESSION_MINUTES) =>
  `${formatTime(start)} – ${formatTime(fromMinutes(toMinutes(start) + minutes))}`;

/** Weekday of a YYYY-MM-DD date, independent of the browser's timezone. */
export const weekday = (date: string) => new Date(`${date}T12:00:00Z`).getUTCDay();

/** Start times ("10:00", "11:00", …) of the slots offered on a date. */
export function slotsFor(date: string): string[] {
  const open = hours[weekday(date)];
  if (!open) return [];
  const out: string[] = [];
  for (let t = toMinutes(open[0]); t + SESSION_MINUTES <= toMinutes(open[1]); t += SESSION_MINUTES) out.push(fromMinutes(t));
  return out;
}

/* --------------------------------- Dates --------------------------------- */

/** Today in Lagos as YYYY-MM-DD. */
export const localToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE }).format(new Date());

/** Minutes since midnight right now in Lagos. */
export const localNowMinutes = () =>
  toMinutes(new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date()));

export function addDays(date: string, days: number) {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

export const monthKey = (date: string) => date.slice(0, 7);

export function addMonths(month: string, n: number) {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1 + n, 1)).toISOString().slice(0, 7);
}

/** Every date shown on a Monday-first month grid (leading/trailing days included). */
export function monthGrid(month: string): string[] {
  const first = `${month}-01`;
  const lead = (weekday(first) + 6) % 7;
  const start = addDays(first, -lead);
  const [y, m] = month.split("-").map(Number);
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const cells = Math.ceil((lead + daysInMonth) / 7) * 7;
  return Array.from({ length: cells }, (_, i) => addDays(start, i));
}

export const monthTitle = (month: string) =>
  new Date(`${month}-01T12:00:00Z`).toLocaleDateString("en-CA", { month: "long", year: "numeric", timeZone: "UTC" });

export const longDate = (date: string) =>
  new Date(`${date}T12:00:00Z`).toLocaleDateString("en-CA", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

export const shortDate = (date: string) =>
  new Date(`${date}T12:00:00Z`).toLocaleDateString("en-CA", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });

/* ------------------------------ Availability ----------------------------- */

export interface BusyRange {
  date: string;
  /** HH:MM; null on a block means the whole day */
  start: string | null;
  end: string | null;
}

export interface Availability {
  booked: BusyRange[];
  blocked: BusyRange[];
}

export const overlaps = (aStart: number, aEnd: number, bStart: number, bEnd: number) => aStart < bEnd && bStart < aEnd;

export type SlotState = "open" | "booked" | "blocked" | "past";

/** State of one slot, given everything already booked or closed. */
export function slotState(date: string, start: string, a: Availability): SlotState {
  const s = toMinutes(start);
  const e = s + SESSION_MINUTES;
  const today = localToday();
  if (date < today || (date === today && s <= localNowMinutes())) return "past";
  // minimum notice (e.g. 24 hours): too soon counts as past
  if (MIN_NOTICE_HOURS > 0) {
    const days = (Date.parse(`${date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86400000;
    if (days * 1440 + s - localNowMinutes() < MIN_NOTICE_HOURS * 60) return "past";
  }
  const hit = (r: BusyRange) =>
    r.date === date && (r.start === null || overlaps(s, e, toMinutes(r.start), toMinutes(r.end ?? r.start)));
  if (a.blocked.some(hit)) return "blocked";
  if (a.booked.some(hit)) return "booked";
  return "open";
}

export const dayBlocked = (date: string, a: Availability) => a.blocked.some((r) => r.date === date && r.start === null);

/** Taken and closed times between two dates (never who booked them). */
export async function getAvailability(from: string, to: string): Promise<Availability> {
  if (!isSupabaseConfigured) return { booked: [], blocked: [] };
  const { data, error } = await supabase.rpc("booking_availability", { p_from: from, p_to: to });
  if (error || !data) {
    if (error) console.error("Availability failed", error);
    return { booked: [], blocked: [] };
  }
  const a = data as Availability;
  return { booked: a.booked ?? [], blocked: a.blocked ?? [] };
}

/** The database's answer when a website booking hits a taken or closed time. */
export const isSlotTaken = (err: { code?: string } | null | undefined) => err?.code === "23P01";
