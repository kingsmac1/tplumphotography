#!/usr/bin/env node
/**
 * Tplum-branded account emails (password reset, invite, email confirmation, email change, sign-in link), sent by
 * Supabase Auth through Resend as "Tplum Photography <info@tplumphotography.com>".
 *
 *   node scripts/auth-emails.mjs            writes the templates to supabase/templates/*.html (for review / preview)
 *   node scripts/auth-emails.mjs --apply    also sets Supabase Auth to send through Resend's SMTP with these
 *                                           templates and subjects (needs RESEND_API_KEY in .secrets.local)
 *
 * Supabase only allows custom templates when a custom SMTP provider is set, hence the two together.
 * Every link opens /account/ with a one-time code (token_hash), which signs the person in and shows the right screen
 * (choose a new password, email confirmed, …). Nothing secret is printed.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const SENDER_NAME = "Tplum Photography";
const SENDER_EMAIL = "info@tplumphotography.com";

/* ---------------- the shared layout (table-based and inline-styled, so it holds up in Gmail and Outlook) ---------------- */
const layout = ({ preheader, title, intro, button, linkType, note }) => {
  const link = `{{ .SiteURL }}/account/?token_hash={{ .TokenHash }}&type=${linkType}`;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light only">
<title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#f1ede6;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:#f1ede6;">${preheader}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f1ede6;">
  <tr>
    <td align="center" style="padding:36px 16px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">
        <!-- header: the white Tplum logo on black -->
        <tr>
          <td align="center" style="background:#0a0a0a;border-radius:18px 18px 0 0;padding:30px 24px 26px;">
            <a href="{{ .SiteURL }}" style="text-decoration:none;">
              <img src="{{ .SiteURL }}/brand/tplum-logo-white.png" width="132" height="74" alt="Tplum Photography" style="display:block;border:0;width:132px;height:auto;">
            </a>
          </td>
        </tr>
        <!-- body -->
        <tr>
          <td style="background:#ffffff;padding:40px 44px 36px;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;color:#1f1d1a;">
            <h1 style="margin:0 0 16px;font-family:Georgia,'Times New Roman',serif;font-weight:normal;font-size:30px;line-height:1.15;color:#0a0a0a;">${title}</h1>
            <p style="margin:0 0 28px;font-size:15px;line-height:1.65;color:#3a3733;">${intro}</p>
            <table role="presentation" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td align="center" bgcolor="#0a0a0a" style="border-radius:999px;">
                  <a href="${link}" style="display:inline-block;padding:15px 30px;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:14px;font-weight:bold;color:#ffffff;text-decoration:none;border-radius:999px;">${button}</a>
                </td>
              </tr>
            </table>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:32px;">
              <tr><td style="border-top:1px solid #e9e4dc;font-size:0;line-height:0;">&nbsp;</td></tr>
            </table>
            <p style="margin:20px 0 6px;font-size:12px;line-height:1.6;color:#6f6a62;">Button not working? Copy this link into your browser:</p>
            <p style="margin:0 0 18px;font-size:12px;line-height:1.5;word-break:break-all;"><a href="${link}" style="color:#6f6a62;text-decoration:underline;">${link}</a></p>
            <p style="margin:0;font-size:12px;line-height:1.6;color:#6f6a62;">${note}</p>
          </td>
        </tr>
        <!-- footer -->
        <tr>
          <td align="center" style="background:#faf8f4;border-radius:0 0 18px 18px;padding:24px 24px 26px;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
            <p style="margin:0 0 6px;font-family:Georgia,'Times New Roman',serif;font-style:italic;font-size:14px;color:#3a3733;">...capturing moments beautifully.</p>
            <p style="margin:0;font-size:12px;line-height:1.7;color:#8a847b;">
              Tplum Photography &middot; Calgary | Edmonton | Toronto<br>
              <a href="https://tplumphotography.com" style="color:#8a847b;text-decoration:underline;">tplumphotography.com</a> &middot; <a href="tel:+14034935511" style="color:#8a847b;text-decoration:none;">+1 403 493 5511</a>
            </p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>
`;
};

const IGNORE = "If you didn't ask for this, you can safely ignore this email. Your account stays as it is.";
export const EMAILS = {
  recovery: {
    subject: "Reset your Tplum Photography password",
    html: layout({
      preheader: "Choose a new password for your Tplum Photography account.",
      title: "Reset your password",
      intro: "We received a request to reset the password for <b>{{ .Email }}</b>. Choose a new one with the button below and you'll be signed straight back in.",
      button: "Choose a new password",
      linkType: "recovery",
      note: `This link works once and expires in one hour. ${IGNORE}`,
    }),
  },
  invite: {
    subject: "Your Tplum Photography account is ready",
    html: layout({
      preheader: "Set your password to open your Tplum Photography account.",
      title: "Welcome to Tplum Photography",
      intro: "An account has been created for <b>{{ .Email }}</b>. Set your password to get started; you'll use it with this email to sign in from now on.",
      button: "Set your password",
      linkType: "invite",
      note: "This link works once and expires in 24 hours. If it has expired, use “Forgot password?” on the sign-in page to get a new one.",
    }),
  },
  confirmation: {
    subject: "Confirm your email for Tplum Photography",
    html: layout({
      preheader: "One click to confirm your email and finish your account.",
      title: "Confirm your email",
      intro: "Thanks for creating an account with Tplum Photography. Confirm <b>{{ .Email }}</b> to see your bookings, galleries and downloads in one place.",
      button: "Confirm my email",
      linkType: "email",
      note: `This link works once and expires in 24 hours. ${IGNORE}`,
    }),
  },
  email_change: {
    subject: "Confirm your new email for Tplum Photography",
    html: layout({
      preheader: "Confirm the new email address for your Tplum Photography account.",
      title: "Confirm your new email",
      intro: "You asked to change the email on your Tplum Photography account from <b>{{ .Email }}</b> to <b>{{ .NewEmail }}</b>. Confirm it with the button below.",
      button: "Confirm new email",
      linkType: "email_change",
      note: "This link works once and expires in 24 hours. If you didn't ask for this, ignore this email and your email address stays the same.",
    }),
  },
  magic_link: {
    subject: "Your Tplum Photography sign-in link",
    html: layout({
      preheader: "Your one-time link to sign in to Tplum Photography.",
      title: "Sign in to Tplum Photography",
      intro: "Use the button below to sign in as <b>{{ .Email }}</b>. No password needed.",
      button: "Sign in",
      linkType: "magiclink",
      note: `This link works once and expires in one hour. ${IGNORE}`,
    }),
  },
};

/* ---------------- write the files ---------------- */
const dir = join(root, "supabase", "templates");
mkdirSync(dir, { recursive: true });
for (const [name, e] of Object.entries(EMAILS)) writeFileSync(join(dir, `${name}.html`), e.html);
console.log(`templates written: ${Object.keys(EMAILS).map((n) => `supabase/templates/${n}.html`).join(", ")}`);

/* ---------------- apply to Supabase ---------------- */
if (process.argv.includes("--apply")) {
  const env = Object.fromEntries(
    readFileSync(join(root, ".secrets.local"), "utf8").split(/\r?\n/).filter((l) => /^[A-Za-z0-9_]+=/.test(l)).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]),
  );
  const need = ["SUPABASE_ACCESS_TOKEN", "SUPABASE_PROJECT_REF", "RESEND_API_KEY"].filter((k) => !env[k]);
  if (need.length) { console.error(`Missing in .secrets.local: ${need.join(", ")}`); process.exit(1); }
  const body = {
    smtp_admin_email: SENDER_EMAIL,
    smtp_sender_name: SENDER_NAME,
    smtp_host: "smtp.resend.com",
    smtp_port: "465",
    smtp_user: "resend",
    smtp_pass: env.RESEND_API_KEY,
    smtp_max_frequency: 30,
    rate_limit_email_sent: 60,
  };
  for (const [name, e] of Object.entries(EMAILS)) {
    body[`mailer_subjects_${name}`] = e.subject;
    body[`mailer_templates_${name}_content`] = e.html;
  }
  const r = await fetch(`https://api.supabase.com/v1/projects/${env.SUPABASE_PROJECT_REF}/config/auth`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${env.SUPABASE_ACCESS_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) { console.error(`Supabase refused (${r.status}): ${d.message ?? "unknown error"}`); process.exit(1); }
  console.log(`applied: sender ${d.smtp_sender_name} <${d.smtp_admin_email}> via ${d.smtp_host}; subjects: ${Object.keys(EMAILS).map((n) => d[`mailer_subjects_${n}`]).join(" | ")}`);
}
