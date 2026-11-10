// Instagram feed for @tplumphotography (pattern from the Nkopno project).
// Copies the latest posts into `instagram_posts` and their photos into the public `site-images` bucket
// (Instagram's own photo links expire), so the website keeps showing the feed even if Instagram is slow
// or the token stops working.
//
// Called by:
//   1. the website after a page loads (cheap: skipped if checked in the last 60 s; quick check of the newest posts),
//   2. Dashboard -> Instagram ("Sync now", admin; full pass),
//   3. pg_cron once a day with { action: "refresh_token" } (CRON_SECRET header): renews the 60-day token early.
// A full pass (also removes posts deleted on Instagram) runs on "Sync now" or when the last one is over 6 hours old.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const MIN_INTERVAL_MS = 60 * 1000;
const FULL_PASS_EVERY_MS = 6 * 60 * 60 * 1000;
const REFRESH_AFTER_MS = 20 * 24 * 60 * 60 * 1000; // the token lasts 60 days; renew after 20
const MAX_POSTS = 48;
const COPY_PER_RUN = 12;
const BUCKET = "site-images";

type IgPost = { id: string; caption?: string; media_type: string; media_url?: string; thumbnail_url?: string; permalink: string; timestamp: string };

/** Width/height of a JPEG/PNG from its bytes (no image library in Deno). */
function imageSize(b: Uint8Array): { width: number; height: number } | null {
  if (b[0] === 0x89 && b[1] === 0x50) return { width: (b[16] << 24) | (b[17] << 16) | (b[18] << 8) | b[19], height: (b[20] << 24) | (b[21] << 16) | (b[22] << 8) | b[23] };
  if (b[0] !== 0xff || b[1] !== 0xd8) return null;
  let i = 2;
  while (i < b.length) {
    if (b[i] !== 0xff) { i++; continue; }
    const marker = b[i + 1];
    const len = (b[i + 2] << 8) | b[i + 3];
    if ((marker >= 0xc0 && marker <= 0xc3) || (marker >= 0xc5 && marker <= 0xc7) || (marker >= 0xc9 && marker <= 0xcb) || (marker >= 0xcd && marker <= 0xcf)) {
      return { height: (b[i + 5] << 8) | b[i + 6], width: (b[i + 7] << 8) | b[i + 8] };
    }
    i += 2 + len;
  }
  return null;
}

async function refreshToken(db: ReturnType<typeof createClient>, token: string) {
  const r = await fetch(`https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=${encodeURIComponent(token)}`);
  const j = await r.json().catch(() => ({}));
  if (!j.access_token) throw new Error(`Instagram token refresh failed: ${j.error?.message ?? r.status}`);
  const expires = j.expires_in ? new Date(Date.now() + Number(j.expires_in) * 1000).toISOString() : null;
  await db.from("instagram_settings").update({ access_token: j.access_token, token_refreshed_at: new Date().toISOString(), token_expires_at: expires, last_error: null }).eq("id", 1);
  return j.access_token as string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const url = Deno.env.get("SUPABASE_URL")!;
  const db = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const publicBase = `${url}/storage/v1/object/public/${BUCKET}/`;

  let body: { force?: boolean; action?: string; access_token?: string } = {};
  try { body = await req.json(); } catch { /* no body */ }
  const isCron = !!Deno.env.get("CRON_SECRET") && req.headers.get("x-cron-secret") === Deno.env.get("CRON_SECRET");
  let isAdmin = false;
  if (body.force || body.action === "connect" || (body.action === "refresh_token" && !isCron)) {
    const asUser = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } });
    const { data } = await asUser.rpc("is_admin");
    isAdmin = !!data;
    if (!isAdmin) return json({ error: "Only admins can do that." }, 403);
  }

  // Dashboard: save a new token (validated against Instagram first), then sync.
  if (body.action === "connect") {
    const t = String(body.access_token ?? "").trim();
    const me = await fetch(`https://graph.instagram.com/me?fields=id,username&access_token=${encodeURIComponent(t)}`).then((r) => r.json()).catch(() => ({}));
    if (!me.id) return json({ error: `Instagram didn't accept that token: ${me.error?.message ?? "unknown error"}` }, 400);
    await db.from("instagram_settings").update({ access_token: t, token_refreshed_at: new Date().toISOString(), token_expires_at: new Date(Date.now() + 60 * 86400_000).toISOString(), last_error: null }).eq("id", 1);
    body.force = true;
  }

  const { data: settings } = await db.from("instagram_settings").select("*").eq("id", 1).maybeSingle();
  if (!settings?.access_token) return json({ synced: false, reason: "not_connected" });

  if (body.action === "refresh_token") {
    try { await refreshToken(db, settings.access_token.trim()); return json({ refreshed: true }); }
    catch (e) { const m = e instanceof Error ? e.message : String(e); await db.from("instagram_settings").update({ last_error: m }).eq("id", 1); return json({ refreshed: false, error: m }); }
  }

  const force = !!body.force;
  const { data: sync } = await db.from("instagram_sync").select("last_synced_at, last_full_at").eq("id", 1).maybeSingle();
  const fullPass = force || !sync?.last_full_at || Date.now() - new Date(sync.last_full_at).getTime() > FULL_PASS_EVERY_MS;
  if (!force && sync?.last_synced_at && Date.now() - new Date(sync.last_synced_at).getTime() < MIN_INTERVAL_MS) return json({ synced: false, reason: "fresh" });
  await db.from("instagram_sync").update({ last_synced_at: new Date().toISOString() }).eq("id", 1);

  try {
    let token: string = settings.access_token.trim();
    const refreshedAt = settings.token_refreshed_at ? new Date(settings.token_refreshed_at).getTime() : 0;
    if (Date.now() - refreshedAt > REFRESH_AFTER_MS) token = await refreshToken(db, token).catch(() => token);

    const fields = "id,caption,media_type,media_url,thumbnail_url,permalink,timestamp";
    let next: string | null = `https://graph.instagram.com/me/media?fields=${fields}&limit=50&access_token=${encodeURIComponent(token)}`;
    const posts: IgPost[] = [];
    while (next && posts.length < (fullPass ? MAX_POSTS : 8)) {
      const res = await fetch(next);
      const page = await res.json();
      if (page.error) throw new Error(`Instagram: ${page.error.message}`);
      posts.push(...(page.data ?? []));
      next = fullPass ? page.paging?.next ?? null : null;
    }

    const { data: existing } = await db.from("instagram_posts").select("id, image_url, width, height");
    const known = new Map<string, { image_url: string; width: number | null; height: number | null }>((existing ?? []).map((r: { id: string; image_url: string; width: number | null; height: number | null }) => [r.id, r]));
    const rows = posts.map((p) => {
      const source = p.media_type === "VIDEO" ? p.thumbnail_url : p.media_url;
      const kept = known.get(p.id);
      const image_url = kept && kept.image_url.startsWith(publicBase) ? kept.image_url : source;
      return image_url ? { id: p.id, permalink: p.permalink, media_type: p.media_type, caption: p.caption ?? null, posted_at: p.timestamp, image_url, width: kept?.width ?? null, height: kept?.height ?? null } : null;
    }).filter((r): r is NonNullable<typeof r> => r !== null);

    let note = "";
    for (const r of rows.filter((r) => !r.image_url.startsWith(publicBase)).slice(0, COPY_PER_RUN)) {
      try {
        const res = await fetch(r.image_url);
        if (!res.ok) continue;
        const bytes = new Uint8Array(await res.arrayBuffer());
        const size = imageSize(bytes);
        const path = `instagram/${r.id}.jpg`;
        const { error } = await db.storage.from(BUCKET).upload(path, bytes, { contentType: "image/jpeg", upsert: true, cacheControl: "31536000" });
        if (error) throw new Error(error.message);
        r.image_url = `${publicBase}${path}`;
        if (size) { r.width = size.width; r.height = size.height; }
      } catch (e) {
        note = `Some photos are still served from Instagram for now (${e instanceof Error ? e.message : e}).`;
      }
    }

    if (rows.length) {
      const { error } = await db.from("instagram_posts").upsert(rows, { onConflict: "id" });
      if (error) throw new Error(error.message);
      if (fullPass) {
        const keep = new Set(rows.map((r) => r.id));
        const stale = [...known.keys()].filter((id) => !keep.has(id));
        if (stale.length) {
          await db.from("instagram_posts").delete().in("id", stale);
          await db.storage.from(BUCKET).remove(stale.map((id) => `instagram/${id}.jpg`));
        }
      }
    }
    const { count } = await db.from("instagram_posts").select("id", { count: "exact", head: true });
    await db.from("instagram_sync").update({ last_synced_at: new Date().toISOString(), post_count: count ?? rows.length, ...(fullPass ? { last_full_at: new Date().toISOString() } : {}) }).eq("id", 1);
    await db.from("instagram_settings").update({ last_error: note || null }).eq("id", 1);
    return json({ synced: true, count: count ?? rows.length, full: fullPass, note: note || undefined });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await db.from("instagram_settings").update({ last_error: message }).eq("id", 1);
    // the website keeps showing the last saved posts
    return json({ synced: false, error: message });
  }
});
