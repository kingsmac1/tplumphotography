import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import EmailTemplatesPanel, { TEMPLATE_META } from "./EmailTemplatesPanel";
import MessagingPanel from "./MessagingPanel";
import { peekEmailPrefill } from "./contact";

type Tab = "templates" | "messaging" | "log";
const tabs: { id: Tab; label: string }[] = [
  { id: "templates", label: "Templates" },
  { id: "messaging", label: "Messaging" },
  { id: "log", label: "Sent log" },
];

type LogRow = { id: string; created_at: string; template_key: string; recipient: string; subject: string | null; status: string; error: string | null };
type CampaignRow = { id: string; created_at: string; subject: string; recipient_group: string; sent_count: number; failed_count: number; sent_by: string | null };

const statusCls: Record<string, string> = {
  sent: "text-green-700",
  failed: "text-destructive",
  skipped: "text-muted-foreground",
  backfilled: "text-muted-foreground",
  pending: "text-amber-700",
};

const SentLog = () => {
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([]);
  const [error, setError] = useState("");
  const templateName = (key: string) => TEMPLATE_META.find((m) => m.key === key)?.name ?? key;

  useEffect(() => {
    Promise.all([
      supabase.from("email_log").select("*").order("created_at", { ascending: false }).limit(200),
      supabase.from("email_campaigns").select("*").order("created_at", { ascending: false }).limit(30),
    ]).then(([l, c]) => {
      if (l.error || c.error) setError((l.error || c.error)!.message);
      setLogs((l.data as LogRow[]) || []);
      setCampaigns((c.data as CampaignRow[]) || []);
    });
  }, []);

  return (
    <div className="space-y-8">
      {error && <p className="text-sm font-body text-destructive">{error}</p>}

      <div className="border border-border">
        <p className="px-4 pt-4 pb-2 font-display text-lg font-bold">Messages you sent</p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm font-body">
            <thead>
              <tr className="border-b border-border text-left text-xs font-bold tracking-widest text-muted-foreground">
                <th className="px-4 py-2">When</th><th className="px-4 py-2">Subject</th><th className="px-4 py-2">Sent to</th><th className="px-4 py-2">Delivered</th><th className="px-4 py-2">Failed</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">No messages sent yet.</td></tr>
              ) : campaigns.map((c) => (
                <tr key={c.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-2 whitespace-nowrap">{new Date(c.created_at).toLocaleString()}</td>
                  <td className="px-4 py-2">{c.subject}</td>
                  <td className="px-4 py-2">{c.recipient_group}</td>
                  <td className="px-4 py-2">{c.sent_count}</td>
                  <td className="px-4 py-2 text-destructive">{c.failed_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="border border-border">
        <p className="px-4 pt-4 pb-2 font-display text-lg font-bold">Automatic emails (latest 200)</p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm font-body">
            <thead>
              <tr className="border-b border-border text-left text-xs font-bold tracking-widest text-muted-foreground">
                <th className="px-4 py-2">When</th><th className="px-4 py-2">Email</th><th className="px-4 py-2">To</th><th className="px-4 py-2">Status</th><th className="px-4 py-2">Detail</th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">Nothing sent automatically yet.</td></tr>
              ) : logs.map((l) => (
                <tr key={l.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-2 whitespace-nowrap">{new Date(l.created_at).toLocaleString()}</td>
                  <td className="px-4 py-2">{templateName(l.template_key)}</td>
                  <td className="px-4 py-2 max-w-[200px] truncate">{l.recipient}</td>
                  <td className={`px-4 py-2 font-bold uppercase text-xs tracking-wide ${statusCls[l.status] ?? ""}`}>{l.status}</td>
                  <td className="px-4 py-2 max-w-[260px] truncate text-muted-foreground">{l.error || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const EmailsSection = () => {
  // Arriving from a table's Email button opens the messenger straight away.
  const [tab, setTab] = useState<Tab>(() => (peekEmailPrefill() ? "messaging" : "templates"));
  return (
    <div>
      <div className="flex gap-2 mb-6 overflow-x-auto">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 text-xs font-body font-bold tracking-widest border whitespace-nowrap transition-colors ${
              tab === t.id ? "bg-foreground text-background border-foreground" : "border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label.toUpperCase()}
          </button>
        ))}
      </div>
      {tab === "templates" && <EmailTemplatesPanel />}
      {tab === "messaging" && <MessagingPanel />}
      {tab === "log" && <SentLog />}
    </div>
  );
};

export default EmailsSection;
