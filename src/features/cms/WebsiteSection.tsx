import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ExternalLink, History, Monitor, RotateCcw, Smartphone, Undo2, Eye, EyeOff, X, ChevronDown, ChevronRight } from "lucide-react";
import { SEED, type DocKey } from "@/cms/types";
import { demoMode, discardDraft, listRevisions, loadDoc, publish, restoreRevision, saveDraft, seedFor, type Doc, type Revision } from "./api";
import { Field, GroupField } from "./fields";
import { PAGES, sectionsFor, type PageDef } from "./schema";
import { sendPreview } from "./previewChannel";

/**
 * Dashboard → Website. Every page of the public site, its sections in the same order as on the page, and every
 * text, link, image, slide, testimonial, gallery and FAQ in them. Changes are saved as a draft automatically, shown
 * in the live preview, and only reach the site on "Publish". Every publish is kept, so any earlier version can be
 * restored. The layout itself is fixed in code: the editor can only change content.
 */

const btn = "inline-flex items-center gap-1.5 border border-border px-3 py-2 text-xs uppercase tracking-wider hover:bg-muted transition disabled:opacity-40 disabled:pointer-events-none";
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString("en-CA", { timeZone: "America/Edmonton", dateStyle: "medium", timeStyle: "short" }) : "never");
const idFromHash = () => (typeof window === "undefined" ? null : /^#website\/([a-z-]+)/.exec(window.location.hash)?.[1] ?? null);

export default function WebsiteSection() {
  const [id, setId] = useState<string | null>(idFromHash);
  useEffect(() => {
    const on = () => setId(idFromHash());
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  const open = (next: string | null) => {
    window.history.replaceState(null, "", next ? `#website/${next}` : "#website");
    setId(next);
    window.scrollTo({ top: 0 });
  };
  const def = PAGES.find((p) => p.id === id);
  return (
    <div>
      {demoMode && (
        <div className="mb-6 border border-amber-300 bg-amber-50 text-amber-900 px-4 py-3 text-sm">
          <b>Demo mode.</b> The database isn't connected yet, so edits are kept in this browser only and the live site doesn't change. Everything else (preview, publish, history) works the same.
        </div>
      )}
      {def ? <Editor key={def.id} def={def} onBack={() => open(null)} /> : <PageList onOpen={open} />}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* page list                                                           */
/* ------------------------------------------------------------------ */

function PageList({ onOpen }: { onOpen: (id: string) => void }) {
  const [docs, setDocs] = useState<Partial<Record<DocKey, Doc>>>({});
  const [err, setErr] = useState("");
  useEffect(() => {
    const keys = [...new Set(PAGES.map((p) => p.doc))];
    Promise.all(keys.map(async (k) => [k, await loadDoc(k)] as const))
      .then((rows) => setDocs(Object.fromEntries(rows)))
      .catch((e) => setErr(e instanceof Error ? e.message : String(e)));
  }, []);
  const status = (p: PageDef) => {
    const d = docs[p.doc];
    if (!d) return null;
    const pick = (v: unknown) => (p.keys ? p.keys.map((k) => (v as Record<string, unknown>)[k]) : v);
    return same(pick(d.draft), pick(d.published)) ? { label: "Live", tone: "text-emerald-700" } : { label: "Unpublished changes", tone: "text-amber-700" };
  };
  const groups: [string, PageDef[]][] = [["Pages", PAGES.filter((p) => p.doc !== "site")], ["Site-wide", PAGES.filter((p) => p.doc === "site")]];
  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl md:text-5xl">Website</h1>
          <p className="text-sm text-muted-foreground mt-2 max-w-xl">Edit the words and photos on every page. The design stays as it is: changes are previewed first and go live when you press Publish.</p>
        </div>
      </div>
      {err && <p className="text-sm text-destructive">Couldn't load the pages: {err}</p>}
      {groups.map(([title, list]) => (
        <section key={title}>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">{title}</h2>
          <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {list.map((p) => {
              const s = status(p);
              return (
                <button key={p.id} type="button" onClick={() => onOpen(p.id)} className="text-left border border-border p-5 hover:border-foreground transition group">
                  <div className="flex items-start justify-between gap-3">
                    <span className="font-display text-2xl leading-tight">{p.label}</span>
                    <ChevronRight size={18} className="text-muted-foreground group-hover:text-foreground mt-1 shrink-0" />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{p.doc === "site" ? "Every page" : p.path}</p>
                  <p className="text-sm mt-3">{p.blurb}</p>
                  <p className={`text-xs mt-3 ${s?.tone ?? "text-muted-foreground"}`}>{s?.label ?? "…"}</p>
                </button>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* editor                                                              */
/* ------------------------------------------------------------------ */

type SaveState = "idle" | "saving" | "saved" | "error";

function Editor({ def, onBack }: { def: PageDef; onBack: () => void }) {
  const [doc, setDoc] = useState<Doc | null>(null);
  const [content, setContent] = useState<Record<string, unknown> | null>(null);
  const [other, setOther] = useState<unknown>(null); // the site doc (when editing a page) or the preview page (when editing site-wide parts)
  const [rev, setRev] = useState(0); // remounts rich-text editors after undo / restore
  const [save, setSave] = useState<SaveState>("idle");
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState(false);
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [showPreview, setShowPreview] = useState(true);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const undo = useRef<{ stack: Record<string, unknown>[]; last: number }>({ stack: [], last: 0 });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef<Record<string, unknown> | null>(null);
  const sections = useMemo(() => sectionsFor(def), [def]);
  const seed = SEED[def.doc] as Record<string, unknown>;
  const otherKey: DocKey = def.doc === "site" ? def.preview : "site";

  const load = useCallback(async () => {
    setErr("");
    try {
      const [d, o] = await Promise.all([loadDoc(def.doc), loadDoc(otherKey)]);
      setDoc(d);
      setContent(d.draft as Record<string, unknown>);
      setOther(o.draft);
      setSavedAt(d.draftSavedAt);
      setRev((r) => r + 1);
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
  }, [def.doc, otherKey]);
  useEffect(() => { load(); }, [load]);

  const flush = useCallback(async () => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    const c = pending.current;
    if (!c) return;
    pending.current = null;
    setSave("saving");
    try { setSavedAt(await saveDraft(def.doc, c)); setSave("saved"); }
    catch (e) { setSave("error"); setErr(e instanceof Error ? e.message : String(e)); }
  }, [def.doc]);
  // save anything pending when leaving the page
  useEffect(() => () => { void flush(); }, [flush]);
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => { if (pending.current) { e.preventDefault(); void flush(); } };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [flush]);

  const queueSave = (c: Record<string, unknown>) => {
    pending.current = c;
    setSave("saving");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(flush, 1200);
  };

  const change = (next: Record<string, unknown>) => {
    if (!content) return;
    const u = undo.current;
    if (Date.now() - u.last > 800) { u.stack.push(content); if (u.stack.length > 60) u.stack.shift(); }
    u.last = Date.now();
    setContent(next);
    queueSave(next);
  };
  const doUndo = () => {
    const prev = undo.current.stack.pop();
    if (!prev) return;
    undo.current.last = 0;
    setContent(prev);
    queueSave(prev);
    setRev((r) => r + 1);
  };
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if ((e.metaKey || e.ctrlKey) && e.key === "z" && !e.shiftKey && !(t && (t.isContentEditable || /INPUT|TEXTAREA/.test(t.tagName)))) { e.preventDefault(); doUndo(); }
    };
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  });

  // live preview
  useEffect(() => {
    if (!content) return;
    const t = setTimeout(() => {
      if (def.doc === "site") sendPreview({ page: def.preview, site: content, content: other });
      else sendPreview({ page: def.preview, site: other, content });
    }, 200);
    return () => clearTimeout(t);
  }, [content, other, def.doc, def.preview]);

  const pick = (v: unknown) => (def.keys ? def.keys.map((k) => (v as Record<string, unknown>)[k]) : v);
  const unpublished = !!doc && !!content && !same(pick(content), pick(doc.published));

  const doPublish = async () => {
    if (!content) return;
    const note = window.prompt(`Publish ${def.label} to the live site?\n\nOptional: a short note for the version history (e.g. “New spring slides”).`, "");
    if (note === null) return;
    setBusy(true);
    try {
      await flush();
      await publish(def.doc, content, note.trim());
      await load();
      setSave("idle");
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  };
  const doDiscard = async () => {
    if (!window.confirm(`Throw away the unpublished changes on ${def.label}? The page goes back to what is live now.`)) return;
    setBusy(true);
    try { pending.current = null; await discardDraft(def.doc); undo.current.stack = []; await load(); setSave("idle"); }
    catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  };

  if (err && !content) return <div><BackBar onBack={onBack} title={def.label} /><p className="text-sm text-destructive mt-6">Couldn't load this page: {err}</p></div>;
  if (!content || !doc) return <div><BackBar onBack={onBack} title={def.label} /><p className="text-sm text-muted-foreground mt-6">Loading…</p></div>;

  const status = save === "saving" ? "Saving draft…" : save === "error" ? "Couldn't save. Check your connection." : unpublished ? `Draft saved ${savedAt ? when(savedAt) : ""} · not live yet` : doc.publishedAt ? `Live · published ${when(doc.publishedAt)}` : "Live · original WordPress content";
  const ctx = { folder: `cms/${def.doc}` };

  return (
    <div>
      {/* toolbar */}
      <div className="sticky top-0 z-30 -mx-4 md:-mx-8 px-4 md:px-8 py-3 bg-background/95 backdrop-blur border-b border-border mb-6">
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={onBack} className="p-2 -ml-2 hover:bg-muted" aria-label="All pages"><ArrowLeft size={18} /></button>
          <div className="mr-auto min-w-0">
            <h1 className="font-display text-2xl md:text-3xl leading-none truncate">{def.label}</h1>
            <p className={`text-xs mt-1 ${save === "error" ? "text-destructive" : unpublished ? "text-amber-700" : "text-muted-foreground"}`} aria-live="polite">{status}</p>
          </div>
          <button type="button" className={btn} onClick={doUndo} disabled={!undo.current.stack.length} title="Undo (Ctrl/⌘ Z)"><Undo2 size={14} /> Undo</button>
          <button type="button" className={btn} onClick={() => setHistory(true)}><History size={14} /> History</button>
          <button type="button" className={btn} onClick={doDiscard} disabled={!unpublished || busy}><RotateCcw size={14} /> Discard</button>
          <a className={btn} href="/cms-preview/" target="_blank" rel="noopener"><ExternalLink size={14} /> Preview</a>
          <button type="button" className={`${btn} bg-foreground text-background border-foreground hover:bg-foreground/85`} onClick={doPublish} disabled={!unpublished || busy}>{busy ? "Publishing…" : "Publish"}</button>
        </div>
        {err && <p className="text-xs text-destructive mt-2">{err}</p>}
      </div>

      <div className={`grid gap-8 ${showPreview ? "xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]" : ""}`}>
        {/* form */}
        <div className="space-y-4 min-w-0" key={rev}>
          <nav className="flex flex-wrap gap-1.5" aria-label="Sections">
            {sections.map((s) => <a key={s.id} href={`#website/${def.id}`} onClick={(e) => { e.preventDefault(); setCollapsed((c) => ({ ...c, [s.id]: false })); document.getElementById(`sec-${s.id}`)?.scrollIntoView({ behavior: "smooth", block: "start" }); }} className="text-xs border border-border px-2 py-1 hover:bg-muted">{s.label}</a>)}
          </nav>
          {sections.map((s, i) => (
            <section key={s.id} id={`sec-${s.id}`} className="border border-border scroll-mt-28">
              <button type="button" className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/50" onClick={() => setCollapsed((c) => ({ ...c, [s.id]: !c[s.id] }))} aria-expanded={!collapsed[s.id]}>
                <span className="text-xs text-muted-foreground tabular-nums w-5">{i + 1}</span>
                <span className="font-display text-xl flex-1">{s.label}</span>
                {collapsed[s.id] ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
              </button>
              {!collapsed[s.id] && (
                <div className="px-4 pb-5 pt-1 space-y-5">
                  {s.keys.length === 1 && s.id !== "_text"
                    ? (() => {
                        const k = s.keys[0];
                        const isObj = seed[k] && typeof seed[k] === "object" && !Array.isArray(seed[k]) && !("src" in (seed[k] as object));
                        return isObj
                          ? <GroupField bare path={k} k={k} seed={seed[k]} value={content[k]} ctx={ctx} onChange={(v) => change({ ...content, [k]: v })} />
                          : <Field path={k} k={k} seed={seed[k]} value={content[k]} ctx={ctx} onChange={(v) => change({ ...content, [k]: v })} />;
                      })()
                    : s.keys.map((k) => <Field key={k} path={k} k={k} seed={seed[k]} value={content[k]} ctx={ctx} onChange={(v) => change({ ...content, [k]: v })} />)}
                </div>
              )}
            </section>
          ))}
        </div>

        {/* preview */}
        {showPreview ? (
          <div className="min-w-0">
            <div className="xl:sticky xl:top-28">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mr-auto">Live preview{def.doc === "site" ? ` · ${PAGES.find((p) => p.id === def.preview)?.label}` : ""}</span>
                <button type="button" className={`p-1.5 ${device === "desktop" ? "bg-foreground text-background" : "hover:bg-muted"}`} onClick={() => setDevice("desktop")} aria-label="Desktop" aria-pressed={device === "desktop"}><Monitor size={15} /></button>
                <button type="button" className={`p-1.5 ${device === "mobile" ? "bg-foreground text-background" : "hover:bg-muted"}`} onClick={() => setDevice("mobile")} aria-label="Phone" aria-pressed={device === "mobile"}><Smartphone size={15} /></button>
                <button type="button" className="p-1.5 hover:bg-muted" onClick={() => setShowPreview(false)} aria-label="Hide preview"><EyeOff size={15} /></button>
              </div>
              <PreviewFrame device={device} />
            </div>
          </div>
        ) : (
          <button type="button" className={`${btn} fixed bottom-6 right-6 z-30 bg-background shadow-lg`} onClick={() => setShowPreview(true)}><Eye size={14} /> Show preview</button>
        )}
      </div>

      {history && (
        <HistoryDialog
          def={def}
          onClose={() => setHistory(false)}
          onRestore={async (rid) => {
            setBusy(true);
            try {
              await flush();
              if (rid === "seed") {
                const s = seedFor(def.doc) as Record<string, unknown>;
                const next = def.keys ? { ...content, ...Object.fromEntries(def.keys.map((k) => [k, s[k]])) } : s;
                change(next);
                await flush();
                setRev((r) => r + 1);
              } else {
                await restoreRevision(def.doc, rid);
                await load();
              }
              setHistory(false);
            } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
            finally { setBusy(false); }
          }}
        />
      )}
    </div>
  );
}

function BackBar({ onBack, title }: { onBack: () => void; title: string }) {
  return (
    <div className="flex items-center gap-2">
      <button type="button" onClick={onBack} className="p-2 -ml-2 hover:bg-muted" aria-label="All pages"><ArrowLeft size={18} /></button>
      <h1 className="font-display text-3xl">{title}</h1>
    </div>
  );
}

/** The real page, rendered at true desktop (1440px) or phone (390px) width and scaled to fit. */
function PreviewFrame({ device }: { device: "desktop" | "mobile" }) {
  const box = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(600);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const vw = device === "desktop" ? 1440 : 390;
  const scale = Math.min(1, w / vw);
  const viewH = typeof window !== "undefined" ? Math.max(420, window.innerHeight - 200) : 700;
  return (
    <div ref={box} className="border border-border bg-muted overflow-hidden" style={{ height: viewH }}>
      <iframe
        title="Page preview"
        src="/cms-preview/"
        style={{ width: vw, height: viewH / scale, transform: `scale(${scale})`, transformOrigin: "0 0", border: 0, display: "block", background: "#fff", marginLeft: device === "mobile" ? Math.max(0, (w - vw * scale) / 2) : 0 }}
      />
    </div>
  );
}

function HistoryDialog({ def, onClose, onRestore }: { def: PageDef; onClose: () => void; onRestore: (id: string) => void }) {
  const [list, setList] = useState<Revision[] | null>(null);
  const [err, setErr] = useState("");
  useEffect(() => { listRevisions(def.doc).then(setList).catch((e) => setErr(e instanceof Error ? e.message : String(e))); }, [def.doc]);
  const shared = def.doc === "site" ? " (header, menu, footer and contact details share one history)" : "";
  return (
    <div className="fixed inset-0 z-[100] bg-black/60 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Version history" onClick={onClose}>
      <div className="bg-background w-full max-w-lg max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h3 className="font-display text-2xl">Version history</h3>
          <button type="button" className="p-1.5 hover:bg-muted" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>
        <div className="overflow-y-auto p-5 space-y-2">
          <p className="text-sm text-muted-foreground">Restoring puts that version into the draft{shared}. Check the preview, then Publish to make it live.</p>
          {err && <p className="text-sm text-destructive">{err}</p>}
          {list === null && !err && <p className="text-sm text-muted-foreground">Loading…</p>}
          {list?.map((r, i) => (
            <div key={r.id} className="flex items-center gap-3 border border-border px-3 py-2.5">
              <div className="flex-1 min-w-0">
                <p className="text-sm">{when(r.created_at)}{i === 0 && <span className="ml-2 text-xs text-emerald-700">live now</span>}</p>
                {r.note && <p className="text-xs text-muted-foreground truncate">{r.note}</p>}
              </div>
              <button type="button" className={btn} onClick={() => onRestore(r.id)}>Restore</button>
            </div>
          ))}
          {list?.length === 0 && <p className="text-sm text-muted-foreground">No published versions yet.</p>}
          <div className="flex items-center gap-3 border border-dashed border-border px-3 py-2.5">
            <div className="flex-1"><p className="text-sm">Original WordPress content</p><p className="text-xs text-muted-foreground">As copied from the old site</p></div>
            <button type="button" className={btn} onClick={() => { if (window.confirm(`Put the original WordPress content of ${def.label} back into the draft?`)) onRestore("seed"); }}>Restore</button>
          </div>
        </div>
      </div>
    </div>
  );
}
