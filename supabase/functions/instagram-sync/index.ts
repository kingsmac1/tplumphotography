// Supabase Edge Function: copies the latest Instagram posts into the `instagram_posts` table
// (and their photos into the GitHub media repository) for the website's "Our Visual Showcase".
//
// Called (1) by the homepage when the feed is more than an hour old, and (2) by the
// dashboard's "Sync now" button. It refuses to run more than once every 30 minutes
// unless an admin forces it.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const MIN_INTERVAL_MS = 30 * 60 * 1000; // don't sync more often than this (unless forced)
const REFRESH_AFTER_MS = 20 * 24 * 60 * 60 * 1000; // renew the 60-day token after 20 days
const MAX_POSTS = 200;
const COPY_PER_RUN = 20; // photos copied to GitHub per run (the rest follow on the next runs)
const RAW_PREFIX = "https://raw.githubusercontent.com/";

type IgPost = {
  id: string;
  caption?: string;
  media_type: string;
  media_url?: string;
  thumbnail_url?: string;
  permalink: string;
  timestamp: string;
};

type GithubCfg = { owner: string; repo: string; branch: string; token: string };

const gh = async (cfg: GithubCfg, path: string, init?: RequestInit) => {
  const res = await fetch(`https://api.github.com/repos/${cfg.owner}/${cfg.repo}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${cfg.token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "dmi-instagram-sync",
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
    },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`GitHub: ${body.message || res.status}`);
  return body;
};

const toBase64 = (bytes: Uint8Array) => {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
};

/** Commits all files in ONE commit and returns the commit sha (retries if the branch moved meanwhile). */
const commitFiles = async (cfg: GithubCfg, files: { path: string; bytes: Uint8Array }[]) => {
  const entries = [];
  for (const f of files) {
    const blob = await gh(cfg, "/git/blobs", { method: "POST", body: JSON.stringify({ content: toBase64(f.bytes), encoding: "base64" }) });
    entries.push({ path: f.path, mode: "100644", type: "blob", sha: blob.sha });
  }
  let lastError: unknown;
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const ref = await gh(cfg, `/git/ref/heads/${cfg.branch}`);
      const head: string = ref.object.sha;
      const headCommit = await gh(cfg, `/git/commits/${head}`);
      const tree = await gh(cfg, "/git/trees", { method: "POST", body: JSON.stringify({ base_tree: headCommit.tree.sha, tree: entries }) });
      const commit = await gh(cfg, "/git/commits", {
        method: "POST",
        body: JSON.stringify({ message: `Sync ${files.length} Instagram photo(s)`, tree: tree.sha, parents: [head] }),
      });
      await gh(cfg, `/git/refs/heads/${cfg.branch}`, { method: "PATCH", body: JSON.stringify({ sha: commit.sha }) });
      return commit.sha as string;
    } catch (e) {
      lastError = e;
      if (!/fast forward|fast-forward|Reference update failed/i.test(e instanceof Error ? e.message : "")) throw e;
      await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
    }
  }
  throw lastError instanceof Error ? lastError : new Error("GitHub update failed");
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const url = Deno.env.get("SUPABASE_URL")!;
  const db = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  let force = false;
  try { force = (await req.json())?.force === true; } catch { /* no body */ }

  if (force) {
    const asUser = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    });
    const { data: isAdmin } = await asUser.rpc("is_admin");
    if (!isAdmin) return json({ error: "Only admins can force a sync." }, 403);
  }

  const { data: sync } = await db.from("instagram_sync").select("last_synced_at").eq("id", 1).maybeSingle();
  if (!force && sync?.last_synced_at && Date.now() - new Date(sync.last_synced_at).getTime() < MIN_INTERVAL_MS) {
    return json({ synced: false, reason: "fresh" });
  }
  // Take the "lock" first so simultaneous visitors don't all trigger a sync.
  await db.from("instagram_sync").update({ last_synced_at: new Date().toISOString() }).eq("id", 1);

  const { data: settings } = await db.from("instagram_settings").select("*").eq("id", 1).maybeSingle();
  if (!settings?.access_token) return json({ synced: false, reason: "not_connected" });

  try {
    let token: string = settings.access_token;

    // Keep the 60-day token alive by renewing it well before it expires.
    const refreshedAt = settings.token_refreshed_at ? new Date(settings.token_refreshed_at).getTime() : 0;
    if (Date.now() - refreshedAt > REFRESH_AFTER_MS) {
      const r = await fetch(`https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=${token}`);
      const j = await r.json().catch(() => ({}));
      if (j.access_token) {
        token = j.access_token;
        await db.from("instagram_settings").update({ access_token: token, token_refreshed_at: new Date().toISOString() }).eq("id", 1);
      }
    }

    // Fetch the account's posts (newest first)
    const fields = "id,caption,media_type,media_url,thumbnail_url,permalink,timestamp";
    let next: string | null = `https://graph.instagram.com/me/media?fields=${fields}&limit=50&access_token=${token}`;
    const posts: IgPost[] = [];
    while (next && posts.length < MAX_POSTS) {
      const res = await fetch(next);
      const body = await res.json();
      if (body.error) throw new Error(`Instagram: ${body.error.message}`);
      posts.push(...(body.data ?? []));
      next = body.paging?.next ?? null;
    }

    const { data: existing } = await db.from("instagram_posts").select("id, image_url");
    const known = new Map<string, string>(
      (existing ?? []).map((r: { id: string; image_url: string }): [string, string] => [r.id, r.image_url]),
    );

    const rows = posts
      .map((p) => {
        const source = p.media_type === "VIDEO" ? p.thumbnail_url : p.media_url;
        const kept = known.get(p.id);
        const image_url = kept && kept.startsWith(RAW_PREFIX) ? kept : source;
        return image_url
          ? { id: p.id, permalink: p.permalink, media_type: p.media_type, caption: p.caption ?? null, posted_at: p.timestamp, image_url }
          : null;
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);

    // Copy photos that are still on Instagram's (expiring) CDN into the GitHub media repository.
    let copyNote = "";
    const { data: gcfg } = await db.from("cms_settings").select("*").eq("id", 1).maybeSingle();
    if (gcfg?.github_owner && gcfg?.github_repo && gcfg?.github_token) {
      const cfg: GithubCfg = { owner: gcfg.github_owner, repo: gcfg.github_repo, branch: gcfg.github_branch || "main", token: gcfg.github_token };
      const pending = rows.filter((r) => !r.image_url.startsWith(RAW_PREFIX)).slice(0, COPY_PER_RUN);
      try {
        const files: { path: string; bytes: Uint8Array; id: string }[] = [];
        for (const r of pending) {
          const res = await fetch(r.image_url);
          if (!res.ok) continue;
          files.push({ id: r.id, path: `instagram/${r.id}.jpg`, bytes: new Uint8Array(await res.arrayBuffer()) });
        }
        if (files.length > 0) {
          const sha = await commitFiles(cfg, files);
          for (const f of files) {
            const row = rows.find((r) => r.id === f.id)!;
            row.image_url = `${RAW_PREFIX}${cfg.owner}/${cfg.repo}/${sha}/${f.path}`;
          }
        }
      } catch (e) {
        copyNote = ` (photos left on Instagram's servers for now: ${e instanceof Error ? e.message : e})`;
      }
    }

    if (rows.length > 0) {
      const { error } = await db.from("instagram_posts").upsert(rows, { onConflict: "id" });
      if (error) throw new Error(error.message);
      const keep = new Set<string>(rows.map((r) => r.id));
      const stale = [...known.keys()].filter((id: string) => !keep.has(id));
      if (stale.length > 0) await db.from("instagram_posts").delete().in("id", stale);
    }

    await db.from("instagram_sync").update({ last_synced_at: new Date().toISOString(), post_count: rows.length }).eq("id", 1);
    await db.from("instagram_settings").update({ last_error: copyNote ? copyNote.trim() : null }).eq("id", 1);
    return json({ synced: true, count: rows.length, note: copyNote || undefined });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await db.from("instagram_settings").update({ last_error: message }).eq("id", 1);
    return json({ synced: false, error: message });
  }
});
