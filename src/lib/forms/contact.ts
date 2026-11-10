/**
 * Contact form rules. The SAME file is copied to supabase/functions/_shared/contact-rules.ts
 * (scripts/sync-shared.mjs) so the browser and the server validate identically.
 */
export type ContactInput = {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  service: string;
  service_other: string;
  event_date: string;
  location: string;
  instagram: string;
  heard_from: string;
  message: string;
  /** honeypot: real people never see or fill this */
  website: string;
};

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_RE = /^\+?[0-9 ()\-.]{7,20}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export type FieldErrors = Partial<Record<keyof ContactInput, string>>;

const clip = (v: unknown, n: number) => String(v ?? "").trim().slice(0, n);

export function normalizeContact(raw: Partial<Record<keyof ContactInput, unknown>>): ContactInput {
  return {
    first_name: clip(raw.first_name, 80),
    last_name: clip(raw.last_name, 80),
    email: clip(raw.email, 200).toLowerCase(),
    phone: clip(raw.phone, 30),
    service: clip(raw.service, 80),
    service_other: clip(raw.service_other, 200),
    event_date: clip(raw.event_date, 10),
    location: clip(raw.location, 200),
    instagram: clip(raw.instagram, 80),
    heard_from: clip(raw.heard_from, 80),
    message: clip(raw.message, 5000),
    website: clip(raw.website, 200),
  };
}

export function validateContact(v: ContactInput, opts: { services?: string[]; today?: string } = {}): FieldErrors {
  const e: FieldErrors = {};
  if (!v.first_name) e.first_name = "This field is required.";
  if (!v.last_name) e.last_name = "This field is required.";
  if (!v.email) e.email = "This field is required.";
  else if (!EMAIL_RE.test(v.email)) e.email = "Please enter a valid email address.";
  if (!v.phone) e.phone = "This field is required.";
  else if (!PHONE_RE.test(v.phone) || v.phone.replace(/\D/g, "").length < 7) e.phone = "Please enter a valid phone number.";
  if (!v.service) e.service = "This field is required.";
  else if (opts.services?.length && !opts.services.includes(v.service)) e.service = "Please choose a service from the list.";
  if (/^others?$/i.test(v.service) && !v.service_other) e.service_other = "Please describe the service.";
  if (!v.event_date) e.event_date = "This field is required.";
  else if (!DATE_RE.test(v.event_date) || Number.isNaN(Date.parse(v.event_date))) e.event_date = "Please enter a valid date.";
  else if (opts.today && v.event_date < opts.today) e.event_date = "Please choose a date in the future.";
  if (!v.location) e.location = "This field is required.";
  return e;
}

/** Honeypot filled in, or the form was submitted impossibly fast: treat as spam. */
export const looksLikeSpam = (v: ContactInput, msSinceRender?: number) => !!v.website || (msSinceRender !== undefined && msSinceRender < 2500);
