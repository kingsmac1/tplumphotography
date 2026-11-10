import { useCallback, useEffect, useState } from "react";
import { Eye, EyeOff, ExternalLink, KeyRound, Loader2, RefreshCw, Unplug } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

/** Instagram feed (@tplumphotography) — ported from the Nkopno dashboard. */
const INSTAGRAM_URL = "https://www.instagram.com/tplumphotography";
const inputCls = "w-full border border-border bg-background px-3 py-2 text-sm font-body outline-none focus:border-foreground";
type Post = { id: string; permalink: string; caption: string | null; image_url: string; hidden: boolean; posted_at: string | null };

async function invoke(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke("instagram-sync", { body });
  if (error) {
    let detail = error.message;
    try { detail = (await (error as { context?: Response }).context?.json())?.error || detail; } catch { /* keep */ }
    return { error: /not found|404|Failed to send/i.test(detail) ? "The instagram-sync function isn't deployed yet (see SETUP-GUIDE.md)." : detail };
  }
  return data ?? {};
}

const InstagramPanel = () => {
  const [hasToken, setHasToken] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const [expires, setExpires] = useState<string | null>(null);
  const [sync, setSync] = useState<{ last_synced_at: string | null; post_count: number } | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async () => {
    const [s, y, p] = await Promise.all([
      supabase.from("instagram_settings").select("access_token, last_error, token_expires_at").eq("id", 1).maybeSingle(),
      supabase.from("instagram_sync").select("last_synced_at, post_count").eq("id", 1).maybeSingle(),
      supabase.from("instagram_posts").select("id, permalink, caption, image_url, hidden, posted_at").order("posted_at", { ascending: false }).limit(24),
    ]);
    setHasToken(!!s.data?.access_token);
    setLastError(s.data?.last_error ?? null);
    setExpires(s.data?.token_expires_at ?? null);
    setSync(y.data ?? null);
    setPosts((p.data as Post[]) || []);
  }, []);
  useEffect(() => { void load(); }, [load]);

  const runSync = async () => {
    setBusy(true); setMsg(null);
    const data = await invoke({ force: true });
    setBusy(false);
    if (data.error) setMsg({ ok: false, text: data.error });
    else if (data.synced) setMsg({ ok: true, text: `Synced ${data.count} posts. The Instagram strip on every page now shows your latest posts.${data.note ? ` ${data.note}` : ""}` });
    else if (data.reason === "not_connected") setMsg({ ok: false, text: "Save your access token first." });
    else setMsg({ ok: false, text: data.error || "Sync did not run." });
    await load();
  };

  const saveToken = async () => {
    const value = token.trim();
    if (!value) return;
    setBusy(true); setMsg(null);
    const data = await invoke({ action: "connect", access_token: value });
    setBusy(false);
    if (data.error) return setMsg({ ok: false, text: data.error });
    setToken("");
    setMsg({ ok: true, text: data.synced ? `Connected. Synced ${data.count} posts.` : "Connected." });
    await load();
  };

  const refresh = async () => {
    setBusy(true); setMsg(null);
    const data = await invoke({ action: "refresh_token" });
    setBusy(false);
    setMsg(data.refreshed ? { ok: true, text: "Token renewed for another 60 days." } : { ok: false, text: data.error || "Could not renew the token." });
    await load();
  };

  const disconnect = async () => {
    if (!window.confirm("Disconnect Instagram? The posts already saved keep showing on the website; they just stop updating.")) return;
    await supabase.from("instagram_settings").update({ access_token: "", last_error: null }).eq("id", 1);
    setMsg({ ok: true, text: "Disconnected. No more automatic updates." });
    await load();
  };

  const toggleHidden = async (p: Post) => {
    await supabase.from("instagram_posts").update({ hidden: !p.hidden }).eq("id", p.id);
    await load();
  };

  const live = (sync?.post_count ?? 0) > 0;
  const daysLeft = expires ? Math.round((Date.parse(expires) - Date.now()) / 86400000) : null;

  return (
    <div className="space-y-5 max-w-4xl">
      <p className="text-sm font-body text-muted-foreground">
        The black Instagram strip at the bottom of every page shows your latest posts. Photos are copied to the website's own storage, so the strip keeps working even if Instagram is slow or the token expires.
        Until the first successful sync, the posts saved from the old website are shown.
      </p>
      <div className="border border-border p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm font-body space-y-1">
          <div>
            <span className="font-bold tracking-widest text-xs">STATUS</span>
            <span className={`ml-3 ${live ? "text-green-700" : "text-muted-foreground"}`}>
              {live ? `Live: ${sync!.post_count} posts` : hasToken ? "Connected, waiting for the first sync" : "Not connected (showing the saved posts)"}
            </span>
          </div>
          {sync?.last_synced_at && <div className="text-muted-foreground text-xs">Last check {new Date(sync.last_synced_at).toLocaleString("en-CA", { timeZone: "America/Edmonton" })}</div>}
          {hasToken && daysLeft !== null && <div className={`text-xs ${daysLeft < 10 ? "text-destructive" : "text-muted-foreground"}`}>Token renews automatically · expires in about {daysLeft} days</div>}
        </div>
        <div className="flex flex-wrap gap-2">
          <a href={INSTAGRAM_URL} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-body font-bold tracking-widest border border-border hover:border-foreground">@TPLUMPHOTOGRAPHY <ExternalLink size={12} /></a>
          <button onClick={() => void runSync()} disabled={busy || !hasToken} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-body font-bold tracking-widest bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50">
            {busy ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />} SYNC NOW
          </button>
          {hasToken && <button onClick={() => void refresh()} disabled={busy} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-body font-bold tracking-widest border border-border hover:border-foreground"><KeyRound size={13} /> RENEW TOKEN</button>}
          {hasToken && <button onClick={() => void disconnect()} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-body font-bold tracking-widest border border-border text-muted-foreground hover:text-destructive"><Unplug size={13} /> DISCONNECT</button>}
        </div>
      </div>
      {msg && <p className={`text-sm font-body ${msg.ok ? "text-green-700" : "text-destructive"}`} role="status">{msg.text}</p>}
      {lastError && <p className="text-xs text-destructive font-body">Last problem: {lastError}</p>}
      <div className="border border-border p-4 space-y-3">
        <p className="font-display text-lg">{hasToken ? "Replace the access token" : "Connect Instagram"}</p>
        <p className="text-xs font-body text-muted-foreground">Paste the Instagram access token from your Meta app (steps in SETUP-GUIDE.md). It's checked with Instagram, stored privately and renewed automatically every few weeks.</p>
        <input className={inputCls} type="password" autoComplete="off" value={token} onChange={(e) => setToken(e.target.value)} placeholder={hasToken ? "•••••• saved (paste a new one to replace)" : "IGAA…"} />
        <button onClick={() => void saveToken()} disabled={busy || !token.trim()} className="px-4 py-2 text-sm font-body font-medium bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50">Save and sync</button>
      </div>
      {posts.length > 0 && (
        <div>
          <p className="text-xs font-body font-bold tracking-widest text-muted-foreground mb-3">LATEST SYNCED · tap the eye to hide a post from the website</p>
          <ul className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2">
            {posts.map((p) => (
              <li key={p.id} className="relative">
                <a href={p.permalink} target="_blank" rel="noopener noreferrer"><img src={p.image_url} alt={p.caption?.slice(0, 80) ?? "Instagram post"} loading="lazy" className={`aspect-square w-full object-cover border border-border ${p.hidden ? "opacity-30" : ""}`} /></a>
                <button onClick={() => void toggleHidden(p)} aria-label={p.hidden ? "Show on website" : "Hide from website"} className="absolute top-1 right-1 bg-background/90 p-1 border border-border">{p.hidden ? <EyeOff size={14} /> : <Eye size={14} />}</button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default InstagramPanel;
