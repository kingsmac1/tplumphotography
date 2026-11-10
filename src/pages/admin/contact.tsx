import { Mail, MessageCircle } from "lucide-react";

const PREFILL_KEY = "dmi_email_prefill";
export const COMPOSE_EVENT = "dmi:compose-email";

/** Turns a stored phone number (0801…, 801…, +234…, 234…) into the international digits wa.me needs. */
export const whatsAppDigits = (raw: string | null | undefined): string => {
  const digits = String(raw ?? "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("234")) return digits;
  if (digits.startsWith("0")) return `234${digits.slice(1)}`;
  if (digits.length === 10) return `234${digits}`;
  return digits;
};

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

/** WhatsApp and Email buttons for a table row: one click to contact the person. */
export const ContactActions = ({ name, phone, email }: Props) => {
  const wa = whatsAppDigits(phone);
  const mail = (email ?? "").trim();
  const first = (name ?? "").trim().split(/\s+/)[0];
  const waHref = wa ? `https://wa.me/${wa}${first ? `?text=${encodeURIComponent(`Hi ${first}, `)}` : ""}` : "";
  return (
    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
      {wa ? (
        <a href={waHref} target="_blank" rel="noopener noreferrer" aria-label={`WhatsApp ${name || "client"}`} title="Message on WhatsApp"
          className={`${btn} text-green-700 hover:bg-green-600/10`}>
          <MessageCircle size={15} />
        </a>
      ) : (
        <span aria-hidden title="No WhatsApp number" className={`${btn} text-muted-foreground/30 cursor-not-allowed`}><MessageCircle size={15} /></span>
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
