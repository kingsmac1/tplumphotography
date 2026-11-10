// Dashboard-only: the Messaging page and template test sends. Requires a signed-in admin.

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

export async function loadTemplate(db: SupabaseClient, key: string): Promise<TemplateRow | null> {
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

const GROUPS = ["individual", "all_clients", "photography", "wedding", "studio", "events", "academy"] as const;
const NO_BATCH = "__none__";
type Group = (typeof GROUPS)[number];

const SEND_GAP_MS = 600;
const CHUNK = 2;
const RUN_BUDGET_MS = 110_000;

const SAMPLE_VARS: Record<string, string> = {
  client_name: "Sample Client",
  service_summary: "Individual - $50,000",
  shoot_date: "2026-10-20",
  shoot_time: "10:00",
  location: "Uyo",
  shoot_setting: "Indoor",
  shoot_type: "Portrait",
  grand_total: "$50,000",
  space_name: "Studio Backdrop (with AC)",
  rental_date: "2026-10-20",
  rental_time: "14:00",
  duration: "30",
  extras: "Props x2",
  event_type: "Birthday Party",
  event_dates: "2026-11-02",
  event_time: "16:00",
  venue: "DMI Studio, Uyo",
  agreed_amount: "$150,000",
  item: "Couple - $150,000",
  amount_paid: "$50,000",
  total: "$150,000",
  balance: "$100,000",
  client_count: "2",
  date: "2026-10-20",
  client_whatsapp: "08012345678",
  client_email: "client@example.com",
  details: detailsTable([["Name", "Sample Client"], ["Total", "$50,000"]]),
};

/** Academy batches are free text (e.g. "2026, Batch A"), so the filter matches the stored value exactly. */
function academyBatchFilter(batch: string) {
  if (!batch || batch === "all") return undefined;
  if (batch === NO_BATCH) return (q: any) => q.or("academic_year_batch.is.null,academic_year_batch.eq.");
  return (q: any) => q.eq("academic_year_batch", batch);
}

/** Lowercased, de-duplicated emails from one table, using a column that holds the email. */
async function emailsFrom(db: SupabaseClient, table: string, filter?: (q: any) => any): Promise<string[]> {
  let q = db.from(table).select("email").not("email", "is", null);
  if (filter) q = filter(q);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []).map((r: { email: string }) => String(r.email).trim().toLowerCase()).filter((e) => EMAIL_RE.test(e));
}

async function recipientsFor(db: SupabaseClient, group: Group, customEmails: string, batch = "all"): Promise<string[]> {
  let list: string[];
  if (group === "individual") {
    list = customEmails.split(/[\n,]+/).map((e) => e.trim().toLowerCase()).filter(Boolean);
    const invalid = list.filter((e) => !EMAIL_RE.test(e));
    if (invalid.length) throw new Error(`Invalid email address(es): ${invalid.join(", ")}`);
  } else if (group === "photography") {
    list = await emailsFrom(db, "bookings", (q) => q.or("source.is.null,source.neq.wedding_form"));
  } else if (group === "wedding") {
    list = await emailsFrom(db, "bookings", (q) => q.eq("source", "wedding_form"));
  } else if (group === "studio") {
    list = await emailsFrom(db, "studio_bookings");
  } else if (group === "events") {
    list = await emailsFrom(db, "event_bookings");
  } else if (group === "academy") {
    list = await emailsFrom(db, "academy_applications", academyBatchFilter(batch));
  } else {
    list = [
      ...(await emailsFrom(db, "bookings")),
      ...(await emailsFrom(db, "studio_bookings")),
      ...(await emailsFrom(db, "event_bookings")),
    ];
  }
  return [...new Set(list)];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  const asUser = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
  });
  const { data: isAdmin } = await asUser.rpc("is_admin");
  if (!isAdmin) return json({ error: "Only signed-in admins can send email from the dashboard." }, 403);
  const { data: userData } = await asUser.auth.getUser();
  const adminEmail = userData.user?.email ?? "";

  const db = serviceDb();
  const body = await req.json().catch(() => ({}));
  const action = String(body.action ?? "send");

  try {
    if (action === "counts") {
      const counts: Record<string, number> = {};
      for (const g of GROUPS) if (g !== "individual") counts[g] = (await recipientsFor(db, g, "")).length;
      return json({ counts });
    }

    if (action === "academy_batches") {
      const { data, error } = await db.from("academy_applications").select("academic_year_batch, email").not("email", "is", null);
      if (error) throw new Error(error.message);
      const byBatch = new Map<string, Set<string>>();
      for (const row of data ?? []) {
        const email = String(row.email ?? "").trim().toLowerCase();
        if (!EMAIL_RE.test(email)) continue;
        const raw = String(row.academic_year_batch ?? "");
        const key = raw.trim() ? raw : NO_BATCH;
        if (!byBatch.has(key)) byBatch.set(key, new Set());
        byBatch.get(key)!.add(email);
      }
      const batches = [...byBatch.entries()]
        .map(([value, emails]) => ({ value, label: value === NO_BATCH ? "No batch given" : value.trim(), count: emails.size }))
        .sort((a, b) => a.label.localeCompare(b.label));
      return json({ batches });
    }

    if (action === "test") {
      if (!adminEmail) return json({ error: "Your account has no email address." }, 400);
      const id = await sendResend({ to: adminEmail, subject: `[Test] ${body.subject}`, html: String(body.body ?? "") });
      return json({ sent: 1, failed: [], total: 1, to: adminEmail, id });
    }

    if (action === "test_template") {
      // Default: the email address you signed in to the dashboard with. "owners" sends to the saved owner list instead.
      const toOwners = body.send_to === "owners";
      const recipients = toOwners ? await ownerEmails(db) : adminEmail ? [adminEmail] : [];
      if (recipients.length === 0) {
        return json({ error: toOwners ? "No owner email addresses are saved yet. Add them under Owner notification recipients." : "Your account has no email address." }, 400);
      }
      const template = await loadTemplate(db, String(body.template_key ?? ""));
      if (!template) return json({ error: "That template doesn't exist yet. Run the SQL setup first." }, 404);
      const id = await sendResend({
        to: recipients,
        subject: `[Test] ${render(template.subject, SAMPLE_VARS)}`,
        html: render(template.body, SAMPLE_VARS),
        design: design(template.key, SAMPLE_VARS),
      });
      return json({ sent: recipients.length, failed: [], total: recipients.length, to: recipients.join(", "), id });
    }

    // action === "send"
    const group = String(body.recipient_group ?? "") as Group;
    if (!GROUPS.includes(group)) return json({ error: "Pick who to send to." }, 400);
    const subject = String(body.subject ?? "").trim();
    const html = String(body.body ?? "");
    if (!subject) return json({ error: "Subject is required." }, 400);
    if (!html.trim()) return json({ error: "Message body is required." }, 400);

    const academyBatch = String(body.academy_batch ?? "all");
    const recipients = await recipientsFor(db, group, String(body.custom_emails ?? ""), academyBatch);
    if (recipients.length === 0) return json({ error: "No recipients found for this selection." }, 400);

    const attachments = Array.isArray(body.attachments)
      ? body.attachments.map((a: { filename: string; content: string }) => ({ filename: a.filename, content: a.content }))
      : [];

    const started = Date.now();
    let sent = 0;
    const failed: string[] = [];
    for (let i = 0; i < recipients.length; i += CHUNK) {
      if (Date.now() - started > RUN_BUDGET_MS) {
        failed.push(...recipients.slice(i).map((r) => `${r} (not sent: time limit reached, send again to the rest)`));
        break;
      }
      const chunk = recipients.slice(i, i + CHUNK);
      const results = await Promise.allSettled(
        chunk.map((to) => sendResend({ to, subject, html, attachments: attachments.length ? attachments : undefined })),
      );
      results.forEach((r, idx) => {
        if (r.status === "fulfilled") sent++;
        else failed.push(`${chunk[idx]} (${r.reason instanceof Error ? r.reason.message : String(r.reason)})`);
      });
      if (i + CHUNK < recipients.length) await new Promise((r) => setTimeout(r, SEND_GAP_MS));
    }

    await db.from("email_campaigns").insert({
      sent_by: adminEmail || null,
      subject,
      body: html,
      recipient_group: group === "individual" ? `individual (${recipients.length})` : group === "academy" && academyBatch !== "all" ? `academy: ${academyBatch}` : group,
      recipient_count: recipients.length,
      sent_count: sent,
      failed_count: failed.length,
      failed_list: failed.length ? failed.slice(0, 50).join("\n") : null,
    });

    return json({ sent, failed, total: recipients.length });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : String(err) }, 400);
  }
});
