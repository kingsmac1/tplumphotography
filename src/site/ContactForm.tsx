import { useMemo, useRef, useState, type FormEvent } from "react";
import type { ContactContent } from "@/cms/types";
import { looksLikeSpam, normalizeContact, validateContact, type ContactInput, type FieldErrors } from "@/lib/forms/contact";
import { callFunction } from "@/lib/functions";

const COUNTRIES: [code: string, flag: string, dial: string, name: string][] = [
  ["CA", "🇨🇦", "+1", "Canada"], ["US", "🇺🇸", "+1", "United States"], ["GB", "🇬🇧", "+44", "United Kingdom"], ["NG", "🇳🇬", "+234", "Nigeria"],
  ["GH", "🇬🇭", "+233", "Ghana"], ["FR", "🇫🇷", "+33", "France"], ["DE", "🇩🇪", "+49", "Germany"], ["IN", "🇮🇳", "+91", "India"],
  ["PH", "🇵🇭", "+63", "Philippines"], ["JM", "🇯🇲", "+1", "Jamaica"], ["KE", "🇰🇪", "+254", "Kenya"], ["ZA", "🇿🇦", "+27", "South Africa"],
  ["AU", "🇦🇺", "+61", "Australia"], ["MX", "🇲🇽", "+52", "Mexico"], ["IT", "🇮🇹", "+39", "Italy"], ["ES", "🇪🇸", "+34", "Spain"],
];
const PLACEHOLDER: Record<string, string> = { CA: "(506) 234-5678", US: "(201) 555-0123", GB: "07400 123456", NG: "0802 123 4567" };

const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Edmonton" }).format(new Date());

/** The Contact page form (fields and look of the original WPForms form). Validates in the browser and again on the server. */
export default function ContactForm({ form }: { form: ContactContent["form"] }) {
  const L = form.labels;
  const empty: ContactInput = { first_name: "", last_name: "", email: "", phone: "", service: form.serviceOptions[0] ?? "", service_other: "", event_date: "", location: "", instagram: "", heard_from: form.heardOptions[0] ?? "", message: "", website: "" };
  const [v, setV] = useState<ContactInput>(empty);
  const [cc, setCc] = useState("CA");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [state, setState] = useState<"idle" | "sending" | "done">("idle");
  const [fail, setFail] = useState("");
  const rendered = useRef(Date.now());
  const country = useMemo(() => COUNTRIES.find((c) => c[0] === cc)!, [cc]);
  const set = (k: keyof ContactInput) => (e: { target: { value: string } }) => { setV((x) => ({ ...x, [k]: e.target.value })); if (errors[k]) setErrors((x) => ({ ...x, [k]: undefined })); };
  const isOthers = /^others?$/i.test(v.service);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setFail("");
    const phone = v.phone && !v.phone.trim().startsWith("+") ? `${country[2]} ${v.phone.trim()}` : v.phone;
    const data = normalizeContact({ ...v, phone });
    const errs = validateContact(data, { services: form.serviceOptions, today: today() });
    setErrors(errs);
    if (Object.keys(errs).length) {
      document.querySelector<HTMLElement>(".tp-form .invalid")?.focus();
      return;
    }
    if (looksLikeSpam(data, Date.now() - rendered.current)) { setState("done"); return; }
    setState("sending");
    const res = await callFunction("form-submit", { form: "contact", ...data });
    if (res.ok) { setState("done"); return; }
    setState("idle");
    if (!res.ok && res.fields) setErrors(res.fields as FieldErrors);
    setFail(res.error);
  }

  if (state === "done") return <div className="tp-form" role="status"><div className="done">{form.success}</div></div>;

  const err = (k: keyof ContactInput) => errors[k] && <div className="err" id={`err-${k}`}>{errors[k]}</div>;
  const aria = (k: keyof ContactInput) => ({ "aria-invalid": !!errors[k] || undefined, "aria-describedby": errors[k] ? `err-${k}` : undefined, className: errors[k] ? "invalid" : undefined });

  return (
    <form className="tp-form" noValidate onSubmit={submit}>
      <fieldset className="field" style={{ border: 0, margin: 0, padding: "15px 0" }}>
        <legend className="l">{L.name} <span className="req">*</span></legend>
        <div className="row">
          <div><input id="cf-first" autoComplete="given-name" value={v.first_name} onChange={set("first_name")} required {...aria("first_name")} /><label className="sub" htmlFor="cf-first">{L.first}</label>{err("first_name")}</div>
          <div><input id="cf-last" autoComplete="family-name" value={v.last_name} onChange={set("last_name")} required {...aria("last_name")} /><label className="sub" htmlFor="cf-last">{L.last}</label>{err("last_name")}</div>
        </div>
      </fieldset>
      <div className="row stack">
        <div className="field"><label className="l" htmlFor="cf-email">{L.email} <span className="req">*</span></label><input id="cf-email" type="email" autoComplete="email" value={v.email} onChange={set("email")} required {...aria("email")} />{err("email")}</div>
        <div className="field">
          <label className="l" htmlFor="cf-phone">{L.phone} <span className="req">*</span></label>
          <div className="phone">
            <select className="cc" aria-label="Country code" value={cc} onChange={(e) => setCc(e.target.value)}>
              {COUNTRIES.map(([code, flag, dial, name]) => <option key={code} value={code} title={`${name} ${dial}`}>{flag}</option>)}
            </select>
            <input id="cf-phone" type="tel" autoComplete="tel-national" placeholder={PLACEHOLDER[cc] ?? ""} value={v.phone} onChange={set("phone")} required {...aria("phone")} />
          </div>
          {err("phone")}
        </div>
      </div>
      <div className="field half">
        <label className="l" htmlFor="cf-service">{L.service} <span className="req">*</span></label>
        <select id="cf-service" value={v.service} onChange={set("service")} required {...aria("service")}>
          {form.serviceOptions.map((o) => <option key={o}>{o}</option>)}
        </select>
        {err("service")}
      </div>
      {isOthers && (
        <div className="field">
          <label className="l" htmlFor="cf-other">{L.others}</label>
          <input id="cf-other" value={v.service_other} onChange={set("service_other")} {...aria("service_other")} />
          <div className="help">{L.othersHelp}</div>
          {err("service_other")}
        </div>
      )}
      <div className="field"><label className="l" htmlFor="cf-date">{L.date} <span className="req">*</span></label><input id="cf-date" type="date" min={today()} value={v.event_date} onChange={set("event_date")} required {...aria("event_date")} />{err("event_date")}</div>
      <div className="field"><label className="l" htmlFor="cf-loc">{L.location} <span className="req">*</span></label><input id="cf-loc" value={v.location} onChange={set("location")} required {...aria("location")} />{err("location")}</div>
      <div className="field"><label className="l" htmlFor="cf-ig">{L.instagram}</label><input id="cf-ig" placeholder={L.instagramPlaceholder} value={v.instagram} onChange={set("instagram")} /></div>
      <div className="field">
        <label className="l" htmlFor="cf-heard">{L.heardFrom}</label>
        <select id="cf-heard" value={v.heard_from} onChange={set("heard_from")}>{form.heardOptions.map((o) => <option key={o}>{o}</option>)}</select>
      </div>
      <div className="field"><label className="l" htmlFor="cf-msg">{L.message}</label><textarea id="cf-msg" value={v.message} onChange={set("message")} /></div>
      {/* honeypot */}
      <div className="hp" aria-hidden="true"><label htmlFor="cf-website">Website</label><input id="cf-website" tabIndex={-1} autoComplete="off" value={v.website} onChange={set("website")} /></div>
      <div className="submit">
        <button type="submit" disabled={state === "sending"}>{state === "sending" ? "Sending…" : form.submit}</button>
        {fail && <p className="fail" role="alert">{fail}</p>}
      </div>
    </form>
  );
}
