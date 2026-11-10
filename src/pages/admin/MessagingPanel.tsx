import { useEffect, useRef, useState } from "react";
import { Send, Paperclip, X, Loader2, LayoutTemplate, Pencil } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { RichTextEditor } from "./RichTextEditor";
import { EmailBuilder } from "./EmailBuilder";
import { type EmailBlock, defaultBlocks, blocksToHtml } from "@/lib/emailBlocks";
import { peekEmailPrefill, takeEmailPrefill } from "./contact";

const RECIPIENT_OPTIONS = [
  { value: "individual", label: "Individual email(s)" },
  { value: "all_clients", label: "Everyone (all clients)" },
  { value: "photography", label: "Photography clients" },
  { value: "wedding", label: "Wedding clients" },
  { value: "studio", label: "Studio space renters" },
  { value: "events", label: "Event clients" },
] as const;

type Group = (typeof RECIPIENT_OPTIONS)[number]["value"];
type Counts = Record<Exclude<Group, "individual">, number>;
type SendResult = { sent: number; failed: string[]; total: number };
type AcademyBatch = { value: string; label: string; count: number };

/** Calls the send-admin-email Edge Function as the signed-in admin and surfaces its error message. */
export async function invokeAdminEmail<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke("send-admin-email", { body });
  if (error) {
    let message = error.message;
    try {
      const json = await (error as { context?: Response }).context?.json();
      if (json?.error) message = json.error;
    } catch {
      /* keep the generic message */
    }
    throw new Error(message);
  }
  if (data?.error) throw new Error(data.error);
  return data as T;
}

const readAsBase64 = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

const inputCls = "w-full border border-border bg-background px-3 py-2.5 text-sm font-body outline-none focus:border-foreground transition-colors";
const labelCls = "block text-sm font-body font-medium mb-1.5";

const MessagingPanel = () => {
  const [counts, setCounts] = useState<Counts | null>(null);
  const [countsError, setCountsError] = useState("");
  const [recipientType, setRecipientType] = useState<Group>("individual");
  const [academyBatch, setAcademyBatch] = useState("all");
  const [batches, setBatches] = useState<AcademyBatch[]>([]);
  // An address sent from a table's Email button arrives already in the audience field.
  const [customEmails, setCustomEmails] = useState(() => peekEmailPrefill());
  useEffect(() => { takeEmailPrefill(); }, []);
  const [subject, setSubject] = useState("");
  const [mode, setMode] = useState<"simple" | "builder">("simple");
  const [html, setHtml] = useState("");
  const [blocks, setBlocks] = useState<EmailBlock[]>(defaultBlocks);
  const [attachments, setAttachments] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<SendResult | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    invokeAdminEmail<{ batches: AcademyBatch[] }>({ action: "academy_batches" })
      .then((r) => setBatches(r.batches))
      .catch(() => setBatches([]));
  }, []);

  useEffect(() => {
    invokeAdminEmail<{ counts: Counts }>({ action: "counts" })
      .then((r) => setCounts(r.counts))
      .catch((err) => setCountsError(err instanceof Error ? err.message : "Failed to load recipient counts."));
  }, []);

  const bodyHtml = mode === "builder" ? blocksToHtml(blocks) : html;

  function recipientCount(): number | null {
    if (recipientType === "individual") return customEmails.split(/[\n,]+/).map((e) => e.trim()).filter(Boolean).length;
    if (recipientType === "academy" && academyBatch !== "all") return batches.find((b) => b.value === academyBatch)?.count ?? 0;
    return counts?.[recipientType] ?? null;
  }

  async function handleSend() {
    setError("");
    setResult(null);
    setSuccess("");
    if (!subject.trim()) return setError("Subject is required.");
    if (!bodyHtml.trim()) return setError(mode === "builder" ? "Add at least one block to the email." : "Message body is required.");

    const count = recipientCount();
    const groupLabel = RECIPIENT_OPTIONS.find((o) => o.value === recipientType)?.label ?? recipientType;
    const batchLabel = recipientType === "academy" && academyBatch !== "all" ? `, ${batches.find((b) => b.value === academyBatch)?.label ?? academyBatch}` : "";
    if (!window.confirm(`Send this email to ${count ?? "an unknown number of"} recipient(s) (${groupLabel}${batchLabel})?`)) return;

    setSending(true);
    try {
      const files = await Promise.all(
        attachments.map(async (f) => ({ filename: f.name, content: await readAsBase64(f) })),
      );
      const res = await invokeAdminEmail<SendResult>({
        action: "send",
        recipient_group: recipientType,
        custom_emails: customEmails,
        academy_batch: academyBatch,
        subject: subject.trim(),
        body: bodyHtml,
        attachments: files,
      });
      if (res.failed.length === 0) {
        setSuccess(`Email sent to ${res.sent} recipient${res.sent === 1 ? "" : "s"}.`);
        setSubject(""); setHtml(""); setBlocks(defaultBlocks()); setCustomEmails(""); setAttachments([]);
      } else {
        setResult(res);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Send failed.");
    } finally {
      setSending(false);
    }
  }

  const count = recipientCount();

  return (
    <div className={mode === "builder" ? "max-w-[1120px]" : "max-w-3xl"}>
      <p className="text-sm font-body text-muted-foreground mb-6">
        Send a one-off email to an individual address or to a group of clients. Emails go out from <span className="font-medium text-foreground">DMI STUDIOS</span>.
      </p>

      <div className="border border-border p-5 sm:p-6 space-y-5">
        <div>
          <span className={labelCls}>Send to</span>
          <div className="grid sm:grid-cols-2 gap-2">
            {RECIPIENT_OPTIONS.map((opt) => (
              <label
                key={opt.value}
                className={`flex items-center justify-between gap-2 border px-3 py-2.5 text-sm font-body cursor-pointer transition ${
                  recipientType === opt.value ? "border-foreground bg-muted/40" : "border-border hover:border-foreground/40"
                }`}
              >
                <span className="flex items-center gap-2">
                  <input type="radio" name="recipientType" checked={recipientType === opt.value} onChange={() => setRecipientType(opt.value)} />
                  {opt.label}
                </span>
                {opt.value !== "individual" && (
                  <span className="text-xs text-muted-foreground shrink-0">{countsError ? "—" : counts ? counts[opt.value] : "…"}</span>
                )}
              </label>
            ))}
          </div>
          {countsError && <p className="text-xs text-destructive mt-2">{countsError}</p>}
        </div>

        {recipientType === "academy" && (
          <label className="block">
            <span className={labelCls}>Which batch?</span>
            <select value={academyBatch} onChange={(e) => setAcademyBatch(e.target.value)} className={inputCls}>
              <option value="all">All batches ({counts?.academy ?? "…"})</option>
              {batches.map((b) => (
                <option key={b.value} value={b.value}>{b.label} ({b.count})</option>
              ))}
            </select>
            {batches.length === 0 && <p className="text-xs text-muted-foreground mt-1.5">No batches found yet. Applications appear here once someone applies.</p>}
          </label>
        )}

        {recipientType === "individual" && (
          <label className="block">
            <span className={labelCls}>Email address(es)</span>
            <textarea
              value={customEmails}
              onChange={(e) => setCustomEmails(e.target.value)}
              rows={3}
              placeholder="One per line, or comma-separated"
              className={inputCls}
            />
          </label>
        )}

        <label className="block">
          <span className={labelCls}>Subject</span>
          <input value={subject} onChange={(e) => setSubject(e.target.value)} className={inputCls} />
        </label>

        <div>
          <div className="flex items-center justify-between gap-3 mb-1.5">
            <span className="block text-sm font-body font-medium">Message</span>
            <div className="flex gap-1 border border-border p-0.5 bg-muted/40">
              {(
                [
                  ["simple", "Simple", Pencil],
                  ["builder", "Email builder", LayoutTemplate],
                ] as const
              ).map(([value, label, Icon]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setMode(value)}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-body font-bold uppercase tracking-wide transition ${
                    mode === value ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Icon size={12} /> {label}
                </button>
              ))}
            </div>
          </div>
          {mode === "simple" ? <RichTextEditor value={html} onChange={setHtml} /> : <EmailBuilder blocks={blocks} onChange={setBlocks} />}
        </div>

        <div>
          <span className={labelCls}>Attachments</span>
          <div className="flex flex-wrap gap-2 mb-2">
            {attachments.map((file, idx) => (
              <span key={`${file.name}-${idx}`} className="inline-flex items-center gap-1.5 text-xs font-body bg-muted/40 border border-border pl-2.5 pr-1.5 py-1.5">
                <Paperclip size={11} className="text-muted-foreground" />
                <span className="max-w-[160px] truncate">{file.name}</span>
                <button type="button" onClick={() => setAttachments((p) => p.filter((_, i) => i !== idx))} className="text-muted-foreground hover:text-destructive" aria-label={`Remove ${file.name}`}>
                  <X size={12} />
                </button>
              </span>
            ))}
          </div>
          <button type="button" onClick={() => fileInputRef.current?.click()} className="inline-flex items-center gap-2 border border-border hover:border-foreground px-3 py-2 text-xs font-body font-bold uppercase tracking-wide transition">
            <Paperclip size={13} /> Add files
          </button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => {
              const picked = Array.from(e.target.files ?? []);
              if (picked.length) setAttachments((p) => [...p, ...picked]);
              e.target.value = "";
            }}
          />
        </div>

        {error && <p className="text-sm text-destructive font-body">{error}</p>}
        {success && <p className="text-sm text-green-700 font-body">{success}</p>}
        {result && (
          <p className="text-sm text-amber-700 font-body">
            Sent {result.sent} of {result.total}. Failed: {result.failed.join("; ")}
          </p>
        )}

        <button
          onClick={() => void handleSend()}
          disabled={sending || count === 0}
          className="inline-flex items-center gap-2 bg-primary hover:bg-primary/90 disabled:opacity-60 text-primary-foreground text-xs font-body font-bold uppercase tracking-wide px-5 py-3 transition"
        >
          {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
          {sending ? "Sending…" : `Send${count ? ` to ${count}` : ""}`}
        </button>
      </div>
    </div>
  );
};

export default MessagingPanel;
