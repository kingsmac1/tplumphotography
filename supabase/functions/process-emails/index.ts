// Runs every 5 minutes (scheduled by pg_cron in email-automation-and-messaging.sql).
// Sends every automatic email that is due. Each email is claimed in email_log first, so
// nothing is ever sent twice, even if runs overlap or one is interrupted.

// ---- Shared helpers (kept in this file so the function deploys on its own) ----
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

export const serviceDb = (): SupabaseClient =>
  createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const escapeHtml = (v: unknown) =>
  String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

// ---- Email look: structure follows the Uforo Abia emails (dark header band, small label above a serif
// title, hairline detail rows, a dark total block, pill buttons, a quiet footer), in DMI's black and white. ----
const INK = "#0a0a0a";
const PAPER = "#f7f6f2";
const LINE = "#d8d6ce";
const MUTED = "#8c8b86";
const SERIF = "Georgia, 'Times New Roman', serif";
const SANS = "-apple-system, 'Segoe UI', Helvetica, Arial, sans-serif";
const DMI_WHATSAPP = "https://wa.me/2349013962323";
const DMI_SITE = "https://dmi.com.ng";

export type EmailButton = { label: string; href: string; dark?: boolean };
/** Optional extras a template can add around its editable body. */
export type EmailDesign = {
  eyebrow?: string;
  title?: string;
  preheader?: string;
  /** Hairline label / value rows shown under the body. */
  rows?: [string, string][];
  /** Dark block with a large figure. */
  total?: { label: string; value: string };
  buttons?: EmailButton[];
};

const esc2 = (v: unknown) =>
  String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** Gives plain template HTML (<p>, <a>, lists) the email's typography without the owner having to write styles. */
export function styleBody(html: string): string {
  return html
    .replace(/<p>/gi, `<p style="margin:0 0 20px;font-family:${SANS};font-size:15px;line-height:1.7;color:${INK};">`)
    .replace(/<(ul|ol)>/gi, `<$1 style="margin:0 0 20px;padding-left:20px;font-family:${SANS};font-size:15px;line-height:1.8;color:${INK};">`)
    .replace(/<a (?![^>]*style=)/gi, `<a style="color:${INK};text-decoration:underline;" `);
}

/** Hairline label / value table. `rows` are already-built <tr> strings or [label, value] pairs. */
export function detailsTable(rows: [string, string][]): string {
  const cells = rows
    .filter(([, v]) => String(v ?? "").trim() && v !== "-")
    .map(
      ([k, v]) => `<tr>
        <td style="padding:14px 0;border-bottom:1px solid ${LINE};width:38%;vertical-align:top;font-family:${SANS};font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:${MUTED};">${esc2(k)}</td>
        <td style="padding:14px 0;border-bottom:1px solid ${LINE};font-family:${SANS};font-size:14px;line-height:1.5;color:${INK};text-align:right;vertical-align:top;">${esc2(v).replace(/\r?\n/g, "<br>")}</td>
      </tr>`,
    )
    .join("");
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-top:1px solid ${LINE};margin:0 0 8px;">${cells}</table>`;
}

function buttonHtml(b: EmailButton): string {
  const dark = b.dark !== false;
  return `<a href="${esc2(b.href)}" style="display:inline-block;margin:0 10px 10px 0;padding:14px 28px;background:${dark ? INK : "transparent"};color:${dark ? PAPER : INK};border:1px solid ${INK};font-family:${SANS};font-size:12px;letter-spacing:0.14em;text-transform:uppercase;text-decoration:none;border-radius:999px;">${esc2(b.label)}</a>`;
}

/** Wraps an email body in the DMI frame: header band, optional label + title, body, details, buttons, footer. */
export function wrapper(bodyHtml: string, d: EmailDesign = {}): string {
  const head = d.title
    ? `<tr><td style="padding:44px 36px 8px;">
        ${d.eyebrow ? `<span style="font-family:${SANS};font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:${MUTED};">${esc2(d.eyebrow)}</span>` : ""}
        <h1 style="margin:14px 0 0;font-family:${SERIF};font-weight:400;font-size:34px;line-height:1.1;color:${INK};">${esc2(d.title)}</h1>
      </td></tr>`
    : "";
  const rows = d.rows?.length ? `<div style="margin:8px 0 28px;">${detailsTable(d.rows)}</div>` : "";
  const total = d.total
    ? `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:${INK};margin:0 0 28px;">
        <tr><td style="padding:28px;">
          <span style="font-family:${SANS};font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:rgba(247,246,242,0.55);">${esc2(d.total.label)}</span>
          <div style="font-family:${SERIF};font-size:36px;line-height:1.1;color:${PAPER};margin-top:10px;">${esc2(d.total.value)}</div>
        </td></tr>
      </table>`
    : "";
  const buttons = d.buttons?.length ? `<div style="margin-top:36px;">${d.buttons.map(buttonHtml).join("")}</div>` : "";
  // Put the summary where the template says {{summary}}; otherwise it follows the body.
  const marker = "<!--dmi-summary-->";
  const hasMarker = bodyHtml.includes(marker);
  const styledBody = styleBody(bodyHtml).replace(marker, `${rows}${total}`);
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light only"></head>
<body style="margin:0;padding:0;background:${PAPER};">
${d.preheader ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${esc2(d.preheader)}</div>` : ""}
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:${PAPER};">
  <tr><td align="center" style="padding:32px 12px;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#ffffff;border:1px solid ${LINE};">
      <tr><td style="background:${INK};padding:26px 36px;">
        <img src="${DMI_SITE}/email-logo.png" alt="DMI Studios" width="150" style="display:block;border:0;width:150px;max-width:100%;height:auto;" />
      </td></tr>
      ${head}
      <tr><td style="padding:${d.title ? "8px" : "36px"} 36px 44px;">
        ${styledBody}
        ${hasMarker ? "" : `${rows}${total}`}${buttons}
      </td></tr>
      <tr><td style="border-top:1px solid ${LINE};padding:26px 36px;background:${PAPER};">
        <div style="font-family:${SANS};font-size:12px;line-height:1.7;color:${MUTED};">
          DarlMac Impression<br>
          +234 901 396 2323 &middot; <a href="mailto:info@dmi.com.ng" style="color:${MUTED};">info@dmi.com.ng</a><br>
          <a href="https://www.instagram.com/darlmac_impression/" style="color:${MUTED};">Instagram</a> &middot;
          <a href="https://www.facebook.com/DMIstudios/" style="color:${MUTED};">Facebook</a> &middot;
          <a href="https://www.tiktok.com/@darlmac_impression" style="color:${MUTED};">TikTok</a>
        </div>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
}

/** Plain-text twin of the HTML, sent alongside it (better deliverability, and readable in plain clients). */
export function htmlToText(html: string): string {
  return html
    .replace(/<head[\s\S]*?<\/head>/gi, "")
    .replace(/<(br|\/p|\/div|\/tr|\/h1|\/li)\s*\/?>/gi, "\n")
    .replace(/<\/td>/gi, "  ")
    .replace(/<a [^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, "$2 ($1)")
    .replace(/<[^>]+>/g, "")
    .replace(/&middot;/g, "·").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

/** The label, title, summary rows and buttons each template gets, built from its placeholder values. */
export function design(templateKey: string, v: Record<string, string>): EmailDesign {
  const first = (v.client_name || "").trim().split(/\s+/)[0] || "";
  const wa: EmailButton = { label: "Message us on WhatsApp", href: DMI_WHATSAPP };
  const ownerButtons = (): EmailButton[] => {
    const digits = (v.client_whatsapp || "").replace(/\D/g, "");
    const intl = digits.startsWith("234") ? digits : digits.startsWith("0") ? `234${digits.slice(1)}` : digits.length === 10 ? `234${digits}` : digits;
    return [
      ...(intl ? [{ label: "Reply on WhatsApp", href: `https://wa.me/${intl}` }] : []),
      ...(v.client_email ? [{ label: "Reply by email", href: `mailto:${v.client_email}`, dark: false }] : []),
    ];
  };
  switch (templateKey) {
    case "booking_confirmation":
      return { eyebrow: "Photography booking", title: "Booking confirmed", preheader: "Your DMI session is booked.",
        rows: [["Package", v.service_summary], ["Date", v.shoot_date], ["Time", v.shoot_time], ["Location", `${v.location} (${v.shoot_setting})`]],
        total: { label: "Total", value: v.grand_total }, buttons: [wa] };
    case "studio_confirmation":
      return { eyebrow: "Studio space", title: "Request received", preheader: "We have your studio space request.",
        rows: [["Space", v.space_name], ["Date", v.rental_date], ["Time", v.rental_time], ["Duration", `${v.duration} minutes`], ["Extras", v.extras]],
        total: { label: "Total", value: v.grand_total }, buttons: [wa] };
    case "event_confirmation":
      return { eyebrow: "Event booking", title: "Request received", preheader: "We have your event request.",
        rows: [["Event", v.event_type], ["Dates", v.event_dates], ["Start time", v.event_time], ["Venue", v.venue]],
        total: { label: "Agreed amount", value: v.agreed_amount }, buttons: [wa] };
    case "reminder_24h":
      return { eyebrow: "Shoot reminder", title: "Your shoot is tomorrow", rows: [["Date", v.shoot_date], ["Time", v.shoot_time], ["Location", `${v.location} (${v.shoot_setting})`]], buttons: [wa] };
    case "reminder_12h":
      return { eyebrow: "Shoot reminder", title: "12 hours to go", rows: [["Date", v.shoot_date], ["Time", v.shoot_time], ["Location", `${v.location} (${v.shoot_setting})`]], buttons: [wa] };
    case "reminder_2h":
      return { eyebrow: "Shoot reminder", title: "Almost time", rows: [["Time", v.shoot_time], ["Location", `${v.location} (${v.shoot_setting})`]], buttons: [wa] };
    case "thank_you":
      return { eyebrow: "Thank you", title: "Thank you for booking", buttons: [wa] };
    case "review_request":
      return { eyebrow: "Your feedback", title: "How was your experience?", buttons: [{ label: "Leave a review", href: "https://g.page/r/CeltVtvHMcl5EBM/review" }] };
    case "re_engagement":
      return { eyebrow: "Next session", title: "Ready for your next session?", buttons: [{ label: "Book a session", href: `${DMI_SITE}/booking` }] };
    case "birthday":
      return { eyebrow: "Happy birthday", title: first ? `Happy birthday, ${first}` : "Happy birthday", buttons: [{ label: "Book a birthday shoot", href: `${DMI_SITE}/booking` }] };
    case "payment_paid":
      return { eyebrow: "Payment", title: "Payment received", preheader: `We received your payment for ${v.item}.`,
        rows: [["For", v.item], ["Amount paid", v.amount_paid]],
        total: v.total && v.total !== "$0" ? { label: "Paid in full", value: v.total } : undefined, buttons: [wa] };
    case "payment_part":
      return { eyebrow: "Payment", title: "Part payment received", preheader: `We received ${v.amount_paid} for ${v.item}.`,
        rows: [["For", v.item], ["Total", v.total !== "$0" ? v.total : ""], ["Amount paid", v.amount_paid]],
        total: v.balance && v.balance !== "$0" ? { label: "Balance remaining", value: v.balance } : undefined, buttons: [wa] };
    case "owner_booking":
      return { eyebrow: "New submission", title: "New booking", preheader: `${v.client_name} · ${v.shoot_date}`, buttons: ownerButtons() };
    case "owner_studio":
      return { eyebrow: "New submission", title: "New studio space rental", preheader: `${v.client_name} · ${v.rental_date}`, buttons: ownerButtons() };
    case "owner_event":
      return { eyebrow: "New submission", title: "New event booking", preheader: `${v.client_name} · ${v.event_type}`, buttons: ownerButtons() };
    case "owner_birthday":
      return { eyebrow: "Birthdays", title: "Client birthdays today", preheader: `${v.client_count} client birthday(s) today` };
    default:
      return {};
  }
}

/** Replaces {{name}} placeholders. Values are HTML-escaped, except the `details` block, which is built as HTML already. */
export function render(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_m, key: string) => {
    // {{summary}} marks where the template's detail rows and total block go; wrapper() swaps this marker for them.
    if (key === "summary") return "<!--dmi-summary-->";
    const value = vars[key] ?? "";
    return key === "details" ? value : escapeHtml(value);
  });
}

export type TemplateRow = { key: string; subject: string; body: string; enabled: boolean };

// Templates are read once per run (reset at the start of each run), not once per email.
let templateCache = new Map<string, TemplateRow | null>();

export async function loadTemplate(db: SupabaseClient, key: string): Promise<TemplateRow | null> {
  if (templateCache.has(key)) return templateCache.get(key) ?? null;
  const row = await loadTemplateFromDb(db, key);
  templateCache.set(key, row);
  return row;
}

async function loadTemplateFromDb(db: SupabaseClient, key: string): Promise<TemplateRow | null> {
  const { data, error } = await db.from("email_templates").select("key, subject, body, enabled").eq("key", key).maybeSingle();
  if (error) throw new Error(error.message);
  return (data as TemplateRow) ?? null;
}

export async function ownerEmails(db: SupabaseClient): Promise<string[]> {
  const { data } = await db.from("email_settings").select("value").eq("key", "owner_emails").maybeSingle();
  return String(data?.value ?? "")
    .split(/[\n,]+/)
    .map((e) => e.trim())
    .filter((e) => EMAIL_RE.test(e));
}

/** Claims a dedupe key. Returns false if it was already claimed, so the email is never sent twice. */
export async function claim(
  db: SupabaseClient,
  row: { dedupeKey: string; templateKey: string; recipient: string; subject: string; sourceTable?: string; sourceId?: string },
): Promise<boolean> {
  const { data, error } = await db
    .from("email_log")
    .upsert(
      {
        dedupe_key: row.dedupeKey,
        template_key: row.templateKey,
        recipient: row.recipient,
        subject: row.subject,
        status: "pending",
        source_table: row.sourceTable ?? null,
        source_id: row.sourceId ?? null,
      },
      { onConflict: "dedupe_key", ignoreDuplicates: true },
    )
    .select("id");
  if (error) throw new Error(error.message);
  return (data?.length ?? 0) > 0;
}

export async function markLog(db: SupabaseClient, dedupeKey: string, status: "sent" | "failed" | "skipped", error?: string) {
  await db.from("email_log").update({ status, error: error ?? null }).eq("dedupe_key", dedupeKey);
}

/** Sends one email through Resend. Throws with Resend's message on failure. */
export async function sendResend(params: {
  to: string | string[];
  subject: string;
  html: string;
  attachments?: { filename: string; content: string }[];
  replyTo?: string;
  design?: EmailDesign;
}): Promise<string | null> {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  const from = Deno.env.get("RESEND_FROM_EMAIL");
  if (!apiKey || !from) throw new Error("RESEND_API_KEY or RESEND_FROM_EMAIL is not set in Supabase secrets.");

  const html = wrapper(params.html, params.design);
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from,
      to: params.to,
      subject: params.subject,
      html,
      text: htmlToText(html),
      reply_to: params.replyTo || undefined,
      attachments: params.attachments?.length ? params.attachments : undefined,
    }),
  });
  if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text().catch(() => "")}`);
  // Resend's reference for this email: look it up in the Resend dashboard to see delivered / bounced / suppressed.
  const out = await res.json().catch(() => null);
  return (out?.id as string | undefined) ?? null;
}

/** Sends a template to one recipient exactly once (keyed by dedupeKey), logging the outcome. */
export async function sendTemplateOnce(params: {
  db: SupabaseClient;
  templateKey: string;
  dedupeKey: string;
  to: string | string[];
  vars: Record<string, string>;
  sourceTable?: string;
  sourceId?: string;
  replyTo?: string;
}): Promise<"sent" | "skipped" | "failed" | "already"> {
  const { db, templateKey, dedupeKey, to, vars } = params;
  const template = await loadTemplate(db, templateKey);
  const subject = template ? render(template.subject, vars) : "";

  const recipient = Array.isArray(to) ? to.join(", ") : to;
  const claimed = await claim(db, {
    dedupeKey, templateKey, recipient, subject,
    sourceTable: params.sourceTable, sourceId: params.sourceId,
  });
  if (!claimed) return "already";

  if (!template || !template.enabled) {
    await markLog(db, dedupeKey, "skipped", template ? "Template is turned off" : "Template missing");
    return "skipped";
  }

  try {
    await sendResend({ to, subject, html: render(template.body, vars), replyTo: params.replyTo, design: design(templateKey, vars) });
    await markLog(db, dedupeKey, "sent");
    return "sent";
  } catch (err) {
    await markLog(db, dedupeKey, "failed", err instanceof Error ? err.message : String(err));
    return "failed";
  }
}

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const RUN_BUDGET_MS = 110_000;
const SEND_GAP_MS = 550; // stays under Resend's 2 requests/second limit

const money = (n: unknown) => `$${Number(n || 0).toLocaleString("en-CA")}`;
const esc = (v: unknown) => String(v ?? "-").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const line = (label: string, value: unknown): [string, string] => [label, String(value || "")];

/** Lagos is UTC+1 all year, so shoot times are read with a fixed offset. */
function shootAt(date: string | null, time: string | null): Date | null {
  if (!date) return null;
  const d = new Date(`${date}T${time || "10:00"}:00+01:00`);
  return isNaN(d.getTime()) ? null : d;
}

function localToday(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Edmonton" }).format(new Date());
}

/** Hour of day (0-23) in Lagos. */
function lagosHour(): number {
  return Number(new Intl.DateTimeFormat("en-CA", { timeZone: "America/Edmonton", hour: "2-digit", hourCycle: "h23" }).format(new Date()));
}

/**
 * True when a stored birthday (YYYY-MM-DD, year ignored) falls on today's Lagos date.
 * A 29 February birthday is celebrated on 28 February in years that have no 29th.
 */
function isBirthdayToday(dob: unknown, today: string): boolean {
  if (!dob) return false;
  const md = String(dob).slice(5, 10);
  const todayMd = today.slice(5);
  if (md === todayMd) return true;
  const year = Number(today.slice(0, 4));
  const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  return md === "02-29" && !leap && todayMd === "02-28";
}

type Budget = { start: number; sent: number; failed: number; skipped: number; already: number; errors: string[] };

type SendParams = Parameters<typeof sendTemplateOnce>[0];

// Emails that are due this run. Collected first, then checked against email_log in one lookup,
// so a run reads only the log rows it needs instead of the whole log.
let queue: SendParams[] = [];
function send(_budget: Budget, params: SendParams) {
  queue.push(params);
  return Promise.resolve();
}

/** Keys from `keys` that are already in email_log. */
async function loggedKeys(db: SupabaseClient, keys: string[]): Promise<Set<string>> {
  const found = new Set<string>();
  const unique = [...new Set(keys)];
  for (let i = 0; i < unique.length; i += 150) {
    const { data, error } = await db.from("email_log").select("dedupe_key").in("dedupe_key", unique.slice(i, i + 150));
    if (error) throw new Error(error.message);
    for (const r of data ?? []) found.add(String(r.dedupe_key));
  }
  return found;
}

async function flush(db: SupabaseClient, budget: Budget) {
  const known = await loggedKeys(db, queue.map((q) => q.dedupeKey));
  for (const params of queue) {
    if (Date.now() - budget.start > RUN_BUDGET_MS) break;
    if (known.has(params.dedupeKey)) { budget.already++; continue; }
    known.add(params.dedupeKey);
    const result = await sendTemplateOnce(params);
    if (result === "sent") { budget.sent++; await new Promise((r) => setTimeout(r, SEND_GAP_MS)); }
    else if (result === "failed") budget.failed++;
    else if (result === "skipped") budget.skipped++;
    else budget.already++;
  }
  queue = [];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const db = serviceDb();
  const budget: Budget = { start: Date.now(), sent: 0, failed: 0, skipped: 0, already: 0, errors: [] };
  const now = new Date();
  const today = localToday(); // YYYY-MM-DD in Lagos
  const thisYear = Number(today.slice(0, 4));
  const owners = await ownerEmails(db);

  templateCache = new Map();
  queue = [];
  // Only records that could need an email now are read: new arrivals (confirmations, thank-yous),
  // shoots in the reminder and follow-up windows, and today's birthdays.
  const recentSince = new Date(now.getTime() - 7 * DAY).toISOString();
  const addDays = (n: number) => new Date(Date.parse(`${today}T12:00:00Z`) + n * DAY).toISOString().slice(0, 10);

  const safe = async (label: string, fn: () => Promise<void>) => {
    try { await fn(); } catch (err) { budget.errors.push(`${label}: ${err instanceof Error ? err.message : String(err)}`); }
  };

  // ---------- Payment acknowledgements: when a booking, rental or event is marked Paid or Part Payment ----------
  // The dashboard stamps payment_updated_at whenever payment changes; rows never touched (older payments) have none,
  // so only fresh changes are acknowledged. A part payment is acknowledged again if the amount paid changes.
  await safe("payments", async () => {
    const cutoff = new Date(now.getTime() - 48 * HOUR).toISOString();
    const sources: { table: string; item: (r: any) => string; total: (r: any) => number }[] = [
      { table: "bookings", item: (r) => r.service_summary || r.selected_service || r.shoot_type || "your booking", total: (r) => Number(r.grand_total) || 0 },
      { table: "studio_bookings", item: (r) => [r.space_name, r.rental_date].filter(Boolean).join(" · ") || "your studio rental", total: (r) => Number(r.grand_total) || 0 },
      { table: "event_bookings", item: (r) => [r.event_type, r.event_start_date].filter(Boolean).join(" · ") || "your event", total: (r) => Number(r.agreed_amount) || 0 },
    ];
    for (const src of sources) {
      const { data, error } = await db.from(src.table).select("*").in("payment_status", ["Paid", "Part Payment"]).gte("payment_updated_at", cutoff);
      if (error) throw new Error(`${src.table}: ${error.message}`);
      for (const r of data ?? []) {
        if (Date.now() - budget.start > RUN_BUDGET_MS) break;
        const email = String(r.email ?? "").trim();
        if (!EMAIL_RE.test(email)) continue;
        const total = src.total(r);
        const isPaid = r.payment_status === "Paid";
        const paid = isPaid ? total : Number(r.amount_paid) || 0;
        if (!isPaid && paid <= 0) continue;
        const id = String(r.id);
        const vars: Record<string, string> = {
          client_name: r.full_name ?? "",
          item: src.item(r),
          amount_paid: money(paid),
          total: money(total),
          balance: money(Math.max(total - paid, 0)),
        };
        await send(budget, {
          db,
          templateKey: isPaid ? "payment_paid" : "payment_part",
          dedupeKey: isPaid ? `payment_paid:${src.table}:${id}` : `payment_part:${src.table}:${id}:${paid}`,
          to: email,
          vars,
          sourceTable: src.table,
          sourceId: id,
        });
      }
    }
  });

  // ---------- Photography and wedding bookings: the full set of automations ----------
  await safe("bookings", async () => {
    const { data: recent, error } = await db
      .from("bookings")
      .select("*")
      .not("email", "is", null)
      .or(`created_at.gte.${recentSince},and(shoot_date.gte.${addDays(-47)},shoot_date.lte.${addDays(2)})`)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    // Birthdays: a small date-only scan, then full rows for just today's matches.
    const { data: dobs, error: dobErr } = await db.from("bookings").select("id, date_of_birth").not("email", "is", null).not("date_of_birth", "is", null);
    if (dobErr) throw new Error(dobErr.message);
    const have = new Set((recent ?? []).map((b: { id: string }) => String(b.id)));
    const bdayIds = (dobs ?? []).filter((r: { id: string; date_of_birth: string }) => isBirthdayToday(r.date_of_birth, today) && !have.has(String(r.id))).map((r: { id: string }) => r.id);
    const { data: bdayRows } = bdayIds.length ? await db.from("bookings").select("*").in("id", bdayIds) : { data: [] };
    const data = [...(recent ?? []), ...(bdayRows ?? [])];

    // Birthday emails go out once per person per year, even if they have several bookings.
    // Includes mail logged under the older per-booking key so nobody is mailed twice on the changeover day.
    const { data: bdayLog } = await db.from("email_log").select("recipient").eq("template_key", "birthday").like("dedupe_key", `%:${thisYear}`);
    const birthdayMailed = new Set((bdayLog ?? []).map((r: { recipient: string }) => String(r.recipient).trim().toLowerCase()));

    for (const b of data ?? []) {
      if (budget.errors.length > 20 || Date.now() - budget.start > RUN_BUDGET_MS) break;
      const email = String(b.email ?? "").trim();
      if (!EMAIL_RE.test(email)) { budget.errors.push(`booking ${b.id}: "${email}" is not a valid email`); continue; }

      try {
        const id = String(b.id);
        const at = shootAt(b.shoot_date, b.shoot_time);
        const vars: Record<string, string> = {
          client_name: b.full_name ?? "",
          client_whatsapp: String(b.phone ?? ""),
          client_email: email,
          service_summary: b.service_summary ?? "",
          shoot_date: b.shoot_date ?? "",
          shoot_time: b.shoot_time ?? "",
          location: b.location ?? "",
          shoot_setting: b.shoot_setting ?? "",
          shoot_type: b.shoot_type ?? "",
          grand_total: money(b.grand_total),
          details: detailsTable([line("Name", b.full_name), line("WhatsApp", b.phone), line("Email", email), line("Gender", b.gender), line("Birthday", b.date_of_birth), line("Shoot type", b.shoot_type), line("Date", b.shoot_date), line("Time", b.shoot_time), line("Location", `${b.location ?? ""} (${b.shoot_setting ?? ""})`), line("Package", b.service_summary), line("Extras", b.selected_extras), line("Outfits", b.outfits), line("Total", money(b.grand_total)), line("Socials", b.social_handles), line("Inspiration / notes", b.inspiration_links)]),
        };
        const src = { sourceTable: "bookings", sourceId: id };

        // Confirmation + owner alert: once, when the booking arrives. Manual admin entries are not announced.
        if (b.source !== "manual") {
          await send(budget, { db, templateKey: "booking_confirmation", dedupeKey: `booking_confirmation:bookings:${id}`, to: email, vars, ...src });
          if (owners.length) await send(budget, { db, templateKey: "owner_booking", dedupeKey: `owner_booking:bookings:${id}`, to: owners, vars, replyTo: email, ...src });
        }

        // Shoot reminders. The windows don't overlap, so a booking gets only the closest one.
        if (at) {
          const hours = (at.getTime() - now.getTime()) / HOUR;
          const days = (now.getTime() - at.getTime()) / DAY;
          if (hours > 12 && hours <= 24) await send(budget, { db, templateKey: "reminder_24h", dedupeKey: `reminder_24h:bookings:${id}`, to: email, vars, ...src });
          else if (hours > 2 && hours <= 12) await send(budget, { db, templateKey: "reminder_12h", dedupeKey: `reminder_12h:bookings:${id}`, to: email, vars, ...src });
          else if (hours > 0 && hours <= 2) await send(budget, { db, templateKey: "reminder_2h", dedupeKey: `reminder_2h:bookings:${id}`, to: email, vars, ...src });

          if (days >= 14 && days < 21) await send(budget, { db, templateKey: "review_request", dedupeKey: `review_request:bookings:${id}`, to: email, vars, ...src });
          if (days >= 40 && days < 47) await send(budget, { db, templateKey: "re_engagement", dedupeKey: `re_engagement:bookings:${id}`, to: email, vars, ...src });
        }

        if (b.created_at) {
          const sinceBooking = (now.getTime() - new Date(b.created_at).getTime()) / HOUR;
          if (sinceBooking >= 24 && sinceBooking < 72) await send(budget, { db, templateKey: "thank_you", dedupeKey: `thank_you:bookings:${id}`, to: email, vars, ...src });
        }

        if (isBirthdayToday(b.date_of_birth, today) && !birthdayMailed.has(email.toLowerCase())) {
          birthdayMailed.add(email.toLowerCase());
          await send(budget, { db, templateKey: "birthday", dedupeKey: `birthday:${email.toLowerCase()}:${thisYear}`, to: email, vars, ...src });
        }
      } catch (err) {
        budget.errors.push(`booking ${b.id}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  });

  // ---------- Owner birthday digest: one email at 7am (Lagos) listing today's client birthdays ----------
  // Built from its own query (not the loop above) so the list is complete, and keyed by date so it is sent once a day.
  await safe("owner-birthdays", async () => {
    if (!owners.length || lagosHour() < 7) return;
    // Already sent today: skip the scan.
    if ((await loggedKeys(db, [`owner_birthday:${today}`])).size) return;
    const { data, error } = await db.from("bookings").select("full_name, phone, email, date_of_birth, shoot_type").not("date_of_birth", "is", null);
    if (error) throw new Error(error.message);

    // One line per person (a client with several bookings is listed once).
    const people = new Map<string, { name: string; whatsapp: string; email: string; shoot: string }>();
    for (const b of data ?? []) {
      if (!isBirthdayToday(b.date_of_birth, today)) continue;
      const key = String(b.email || b.phone || b.full_name).trim().toLowerCase();
      if (!people.has(key)) {
        people.set(key, { name: b.full_name ?? "", whatsapp: String(b.phone ?? ""), email: String(b.email ?? ""), shoot: b.shoot_type ?? "" });
      }
    }
    if (people.size === 0) return;

    const rows = [...people.values()].map((p) => {
      const digits = p.whatsapp.replace(/\D/g, "");
      // Nigerian numbers saved as 0801... or 801... are turned into international format for the WhatsApp link.
      const intl = digits.startsWith("234") ? digits : digits.startsWith("0") ? `234${digits.slice(1)}` : digits.length === 10 ? `234${digits}` : digits;
      const wa = intl ? ` &middot; <a href="https://wa.me/${intl}" style="color:${INK};">Message on WhatsApp</a>` : "";
      return `<tr><td style="padding:14px 0;border-bottom:1px solid ${LINE};font-family:${SANS};font-size:14px;line-height:1.6;color:${INK};">` +
        `<strong>${esc(p.name)}</strong><br/>${esc(p.whatsapp || "no WhatsApp number")}${wa}<br/>${esc(p.email || "no email")}` +
        `${p.shoot ? `<br/><span style="color:${MUTED};">Last shoot type: ${esc(p.shoot)}</span>` : ""}</td></tr>`;
    });
    const vars: Record<string, string> = {
      client_count: String(people.size),
      date: today,
      details: `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-top:1px solid ${LINE};">${rows.join("")}</table>`,
    };
    await send(budget, { db, templateKey: "owner_birthday", dedupeKey: `owner_birthday:${today}`, to: owners, vars });
  });

  // ---------- Studio space rentals: confirmation + owner alert ----------
  await safe("studio", async () => {
    const { data, error } = await db.from("studio_bookings").select("*").not("email", "is", null).gte("created_at", recentSince);
    if (error) throw new Error(error.message);
    for (const s of data ?? []) {
      if (Date.now() - budget.start > RUN_BUDGET_MS) break;
      const email = String(s.email ?? "").trim();
      if (!EMAIL_RE.test(email) || s.source === "manual") continue;
      const id = String(s.id);
      const vars: Record<string, string> = {
        client_name: s.full_name ?? "",
        client_whatsapp: String(s.phone ?? ""),
        client_email: email,
        space_name: s.space_name ?? "",
        rental_date: s.rental_date ?? "",
        rental_time: s.rental_time ?? "",
        duration: String(s.duration_minutes ?? 30),
        extras: s.selected_extras || "-",
        grand_total: money(s.grand_total),
        details: detailsTable([line("Name", s.full_name), line("WhatsApp", s.phone), line("Email", email), line("Space", s.space_name), line("Date", s.rental_date), line("Time", s.rental_time), line("Duration", `${s.duration_minutes ?? 30} minutes`), line("Extras", s.selected_extras), line("Total", money(s.grand_total)), line("Notes", s.notes)]),
      };
      const src = { sourceTable: "studio_bookings", sourceId: id };
      await send(budget, { db, templateKey: "studio_confirmation", dedupeKey: `studio_confirmation:studio_bookings:${id}`, to: email, vars, ...src });
      if (owners.length) await send(budget, { db, templateKey: "owner_studio", dedupeKey: `owner_studio:studio_bookings:${id}`, to: owners, vars, replyTo: email, ...src });
    }
  });

  // ---------- Event bookings: confirmation + owner alert ----------
  await safe("events", async () => {
    const { data, error } = await db.from("event_bookings").select("*").not("email", "is", null).gte("created_at", recentSince);
    if (error) throw new Error(error.message);
    for (const ev of data ?? []) {
      if (Date.now() - budget.start > RUN_BUDGET_MS) break;
      const email = String(ev.email ?? "").trim();
      if (!EMAIL_RE.test(email) || ev.source === "manual") continue;
      const id = String(ev.id);
      const dates = ev.event_start_date ? `${ev.event_start_date}${ev.event_end_date && ev.event_end_date !== ev.event_start_date ? ` to ${ev.event_end_date}` : ""}` : "-";
      const vars: Record<string, string> = {
        client_name: ev.full_name ?? "",
        client_whatsapp: String(ev.phone ?? ""),
        client_email: email,
        event_type: ev.event_type ?? "",
        event_dates: dates,
        event_time: ev.event_time ?? "-",
        venue: ev.venue ?? "-",
        agreed_amount: money(ev.agreed_amount),
        details: detailsTable([line("Name", ev.full_name), line("WhatsApp", ev.phone), line("Email", email), line("Event", ev.event_type), line("Dates", dates), line("Start time", ev.event_time), line("Venue", ev.venue), line("Expected guests", ev.expected_guests), line("Agreed amount", money(ev.agreed_amount)), line("Notes", ev.notes)]),
      };
      const src = { sourceTable: "event_bookings", sourceId: id };
      await send(budget, { db, templateKey: "event_confirmation", dedupeKey: `event_confirmation:event_bookings:${id}`, to: email, vars, ...src });
      if (owners.length) await send(budget, { db, templateKey: "owner_event", dedupeKey: `owner_event:event_bookings:${id}`, to: owners, vars, replyTo: email, ...src });
    }
  });

  await safe("send", () => flush(db, budget));

  if (Date.now() - budget.start > RUN_BUDGET_MS) budget.errors.push("Time budget reached; the rest is picked up on the next run.");
  return json({ ok: true, ...budget, ranAt: now.toISOString() });
});
