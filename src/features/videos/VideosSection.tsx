import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowUp, ExternalLink, Eye, EyeOff, Home, Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { rebuildSite } from "@/features/cms/api";
import { VIDEO_CATEGORIES, thumbHq, watchUrl, youtubeDetails, youtubeId } from "@/lib/youtube";

/**
 * Dashboard → Videos: the video portfolio. Paste a YouTube link, give it a category and it shows on the Video
 * Portfolio page (/videos/) of both designs; tick "On the home page" for up to five films in the home page's video
 * section. The order here is the order on the site. Visitors see changes straight away; the pre-built pages are
 * refreshed shortly after (the site rebuilds itself about 20 seconds after the last change).
 */
type Row = { id: string; youtube_id: string; url: string; title: string; description: string; category: string; on_home: boolean; sort_order: number; active: boolean; created_at: string };
const HOME_MAX = 5;
const btn = "inline-flex items-center gap-2 px-4 py-2 text-sm border border-border hover:border-foreground disabled:opacity-40";
const primary = "inline-flex items-center gap-2 px-4 py-2 text-sm bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-40";
const input = "w-full border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-foreground";
const iconBtn = "p-2 text-muted-foreground hover:text-foreground hover:bg-muted/60 rounded transition-colors disabled:opacity-30";

export default function VideosSection() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [err, setErr] = useState("");
  const [note, setNote] = useState("");
  const [editing, setEditing] = useState<Row | null>(null);
  const rebuildTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase.from("videos").select("*").order("sort_order", { ascending: true }).order("created_at", { ascending: false });
    if (error) { setErr(/relation .*videos/i.test(error.message) ? "The videos table isn't set up yet." : error.message); setRows([]); return; }
    setRows((data as Row[]) ?? []);
  }, []);
  useEffect(() => { void load(); }, [load]);

  // rebuild the pre-built pages once the changes settle (and right away if the dashboard is left)
  const scheduleRebuild = useCallback(() => {
    if (rebuildTimer.current) clearTimeout(rebuildTimer.current);
    rebuildTimer.current = setTimeout(() => { rebuildTimer.current = null; void rebuildSite(); }, 20000);
  }, []);
  useEffect(() => () => { if (rebuildTimer.current) { clearTimeout(rebuildTimer.current); void rebuildSite(); } }, []);

  const changed = async (msg: string) => { setNote(msg); scheduleRebuild(); await load(); };
  const homeCount = useMemo(() => (rows ?? []).filter((r) => r.on_home && r.active).length, [rows]);

  const update = async (r: Row, patch: Partial<Row>, msg: string) => {
    setErr("");
    const { error } = await supabase.from("videos").update(patch).eq("id", r.id);
    if (error) { setErr(error.message); return; }
    await changed(msg);
  };
  const move = async (i: number, d: -1 | 1) => {
    if (!rows) return;
    const j = i + d;
    if (j < 0 || j >= rows.length) return;
    // renumber the whole list so the order is always explicit
    const next = [...rows];
    [next[i], next[j]] = [next[j], next[i]];
    const results = await Promise.all(next.map((r, k) => (r.sort_order === k ? null : supabase.from("videos").update({ sort_order: k }).eq("id", r.id))));
    const failed = results.find((x) => x?.error);
    if (failed?.error) { setErr(failed.error.message); return; }
    await changed("Order saved.");
  };
  const remove = async (r: Row) => {
    if (!window.confirm(`Remove “${r.title || "this film"}” from the website? The film stays on YouTube.`)) return;
    const { error } = await supabase.from("videos").delete().eq("id", r.id);
    if (error) { setErr(error.message); return; }
    await changed("Film removed.");
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <p className="text-sm text-muted-foreground max-w-2xl">
        Paste a YouTube link to add a film to the <a href="/videos/" target="_blank" rel="noopener noreferrer" className="underline underline-offset-4 text-foreground">Video Portfolio</a> page. Tick “On the home page” for up to {HOME_MAX} films in the home page’s video section. Films play on the website through YouTube; unlisted videos work too, private ones don’t.
      </p>
      <AddFilm count={rows?.length ?? 0} homeFull={homeCount >= HOME_MAX} onAdded={(m) => void changed(m)} />
      {err && <p className="text-sm text-destructive" role="alert">{err}</p>}
      {note && !err && <p className="text-sm text-emerald-700" role="status">{note} The website shows it now; the saved pages refresh within a couple of minutes.</p>}

      <section>
        <div className="flex items-baseline justify-between gap-3 mb-3">
          <h2 className="font-display text-2xl">Films {rows ? <span className="text-muted-foreground text-base">({rows.length})</span> : null}</h2>
          <p className="text-xs text-muted-foreground">On the home page: <b className="text-foreground">{homeCount} of {HOME_MAX}</b></p>
        </div>
        {rows === null ? <p className="text-sm text-muted-foreground">Loading…</p> : rows.length === 0 ? (
          <div className="border border-border p-8 text-sm text-muted-foreground">No films yet. Paste a YouTube link above to add the first one.</div>
        ) : (
          <ul className="space-y-3">
            {rows.map((r, i) => (
              <li key={r.id} className={`border border-border p-3 flex flex-wrap sm:flex-nowrap items-center gap-4 ${r.active ? "" : "opacity-60"}`}>
                <a href={watchUrl(r.youtube_id)} target="_blank" rel="noopener noreferrer" className="relative block w-40 shrink-0 aspect-video overflow-hidden rounded-lg bg-muted" title="Watch on YouTube">
                  <img src={thumbHq(r.youtube_id)} alt="" className="absolute inset-0 w-full h-full object-cover" loading="lazy" />
                </a>
                <div className="min-w-0 flex-1">
                  <p className="font-medium truncate">{r.title || "Untitled film"}</p>
                  <p className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-x-3 gap-y-1">
                    <span>{r.category}</span>
                    {r.on_home && r.active && <span className="inline-flex items-center gap-1 text-foreground"><Home size={12} /> On the home page</span>}
                    {!r.active && <span>Hidden</span>}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button className={iconBtn} onClick={() => void move(i, -1)} disabled={i === 0} aria-label="Move up"><ArrowUp size={16} /></button>
                  <button className={iconBtn} onClick={() => void move(i, 1)} disabled={i === rows.length - 1} aria-label="Move down"><ArrowDown size={16} /></button>
                  <button className={`${iconBtn} ${r.on_home ? "text-foreground" : ""}`} onClick={() => void update(r, { on_home: !r.on_home }, r.on_home ? "Taken off the home page." : "Added to the home page.")}
                    disabled={!r.on_home && homeCount >= HOME_MAX} aria-pressed={r.on_home} aria-label={r.on_home ? "Take off the home page" : "Show on the home page"} title={!r.on_home && homeCount >= HOME_MAX ? `${HOME_MAX} films are already on the home page` : r.on_home ? "Take off the home page" : "Show on the home page"}>
                    <Home size={16} />
                  </button>
                  <button className={iconBtn} onClick={() => void update(r, { active: !r.active }, r.active ? "Film hidden." : "Film shown.")} aria-label={r.active ? "Hide from the website" : "Show on the website"} title={r.active ? "Hide from the website" : "Show on the website"}>
                    {r.active ? <Eye size={16} /> : <EyeOff size={16} />}
                  </button>
                  <button className={iconBtn} onClick={() => setEditing(r)} aria-label="Edit details"><Pencil size={16} /></button>
                  <button className={`${iconBtn} hover:text-destructive`} onClick={() => void remove(r)} aria-label="Remove"><Trash2 size={16} /></button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
      {editing && <EditFilm row={editing} onClose={() => setEditing(null)} onSaved={(m) => { setEditing(null); void changed(m); }} />}
    </div>
  );
}

/** Paste a link: the id, thumbnail and title come straight from YouTube. */
function AddFilm({ count, homeFull, onAdded }: { count: number; homeFull: boolean; onAdded: (msg: string) => void }) {
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<string>(VIDEO_CATEGORIES[0]);
  const [description, setDescription] = useState("");
  const [onHome, setOnHome] = useState(false);
  const [looking, setLooking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const id = youtubeId(url);
  const titled = useRef("");
  useEffect(() => {
    if (!id || titled.current === id) return;
    titled.current = id;
    setLooking(true);
    youtubeDetails(id).then((d) => {
      setLooking(false);
      if (d?.title) setTitle((t) => t || d.title);
      else setMsg("YouTube didn't share this video's details. If it's private, change it to Public or Unlisted; otherwise type a title.");
    });
  }, [id]);
  const reset = () => { setUrl(""); setTitle(""); setDescription(""); setOnHome(false); setMsg(""); titled.current = ""; };
  const add = async () => {
    if (!id) { setMsg("That doesn't look like a YouTube link. Copy the address from the video page or its Share button."); return; }
    setBusy(true); setMsg("");
    const { data: exists } = await supabase.from("videos").select("id").eq("youtube_id", id).maybeSingle();
    if (exists) { setBusy(false); setMsg("This film is already in the list."); return; }
    const { data: first } = await supabase.from("videos").select("sort_order").order("sort_order", { ascending: true }).limit(1);
    const sort = first?.[0] ? Number(first[0].sort_order) - 1 : 0;
    const { error } = await supabase.from("videos").insert({ youtube_id: id, url: url.trim(), title: title.trim(), description: description.trim(), category, on_home: onHome && !homeFull, sort_order: sort });
    setBusy(false);
    if (error) { setMsg(error.message); return; }
    reset();
    onAdded("Film added.");
  };
  return (
    <section className="border border-border p-5 space-y-4">
      <h2 className="font-display text-2xl">Add a film</h2>
      <div className="grid md:grid-cols-[1fr_220px] gap-4">
        <div className="space-y-3">
          <label className="block text-sm">YouTube link
            <input className={input} value={url} onChange={(e) => { setUrl(e.target.value); setMsg(""); }} placeholder="https://www.youtube.com/watch?v=… or https://youtu.be/…" inputMode="url" autoComplete="off" />
          </label>
          <label className="block text-sm">Title {looking && <Loader2 size={12} className="inline animate-spin ml-1" />}
            <input className={input} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Filled in from YouTube; change it if you like" />
          </label>
          <div className="grid sm:grid-cols-2 gap-3">
            <label className="block text-sm">Category
              <select className={input} value={category} onChange={(e) => setCategory(e.target.value)}>{VIDEO_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select>
            </label>
            <label className="flex items-center gap-2 text-sm sm:pt-6">
              <input type="checkbox" checked={onHome && !homeFull} disabled={homeFull} onChange={(e) => setOnHome(e.target.checked)} />
              On the home page {homeFull && <span className="text-xs text-muted-foreground">({HOME_MAX} already)</span>}
            </label>
          </div>
          <label className="block text-sm">Short description <span className="text-muted-foreground">(optional, shown under the film)</span>
            <textarea className={input} rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
          </label>
        </div>
        <div className="aspect-video md:aspect-auto md:h-full min-h-[124px] rounded-lg overflow-hidden bg-muted grid place-items-center text-xs text-muted-foreground text-center p-3">
          {id ? <img src={thumbHq(id)} alt="" className="w-full h-full object-cover" /> : "The film's picture appears here"}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className={primary} onClick={() => void add()} disabled={busy || !url.trim()}>{busy ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />} Add film</button>
        {id && <a href={watchUrl(id)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs underline underline-offset-4 text-muted-foreground">Check it on YouTube <ExternalLink size={12} /></a>}
        {msg && <p className="text-sm text-destructive" role="alert">{msg}</p>}
        <span className="text-xs text-muted-foreground ml-auto">{count} film{count === 1 ? "" : "s"} so far</span>
      </div>
    </section>
  );
}

function EditFilm({ row, onClose, onSaved }: { row: Row; onClose: () => void; onSaved: (msg: string) => void }) {
  const [title, setTitle] = useState(row.title);
  const [category, setCategory] = useState(row.category);
  const [description, setDescription] = useState(row.description);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const save = async () => {
    setBusy(true);
    const { error } = await supabase.from("videos").update({ title: title.trim(), category, description: description.trim() }).eq("id", row.id);
    setBusy(false);
    if (error) { setMsg(error.message); return; }
    onSaved("Film updated.");
  };
  const cats = VIDEO_CATEGORIES.includes(category as (typeof VIDEO_CATEGORIES)[number]) ? VIDEO_CATEGORIES : [category, ...VIDEO_CATEGORIES];
  return (
    <div className="fixed inset-0 z-50 bg-black/60 grid place-items-center p-4" onClick={onClose}>
      <div className="bg-background w-full max-w-lg p-6 space-y-4" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Edit film">
        <div className="flex items-center justify-between"><h2 className="font-display text-2xl">Edit film</h2><button onClick={onClose} aria-label="Close" className={iconBtn}><X size={18} /></button></div>
        <img src={thumbHq(row.youtube_id)} alt="" className="w-full aspect-video object-cover rounded-lg" />
        <label className="block text-sm">Title<input className={input} value={title} onChange={(e) => setTitle(e.target.value)} /></label>
        <label className="block text-sm">Category<select className={input} value={category} onChange={(e) => setCategory(e.target.value)}>{cats.map((c) => <option key={c}>{c}</option>)}</select></label>
        <label className="block text-sm">Short description<textarea className={input} rows={3} value={description} onChange={(e) => setDescription(e.target.value)} /></label>
        <div className="flex gap-2"><button className={primary} disabled={busy} onClick={() => void save()}>{busy && <Loader2 size={15} className="animate-spin" />} Save</button><button className={btn} onClick={onClose}>Cancel</button></div>
        {msg && <p className="text-sm text-destructive">{msg}</p>}
      </div>
    </div>
  );
}
