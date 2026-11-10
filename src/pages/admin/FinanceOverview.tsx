import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { formatMoney } from "./formOptions";
import { receivedAmount, selectWithPaid } from "./payment";
import { AnimatedNumber, ColumnChart, Donut, PALETTE, Panel, SERIES_COLORS, TrendChart, compactMoney, money } from "./viz";

interface BookingRow {
  created_at: string;
  shoot_date: string | null;
  location: string | null;
  grand_total: number | null;
  payment_status: string | null;
  amount_paid?: number | null;
  source: string | null;
}
interface StudioRow {
  created_at: string;
  rental_date: string | null;
  grand_total: number | null;
  payment_status: string | null;
  amount_paid?: number | null;
}
interface EventRow {
  created_at: string;
  event_start_date: string | null;
  agreed_amount: number | null;
  payment_status: string | null;
  amount_paid?: number | null;
}
interface AcademyRow {
  created_at: string;
  amount: number | null;
  payment_status: string | null;
}
interface ExpenseRow {
  expense_date: string;
  amount: number;
  category: string;
}
interface OtherIncomeRow {
  income_date: string;
  source: string;
  amount: number;
}

const inputCls = "border border-border bg-background px-3 py-2 text-sm font-body outline-none focus:border-foreground";

const localToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Edmonton" }).format(new Date());
const dateOf = (iso: string) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Edmonton" }).format(new Date(iso));

const monthStart = (offset = 0) => {
  const [y, m] = localToday().split("-").map(Number);
  return new Date(Date.UTC(y, m - 1 + offset, 1)).toISOString().slice(0, 10);
};
const monthEnd = (offset = 0) => {
  const [y, m] = localToday().split("-").map(Number);
  return new Date(Date.UTC(y, m + offset, 0)).toISOString().slice(0, 10);
};
const yearStart = () => `${localToday().slice(0, 4)}-01-01`;
// Week runs Monday-Sunday, in Lagos time.
const weekStart = () => {
  const d = new Date(`${localToday()}T00:00:00Z`);
  const day = d.getUTCDay(); // 0 = Sunday
  const diff = day === 0 ? 6 : day - 1;
  d.setUTCDate(d.getUTCDate() - diff);
  return d.toISOString().slice(0, 10);
};
const monthLabel = (offset: number) => {
  const [y, m] = localToday().split("-").map(Number);
  return new Date(Date.UTC(y, m - 1 + offset, 1)).toLocaleDateString("en-CA", { month: "long", year: "numeric", timeZone: "UTC" });
};

const Big = ({ label, value, sub, tone, delay = 0 }: { label: string; value: number; sub?: string; tone?: "up" | "down" | "orange"; delay?: number }) => (
  <Panel delay={delay} className="!p-5">
    <p className="text-xs font-body font-bold tracking-widest text-muted-foreground">{label}</p>
    <p className={`font-display text-3xl font-bold mt-2 break-all ${tone === "up" ? "text-green-700" : tone === "down" ? "text-destructive" : tone === "orange" ? "text-accent" : ""}`}>
      <AnimatedNumber value={value} format={money} />
    </p>
    {sub && <p className="text-xs font-body text-muted-foreground mt-1">{sub}</p>}
  </Panel>
);

type Totals = { count: number; booked: number; paid: number; notPaid: number };
// `received` is the money actually in so far (a part payment counts only what was paid); without it, paid means in full.
const sumUp = (amounts: { amount: number; paid: boolean; received?: number }[]): Totals =>
  amounts.reduce(
    (t, a) => {
      const got = a.received ?? (a.paid ? a.amount : 0);
      return { count: t.count + 1, booked: t.booked + a.amount, paid: t.paid + got, notPaid: t.notPaid + Math.max(a.amount - got, 0) };
    },
    { count: 0, booked: 0, paid: 0, notPaid: 0 },
  );

const StreamRow = ({ label, t }: { label: string; t: Totals }) => (
  <tr className="border-b border-border last:border-0">
    <td className="px-4 py-3 font-medium">{label}</td>
    <td className="px-4 py-3">{t.count}</td>
    <td className="px-4 py-3">{formatMoney(t.booked)}</td>
    <td className="px-4 py-3 text-green-700">{formatMoney(t.paid)}</td>
    <td className="px-4 py-3 text-amber-700">{formatMoney(t.notPaid)}</td>
  </tr>
);

const FinanceOverview = () => {
  const today = localToday();
  const [dateField, setDateField] = useState<"event_date" | "created_at">("created_at");
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [studio, setStudio] = useState<StudioRow[]>([]);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [academy, setAcademy] = useState<AcademyRow[]>([]);
  const [expenses, setExpenses] = useState<ExpenseRow[]>([]);
  const [otherIncome, setOtherIncome] = useState<OtherIncomeRow[]>([]);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      selectWithPaid("bookings", "created_at, shoot_date, location, grand_total, payment_status, source"),
      selectWithPaid("studio_bookings", "created_at, rental_date, grand_total, payment_status"),
      selectWithPaid("event_bookings", "created_at, event_start_date, agreed_amount, payment_status"),
      supabase.from("academy_applications").select("created_at, amount, payment_status"),
      supabase.from("expenses").select("expense_date, amount, category"),
      supabase.from("other_income").select("income_date, source, amount"),
    ]).then(([b, s, ev, a, e, oi]) => {
      const err = b.error || s.error || ev.error || a.error || e.error || oi.error;
      if (err) setError(err.message);
      setBookings((b.data as BookingRow[]) || []);
      setStudio((s.data as StudioRow[]) || []);
      setEvents((ev.data as EventRow[]) || []);
      setAcademy((a.data as AcademyRow[]) || []);
      setExpenses((e.data as ExpenseRow[]) || []);
      setOtherIncome((oi.data as OtherIncomeRow[]) || []);
      setLoading(false);
    });
  }, []);

  const inRange = (d: string | null) => {
    if (!d) return false;
    const day = d.length > 10 ? dateOf(d) : d;
    return (!from || day >= from) && (!to || day <= to);
  };

  // A booking with no shoot date yet would otherwise vanish from "Shoot / rental date" view for
  // every range — falling back to the date it was booked keeps it visible instead of silently hidden.
  const filteredBookings = useMemo(
    () => bookings.filter((b) => inRange(dateField === "event_date" ? (b.shoot_date || b.created_at) : b.created_at)),
    [bookings, dateField, from, to],
  );
  const photography = useMemo(() => sumUp(filteredBookings.filter((b) => b.source !== "wedding_form").map((b) => ({ amount: b.grand_total || 0, paid: b.payment_status === "Paid", received: receivedAmount(b.payment_status, b.grand_total, b.amount_paid) }))), [filteredBookings]);
  const wedding = useMemo(() => sumUp(filteredBookings.filter((b) => b.source === "wedding_form").map((b) => ({ amount: b.grand_total || 0, paid: b.payment_status === "Paid", received: receivedAmount(b.payment_status, b.grand_total, b.amount_paid) }))), [filteredBookings]);

  const filteredStudio = useMemo(
    () => studio.filter((s) => inRange(dateField === "event_date" ? (s.rental_date || s.created_at) : s.created_at)),
    [studio, dateField, from, to],
  );
  const studioTotals = useMemo(() => sumUp(filteredStudio.map((s) => ({ amount: s.grand_total || 0, paid: s.payment_status === "Paid", received: receivedAmount(s.payment_status, s.grand_total, s.amount_paid) }))), [filteredStudio]);

  const filteredEvents = useMemo(
    () => events.filter((ev) => inRange(dateField === "event_date" ? (ev.event_start_date || ev.created_at) : ev.created_at)),
    [events, dateField, from, to],
  );
  const eventTotals = useMemo(() => sumUp(filteredEvents.map((ev) => ({ amount: ev.agreed_amount || 0, paid: ev.payment_status === "Paid", received: receivedAmount(ev.payment_status, ev.agreed_amount, ev.amount_paid) }))), [filteredEvents]);

  // Academy applications don't have an "event date" — always counted by the date they applied.
  const filteredAcademy = useMemo(() => academy.filter((a) => inRange(a.created_at)), [academy, from, to]);
  // Academy tracks payment as Not Paid / Part Payment / Full Payment; either paid state counts
  // its full amount as received (part-payments aren't tracked to the money, just flagged).
  const academyTotals = useMemo(() => sumUp(filteredAcademy.map((a) => ({ amount: a.amount || 0, paid: a.payment_status !== "Not Paid" && !!a.payment_status }))), [filteredAcademy]);

  // Other income is counted by the date it was recorded and is always treated as money received.
  const filteredOtherIncome = useMemo(() => otherIncome.filter((o) => (!from || o.income_date >= from) && (!to || o.income_date <= to)), [otherIncome, from, to]);
  const otherIncomeTotals = useMemo(() => sumUp(filteredOtherIncome.map((o) => ({ amount: o.amount || 0, paid: true }))), [filteredOtherIncome]);

  const filteredExpenses = useMemo(() => expenses.filter((e) => (!from || e.expense_date >= from) && (!to || e.expense_date <= to)), [expenses, from, to]);
  const totalExpenses = useMemo(() => filteredExpenses.reduce((sum, e) => sum + e.amount, 0), [filteredExpenses]);
  const expensesByCategory = useMemo(() => {
    const map = new Map<string, number>();
    filteredExpenses.forEach((e) => map.set(e.category, (map.get(e.category) || 0) + e.amount));
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [filteredExpenses]);

  const totalRevenue = photography.paid + wedding.paid + studioTotals.paid + eventTotals.paid + academyTotals.paid + otherIncomeTotals.paid;
  const totalBookedValue = photography.booked + wedding.booked + studioTotals.booked + eventTotals.booked + academyTotals.booked + otherIncomeTotals.booked;
  const netProfit = totalRevenue - totalExpenses;

  // Money in and out for the last 12 months, independent of the date filter above.
  const yearSeries = useMemo(() => {
    const [y, mo] = today.split("-").map(Number);
    const months = Array.from({ length: 12 }, (_, i) => {
      const d = new Date(Date.UTC(y, mo - 1 - (11 - i), 1));
      return { key: d.toISOString().slice(0, 7), label: d.toLocaleString("en-CA", { month: "short", timeZone: "UTC" }), income: 0, expenses: 0, profit: 0 };
    });
    const slot = (day: string) => months.find((m) => m.key === day.slice(0, 7));
    bookings.forEach((b) => { const m = slot(dateOf(b.created_at)); if (m) m.income += receivedAmount(b.payment_status, b.grand_total, b.amount_paid); });
    studio.forEach((r) => { const m = slot(dateOf(r.created_at)); if (m) m.income += receivedAmount(r.payment_status, r.grand_total, r.amount_paid); });
    events.forEach((r) => { const m = slot(dateOf(r.created_at)); if (m) m.income += receivedAmount(r.payment_status, r.agreed_amount, r.amount_paid); });
    academy.forEach((r) => { const m = slot(dateOf(r.created_at)); if (m && r.payment_status && r.payment_status !== "Not Paid") m.income += r.amount || 0; });
    otherIncome.forEach((o) => { const m = slot(o.income_date); if (m) m.income += o.amount || 0; });
    expenses.forEach((e) => { const m = slot(e.expense_date); if (m) m.expenses += e.amount || 0; });
    months.forEach((m) => { m.profit = m.income - m.expenses; });
    return months;
  }, [bookings, studio, events, academy, otherIncome, expenses, today]);

  const sourceSlices = [
    { name: "Photography", value: photography.paid },
    { name: "Weddings", value: wedding.paid },
    { name: "Studio space", value: studioTotals.paid },
    { name: "Events", value: eventTotals.paid },
    { name: "Academy", value: academyTotals.paid },
    { name: "Other income", value: otherIncomeTotals.paid },
  ].map((x, i) => ({ ...x, color: SERIES_COLORS[i % SERIES_COLORS.length] }));

  const byLocation = useMemo(() => {
    const map = new Map<string, { count: number; total: number }>();
    filteredBookings.forEach((b) => {
      const key = b.location || "—";
      const cur = map.get(key) || { count: 0, total: 0 };
      cur.count += 1;
      cur.total += b.grand_total || 0;
      map.set(key, cur);
    });
    return [...map.entries()].sort((a, b) => b[1].total - a[1].total);
  }, [filteredBookings]);

  const quickButtons: { label: string; apply: () => void }[] = [
    { label: "Today", apply: () => { setFrom(today); setTo(today); } },
    { label: "This week", apply: () => { setFrom(weekStart()); setTo(today); } },
    { label: "This month", apply: () => { setFrom(monthStart()); setTo(today); } },
    { label: "Last month", apply: () => { setFrom(monthStart(-1)); setTo(monthEnd(-1)); } },
    { label: "This year", apply: () => { setFrom(yearStart()); setTo(today); } },
    { label: "All time", apply: () => { setFrom(""); setTo(""); } },
  ];
  const rangeLabel = from && to && from === today && to === today
    ? "Today"
    : from && to && from === weekStart() && to === today
      ? "This week"
      : from && to && from === monthStart() && to === today
        ? monthLabel(0)
        : from && to && from === monthStart(-1) && to === monthEnd(-1)
          ? monthLabel(-1)
          : !from && !to
            ? "All time"
            : `${from || "the start"} to ${to || "now"}`;

  return (
    <div className="space-y-6">
      <div className="border border-border p-4 space-y-3">
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-xs font-body font-bold tracking-widest">COUNT BOOKINGS &amp; RENTALS BY
            <select className={inputCls + " block mt-1 font-normal"} value={dateField} onChange={(e) => setDateField(e.target.value as "event_date" | "created_at")}>
              <option value="created_at">Date booked</option>
              <option value="event_date">Shoot / rental date</option>
            </select>
          </label>
          <label className="text-xs font-body font-bold tracking-widest">FROM
            <input type="date" className={inputCls + " block mt-1 font-normal"} value={from} onChange={(e) => setFrom(e.target.value)} />
          </label>
          <label className="text-xs font-body font-bold tracking-widest">TO
            <input type="date" className={inputCls + " block mt-1 font-normal"} value={to} onChange={(e) => setTo(e.target.value)} />
          </label>
          <div className="flex flex-wrap gap-2 pb-0.5">
            {quickButtons.map((b) => (
              <button key={b.label} className="px-3 py-2 text-xs font-body border border-border hover:border-foreground" onClick={b.apply}>{b.label}</button>
            ))}
          </div>
        </div>
        <p className="text-xs font-body text-muted-foreground">
          Showing <b className="text-foreground">{rangeLabel}</b>. Academy applications, Other Income and expenses are always counted by the date they were recorded.
        </p>
      </div>

      {error && <p className="text-sm text-destructive font-body">{error}</p>}

      {loading ? (
        <p className="text-sm text-muted-foreground font-body">Loading…</p>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Big delay={0.05} label="TOTAL REVENUE (PAID)" value={totalRevenue} tone="orange" />
            <Big delay={0.1} label="TOTAL EXPENSES" value={totalExpenses} tone="down" />
            <Big delay={0.15} label="NET PROFIT" value={netProfit} sub="Revenue actually received, minus expenses" tone={netProfit < 0 ? "down" : "up"} />
            <Big delay={0.2} label="TOTAL BOOKED VALUE" value={totalBookedValue} sub="Including money not yet paid" />
          </div>

          <div className="grid gap-5 lg:grid-cols-3">
            <Panel className="lg:col-span-2" delay={0.25} title="Money in vs money out" sub="Last 12 months: payments received against expenses">
              <ColumnChart data={yearSeries} series={[{ key: "income", name: "Money in", color: PALETTE.ink }, { key: "expenses", name: "Expenses", color: PALETTE.brown }]} />
            </Panel>
            <Panel delay={0.3} title="Where the money comes from" sub={rangeLabel}>
              <Donut money centerLabel="received" centerValue={compactMoney(totalRevenue)} data={sourceSlices} />
            </Panel>
          </div>

          <div className="grid gap-5 lg:grid-cols-3">
            <Panel className="lg:col-span-2" delay={0.35} title="Profit trend" sub="Money in minus expenses, month by month">
              <TrendChart height={220} data={yearSeries} series={[{ key: "profit", name: "Net profit", color: PALETTE.green }]} />
            </Panel>
            <Panel delay={0.4} title="Where the money goes" sub={rangeLabel}>
              {expensesByCategory.length === 0 ? (
                <p className="text-sm text-muted-foreground font-body py-10 text-center">No expenses in this range.</p>
              ) : (
                <Donut money centerLabel="spent" centerValue={compactMoney(totalExpenses)}
                  data={expensesByCategory.slice(0, 6).map(([name, value], i) => ({ name, value, color: SERIES_COLORS[i % SERIES_COLORS.length] }))} />
              )}
            </Panel>
          </div>

          <div className="border border-border">
            <p className="px-4 pt-4 pb-2 font-display text-lg font-bold">Revenue by source</p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm font-body">
                <thead>
                  <tr className="border-b border-border text-left text-xs font-bold tracking-widest text-muted-foreground">
                    <th className="px-4 py-2">Source</th>
                    <th className="px-4 py-2">Count</th>
                    <th className="px-4 py-2">Booked value</th>
                    <th className="px-4 py-2">Paid</th>
                    <th className="px-4 py-2">Not yet paid</th>
                  </tr>
                </thead>
                <tbody>
                  <StreamRow label="Photography bookings" t={photography} />
                  <StreamRow label="Wedding bookings" t={wedding} />
                  <StreamRow label="Studio space rentals" t={studioTotals} />
                  <StreamRow label="Event bookings" t={eventTotals} />
                  <StreamRow label="Academy" t={academyTotals} />
                  <StreamRow label="Other income" t={otherIncomeTotals} />
                  <tr className="font-bold bg-muted/40">
                    <td className="px-4 py-3">Total</td>
                    <td className="px-4 py-3">{photography.count + wedding.count + studioTotals.count + eventTotals.count + academyTotals.count + otherIncomeTotals.count}</td>
                    <td className="px-4 py-3">{formatMoney(totalBookedValue)}</td>
                    <td className="px-4 py-3 text-green-700">{formatMoney(totalRevenue)}</td>
                    <td className="px-4 py-3 text-amber-700">{formatMoney(photography.notPaid + wedding.notPaid + studioTotals.notPaid + eventTotals.notPaid + academyTotals.notPaid + otherIncomeTotals.notPaid)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {byLocation.length > 0 && (
              <div className="border border-border">
                <p className="px-4 pt-4 pb-2 font-display text-lg font-bold">Bookings by location</p>
                <table className="w-full text-sm font-body">
                  <thead>
                    <tr className="border-b border-border text-left text-xs font-bold tracking-widest text-muted-foreground">
                      <th className="px-4 py-2">Location</th>
                      <th className="px-4 py-2">Bookings</th>
                      <th className="px-4 py-2">Total booked value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {byLocation.map(([loc, v]) => (
                      <tr key={loc} className="border-b border-border last:border-0">
                        <td className="px-4 py-2 font-medium">{loc}</td>
                        <td className="px-4 py-2">{v.count}</td>
                        <td className="px-4 py-2">{formatMoney(v.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {expensesByCategory.length > 0 && (
              <div className="border border-border">
                <p className="px-4 pt-4 pb-2 font-display text-lg font-bold">Expenses by category</p>
                <table className="w-full text-sm font-body">
                  <thead>
                    <tr className="border-b border-border text-left text-xs font-bold tracking-widest text-muted-foreground">
                      <th className="px-4 py-2">Category</th>
                      <th className="px-4 py-2">Total spent</th>
                    </tr>
                  </thead>
                  <tbody>
                    {expensesByCategory.map(([cat, amt]) => (
                      <tr key={cat} className="border-b border-border last:border-0">
                        <td className="px-4 py-2 font-medium">{cat}</td>
                        <td className="px-4 py-2">{formatMoney(amt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default FinanceOverview;
