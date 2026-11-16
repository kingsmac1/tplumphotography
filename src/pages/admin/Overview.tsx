import { useEffect, useMemo, useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import { ArrowUpRight, Baby, Camera, ChevronLeft, ChevronRight, Heart, PartyPopper, Plus, Sparkles, TrendingDown, TrendingUp } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { selectWithPaid, receivedAmount } from "./payment";
import { AnimatedNumber, BarList, PALETTE, compactMoney, money } from "./viz";
import brandLogoWhite from "@/assets/tplum-logo-white.png";
import { OverviewDeliveries, OverviewDeliveryButton } from "@/features/delivery/OverviewDeliveries";

/**
 * Dashboard home. Layout: a main column (coming up · bookings by month + today's schedule · payments in progress ·
 * insights) and a right rail (money collected · calendar · payment status). Tplum's black, white and greys throughout.
 */
type Stream = "Photography" | "Kiddies" | "Wedding" | "Studio space" | "Events";
type Item = {
  stream: Stream;
  created: string;
  /** The day of the shoot, rental or event. */
  date: string | null;
  time: string | null;
  name: string;
  title: string;
  total: number;
  received: number;
  status: "Paid" | "Part Payment" | "Not Paid";
  location: string | null;
  shootType: string | null;
  service: string | null;
};
type NavId = "bookings" | "deliveries" | "finance" | "calendar" | "invoices";

const TZ = "America/Edmonton";
const localToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date());
const asStatus = (s: string | null | undefined): Item["status"] => (s === "Paid" || s === "Part Payment" ? s : "Not Paid");
const dayLabel = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-CA", { timeZone: "UTC", day: "numeric", month: "short" });
const timeLabel = (t: string | null) => {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
};

const card = "rounded-[20px] bg-white shadow-[var(--dash-shadow)]";
const STREAM_ICON: Record<Stream, typeof Camera> = { Photography: Camera, Kiddies: Baby, Wedding: Heart, "Studio space": Camera, Events: PartyPopper };
const STREAM_TINT: Record<Stream, string> = { Photography: "#efefed", Kiddies: "#f3e9e4", Wedding: "#ecebe8", "Studio space": "#efefed", Events: "#e9e9e6" };

const IconChip = ({ stream, size = 40 }: { stream: Stream; size?: number }) => {
  const Icon = STREAM_ICON[stream];
  return (
    <span className="inline-grid place-items-center rounded-xl shrink-0 text-[#0a0a0a]" style={{ width: size, height: size, background: STREAM_TINT[stream] }} aria-hidden="true">
      <Icon size={size * 0.45} strokeWidth={1.75} />
    </span>
  );
};

const SectionHead = ({ title, action }: { title: string; action?: ReactNode }) => (
  <div className="flex items-center justify-between gap-3 mb-3">
    <h2 className="font-display text-xl md:text-2xl text-foreground">{title}</h2>
    {action}
  </div>
);

const TextLink = ({ onClick, children }: { onClick: () => void; children: ReactNode }) => (
  <button onClick={onClick} className="text-xs font-body font-bold text-muted-foreground underline underline-offset-4 hover:text-foreground">{children}</button>
);

const RoundButton = ({ onClick, label, dark }: { onClick: () => void; label: string; dark?: boolean }) => (
  <button onClick={onClick} aria-label={label} title={label}
    className={`inline-grid place-items-center w-7 h-7 rounded-full transition-colors ${dark ? "bg-[#0a0a0a] text-white hover:bg-[#545454]" : "bg-white text-[#0a0a0a] shadow-[var(--dash-shadow)] hover:bg-[#ececea]"}`}>
    <Plus size={15} />
  </button>
);

/** Share of the total that has been paid, as a ring. */
const Ring = ({ pct }: { pct: number }) => {
  const r = 13, c = 2 * Math.PI * r, p = Math.max(0, Math.min(100, pct));
  return (
    <span className="inline-flex items-center gap-2">
      <svg width="34" height="34" viewBox="0 0 34 34" aria-hidden="true">
        <circle cx="17" cy="17" r={r} fill="none" stroke="#ececea" strokeWidth="3.5" />
        <circle cx="17" cy="17" r={r} fill="none" stroke={PALETTE.ink} strokeWidth="3.5" strokeLinecap="round" strokeDasharray={`${(p / 100) * c} ${c}`} transform="rotate(-90 17 17)" />
      </svg>
      <span className="text-sm font-body font-bold w-10 text-right">{Math.round(p)}%</span>
    </span>
  );
};

const STATUS_PILL: Record<Item["status"], string> = {
  Paid: "bg-[#0a0a0a] text-white",
  "Part Payment": "bg-[#e7e7e4] text-[#0a0a0a]",
  "Not Paid": "border border-[#0a0a0a]/25 text-[#0a0a0a]",
};
const STATUS_TEXT: Record<Item["status"], string> = { Paid: "Paid", "Part Payment": "Part paid", "Not Paid": "Not paid" };

/* ---------------- bookings by month (the "activity" chart) ---------------- */
function MonthBars({ months, mode }: { months: { label: string; count: number; collected: number }[]; mode: "count" | "collected" }) {
  const values = months.map((m) => (mode === "count" ? m.count : m.collected));
  const max = Math.max(1, ...values);
  const last = values.length - 1;
  const fmt = (v: number) => (mode === "count" ? `${v} booking${v === 1 ? "" : "s"}` : compactMoney(v));
  return (
    <div className="relative h-[190px] mt-4" role="img" aria-label={`${mode === "count" ? "Bookings" : "Money collected"} per month: ${months.map((m, i) => `${m.label} ${fmt(values[i])}`).join(", ")}`}>
      {[0, 1, 2, 3].map((g) => <div key={g} className="absolute inset-x-0 border-t border-dashed border-[#e4e4e1]" style={{ bottom: 24 + g * 50 }} aria-hidden="true" />)}
      <div className="absolute inset-0 grid items-end" style={{ gridTemplateColumns: `repeat(${months.length}, 1fr)` }}>
        {months.map((m, i) => {
          const h = Math.max(4, (values[i] / max) * 150);
          return (
            <div key={m.label} className="relative flex flex-col items-center justify-end h-full pb-0">
              {i === last && (
                <span className="absolute z-10 whitespace-nowrap rounded-lg bg-[#0a0a0a] text-white text-[11px] font-body px-2.5 py-1.5" style={{ bottom: 24 + h + 10 }}>
                  {fmt(values[i])}
                </span>
              )}
              <motion.span initial={{ height: 0 }} animate={{ height: h }} transition={{ duration: 0.7, delay: 0.1 + i * 0.05, ease: [0.16, 1, 0.3, 1] }}
                className="w-2.5 rounded-full" style={{ background: i === last ? "#545454" : PALETTE.ink }} />
              <span className="h-6 pt-2 text-[11px] font-body text-muted-foreground">{m.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---------------- mini calendar (booking days marked) ---------------- */
function MiniCalendar({ busy, today, onOpen }: { busy: Map<string, number>; today: string; onOpen: () => void }) {
  const [offset, setOffset] = useState(0);
  const [ty, tm] = today.split("-").map(Number);
  const first = new Date(Date.UTC(ty, tm - 1 + offset, 1));
  const y = first.getUTCFullYear(), mo = first.getUTCMonth();
  const startDow = first.getUTCDay();
  const days = new Date(Date.UTC(y, mo + 1, 0)).getUTCDate();
  const prevDays = new Date(Date.UTC(y, mo, 0)).getUTCDate();
  const cells = Array.from({ length: 42 }, (_, i) => {
    const d = i - startDow + 1;
    if (d < 1) return { d: prevDays + d, iso: "", out: true };
    if (d > days) return { d: d - days, iso: "", out: true };
    return { d, iso: `${y}-${String(mo + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`, out: false };
  });
  const rows = cells.slice(35).every((c) => c.out) ? cells.slice(0, 35) : cells;
  return (
    <div className={`${card} p-5`}>
      <div className="flex items-center justify-between mb-4">
        <button onClick={() => setOffset((o) => o - 1)} aria-label="Previous month" className="w-7 h-7 rounded-full grid place-items-center hover:bg-[#efefed]"><ChevronLeft size={16} /></button>
        <p className="font-body font-bold text-sm">{first.toLocaleDateString("en-CA", { month: "long", year: "numeric", timeZone: "UTC" })}</p>
        <button onClick={() => setOffset((o) => o + 1)} aria-label="Next month" className="w-7 h-7 rounded-full grid place-items-center hover:bg-[#efefed]"><ChevronRight size={16} /></button>
      </div>
      <div className="grid grid-cols-7 gap-y-1 text-center text-[11px] font-body">
        {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => <span key={i} className="py-1 font-bold text-muted-foreground bg-[#f4f4f2] first:rounded-l-lg last:rounded-r-lg">{d}</span>)}
        {rows.map((c, i) => {
          const n = c.iso ? busy.get(c.iso) ?? 0 : 0;
          const isToday = c.iso === today;
          return (
            <button key={i} disabled={c.out} onClick={onOpen} title={n ? `${n} booking${n === 1 ? "" : "s"}` : undefined}
              className={`relative mx-auto w-8 h-8 rounded-full text-xs transition-colors ${c.out ? "text-[#c9c9c6]" : isToday ? "bg-[#0a0a0a] text-white font-bold" : n ? "font-bold hover:bg-[#efefed]" : "text-[#3a3a3a] hover:bg-[#efefed]"}`}>
              {c.d}
              {n > 0 && !isToday && <span className="absolute left-1/2 -translate-x-1/2 bottom-1 w-1 h-1 rounded-full bg-[#0a0a0a]" aria-hidden="true" />}
            </button>
          );
        })}
      </div>
      <p className="mt-3 text-[11px] font-body text-muted-foreground flex items-center gap-1.5"><span className="w-1 h-1 rounded-full bg-[#0a0a0a]" aria-hidden="true" /> a day with bookings</p>
    </div>
  );
}

const Overview = ({ pendingReviews: _pendingReviews, onNavigate }: { pendingReviews: number; onNavigate: (id: NavId) => void }) => {
  const [items, setItems] = useState<Item[] | null>(null);
  const [error, setError] = useState("");
  const [chart, setChart] = useState<"count" | "collected">("count");
  const [payFilter, setPayFilter] = useState<"owing" | "all">("owing");

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      selectWithPaid("bookings", "created_at, shoot_date, shoot_time, grand_total, payment_status, location, selected_service, shoot_type, full_name, source, status"),
      selectWithPaid("studio_bookings", "created_at, rental_date, rental_time, grand_total, payment_status, full_name, space_name"),
      selectWithPaid("event_bookings", "created_at, event_start_date, event_time, agreed_amount, payment_status, full_name, event_type"),
    ]).then(([b, s, e]) => {
      if (cancelled) return;
      const err = b.error || s.error || e.error;
      if (err) setError(err.message);
      setItems([
        ...(b.data ?? []).filter((r) => r.status !== "cancelled" && r.status !== "pending_payment").map((r): Item => ({
          stream: r.source === "wedding_form" ? "Wedding" : r.source === "kiddies_form" ? "Kiddies" : "Photography", created: r.created_at, date: r.shoot_date, time: r.shoot_time,
          name: r.full_name ?? "", title: r.selected_service || r.shoot_type || "Session", total: Number(r.grand_total) || 0,
          received: receivedAmount(r.payment_status, r.grand_total, r.amount_paid), status: asStatus(r.payment_status),
          location: r.location, shootType: r.shoot_type, service: r.selected_service,
        })),
        ...(s.data ?? []).map((r): Item => ({
          stream: "Studio space", created: r.created_at, date: r.rental_date, time: r.rental_time, name: r.full_name ?? "", title: r.space_name || "Studio rental",
          total: Number(r.grand_total) || 0, received: receivedAmount(r.payment_status, r.grand_total, r.amount_paid), status: asStatus(r.payment_status),
          location: null, shootType: null, service: null,
        })),
        ...(e.data ?? []).map((r): Item => ({
          stream: "Events", created: r.created_at, date: r.event_start_date, time: r.event_time, name: r.full_name ?? "", title: r.event_type || "Event",
          total: Number(r.agreed_amount) || 0, received: receivedAmount(r.payment_status, r.agreed_amount, r.amount_paid), status: asStatus(r.payment_status),
          location: null, shootType: null, service: null,
        })),
      ]);
    });
    return () => { cancelled = true; };
  }, []);

  const m = useMemo(() => {
    const data = items ?? [];
    const today = localToday();
    const booked = data.reduce((s, i) => s + i.total, 0);
    const collected = data.reduce((s, i) => s + i.received, 0);
    const [y, mo] = today.split("-").map(Number);
    const months = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(Date.UTC(y, mo - 1 - (6 - i), 1));
      return { key: d.toISOString().slice(0, 7), label: d.toLocaleString("en-CA", { month: "short", timeZone: "UTC" }), count: 0, collected: 0 };
    });
    data.forEach((i) => {
      const slot = months.find((x) => x.key === i.created.slice(0, 7));
      if (slot) { slot.count += 1; slot.collected += i.received; }
    });
    const upcoming = data.filter((i) => i.date && i.date >= today).sort((a, b) => (a.date! + (a.time ?? "")).localeCompare(b.date! + (b.time ?? "")));
    const busy = new Map<string, number>();
    data.forEach((i) => { if (i.date) busy.set(i.date, (busy.get(i.date) ?? 0) + 1); });
    const tally = (pick: (i: Item) => string | null, n: number) => {
      const map = new Map<string, number>();
      data.forEach((i) => { const k = pick(i); if (k) map.set(k, (map.get(k) || 0) + 1); });
      return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([label, value]) => ({ label, value }));
    };
    const recent = [...data].sort((a, b) => b.created.localeCompare(a.created));
    const cur = months[6], prev = months[5];
    return {
      today, booked, collected, outstanding: Math.max(booked - collected, 0), months, upcoming, busy, recent,
      monthChange: prev.count ? Math.round(((cur.count - prev.count) / prev.count) * 100) : null,
      owing: recent.filter((i) => i.total > 0 && i.received < i.total),
      shootTypes: tally((i) => i.shootType, 5),
      packages: tally((i) => i.service, 5),
      total: data.length,
    };
  }, [items]);

  if (items === null) {
    return (
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-5">{[0, 1, 2].map((i) => <div key={i} className="h-40 rounded-[20px] bg-white/70 animate-pulse" />)}</div>
        <div className="space-y-5">{[0, 1].map((i) => <div key={i} className="h-56 rounded-[20px] bg-white/70 animate-pulse" />)}</div>
      </div>
    );
  }

  const next3 = m.upcoming.slice(0, 3);
  const schedule = m.upcoming.slice(0, 4);
  const payments = (payFilter === "owing" ? m.owing : m.recent).slice(0, 4);

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px] items-start">
      {/* ================= main column ================= */}
      <div className="space-y-6 min-w-0">
        {error && <p className="text-sm text-destructive font-body">{error}</p>}

        {/* Coming up: the next three bookings */}
        <section>
          <SectionHead title="Coming up" action={<TextLink onClick={() => onNavigate("calendar")}>View calendar</TextLink>} />
          {next3.length === 0 ? (
            <div className={`${card} p-6 flex flex-wrap items-center justify-between gap-4`}>
              <div>
                <p className="font-body font-bold">Nothing booked yet</p>
                <p className="text-sm text-muted-foreground font-body mt-1">New bookings from the website show up here as soon as they arrive.</p>
              </div>
              <a href="/book/" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-full bg-[#0a0a0a] text-white px-4 py-2 text-xs font-body font-bold">Open the booking page <ArrowUpRight size={14} /></a>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {next3.map((i, idx) => (
                <motion.button key={idx} onClick={() => onNavigate("bookings")} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.06 }}
                  className={`${card} p-4 text-left hover:-translate-y-0.5 transition-transform`}>
                  <div className="flex items-center gap-3">
                    <IconChip stream={i.stream} />
                    <div className="min-w-0">
                      <p className="text-sm font-body font-bold truncate">{i.name || "—"}</p>
                      <p className="text-xs font-body text-muted-foreground truncate">{i.title}</p>
                    </div>
                  </div>
                  <dl className="grid grid-cols-2 gap-2 mt-4 text-xs font-body">
                    <div><dt className="text-muted-foreground">Date</dt><dd className="font-bold mt-0.5">{dayLabel(i.date!)}{i.time ? `, ${timeLabel(i.time)}` : ""}</dd></div>
                    <div><dt className="text-muted-foreground">Total</dt><dd className="font-bold mt-0.5">{money(i.total)}</dd></div>
                  </dl>
                </motion.button>
              ))}
            </div>
          )}
        </section>

        <OverviewDeliveries onOpen={() => onNavigate("deliveries")} />

        {/* Activity chart + today's schedule */}
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
          <section className={`${card} p-5`}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-display text-xl">Bookings activity</h2>
                {m.monthChange !== null && (
                  <p className="mt-2 inline-flex items-center gap-2 text-xs font-body text-muted-foreground">
                    <span className="inline-grid place-items-center w-6 h-6 rounded-lg bg-[#efefed] text-[#0a0a0a]">{m.monthChange >= 0 ? <TrendingUp size={13} /> : <TrendingDown size={13} />}</span>
                    <b className="text-foreground">{m.monthChange >= 0 ? "+" : ""}{m.monthChange}%</b> new bookings vs last month
                  </p>
                )}
              </div>
              <select value={chart} onChange={(e) => setChart(e.target.value as "count" | "collected")} aria-label="Chart shows"
                className="rounded-full border border-border bg-white px-3 py-1.5 text-xs font-body">
                <option value="count">Bookings</option>
                <option value="collected">Collected</option>
              </select>
            </div>
            <MonthBars months={m.months} mode={chart} />
          </section>

          <section className={`${card} p-5`}>
            <h2 className="font-display text-xl mb-4">Schedule</h2>
            {schedule.length === 0 ? <p className="text-sm text-muted-foreground font-body py-8 text-center">No sessions coming up.</p> : (
              <ul className="space-y-3">
                {schedule.map((i, idx) => (
                  <li key={idx}>
                    <button onClick={() => onNavigate("bookings")} className="w-full flex items-center gap-3 text-left group">
                      <IconChip stream={i.stream} size={38} />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-body font-bold truncate">{i.title}</span>
                        <span className="block text-xs font-body text-muted-foreground truncate">{i.name} · {dayLabel(i.date!)}{i.time ? `, ${timeLabel(i.time)}` : ""}</span>
                      </span>
                      <span className="w-7 h-7 rounded-full grid place-items-center bg-[#efefed] group-hover:bg-[#0a0a0a] group-hover:text-white transition-colors"><ChevronRight size={14} /></span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        {/* Payments in progress */}
        <section>
          <SectionHead title="Payments" action={
            <div className="flex items-center gap-2">
              <select value={payFilter} onChange={(e) => setPayFilter(e.target.value as "owing" | "all")} aria-label="Show"
                className="rounded-full border border-border bg-white px-3 py-1.5 text-xs font-body">
                <option value="owing">Balance owing</option>
                <option value="all">Latest</option>
              </select>
              <RoundButton dark label="New invoice" onClick={() => { window.location.hash = "#invoices/new"; }} />
            </div>
          } />
          {payments.length === 0 ? (
            <div className={`${card} p-6 text-sm text-muted-foreground font-body`}>{payFilter === "owing" ? "Nobody owes a balance right now." : "No bookings yet."}</div>
          ) : (
            <ul className="space-y-3">
              {payments.map((i, idx) => (
                <li key={idx} className={`${card} p-4 grid grid-cols-[auto_minmax(0,1fr)_auto] sm:grid-cols-[auto_minmax(0,1.4fr)_minmax(0,1fr)_auto] items-center gap-4`}>
                  <IconChip stream={i.stream} />
                  <div className="min-w-0">
                    <p className="text-sm font-body font-bold truncate">{i.name || "—"}</p>
                    <p className="text-xs font-body text-muted-foreground truncate">{i.title}{i.date ? ` · ${dayLabel(i.date)}` : ""}</p>
                  </div>
                  <div className="hidden sm:block text-xs font-body">
                    <p className="text-muted-foreground">Balance</p>
                    <p className="font-bold mt-0.5">{money(Math.max(0, i.total - i.received))} <span className="font-normal text-muted-foreground">of {money(i.total)}</span></p>
                  </div>
                  <Ring pct={i.total ? (i.received / i.total) * 100 : 0} />
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Insights */}
        {m.total > 0 ? (
          <div className="grid gap-5 md:grid-cols-2">
            <section className={`${card} p-5`}><h2 className="font-display text-xl mb-4">Shoot types</h2><BarList items={m.shootTypes} color={PALETTE.ink} /></section>
            <section className={`${card} p-5`}><h2 className="font-display text-xl mb-4">Favourite packages</h2><BarList items={m.packages} color="#545454" /></section>
          </div>
        ) : (
          <p className="text-center text-sm text-muted-foreground font-body inline-flex items-center justify-center gap-2 w-full"><Sparkles size={14} /> Charts fill in as bookings arrive from the website.</p>
        )}
      </div>

      {/* ================= right rail ================= */}
      <aside className="space-y-5 min-w-0">
        <motion.section initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
          className="relative overflow-hidden rounded-[20px] bg-[#0a0a0a] text-white p-5">
          <img src={brandLogoWhite} alt="" aria-hidden className="pointer-events-none absolute -right-6 -bottom-8 h-36 opacity-[0.08]" />
          <img src={brandLogoWhite} alt="Tplum Photography" className="h-7 w-auto relative" />
          <p className="relative mt-5 text-xs font-body text-white/60">Collected, all time</p>
          <p className="relative font-display text-4xl mt-1"><AnimatedNumber value={m.collected} format={money} /></p>
          <p className="relative mt-2 text-xs font-body text-white/60">Booked {compactMoney(m.booked)} · Owing {compactMoney(m.outstanding)}</p>
          <div className="relative mt-5 flex flex-wrap gap-2">
            <button onClick={() => onNavigate("finance")} className="rounded-full bg-white text-[#0a0a0a] px-4 py-2 text-xs font-body font-bold hover:bg-[#ececea]">Open finance</button>
            <OverviewDeliveryButton onOpen={() => onNavigate("deliveries")} />
          </div>
        </motion.section>

        <MiniCalendar busy={m.busy} today={m.today} onOpen={() => onNavigate("calendar")} />

        <section>
          <SectionHead title="Payment status" action={<RoundButton label="Open bookings" onClick={() => onNavigate("bookings")} />} />
          {m.recent.length === 0 ? <div className={`${card} p-5 text-sm text-muted-foreground font-body`}>No bookings yet.</div> : (
            <ul className="space-y-3">
              {m.recent.slice(0, 4).map((i, idx) => (
                <li key={idx} className={`${card} p-3.5 flex items-center gap-3`}>
                  <IconChip stream={i.stream} size={36} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-body font-bold truncate">{i.name || i.title}</p>
                    <p className="text-[11px] font-body text-muted-foreground truncate">{i.date ? `${dayLabel(i.date)}${i.time ? `, ${timeLabel(i.time)}` : ""}` : i.title}</p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-body font-bold ${STATUS_PILL[i.status]}`}>{STATUS_TEXT[i.status]}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </aside>
    </div>
  );
};

export default Overview;
