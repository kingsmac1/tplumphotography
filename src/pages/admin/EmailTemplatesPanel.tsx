import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Pencil, X, Send, Loader2 } from "lucide-react";
import { RichTextEditor } from "./RichTextEditor";
import { invokeAdminEmail } from "./MessagingPanel";

type TemplateMeta = {
  key: string;
  name: string;
  group: "Clients" | "Owner";
  when: string;
  variables: string[];
};

/** Names, timing and placeholders for each automatic email. The subject and body are stored in the database. */
export const TEMPLATE_META: TemplateMeta[] = [
  { key: "booking_confirmation", name: "Booking confirmed", group: "Clients", when: "Right after a photography or wedding booking is submitted", variables: ["summary", "client_name", "service_summary", "shoot_date", "shoot_time", "location", "shoot_setting", "grand_total"] },
  { key: "studio_confirmation", name: "Studio space request received", group: "Clients", when: "Right after a studio space rental is submitted", variables: ["summary", "client_name", "space_name", "rental_date", "rental_time", "duration", "extras", "grand_total"] },
  { key: "event_confirmation", name: "Event request received", group: "Clients", when: "Right after an event booking is submitted", variables: ["summary", "client_name", "event_type", "event_dates", "event_time", "agreed_amount"] },
  { key: "reminder_24h", name: "Shoot reminder: 24 hours", group: "Clients", when: "Between 24 and 12 hours before the shoot", variables: ["summary", "client_name", "shoot_date", "shoot_time", "location", "shoot_setting"] },
  { key: "reminder_12h", name: "Shoot reminder: 12 hours", group: "Clients", when: "Between 12 and 2 hours before the shoot", variables: ["summary", "client_name", "shoot_date", "shoot_time", "location", "shoot_setting"] },
  { key: "reminder_2h", name: "Shoot reminder: 2 hours", group: "Clients", when: "Within 2 hours of the shoot", variables: ["summary", "client_name", "shoot_time", "location", "shoot_setting"] },
  { key: "payment_paid", name: "Payment received", group: "Clients", when: "Within about 5 minutes of a booking, studio rental or event being marked Paid", variables: ["client_name", "item", "amount_paid", "total", "balance", "summary"] },
  { key: "payment_part", name: "Part payment received", group: "Clients", when: "Within about 5 minutes of Part Payment being saved (again if the amount changes)", variables: ["client_name", "item", "amount_paid", "total", "balance", "summary"] },
  { key: "thank_you", name: "Thank you", group: "Clients", when: "1 to 3 days after booking", variables: ["client_name"] },
  { key: "review_request", name: "Review request", group: "Clients", when: "14 to 21 days after the shoot", variables: ["client_name"] },
  { key: "re_engagement", name: "Ready for your next session?", group: "Clients", when: "40 to 47 days after the shoot", variables: ["client_name"] },
  { key: "birthday", name: "Birthday", group: "Clients", when: "On the client's birthday, once a year", variables: ["client_name"] },
  { key: "owner_birthday", name: "Client birthdays today", group: "Owner", when: "At 7am on the day, one email to the owner list naming every client with a birthday, with their WhatsApp and email", variables: ["client_count", "date", "details"] },
  { key: "owner_booking", name: "New photography / wedding booking", group: "Owner", when: "Sent to the owner list when a booking arrives", variables: ["client_name", "location", "shoot_date", "details"] },
  { key: "owner_studio", name: "New studio space rental", group: "Owner", when: "Sent to the owner list when a rental request arrives", variables: ["client_name", "rental_date", "details"] },
  { key: "owner_event", name: "New event booking", group: "Owner", when: "Sent to the owner list when an event request arrives", variables: ["client_name", "event_type", "event_dates", "details"] },
];

type Template = { key: string; subject: string; body: string; enabled: boolean };

const inputCls = "w-full border border-border bg-background px-3 py-2.5 text-sm font-body outline-none focus:border-foreground transition-colors";

const EmailTemplatesPanel = () => {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [owners, setOwners] = useState("");
  const [ownersSaved, setOwnersSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<Template | null>(null);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  // Shown right beside the test button: the page-level message sits behind the editing window and can't be seen.
  const [testResult, setTestResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [notice, setNotice] = useState("");

  const load = async () => {
    const [t, s] = await Promise.all([
      supabase.from("email_templates").select("key, subject, body, enabled"),
      supabase.from("email_settings").select("value").eq("key", "owner_emails").maybeSingle(),
    ]);
    if (t.error) setError(t.error.message);
    else setTemplates((t.data as Template[]) || []);
    setOwners(String(s.data?.value ?? ""));
    setLoading(false);
  };
  useEffect(() => { void load(); }, []);

  const saveOwners = async () => {
    setError(""); setOwnersSaved(false);
    const { data, error: err } = await supabase.from("email_settings").upsert({ key: "owner_emails", value: owners.trim() }, { onConflict: "key" }).select("key");
    if (err) return setError(err.message);
    if (!data || data.length === 0) return setError("Not saved. Make sure your account is an admin in the staff table.");
    setOwnersSaved(true);
  };

  const toggle = async (t: Template) => {
    const { data, error: err } = await supabase.from("email_templates").update({ enabled: !t.enabled, updated_at: new Date().toISOString() }).eq("key", t.key).select("key");
    if (err) return setError(err.message);
    if (!data || data.length === 0) return setError("Not saved. Make sure your account is an admin in the staff table.");
    await load();
  };

  const saveEdit = async () => {
    if (!editing) return;
    if (!editing.subject.trim()) return setError("Subject can't be empty.");
    setSaving(true); setError("");
    const { data, error: err } = await supabase
      .from("email_templates")
      .update({ subject: editing.subject, body: editing.body, enabled: editing.enabled, updated_at: new Date().toISOString() })
      .eq("key", editing.key)
      .select("key");
    setSaving(false);
    if (err) return setError(err.message);
    if (!data || data.length === 0) return setError("Not saved. Make sure your account is an admin in the staff table.");
    setEditing(null);
    setNotice("Template saved. New emails will use it straight away.");
    await load();
  };

  const sendTest = async (target: "me" | "owners") => {
    if (!editing) return;
    setTesting(true); setTestResult(null);
    try {
      const r = await invokeAdminEmail<{ to?: string; id?: string | null }>({ action: "test_template", template_key: editing.key, send_to: target });
      setTestResult({
        ok: true,
        text: `Test email sent to ${r.to ?? "your address"}. It can take a minute; if it isn't in the inbox, check Spam.${r.id ? ` Reference: ${r.id}` : ""}`,
      });
    } catch (err) {
      setTestResult({ ok: false, text: `Test failed: ${err instanceof Error ? err.message : "the email could not be sent."}` });
    } finally {
      setTesting(false);
    }
  };

  const copy = (text: string) => { void navigator.clipboard?.writeText(text); };

  if (loading) return <p className="text-sm font-body text-muted-foreground">Loading…</p>;

  return (
    <div className="space-y-8">
      <div className="border border-border p-5 space-y-3">
        <p className="font-display text-lg font-bold">Owner notification recipients</p>
        <p className="text-xs font-body text-muted-foreground">
          Who gets the "new booking" email for every form submitted. Separate addresses with commas.
        </p>
        <input value={owners} onChange={(e) => { setOwners(e.target.value); setOwnersSaved(false); }} className={inputCls} placeholder="owner@example.com, second@example.com" />
        <div className="flex items-center gap-3">
          <button onClick={() => void saveOwners()} className="px-4 py-2 text-xs font-body font-bold uppercase tracking-wide bg-primary text-primary-foreground hover:bg-primary/90 transition">Save recipients</button>
          {ownersSaved && <span className="text-xs font-body text-green-700">Saved.</span>}
        </div>
      </div>

      {error && <p className="text-sm font-body text-destructive">{error}</p>}
      {notice && <p className="text-sm font-body text-green-700">{notice}</p>}

      {(["Clients", "Owner"] as const).map((group) => (
        <div key={group} className="border border-border">
          <p className="px-4 pt-4 pb-2 font-display text-lg font-bold">{group === "Clients" ? "Emails to clients" : "Emails to the owner"}</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm font-body">
              <thead>
                <tr className="border-b border-border text-left text-xs font-bold tracking-widest text-muted-foreground">
                  <th className="px-4 py-2">Email</th>
                  <th className="px-4 py-2">When it's sent</th>
                  <th className="px-4 py-2">On</th>
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {TEMPLATE_META.filter((m) => m.group === group).map((meta) => {
                  const t = templates.find((x) => x.key === meta.key);
                  return (
                    <tr key={meta.key} className="border-b border-border last:border-0 align-top">
                      <td className="px-4 py-3 font-medium">{meta.name}</td>
                      <td className="px-4 py-3 text-muted-foreground max-w-[280px]">{meta.when}</td>
                      <td className="px-4 py-3">
                        {t ? (
                          <button
                            role="switch"
                            aria-checked={t.enabled}
                            aria-label={`${meta.name} ${t.enabled ? "on" : "off"}`}
                            onClick={() => void toggle(t)}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${t.enabled ? "bg-green-600" : "bg-muted-foreground/40"}`}
                          >
                            <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${t.enabled ? "translate-x-[22px]" : "translate-x-0.5"}`} />
                          </button>
                        ) : (
                          <span className="text-xs text-muted-foreground">Not set up</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {t && (
                          <button onClick={() => { setEditing(t); setNotice(""); setError(""); setTestResult(null); }} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-body font-medium border border-border hover:bg-muted/50 transition">
                            <Pencil size={13} /> Edit
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      {editing && (() => {
        const meta = TEMPLATE_META.find((m) => m.key === editing.key);
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 overflow-hidden">
            <div className="bg-background border border-border max-w-2xl w-full max-h-[90vh] overflow-y-auto overscroll-contain p-6 space-y-5" data-lenis-prevent>
              <div className="flex items-center justify-between">
                <h2 className="font-display text-2xl font-bold">{meta?.name}</h2>
                <button onClick={() => setEditing(null)} className="text-muted-foreground hover:text-foreground" aria-label="Close"><X size={20} /></button>
              </div>
              <p className="text-xs font-body text-muted-foreground">{meta?.when}</p>

              {error && <p className="text-sm font-body text-destructive">{error}</p>}

              <label className="block">
                <span className="block text-sm font-body font-medium mb-1.5">Subject</span>
                <input value={editing.subject} onChange={(e) => setEditing({ ...editing, subject: e.target.value })} className={inputCls} />
              </label>

              <div>
                <span className="block text-sm font-body font-medium mb-1.5">Message</span>
                <RichTextEditor value={editing.body} onChange={(body) => setEditing({ ...editing, body })} />
              </div>

              <div>
                <span className="block text-xs font-body font-bold tracking-widest text-muted-foreground mb-2">PLACEHOLDERS (click to copy)</span>
                <div className="flex flex-wrap gap-2">
                  {(meta?.variables ?? []).map((v) => (
                    <button key={v} type="button" onClick={() => copy(`{{${v}}}`)} className="px-2 py-1 text-xs font-mono border border-border hover:border-foreground transition">
                      {`{{${v}}}`}
                    </button>
                  ))}
                </div>
                <p className="text-[11px] font-body text-muted-foreground mt-2">Placeholders are replaced with the client's details when the email is sent.</p>
              </div>

              <label className="flex items-center gap-3 text-sm font-body">
                <input type="checkbox" checked={editing.enabled} onChange={(e) => setEditing({ ...editing, enabled: e.target.checked })} />
                Send this email automatically
              </label>

              <div className="flex flex-wrap justify-between gap-3 pt-4 border-t border-border">
                <div className="flex flex-col items-start gap-2 max-w-sm">
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => void sendTest("me")} disabled={testing} className="inline-flex items-center gap-2 px-4 py-2 text-xs font-body font-bold uppercase tracking-wide border border-border hover:bg-muted/50 transition disabled:opacity-60">
                      {testing ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} Send test to me
                    </button>
                    <button onClick={() => void sendTest("owners")} disabled={testing} className="inline-flex items-center gap-2 px-4 py-2 text-xs font-body font-bold uppercase tracking-wide border border-border hover:bg-muted/50 transition disabled:opacity-60">
                      <Send size={14} /> Send test to owners
                    </button>
                  </div>
                  {testing ? <p className="text-xs font-body text-muted-foreground">Sending…</p> : !testResult && <p className="text-[11px] font-body text-muted-foreground">&ldquo;Me&rdquo; is the email you signed in with; &ldquo;owners&rdquo; is the saved owner list. Tests use the saved version, so save your changes first.</p>}
                  {testResult && (
                    <p role="status" className={`text-xs font-body break-words ${testResult.ok ? "text-green-700" : "text-destructive"}`}>{testResult.text}</p>
                  )}
                </div>
                <div className="flex gap-3">
                  <button onClick={() => setEditing(null)} className="px-4 py-2 text-xs font-body font-bold uppercase tracking-wide border border-border hover:bg-muted/50 transition">Cancel</button>
                  <button onClick={() => void saveEdit()} disabled={saving} className="px-4 py-2 text-xs font-body font-bold uppercase tracking-wide bg-primary text-primary-foreground hover:bg-primary/90 transition disabled:opacity-60">
                    {saving ? "Saving…" : "Save"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};

export default EmailTemplatesPanel;
