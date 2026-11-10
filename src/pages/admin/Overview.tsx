import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { CalendarClock, MessageSquareQuote, Sparkles } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { selectWithPaid, receivedAmount } from "./payment";
import { AnimatedNumber, BarList, ColumnChart, Donut, PALETTE, Panel, Sparkline, TrendChart, compactMoney, money } from "./viz";
import brandLogoWhite from "@/assets/tplum-logo-white.png";
import { OverviewDeliveries, OverviewDeliveryButton } from "@/features/delivery/OverviewDeliveries";

type Stream = "Photography" | "Wedding" | "Studio space" | "Events";
type Item = {
  stream: Stream;
  created: string;
  /** The day of the shoot, rental or event (none for academy). */
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

const localToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Edmonton" }).format(new Date());
const greeting = () => {
  const h = Number(new Intl.DateTimeFormat("en-CA", { timeZone: "America/Edmonton", hour: "2-digit", hourCycle: "h23" }).format(new Date()));
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
};
const asStatus = (s: string | null | undefined): Item["status"] => (s === "Paid" || s === "Part Payment" ? s : "Not Paid");

const Kpi = ({ label, value, format, spark, color, delay }: { label: string; value: number; format?: (n: number) => string; spark?: number[]; color?: string; delay: number }) => (
  <Panel delay={delay} className="!p-5 overflow-hidden relative">
    <p className="text-[11px] font-body font-bold tracking-widest text-muted-foreground">{label}</p>
    <p className="font-display text-3xl font-bold mt-2 text-foreground"><AnimatedNumber value={value} format={format} /></p>
    {spark && <div className="-mx-5 -mb-5 mt-3"><Sparkline values={spark} color={color} /></div>}
  </Panel>
);

const Overview = ({ pendingReviews, onNavigate }: { pendingReviews: number; onNavigate: (id: "bookings" | "deliveries" | "finance" | "calendar" | "invoices") => void }) => {
  const [items, setItems] = useState<Item[] | null>(null);
  const [error, setError] = useState("");

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
      const all: Item[] = [
        ...(b.data ?? []).filter((r) => r.status !== "cancelled" && r.status !== "pending_payment").map((r): Item => ({
          stream: r.source === "wedding_form" ? "Wedding" : "Photography", created: r.created_at, date: r.shoot_date, time: r.shoot_time,
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
      ];
      setItems(all);
    });
    return () => { cancelled = true; };
  }, []);

  const m = useMemo(() => {
    const data = items ?? [];
    const today = localToday();
    const booked = data.reduce((s, i) => s + i.total, 0);
    const collected = data.reduce((s, i) => s + i.received, 0);

    // Last 6 calendar months, oldest first.
    const [y, mo] = today.split("-").map(Number);
    const months = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(Date.UTC(y, mo - 1 - (5 - i), 1));
      return { key: d.toISOString().slice(0, 7), label: d.toLocaleString("en-CA", { month: "short", timeZone: "UTC" }), booked: 0, collected: 0, count: 0 };
    });
    data.forEach((i) => {
      const slot = months.find((x) => x.key === i.created.slice(0, 7));
      if (slot) { slot.booked += i.total; slot.collected += i.received; slot.count += 1; }
    });

    const status = { Paid: 0, "Part Payment": 0, "Not Paid": 0 };
    data.forEach((i) => { status[i.status] += 1; });

    const tally = (pick: (i: Item) => string | null, n: number) => {
      const map = new Map<string, number>();
      data.forEach((i) => { const k = pick(i); if (k) map.set(k, (map.get(k) || 0) + 1); });
      return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([label, value]) => ({ label, value }));
    };

    const streams: Stream[] = ["Photography", "Wedding", "Studio space", "Events"];
    const byStream = streams.map((s) => ({ label: s, value: data.filter((i) => i.stream === s).reduce((t, i) => t + i.received, 0) })).filter((x) => x.value > 0);

    // Which day of the week the shoots, rentals and events fall on.
    const week = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((label) => ({ label, count: 0 }));
    data.forEach((i) => {
      if (!i.date) return;
      const dow = (new Date(`${i.date}T12:00:00Z`).getUTCDay() + 6) % 7; // Monday first
      week[dow].count += 1;
    });

    const upcoming = data
      .filter((i) => i.date && i.date >= today)
      .sort((a, b) => (a.date! + (a.time ?? "")).localeCompare(b.date! + (b.time ?? "")));
    const nextWeek = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);

    return {
      booked, collected, outstanding: Math.max(booked - collected, 0), months, status, week, byStream, upcoming,
      thisWeek: upcoming.filter((i) => i.date! <= nextWeek).length,
      shootTypes: tally((i) => i.shootType, 5),
      packages: tally((i) => i.service, 5),
      locations: tally((i) => i.location, 5),
      total: data.length,
    };
  }, [items]);

  if (items === null) {
    return <div className="grid gap-4 grid-cols-2 xl:grid-cols-5">{[0, 1, 2, 3, 4].map((i) => <div key={i} className="h-32 bg-muted animate-pulse" />)}</div>;
  }

  return (
    <div className="space-y-5">
      {error && <p className="text-sm text-destructive font-body">{error}</p>}

      {/* Welcome */}
      <motion.section initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}
        className="relative overflow-hidden bg-[#0a0a0a] text-white p-6 sm:p-8">
        <img src={brandLogoWhite} alt="" aria-hidden className="pointer-events-none absolute -right-4 -bottom-6 h-44 opacity-[0.07]" />
        <div className="relative flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="inline-flex items-center gap-2 text-xs font-body font-bold tracking-widest text-white/60"><span className="inline-block w-1.5 h-1.5 rounded-full bg-[#9a9a9a]" /> {greeting().toUpperCase()}</p>
            <h2 className="font-display text-3xl sm:text-4xl font-bold mt-3 leading-tight">
              {m.thisWeek > 0
                ? <>You have <span className="text-[#9a9a9a]">{m.thisWeek} booking{m.thisWeek === 1 ? "" : "s"}</span> in the next 7 days.</>
                : <>Nothing booked this week. <span className="text-[#9a9a9a]">A good time to share some work?</span></>}
            </h2>
            <div className="flex flex-wrap gap-3 mt-5">
              <button onClick={() => onNavigate("bookings")} className="bg-[#f6f6f5] text-[#0a0a0a] px-5 py-2.5 text-xs font-body font-bold tracking-widest hover:bg-[#efefee] transition-colors">VIEW BOOKINGS</button>
              <OverviewDeliveryButton onOpen={() => onNavigate("deliveries")} />
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs font-body font-bold tracking-widest text-white/60">COLLECTED, ALL TIME</p>
            <p className="font-display text-4xl sm:text-5xl font-bold mt-1"><AnimatedNumber value={m.collected} format={money} /></p>
          </div>
        </div>
      </motion.section>

      {/* KPIs */}
      <div className="grid grid-cols-2 xl:grid-cols-5 gap-4">
        <Kpi delay={0.05} label="TOTAL BOOKINGS" value={m.total} spark={m.months.map((x) => x.count)} />
        <Kpi delay={0.1} label="BOOKED VALUE" value={m.booked} format={compactMoney} color={PALETTE.ink} spark={m.months.map((x) => x.booked)} />
        <Kpi delay={0.15} label="COLLECTED" value={m.collected} format={compactMoney} color={PALETTE.green} spark={m.months.map((x) => x.collected)} />
        <Kpi delay={0.2} label="OUTSTANDING" value={m.outstanding} format={compactMoney} color={PALETTE.amber} spark={m.months.map((x) => Math.max(x.booked - x.collected, 0))} />
        <Kpi delay={0.25} label="UPCOMING" value={m.upcoming.length} spark={m.months.map((x) => x.count)} />
      </div>

      <OverviewDeliveries onOpen={() => onNavigate("deliveries")} />

      <div className="grid gap-5 lg:grid-cols-3">
        <Panel className="lg:col-span-2" delay={0.3} title="Booked vs collected" sub="Last 6 months, by the month each booking came in"
          action={<button onClick={() => onNavigate("finance")} className="text-xs font-body font-bold tracking-widest text-accent hover:underline">FINANCE →</button>}>
          <TrendChart data={m.months} series={[{ key: "booked", name: "Booked", color: PALETTE.brown }, { key: "collected", name: "Collected", color: PALETTE.ink }]} />
        </Panel>
        <Panel delay={0.35} title="Payment status" sub="Every booking, rental, event and application">
          <Donut centerValue={String(m.total)} centerLabel="in total" data={[
            { name: "Paid", value: m.status.Paid, color: PALETTE.ink },
            { name: "Part payment", value: m.status["Part Payment"], color: PALETTE.brown },
            { name: "Not paid", value: m.status["Not Paid"], color: PALETTE.sand },
          ]} />
        </Panel>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <Panel delay={0.4} title="Money received by source" sub="All time">
          <BarList money items={m.byStream} />
        </Panel>
        <Panel delay={0.45} title="Busiest days" sub="Shoots, rentals and events by weekday">
          <ColumnChart height={210} money={false} data={m.week} series={[{ key: "count", name: "Bookings", color: PALETTE.brown }]} />
        </Panel>
        <Panel delay={0.5} title="Up next" action={<CalendarClock size={18} className="text-muted-foreground" />}>
          {m.upcoming.length === 0 ? (
            <p className="text-sm text-muted-foreground font-body py-6 text-center">Nothing coming up.</p>
          ) : (
            <ul className="space-y-3">
              {m.upcoming.slice(0, 5).map((i, idx) => {
                const d = new Date(`${i.date}T12:00:00`);
                return (
                  <motion.li key={idx} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.55 + idx * 0.07 }} className="flex items-center gap-3">
                    <div className="w-12 shrink-0 bg-[#0a0a0a] text-white text-center py-1.5 leading-none">
                      <p className="font-display text-lg font-bold">{d.getDate()}</p>
                      <p className="text-[10px] tracking-widest text-white/60 mt-0.5">{d.toLocaleString("en-CA", { month: "short" }).toUpperCase()}</p>
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate font-body">{i.name || "—"}</p>
                      <p className="text-xs text-muted-foreground truncate font-body">{[i.stream, i.time, i.title].filter(Boolean).join(" · ")}</p>
                    </div>
                  </motion.li>
                );
              })}
            </ul>
          )}
        </Panel>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <Panel delay={0.55} title="Shoot types"><BarList items={m.shootTypes} color={PALETTE.ink} /></Panel>
        <Panel delay={0.6} title="Favourite packages"><BarList items={m.packages} color={PALETTE.brown} /></Panel>
        <Panel delay={0.65} title="Weddings by city / venue"><BarList items={m.locations} color={PALETTE.tan} /></Panel>
      </div>

      {m.total === 0 ? (
        <p className="text-center text-sm text-muted-foreground font-body inline-flex items-center justify-center gap-2 w-full"><Sparkles size={14} /> Charts fill in as bookings arrive from the website.</p>
      ) : (
        <p className="text-xs font-body text-muted-foreground">
          Need a specific month or date range, expenses and profit? Open <button onClick={() => onNavigate("finance")} className="font-bold text-foreground hover:underline">Finance</button>.
        </p>
      )}
    </div>
  );
};

export default Overview;
