import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Building2, ChevronLeft, ChevronRight, Lock, PartyPopper, Plus, Trash2, Unlock } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import {
  SESSION_MINUTES,
  addDays,
  addMonths,
  fromMinutes,
  localNowMinutes,
  localToday,
  longDate,
  monthGrid,
  monthKey,
  monthTitle,
  overlaps,
  shortDate,
  slotLabel,
  slotsFor,
  toMinutes,
} from "@/lib/schedule";
import { Panel } from "./viz";
import ManualBookingForm from "./ManualBookingForm";

interface Booking {
  id: string;
  full_name: string;
  phone: string | null;
  shoot_type: string | null;
  selected_service: string | null;
  shoot_date: string;
  shoot_time: string;
  duration_minutes: number | null;
  payment_status: string | null;
}
interface Block {
  id: string;
  block_date: string;
  start_time: string | null;
  end_time: string | null;
  reason: string | null;
}
interface StudioRental {
  id: string;
  full_name: string;
  space_name: string | null;
  rental_date: string;
  rental_time: string | null;
}
interface EventBooking {
  id: string;
  full_name: string;
  event_type: string | null;
  event_start_date: string;
  event_end_date: string | null;
}

const EASE = [0.16, 1, 0.3, 1] as const;
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const hatch =
  "bg-[repeating-linear-gradient(135deg,rgba(10,10,10,0.08)_0,rgba(10,10,10,0.08)_2px,transparent_2px,transparent_7px)]";
const inputCls = "w-full border border-border bg-background px-3 py-2.5 text-sm font-body focus:outline-none focus:border-foreground";
const labelCls = "block text-[10px] font-body font-bold tracking-widest text-muted-foreground mb-1.5";
const btnGhost =
  "inline-flex items-center justify-center gap-1.5 border border-border px-3 py-1.5 text-xs font-body font-bold tracking-wider hover:border-foreground transition-colors disabled:opacity-40";
const btnSolid =
  "inline-flex items-center justify-center gap-1.5 bg-foreground text-background px-3 py-1.5 text-xs font-body font-bold tracking-wider hover:opacity-85 transition-opacity disabled:opacity-40";

const mins = (t: string | null) => (t ? toMinutes(t.slice(0, 5)) : 0);

const friendly = (err: { code?: string; message: string }) =>
  err.code === "42P01" || err.code === "42703" || err.code === "PGRST205" || err.code === "PGRST204"
    ? "The calendar isn't set up in the database yet. Run supabase/booking-calendar.sql in the Supabase SQL Editor."
    : err.message;

/** Month view of shoot slots: who's booked when, and which days or hours are closed to clients. */
export default function CalendarSection() {
  const today = localToday();
  const [month, setMonth] = useState(monthKey(today));
  const [dir, setDir] = useState(1);
  const [day, setDay] = useState(today);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [studio, setStudio] = useState<StudioRental[]>([]);
  const [events, setEvents] = useState<EventBooking[]>([]);
  const [upcomingBlocks, setUpcomingBlocks] = useState<Block[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState("");
  const [adding, setAdding] = useState<string | null>(null);

  const cells = useMemo(() => monthGrid(month), [month]);

  const load = useCallback(async () => {
    const from = cells[0];
    const to = cells[cells.length - 1];
    const [b, x, s, e, u] = await Promise.all([
      supabase
        .from("bookings")
        .select("id, full_name, phone, shoot_type, selected_service, shoot_date, shoot_time, duration_minutes, payment_status")
        .gte("shoot_date", from)
        .lte("shoot_date", to)
        .not("shoot_time", "is", null),
      supabase.from("blocked_slots").select("*").gte("block_date", from).lte("block_date", to),
      supabase.from("studio_bookings").select("id, full_name, space_name, rental_date, rental_time").gte("rental_date", from).lte("rental_date", to),
      supabase.from("event_bookings").select("id, full_name, event_type, event_start_date, event_end_date").lte("event_start_date", to).gte("event_start_date", addDays(from, -30)),
      supabase.from("blocked_slots").select("*").gte("block_date", today).order("block_date").limit(60),
    ]);
    const err = b.error ?? x.error ?? u.error;
    setError(err ? friendly(err) : "");
    setBookings((b.data as Booking[]) ?? []);
    setBlocks((x.data as Block[]) ?? []);
    setStudio((s.data as StudioRental[]) ?? []);
    setEvents((e.data as EventBooking[]) ?? []);
    setUpcomingBlocks((u.data as Block[]) ?? []);
    setLoading(false);
  }, [cells, today]);

  useEffect(() => {
    void load();
  }, [load]);

  const go = (n: number) => {
    setDir(n);
    setMonth((m) => addMonths(m, n));
  };

  /* ------------------------------ Day model ------------------------------ */

  const dayInfo = (d: string) => {
    const closed = blocks.filter((b) => b.block_date === d && !b.start_time);
    const slots = slotsFor(d).map((t) => {
      const s = toMinutes(t);
      const e = s + SESSION_MINUTES;
      const taken = bookings.filter(
        (b) => b.shoot_date === d && overlaps(s, e, mins(b.shoot_time), mins(b.shoot_time) + (b.duration_minutes || SESSION_MINUTES)),
      );
      const block = blocks.find((b) => b.block_date === d && b.start_time && overlaps(s, e, mins(b.start_time), mins(b.end_time)));
      const past = d < today || (d === today && s <= localNowMinutes());
      return { time: t, taken, block, past };
    });
    return {
      closed,
      slots,
      booked: slots.filter((x) => x.taken.length).length,
      studio: studio.filter((x) => x.rental_date === d),
      events: events.filter((x) => x.event_start_date <= d && (x.event_end_date ?? x.event_start_date) >= d),
      // Bookings outside opening hours still show, so nothing goes missing.
      offGrid: bookings.filter((b) => b.shoot_date === d && !slots.some((x) => x.taken.some((t) => t.id === b.id))),
    };
  };

  const info = dayInfo(day);
  const dayClosed = info.closed.length > 0;

  /* ------------------------------- Actions ------------------------------- */

  const run = async (fn: () => PromiseLike<{ error: { code?: string; message: string } | null }>) => {
    setBusy(true);
    const { error: err } = await fn();
    setBusy(false);
    if (err) setError(friendly(err));
    else {
      setError("");
      await load();
    }
  };

  const toggleDay = async (open: boolean) => {
    if (open) await run(() => supabase.from("blocked_slots").delete().in("id", info.closed.map((c) => c.id)));
    else {
      await run(() => supabase.from("blocked_slots").insert({ block_date: day, reason: reason.trim() || null }));
      setReason("");
    }
  };

  const closeSlot = (t: string) =>
    run(() =>
      supabase.from("blocked_slots").insert({
        block_date: day,
        start_time: t,
        end_time: fromMinutes(toMinutes(t) + SESSION_MINUTES),
        reason: reason.trim() || null,
      }),
    );

  const reopen = (id: string) => run(() => supabase.from("blocked_slots").delete().eq("id", id));

  /* --------------------------- Range closure form -------------------------- */

  const [rangeFrom, setRangeFrom] = useState("");
  const [rangeTo, setRangeTo] = useState("");
  const [rangeReason, setRangeReason] = useState("");
  const closeRange = async () => {
    if (!rangeFrom) return setError("Choose the first date to close.");
    const end = rangeTo || rangeFrom;
    if (end < rangeFrom) return setError("The end date is before the start date.");
    const dates: string[] = [];
    for (let d = rangeFrom; d <= end && dates.length < 120; d = addDays(d, 1)) dates.push(d);
    await run(() => supabase.from("blocked_slots").insert(dates.map((d) => ({ block_date: d, reason: rangeReason.trim() || null }))));
    setRangeFrom("");
    setRangeTo("");
    setRangeReason("");
  };

  /* -------------------------------- Render -------------------------------- */

  const monthStats = useMemo(() => {
    const inMonth = cells.filter((d) => monthKey(d) === month && d >= today);
    let open = 0;
    let taken = 0;
    for (const d of inMonth) {
      const i = dayInfo(d);
      if (i.closed.length) continue;
      for (const s of i.slots) {
        if (s.past || s.block) continue;
        if (s.taken.length) taken += 1;
        else open += 1;
      }
    }
    return { open, taken, closedDays: inMonth.filter((d) => blocks.some((b) => b.block_date === d && !b.start_time)).length };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cells, month, bookings, blocks, today]);

  return (
    <div className="space-y-6">
      {error && <p className="border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm font-body text-destructive">{error}</p>}

      {/* Month header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="overflow-hidden">
          <AnimatePresence mode="wait" initial={false}>
            <motion.h2
              key={month}
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "-100%" }}
              transition={{ duration: 0.4, ease: EASE }}
              className="font-display text-3xl md:text-4xl font-bold uppercase"
            >
              {monthTitle(month)}
            </motion.h2>
          </AnimatePresence>
          <p className="mt-1 text-xs font-body text-muted-foreground">
            {monthStats.taken} hour{monthStats.taken === 1 ? "" : "s"} booked · {monthStats.open} slot{monthStats.open === 1 ? "" : "s"} open ·{" "}
            {monthStats.closedDays} day{monthStats.closedDays === 1 ? "" : "s"} closed
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            className={`${btnGhost} !py-2.5`}
            onClick={() => {
              setDir(monthKey(today) < month ? -1 : 1);
              setMonth(monthKey(today));
              setDay(today);
            }}
          >
            TODAY
          </button>
          <button className={`${btnGhost} !p-2.5`} onClick={() => go(-1)} aria-label="Previous month">
            <ChevronLeft size={16} />
          </button>
          <button className={`${btnGhost} !p-2.5`} onClick={() => go(1)} aria-label="Next month">
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.55fr_1fr]">
        {/* Month grid */}
        <Panel className="!p-3 sm:!p-5 xl:self-start">
          <div className="grid grid-cols-7 pb-2 text-center">
            {WEEKDAYS.map((d) => (
              <span key={d} className="text-[10px] font-body font-bold tracking-widest text-muted-foreground">
                {d.toUpperCase()}
              </span>
            ))}
          </div>
          <div className="relative overflow-hidden">
            <AnimatePresence mode="popLayout" initial={false} custom={dir}>
              <motion.div
                key={month}
                initial={{ x: dir * 60, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: dir * -60, opacity: 0 }}
                transition={{ duration: 0.45, ease: EASE }}
                className={`grid grid-cols-7 gap-1 sm:gap-1.5 ${loading ? "opacity-50" : ""}`}
              >
                {cells.map((d) => {
                  const inMonth = monthKey(d) === month;
                  const di = dayInfo(d);
                  const closed = di.closed.length > 0;
                  const selected = d === day;
                  const past = d < today;
                  return (
                    <button
                      key={d}
                      onClick={() => {
                        if (!inMonth) {
                          setDir(d < `${month}-01` ? -1 : 1);
                          setMonth(monthKey(d));
                        }
                        setDay(d);
                      }}
                      style={{ opacity: !inMonth ? 0.35 : past && !selected ? 0.6 : 1 }}
                      className={`relative flex min-h-[60px] flex-col border p-1.5 text-left font-body transition-colors sm:min-h-[92px] sm:p-2.5 ${
                        selected
                          ? "border-foreground bg-foreground text-background"
                          : closed
                            ? `border-border ${hatch} bg-secondary`
                            : inMonth
                              ? "border-border hover:border-foreground"
                              : "border-transparent"
                      }`}
                    >
                      <span className="flex items-center justify-between">
                        <span
                          className={`grid h-6 w-6 place-items-center text-xs font-bold sm:text-sm ${
                            d === today && !selected ? "bg-foreground text-background" : ""
                          }`}
                        >
                          {Number(d.slice(8))}
                        </span>
                        <span className="flex gap-0.5">
                          {di.events.length > 0 && <PartyPopper size={11} className="opacity-70" />}
                          {di.studio.length > 0 && <Building2 size={11} className="opacity-70" />}
                        </span>
                      </span>
                      {closed ? (
                        <span className="mt-auto hidden items-center gap-1 text-[9px] font-bold tracking-widest sm:inline-flex">
                          <Lock size={10} /> CLOSED
                        </span>
                      ) : (
                        <>
                          <span className="mt-auto flex gap-[2px]">
                            {di.slots.map((s) => (
                              <span
                                key={s.time}
                                className={`h-1.5 flex-1 ${
                                  s.taken.length
                                    ? selected ? "bg-background" : "bg-accent"
                                    : s.block
                                      ? selected ? "bg-background/40" : "bg-muted-foreground/50"
                                      : selected ? "bg-background/15" : "bg-border"
                                }`}
                              />
                            ))}
                          </span>
                          {di.booked > 0 && (
                            <span className={`mt-1 hidden text-[10px] sm:block ${selected ? "text-background/70" : "text-muted-foreground"}`}>
                              {di.booked}/{di.slots.length} booked
                            </span>
                          )}
                        </>
                      )}
                    </button>
                  );
                })}
              </motion.div>
            </AnimatePresence>
          </div>
          <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-[11px] font-body text-muted-foreground">
            <Legend swatch="bg-accent" label="Booked" />
            <Legend swatch="bg-muted-foreground/50" label="Slot closed" />
            <Legend swatch="bg-border" label="Open" />
            <span className="inline-flex items-center gap-1.5">
              <span className={`h-3 w-4 ${hatch} bg-secondary`} /> Day closed
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Building2 size={11} /> Studio rental
            </span>
            <span className="inline-flex items-center gap-1.5">
              <PartyPopper size={11} /> Event
            </span>
          </div>
        </Panel>

        {/* Day panel */}
        <div className="space-y-6 xl:sticky xl:top-8 xl:self-start">
          <AnimatePresence mode="wait">
            <motion.section
              key={day}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.35, ease: EASE }}
              className="border border-border bg-background p-5 sm:p-6"
            >
              <p className={labelCls}>{day === today ? "TODAY" : day < today ? "PAST DATE" : "SELECTED DAY"}</p>
              <h3 className="font-display text-2xl font-bold leading-tight">{longDate(day)}</h3>

              <div className="mt-4 flex items-center justify-between gap-3 bg-secondary px-4 py-3">
                <div>
                  <p className="text-sm font-body font-bold">{dayClosed ? "Closed for bookings" : "Open for bookings"}</p>
                  <p className="text-xs font-body text-muted-foreground">
                    {dayClosed
                      ? info.closed[0]?.reason || "Clients can't pick this date."
                      : `${info.slots.filter((s) => !s.taken.length && !s.block && !s.past).length} slot(s) clients can still pick`}
                  </p>
                </div>
                <Switch on={!dayClosed} disabled={busy} onChange={(v) => void toggleDay(v)} label="Open for bookings" />
              </div>

              {!dayClosed && (
                <label className="mt-3 block">
                  <span className={labelCls}>REASON WHEN CLOSING (OPTIONAL, ONLY ADMINS SEE IT)</span>
                  <input className={inputCls} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Outdoor shoot, public holiday" />
                </label>
              )}

              <ul data-lenis-prevent className="mt-5 max-h-[520px] space-y-2 overflow-y-auto overscroll-contain pr-1">
                {info.slots.map((s, i) => {
                  const taken = s.taken[0];
                  return (
                    <motion.li
                      key={s.time}
                      initial={{ opacity: 0, x: 14 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.04 + i * 0.03, duration: 0.3, ease: EASE }}
                      className={`flex items-center gap-3 border px-4 py-3 font-body ${
                        taken ? "border-foreground bg-foreground text-background" : s.block || dayClosed ? `border-border ${hatch}` : "border-border"
                      } ${s.past ? "opacity-55" : ""}`}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold">{slotLabel(s.time)}</p>
                        {taken ? (
                          <p className="truncate text-xs text-background/70">
                            {s.taken.map((b) => b.full_name).join(", ")} · {taken.selected_service || taken.shoot_type || "Shoot"}
                            {taken.payment_status ? ` · ${taken.payment_status.toLowerCase()}` : ""}
                          </p>
                        ) : s.block ? (
                          <p className="truncate text-xs text-muted-foreground">Closed{s.block.reason ? ` · ${s.block.reason}` : ""}</p>
                        ) : (
                          <p className="text-xs text-muted-foreground">{dayClosed ? "Day closed" : s.past ? "Passed" : "Open"}</p>
                        )}
                      </div>
                      {!taken && !s.past && !dayClosed &&
                        (s.block ? (
                          <button disabled={busy} onClick={() => void reopen(s.block!.id)} className={btnGhost} title="Reopen this slot">
                            <Unlock size={13} /> OPEN
                          </button>
                        ) : (
                          <div className="flex gap-1.5">
                            <button disabled={busy} onClick={() => void closeSlot(s.time)} className={btnGhost} title="Make this slot unavailable">
                              <Lock size={13} /> CLOSE
                            </button>
                            <button onClick={() => setAdding(s.time)} className={btnSolid} title="Book this slot for a client">
                              <Plus size={13} /> BOOK
                            </button>
                          </div>
                        ))}
                    </motion.li>
                  );
                })}
                {info.slots.length === 0 && <li className="text-sm font-body text-muted-foreground">No shoot slots on this weekday.</li>}
              </ul>

              {(info.offGrid.length > 0 || info.studio.length > 0 || info.events.length > 0) && (
                <div className="mt-5 border-t border-border pt-4">
                  <p className={labelCls}>ALSO ON THIS DAY</p>
                  <ul className="space-y-1.5 text-sm font-body">
                    {info.offGrid.map((b) => (
                      <li key={b.id}>
                        {b.shoot_time.slice(0, 5)} · {b.full_name} (outside the slot times)
                      </li>
                    ))}
                    {info.studio.map((x) => (
                      <li key={x.id} className="flex items-center gap-2">
                        <Building2 size={13} className="text-muted-foreground" />
                        {x.rental_time ? `${x.rental_time.slice(0, 5)} · ` : ""}
                        {x.space_name ?? "Studio rental"} · {x.full_name}
                      </li>
                    ))}
                    {info.events.map((x) => (
                      <li key={x.id} className="flex items-center gap-2">
                        <PartyPopper size={13} className="text-muted-foreground" />
                        {x.event_type ?? "Event"} · {x.full_name}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </motion.section>
          </AnimatePresence>

          {/* Close a range */}
          <Panel title="Close several days" sub="Holidays, travel or a full-day job. Existing bookings stay as they are.">
            <div className="grid grid-cols-2 gap-3">
              <label>
                <span className={labelCls}>FROM</span>
                <input type="date" min={today} className={inputCls} value={rangeFrom} onChange={(e) => setRangeFrom(e.target.value)} />
              </label>
              <label>
                <span className={labelCls}>TO</span>
                <input type="date" min={rangeFrom || today} className={inputCls} value={rangeTo} onChange={(e) => setRangeTo(e.target.value)} />
              </label>
              <label className="col-span-2">
                <span className={labelCls}>REASON (OPTIONAL)</span>
                <input className={inputCls} value={rangeReason} onChange={(e) => setRangeReason(e.target.value)} placeholder="e.g. Christmas break" />
              </label>
            </div>
            <button className={`${btnSolid} mt-4 w-full !py-3`} disabled={busy} onClick={() => void closeRange()}>
              <Lock size={14} /> CLOSE THESE DATES
            </button>
          </Panel>
        </div>
      </div>

      {/* Upcoming closures */}
      <Panel title="Upcoming closures" sub="Everything clients currently can't pick, soonest first">
        {upcomingBlocks.length === 0 ? (
          <p className="py-4 text-center text-sm font-body text-muted-foreground">No dates or slots are closed. Every slot is open for booking.</p>
        ) : (
          <ul className="divide-y divide-border">
            {upcomingBlocks.map((b) => (
              <li key={b.id} className="flex items-center gap-3 py-2.5 font-body">
                <button
                  onClick={() => {
                    setMonth(monthKey(b.block_date));
                    setDay(b.block_date);
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                  className="min-w-0 flex-1 text-left"
                >
                  <p className="text-sm font-bold">
                    {shortDate(b.block_date)} · {b.start_time ? slotLabel(b.start_time.slice(0, 5), mins(b.end_time) - mins(b.start_time)) : "Whole day"}
                  </p>
                  {b.reason && <p className="truncate text-xs text-muted-foreground">{b.reason}</p>}
                </button>
                <button disabled={busy} onClick={() => void reopen(b.id)} className={`${btnGhost} !p-2`} title="Reopen" aria-label="Reopen">
                  <Trash2 size={14} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      {adding && (
        <ManualBookingForm
          initial={{ shoot_date: day, shoot_time: adding }}
          onClose={() => setAdding(null)}
          onSuccess={() => {
            setAdding(null);
            void load();
          }}
        />
      )}
    </div>
  );
}

const Legend = ({ swatch, label }: { swatch: string; label: string }) => (
  <span className="inline-flex items-center gap-1.5">
    <span className={`h-1.5 w-4 ${swatch}`} /> {label}
  </span>
);

const Switch = ({ on, onChange, label, disabled }: { on: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) => (
  <button
    type="button"
    role="switch"
    aria-checked={on}
    aria-label={label}
    disabled={disabled}
    onClick={() => onChange(!on)}
    className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50 ${on ? "bg-foreground" : "bg-muted-foreground/40"}`}
  >
    <span className={`absolute left-0 top-0.5 h-5 w-5 rounded-full bg-background shadow transition-transform ${on ? "translate-x-[22px]" : "translate-x-0.5"}`} />
  </button>
);
