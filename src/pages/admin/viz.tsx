import { useEffect, useRef, type ReactNode } from "react";
import { animate, motion, useInView, useMotionValue, useTransform } from "framer-motion";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

/** DMI's palette for charts: black, the studio's brown accent, warm neutrals. Shared so every chart reads as one system. */
export const PALETTE = {
  ink: "#0a0a0a",
  brown: "#7d5434",
  tan: "#9a9a9a",
  sand: "#e6dccd",
  stone: "#a8a29a",
  green: "#2f6b45",
  amber: "#b9842f",
  muted: "#8c8b86",
  grid: "#e7e3db",
};
/** Colours handed out in order to donut slices and similar. */
export const SERIES_COLORS = [PALETTE.ink, PALETTE.brown, PALETTE.tan, PALETTE.stone, PALETTE.sand, PALETTE.amber];

export const money = (n: number) => `$${Math.round(n).toLocaleString("en-CA")}`;
const fmtMoney = money;
export const compactMoney = (n: number) =>
  n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(n % 1_000_000 ? 1 : 0)}M` : n >= 1_000 ? `$${Math.round(n / 1_000)}k` : `$${n}`;

/** A figure that counts up from zero when it scrolls into view. */
export const AnimatedNumber = ({ value, format = (n: number) => Math.round(n).toLocaleString("en-CA"), className }: { value: number; format?: (n: number) => string; className?: string }) => {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const mv = useMotionValue(0);
  const text = useTransform(mv, (v) => format(v));
  useEffect(() => {
    if (!inView) return;
    const controls = animate(mv, value, { duration: 1.2, ease: [0.16, 1, 0.3, 1] });
    return () => controls.stop();
  }, [inView, value, mv]);
  return <motion.span ref={ref} className={className}>{text}</motion.span>;
};

/** The square-edged card every widget sits in. It fades up when the page opens. */
export const Panel = ({ title, sub, action, children, className = "", delay = 0 }: { title?: string; sub?: string; action?: ReactNode; children: ReactNode; className?: string; delay?: number }) => (
  <motion.section
    initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55, delay, ease: [0.16, 1, 0.3, 1] }}
    className={`border border-border bg-background p-5 sm:p-6 ${className}`}
  >
    {(title || action) && (
      <div className="flex items-start justify-between gap-3 mb-5">
        <div>
          {title && <h3 className="font-display text-xl font-bold text-foreground leading-tight">{title}</h3>}
          {sub && <p className="text-xs text-muted-foreground mt-1 font-body">{sub}</p>}
        </div>
        {action}
      </div>
    )}
    {children}
  </motion.section>
);

const Tip = ({ active, payload, label, money = true }: { active?: boolean; payload?: { name?: string; value?: number; color?: string; dataKey?: string }[]; label?: string; money?: boolean }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#0a0a0a] text-white px-3 py-2 shadow-xl text-xs font-body">
      {label && <p className="text-white/60 mb-1">{label}</p>}
      {payload.map((p) => (
        <p key={String(p.dataKey)} className="flex items-center gap-2">
          <span className="inline-block w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-white/70">{p.name}</span>
          <b className="ml-auto pl-3">{money ? fmtMoney(p.value ?? 0) : p.value}</b>
        </p>
      ))}
    </div>
  );
};

export type SeriesPoint = { label: string; [key: string]: string | number };
type SeriesDef = { key: string; name: string; color: string };

/** Smooth gradient area chart. The lines draw themselves in on first view. */
export const TrendChart = ({ data, series, height = 260, money = true }: { data: SeriesPoint[]; series: SeriesDef[]; height?: number; money?: boolean }) => (
  <div style={{ height }} className="w-full">
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
        <defs>
          {series.map((s) => (
            <linearGradient key={s.key} id={`fill-${s.key}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={s.color} stopOpacity={0.28} />
              <stop offset="100%" stopColor={s.color} stopOpacity={0} />
            </linearGradient>
          ))}
        </defs>
        <CartesianGrid vertical={false} stroke={PALETTE.grid} strokeDasharray="3 6" />
        <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: PALETTE.muted }} />
        <YAxis tickLine={false} axisLine={false} width={52} tick={{ fontSize: 11, fill: PALETTE.muted }} tickFormatter={(v: number) => (money ? compactMoney(v) : String(v))} allowDecimals={false} />
        <Tooltip content={<Tip money={money} />} cursor={{ stroke: PALETTE.brown, strokeDasharray: "3 3" }} />
        {series.map((s) => (
          <Area key={s.key} type="monotone" dataKey={s.key} name={s.name} stroke={s.color} strokeWidth={2.5} fill={`url(#fill-${s.key})`}
            dot={false} activeDot={{ r: 5, strokeWidth: 2, stroke: "#fff" }} animationDuration={1400} animationEasing="ease-out" />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  </div>
);

/** Grouped columns that grow up from the axis (money in vs out, bookings per weekday). */
export const ColumnChart = ({ data, series, height = 260, money = true }: { data: SeriesPoint[]; series: SeriesDef[]; height?: number; money?: boolean }) => (
  <div style={{ height }} className="w-full">
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 8, right: 8, left: -8, bottom: 0 }} barGap={4}>
        <CartesianGrid vertical={false} stroke={PALETTE.grid} strokeDasharray="3 6" />
        <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: PALETTE.muted }} />
        <YAxis tickLine={false} axisLine={false} width={52} tick={{ fontSize: 11, fill: PALETTE.muted }} tickFormatter={(v: number) => (money ? compactMoney(v) : String(v))} allowDecimals={false} />
        <Tooltip content={<Tip money={money} />} cursor={{ fill: "rgba(125,84,52,0.07)" }} />
        {series.map((s) => (
          <Bar key={s.key} dataKey={s.key} name={s.name} fill={s.color} radius={[2, 2, 0, 0]} maxBarSize={28} animationDuration={1200} animationEasing="ease-out" />
        ))}
      </BarChart>
    </ResponsiveContainer>
  </div>
);

export type Slice = { name: string; value: number; color: string };

/** Donut with a figure in the middle and a legend underneath. */
export const Donut = ({ data, centerLabel, centerValue, money = false }: { data: Slice[]; centerLabel: string; centerValue: string; money?: boolean }) => {
  const total = data.reduce((s, d) => s + d.value, 0);
  const shown = total > 0 ? data.filter((d) => d.value > 0) : [{ name: "None yet", value: 1, color: PALETTE.grid }];
  return (
    <div>
      <div className="relative h-48">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={shown} dataKey="value" nameKey="name" innerRadius="68%" outerRadius="92%" paddingAngle={shown.length > 1 ? 2 : 0} stroke="none" startAngle={90} endAngle={-270} animationDuration={1300}>
              {shown.map((d) => <Cell key={d.name} fill={d.color} />)}
            </Pie>
            {total > 0 && <Tooltip content={<Tip money={money} />} />}
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="font-display text-2xl font-bold text-foreground">{centerValue}</span>
          <span className="text-[11px] text-muted-foreground font-body">{centerLabel}</span>
        </div>
      </div>
      <ul className="mt-4 space-y-1.5">
        {data.map((d) => (
          <li key={d.name} className="flex items-center gap-2 text-sm font-body">
            <span className="inline-block w-2.5 h-2.5" style={{ background: d.color }} />
            <span className="text-muted-foreground">{d.name}</span>
            <b className="ml-auto text-foreground">{money ? compactMoney(d.value) : d.value}</b>
          </li>
        ))}
      </ul>
    </div>
  );
};

/** Horizontal bars that grow in: top packages, locations, revenue by source. */
export const BarList = ({ items, color = PALETTE.ink, money = false }: { items: { label: string; value: number }[]; color?: string; money?: boolean }) => {
  const max = Math.max(1, ...items.map((i) => i.value));
  if (items.length === 0) return <p className="text-sm text-muted-foreground font-body py-6 text-center">Nothing to show yet.</p>;
  return (
    <ul className="space-y-4">
      {items.map((it, i) => (
        <li key={it.label}>
          <div className="flex items-baseline justify-between gap-3 text-sm font-body mb-1.5">
            <span className="truncate text-foreground">{it.label}</span>
            <b className="shrink-0">{money ? compactMoney(it.value) : it.value}</b>
          </div>
          <div className="h-2 bg-muted overflow-hidden rounded-full">
            <motion.div className="h-full rounded-full" style={{ background: `linear-gradient(90deg, ${color}, ${PALETTE.brown})` }}
              initial={{ width: 0 }} whileInView={{ width: `${(it.value / max) * 100}%` }} viewport={{ once: true }} transition={{ duration: 1, delay: i * 0.08, ease: [0.16, 1, 0.3, 1] }} />
          </div>
        </li>
      ))}
    </ul>
  );
};

/** Tiny trend line along the bottom of a KPI tile. */
export const Sparkline = ({ values, color = PALETTE.brown }: { values: number[]; color?: string }) => {
  const data = values.map((v, i) => ({ i, v }));
  const id = `spark-${color.slice(1)}`;
  return (
    <div className="h-12 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.3} /><stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area type="monotone" dataKey="v" stroke={color} strokeWidth={2} fill={`url(#${id})`} dot={false} isAnimationActive animationDuration={1400} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};
