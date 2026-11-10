import { Mail, MessageSquare, Phone } from "lucide-react";

const PREFILL_KEY = "tplum_email_prefill";
export const COMPOSE_EVENT = "tplum:compose-email";

/** A stored phone number as dialable digits with country code (North American numbers get +1). */
export const phoneDigits = (raw: string | null | undefined): string => {
  const t = String(raw ?? "").trim();
  const digits = t.replace(/\D/g, "");
  if (!digits) return "";
  if (t.startsWith("+")) return `+${digits}`;
  if (digits.length === 10) return `+1${digits}`;
  return `+${digits}`;
};
/** (403) 555-0123 for North American numbers; other numbers are shown as stored. */
export const formatPhone = (raw: string | null | undefined): string => {
  const d = phoneDigits(raw);
  const m = /^\+1(\d{3})(\d{3})(\d{4})$/.exec(d);
  return m ? `(${m[1]}) ${m[2]}-${m[3]}` : String(raw ?? "");
};
/** kept for DMI code that still imports the old name */
export const whatsAppDigits = phoneDigits;

/** Opens the dashboard's email messenger with this address already in the audience field. */
export const openEmailTo = (email: string) => {
  try { sessionStorage.setItem(PREFILL_KEY, email); } catch { /* the event below still carries it */ }
  window.dispatchEvent(new CustomEvent(COMPOSE_EVENT, { detail: email }));
};

/** The address waiting to be prefilled, if any. `take` also clears it so it applies once. */
export const peekEmailPrefill = (): string => {
  try { return sessionStorage.getItem(PREFILL_KEY) ?? ""; } catch { return ""; }
};
export const takeEmailPrefill = (): string => {
  const v = peekEmailPrefill();
  try { sessionStorage.removeItem(PREFILL_KEY); } catch { /* ignore */ }
  return v;
};

type Props = { name?: string | null; phone?: string | null; email?: string | null };

const btn = "p-1.5 rounded transition-colors";

/** Call, text and email buttons for a table row: one click to contact the person. */
export const ContactActions = ({ name, phone, email }: Props) => {
  const tel = phoneDigits(phone);
  const mail = (email ?? "").trim();
  return (
    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
      {tel ? (
        <>
          <a href={`tel:${tel}`} aria-label={`Call ${name || "client"}`} title={`Call ${formatPhone(phone)}`} className={`${btn} text-foreground/70 hover:text-foreground hover:bg-muted/50`}><Phone size={15} /></a>
          <a href={`sms:${tel}`} aria-label={`Text ${name || "client"}`} title="Send a text message" className={`${btn} text-foreground/70 hover:text-foreground hover:bg-muted/50`}><MessageSquare size={15} /></a>
        </>
      ) : (
        <span aria-hidden title="No phone number" className={`${btn} text-muted-foreground/30 cursor-not-allowed`}><Phone size={15} /></span>
      )}
      {mail ? (
        <button type="button" onClick={() => openEmailTo(mail)} aria-label={`Email ${name || "client"}`} title="Write an email"
          className={`${btn} text-foreground/70 hover:text-foreground hover:bg-muted/50`}>
          <Mail size={15} />
        </button>
      ) : (
        <span aria-hidden title="No email address" className={`${btn} text-muted-foreground/30 cursor-not-allowed`}><Mail size={15} /></span>
      )}
    </div>
  );
};
