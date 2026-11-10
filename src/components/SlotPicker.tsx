import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  BOOKING_HORIZON_DAYS,
  SESSION_MINUTES,
  addDays,
  addMonths,
  dayBlocked,
  getAvailability,
  localToday,
  longDate,
  monthGrid,
  monthKey,
  monthTitle,
  slotLabel,
  slotState,
  slotsFor,
  type Availability,
  setBookingRules,
} from "@/lib/schedule";
import { useBusinessSettings } from "@/lib/content";

const EASE = [0.16, 1, 0.3, 1] as const;
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const empty: Availability = { booked: [], blocked: [] };

/**
 * Month calendar + 1-hour shoot slots. Taken and closed times come from the
 * database; `refreshKey` reloads them (e.g. after someone else took a slot).
 */
export default function SlotPicker({
  date,
  time,
  onChange,
  refreshKey = 0,
}: {
  date: string;
  time: string;
  onChange: (date: string, time: string) => void;
  refreshKey?: number;
}) {
  const { loaded: rulesLoaded, settings } = useBusinessSettings();
  if (rulesLoaded) setBookingRules(settings);
  const today = localToday();
  const last = addDays(today, BOOKING_HORIZON_DAYS);
  const [month, setMonth] = useState(monthKey(date || today));
  const [dir, setDir] = useState(1);
  const [avail, setAvail] = useState<Availability>(empty);
  const [loading, setLoading] = useState(true);

  const cells = useMemo(() => monthGrid(month), [month]);

  useEffect(() => {
    let live = true;
    setLoading(true);
    getAvailability(cells[0], cells[cells.length - 1])
      .then((a) => live && setAvail(a))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [cells, refreshKey]);

  // If the chosen time was taken in the meantime, drop it so the client picks again.
  useEffect(() => {
    if (date && time && !loading && slotState(date, time, avail) !== "open") onChange(date, "");
  }, [avail, loading, date, time, onChange]);

  const openCount = (d: string) =>
    dayBlocked(d, avail) ? 0 : slotsFor(d).filter((t) => slotState(d, t, avail) === "open").length;

  const go = (n: number) => {
    setDir(n);
    setMonth((m) => addMonths(m, n));
  };
  const canBack = month > monthKey(today);
  const canNext = month < monthKey(last);
  const daySlots = date ? slotsFor(date) : [];
  const navBtn =
    "grid h-9 w-9 place-items-center border border-border transition-colors hover:border-foreground disabled:opacity-30 disabled:hover:border-border";

  return (
    <div className="grid border border-border md:grid-cols-[1.15fr_1fr]">
      {/* Month */}
      <div className="border-b border-border p-4 sm:p-5 md:border-b-0 md:border-r">
        <div className="flex items-center justify-between">
          <p className="font-display text-xl font-bold">{monthTitle(month).toUpperCase()}</p>
          <div className="flex gap-2">
            <button type="button" onClick={() => go(-1)} disabled={!canBack} aria-label="Previous month" className={navBtn}>
              <ChevronLeft size={16} />
            </button>
            <button type="button" onClick={() => go(1)} disabled={!canNext} aria-label="Next month" className={navBtn}>
              <ChevronRight size={16} />
            </button>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-7 text-center">
          {WEEKDAYS.map((d) => (
            <span key={d} className="pb-2 text-[10px] font-body font-bold tracking-widest text-muted-foreground">
              {d.toUpperCase()}
            </span>
          ))}
        </div>
        <div className="relative overflow-hidden">
          <AnimatePresence mode="popLayout" initial={false} custom={dir}>
            <motion.div
              key={month}
              custom={dir}
              initial={{ x: dir * 40, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: dir * -40, opacity: 0 }}
              transition={{ duration: 0.35, ease: EASE }}
              className={`grid grid-cols-7 gap-1 transition-opacity ${loading ? "opacity-50" : ""}`}
            >
              {cells.map((d) => {
                const inMonth = monthKey(d) === month;
                const outOfRange = d < today || d > last;
                const free = outOfRange ? 0 : openCount(d);
                const disabled = !inMonth || outOfRange || free === 0;
                const selected = d === date;
                const full = inMonth && !outOfRange && free === 0 && slotsFor(d).length > 0;
                return (
                  <button
                    key={d}
                    type="button"
                    disabled={disabled || loading}
                    onClick={() => onChange(d, "")}
                    aria-pressed={selected}
                    aria-label={`${longDate(d)}${disabled ? " — unavailable" : ` — ${free} slot${free === 1 ? "" : "s"} free`}`}
                    className={`relative flex aspect-square flex-col items-center justify-center text-sm font-body transition-colors duration-200 ${
                      !inMonth
                        ? "invisible"
                        : selected
                          ? "bg-foreground text-background font-bold"
                          : disabled
                            ? "text-muted-foreground/40"
                            : "hover:bg-secondary"
                    }`}
                  >
                    <span className={full ? "line-through decoration-muted-foreground/60" : ""}>{Number(d.slice(8))}</span>
                    {!disabled && <span className={`mt-1 h-1 w-1 rounded-full ${selected ? "bg-background" : "bg-accent"}`} />}
                    {d === today && !selected && <span className="absolute inset-1 border border-border" aria-hidden />}
                  </button>
                );
              })}
            </motion.div>
          </AnimatePresence>
        </div>
        <p className="mt-4 flex items-center gap-2 text-xs font-body text-muted-foreground">
          <span className="h-1 w-1 rounded-full bg-accent" /> Has free times · crossed out = fully booked
        </p>
      </div>

      {/* Slots */}
      <div className="p-4 sm:p-5">
        <p className="text-xs font-body font-bold tracking-widest text-muted-foreground">
          SHOOT TIME · {SESSION_MINUTES / 60} HOUR
        </p>
        <AnimatePresence mode="wait">
          {!date ? (
            <motion.p key="none" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="mt-6 text-sm font-body text-muted-foreground">
              Pick a date to see the available times.
            </motion.p>
          ) : (
            <motion.div
              key={date}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.3, ease: EASE }}
            >
              <p className="mt-2 font-display text-lg font-bold">{longDate(date)}</p>
              <ul data-lenis-prevent className="mt-4 grid max-h-[360px] gap-2 overflow-y-auto overscroll-contain pr-1">
                {daySlots.map((t, i) => {
                  const state = slotState(date, t, avail);
                  const open = state === "open";
                  const active = t === time;
                  return (
                    <motion.li
                      key={t}
                      initial={{ opacity: 0, x: 12 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.03, duration: 0.3, ease: EASE }}
                    >
                      <button
                        type="button"
                        disabled={!open}
                        onClick={() => onChange(date, t)}
                        aria-pressed={active}
                        className={`flex w-full items-center justify-between border px-4 py-3 text-left text-sm font-body transition-colors duration-200 ${
                          active
                            ? "border-foreground bg-foreground text-background"
                            : open
                              ? "border-border hover:border-foreground"
                              : "cursor-not-allowed border-border/60 text-muted-foreground/60"
                        }`}
                      >
                        <span className={open ? "" : "line-through"}>{slotLabel(t)}</span>
                        <span className="text-[10px] font-bold tracking-widest">
                          {active
                            ? "SELECTED"
                            : state === "booked"
                              ? "BOOKED"
                              : state === "blocked"
                                ? "UNAVAILABLE"
                                : state === "past"
                                  ? "PASSED"
                                  : "AVAILABLE"}
                        </span>
                      </button>
                    </motion.li>
                  );
                })}
              </ul>
            </motion.div>
          )}
        </AnimatePresence>
        <p className="mt-5 text-xs font-body text-muted-foreground">
          Times are Mountain Time (Calgary/Edmonton). Once you book, the slot is held for you and no one else can take it.
        </p>
      </div>
    </div>
  );
}
