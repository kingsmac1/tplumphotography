/**
 * YouTube helpers shared by the website (video portfolio) and the dashboard (Dashboard → Videos).
 * The studio pastes any YouTube link; we keep only the 11-character video id.
 */

/** The video id from any common YouTube link (watch, youtu.be, shorts, embed, live, music), or a bare id. */
export function youtubeId(input: string): string | null {
  const s = input.trim();
  if (/^[A-Za-z0-9_-]{11}$/.test(s)) return s;
  let u: URL;
  try { u = new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`); } catch { return null; }
  const host = u.hostname.replace(/^www\.|^m\.|^music\./, "");
  let id: string | null = null;
  if (host === "youtu.be") id = u.pathname.split("/")[1] ?? null;
  else if (host === "youtube.com" || host === "youtube-nocookie.com") {
    if (u.pathname === "/watch") id = u.searchParams.get("v");
    else {
      const m = /^\/(?:shorts|embed|live|v)\/([^/?#]+)/.exec(u.pathname);
      id = m?.[1] ?? null;
    }
  }
  return id && /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
}

/** Thumbnails: hqdefault always exists (480×360, the 16:9 frame sits in the middle); maxresdefault (1280×720) usually does. */
export const thumbHq = (id: string) => `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
export const thumbMax = (id: string) => `https://i.ytimg.com/vi/${id}/maxresdefault.jpg`;

/** Privacy-enhanced embed (no cookies until the film plays), starting straight away, without unrelated suggestions. */
export const embedUrl = (id: string) =>
  `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&modestbranding=1&playsinline=1&color=white`;

export const watchUrl = (id: string) => `https://www.youtube.com/watch?v=${id}`;

/** Title and channel from YouTube (oEmbed; allowed from the browser). Null if the video is private or the call fails. */
export async function youtubeDetails(id: string): Promise<{ title: string; author: string } | null> {
  try {
    const r = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(watchUrl(id))}&format=json`);
    if (!r.ok) return null;
    const d = (await r.json()) as { title?: string; author_name?: string };
    return { title: d.title ?? "", author: d.author_name ?? "" };
  } catch {
    return null;
  }
}

export const VIDEO_CATEGORIES = ["Wedding", "Engagement", "Portrait", "Kiddies", "Event", "Behind the scenes", "Other"] as const;
