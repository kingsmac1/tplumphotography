import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import Cropper, { type Area } from "react-easy-crop";
import { DndContext, PointerSensor, KeyboardSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, rectSortingStrategy, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ChevronDown, ChevronRight, Crop, GripVertical, ImagePlus, Plus, Trash2, Upload, X } from "lucide-react";
import { RichTextEditor } from "@/pages/admin/RichTextEditor";
import { uploadImage } from "@/lib/siteMedia";
import type { CmsImage } from "@/cms/types";
import { demoMode } from "./api";
import { HELP, blankLike, checkUrl, isHidden, itemTitle, kindOf, labelFor } from "./schema";

/* ------------------------------------------------------------------ */
/* shared bits                                                         */
/* ------------------------------------------------------------------ */

export const inputCls = "w-full border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-foreground";
const btnCls = "inline-flex items-center gap-1.5 border border-border px-3 py-1.5 text-xs uppercase tracking-wider hover:bg-muted transition disabled:opacity-50";
const iconBtn = "p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted transition";

type Ctx = { folder: string };
type FP = { path: string; k: string; seed: unknown; value: unknown; onChange: (v: unknown) => void; ctx: Ctx };

function Label({ path, k, children }: { path: string; k: string; children?: ReactNode }) {
  const tail = path.split(".").slice(-2).join(".");
  const help = HELP[tail] ?? HELP[path];
  return (
    <div className="mb-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{labelFor(k)}</span>
        {children}
      </div>
      {help && <p className="text-xs text-muted-foreground mt-0.5">{help}</p>}
    </div>
  );
}

/** Stable React keys for a list whose items carry no ids. Regenerated when the list is replaced from outside. */
function useIds(len: number) {
  const ref = useRef<string[]>([]);
  if (ref.current.length !== len) ref.current = Array.from({ length: len }, () => Math.random().toString(36).slice(2));
  return ref;
}

function SortableRow({ id, children }: { id: string; children: (handle: ReactNode) => ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const handle = (
    <button type="button" className={`${iconBtn} cursor-grab touch-none`} aria-label="Drag to reorder" {...attributes} {...listeners}>
      <GripVertical size={15} />
    </button>
  );
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 10 : undefined, opacity: isDragging ? 0.8 : 1, position: "relative" }}>
      {children(handle)}
    </div>
  );
}

function Sortable({ ids, onMove, grid, children }: { ids: string[]; onMove: (from: number, to: number) => void; grid?: boolean; children: ReactNode }) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const end = (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return;
    onMove(ids.indexOf(String(e.active.id)), ids.indexOf(String(e.over.id)));
  };
  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={end}>
      <SortableContext items={ids} strategy={grid ? rectSortingStrategy : verticalListSortingStrategy}>{children}</SortableContext>
    </DndContext>
  );
}

/* ------------------------------------------------------------------ */
/* dispatcher                                                          */
/* ------------------------------------------------------------------ */

export function Field(p: FP) {
  const kind = kindOf(p.k, p.seed);
  switch (kind) {
    case "text": return <TextField {...p} />;
    case "textarea": return <TextField {...p} multiline />;
    case "url": return <UrlField {...p} />;
    case "number": return <NumberField {...p} />;
    case "rich": return <RichField {...p} />;
    case "image": return <ImageField {...p} />;
    case "images": return <ImagesField {...p} />;
    case "strings": return <StringsField {...p} />;
    case "items": return <ItemsField {...p} />;
    default: return <GroupField {...p} />;
  }
}

/** The fields of an object, in seed order. */
export function GroupField({ path, k, seed, value, onChange, ctx, bare }: FP & { bare?: boolean }) {
  const s = (seed ?? {}) as Record<string, unknown>;
  const v = (value ?? {}) as Record<string, unknown>;
  const keys = Object.keys(s).filter((x) => !isHidden(x));
  const inner = (
    <div className="space-y-5">
      {keys.map((key) => (
        <Field key={key} path={`${path}.${key}`} k={key} seed={s[key]} value={v[key]} ctx={ctx} onChange={(nv) => onChange({ ...v, [key]: nv })} />
      ))}
    </div>
  );
  if (bare) return inner;
  return (
    <fieldset className="border border-border p-4">
      <legend className="px-1 text-xs font-semibold uppercase tracking-wider">{labelFor(k)}</legend>
      {inner}
    </fieldset>
  );
}

/* ------------------------------------------------------------------ */
/* simple values                                                       */
/* ------------------------------------------------------------------ */

function TextField({ path, k, seed, value, onChange, multiline }: FP & { multiline?: boolean }) {
  const v = typeof value === "string" ? value : "";
  // Headings that the original site breaks over several lines ("Candid / Timeless / Moments") keep one line per row.
  const lines = typeof seed === "string" && seed.includes("\n") && seed.length <= 90 ? seed.split("\n").length : 0;
  const tail = path.split(".").slice(-2).join(".");
  const limit = tail === "seo.title" || /seo\.(og|twitter)Title/.test(tail) ? 60 : tail.endsWith("escription") && path.includes("seo") ? 160 : 0;
  return (
    <label className="block">
      <Label path={path} k={k}>{limit > 0 && <span className={`text-xs ${v.length > limit ? "text-amber-700" : "text-muted-foreground"}`}>{v.length}/{limit}</span>}</Label>
      {multiline
        ? lines
          ? <><textarea className={inputCls} rows={Math.max(lines, v.split("\n").length)} value={v} onChange={(e) => onChange(e.target.value)} /><p className="text-xs text-muted-foreground mt-1">Each line here is a line on the page (press Enter for a new line).</p></>
          : <textarea className={`${inputCls} min-h-[88px]`} value={v} onChange={(e) => onChange(e.target.value)} />
        : <input className={inputCls} value={v} onChange={(e) => onChange(e.target.value)} />}
    </label>
  );
}

function UrlField({ path, k, value, onChange }: FP) {
  const v = typeof value === "string" ? value : "";
  const warn = checkUrl(v);
  return (
    <label className="block">
      <Label path={path} k={k} />
      <input className={inputCls} value={v} onChange={(e) => onChange(e.target.value.trim())} placeholder="/contact/ or https://…" inputMode="url" />
      {warn && <p className="text-xs text-amber-700 mt-1">{warn}</p>}
    </label>
  );
}

function NumberField({ path, k, value, onChange }: FP) {
  const v = typeof value === "number" ? value : 0;
  const max = k === "rating" ? 5 : 9999;
  return (
    <label className="block max-w-[140px]">
      <Label path={path} k={k} />
      <input type="number" min={0} max={max} className={inputCls} value={v} onChange={(e) => onChange(Math.max(0, Math.min(max, Number(e.target.value) || 0)))} />
    </label>
  );
}

function RichField({ path, k, value, onChange }: FP) {
  return (
    <div>
      <Label path={path} k={k} />
      <RichTextEditor value={typeof value === "string" ? value : ""} onChange={onChange} minHeight={110} />
      <p className="text-xs text-muted-foreground mt-1">Bold, italic, lists and links only. Fonts, sizes and colours stay as designed.</p>
    </div>
  );
}

function StringsField({ path, k, value, onChange }: FP) {
  const list = Array.isArray(value) ? (value as string[]) : [];
  const ids = useIds(list.length);
  const set = (next: string[], nextIds: string[]) => { ids.current = nextIds; onChange(next); };
  return (
    <div>
      <Label path={path} k={k} />
      <Sortable ids={ids.current} onMove={(a, b) => set(arrayMove(list, a, b), arrayMove(ids.current, a, b))}>
        <div className="space-y-1.5">
          {list.map((s, i) => (
            <SortableRow key={ids.current[i]} id={ids.current[i]}>
              {(handle) => (
                <div className="flex items-center gap-1">
                  {handle}
                  <input className={inputCls} value={s} onChange={(e) => onChange(list.map((x, j) => (j === i ? e.target.value : x)))} />
                  <button type="button" className={iconBtn} aria-label="Remove" onClick={() => set(list.filter((_, j) => j !== i), ids.current.filter((_, j) => j !== i))}><Trash2 size={15} /></button>
                </div>
              )}
            </SortableRow>
          ))}
        </div>
      </Sortable>
      <button type="button" className={`${btnCls} mt-2`} onClick={() => set([...list, ""], [...ids.current, Math.random().toString(36).slice(2)])}><Plus size={13} /> Add option</button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* lists of objects (testimonials, FAQ, steps, menu links, posts)       */
/* ------------------------------------------------------------------ */

function ItemsField({ path, k, seed, value, onChange, ctx }: FP) {
  const list = Array.isArray(value) ? (value as unknown[]) : [];
  // sub-menu items (menu.items[].children) start as a label + link even when the first menu item has none
  const sample = (Array.isArray(seed) ? seed[0] : undefined) ?? list[0] ?? (k === "children" ? { label: "", href: "" } : {});
  const ids = useIds(list.length);
  const [open, setOpen] = useState<string | null>(null);
  const set = (next: unknown[], nextIds: string[]) => { ids.current = nextIds; onChange(next); };
  const add = () => {
    const id = Math.random().toString(36).slice(2);
    set([...list, blankLike(sample)], [...ids.current, id]);
    setOpen(id);
  };
  return (
    <div>
      <Label path={path} k={k} />
      <Sortable ids={ids.current} onMove={(a, b) => set(arrayMove(list, a, b), arrayMove(ids.current, a, b))}>
        <div className="space-y-2">
          {list.map((item, i) => {
            const id = ids.current[i];
            const isOpen = open === id;
            return (
              <SortableRow key={id} id={id}>
                {(handle) => (
                  <div className="border border-border bg-background">
                    <div className="flex items-center gap-1 px-1 py-1">
                      {handle}
                      <button type="button" className="flex-1 flex items-center gap-2 text-left text-sm py-1.5 min-w-0" onClick={() => setOpen(isOpen ? null : id)} aria-expanded={isOpen}>
                        {isOpen ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                        <span className="text-muted-foreground tabular-nums w-6 shrink-0">{i + 1}.</span>
                        <span className="truncate">{itemTitle(item, i)}</span>
                      </button>
                      <button type="button" className={iconBtn} aria-label="Remove" onClick={() => { if (window.confirm(`Remove “${itemTitle(item, i)}”?`)) set(list.filter((_, j) => j !== i), ids.current.filter((_, j) => j !== i)); }}><Trash2 size={15} /></button>
                    </div>
                    {isOpen && (
                      <div className="border-t border-border p-4">
                        <GroupField bare path={`${path}.${i}`} k={k} seed={sample} value={item} ctx={ctx} onChange={(nv) => onChange(list.map((x, j) => (j === i ? nv : x)))} />
                      </div>
                    )}
                  </div>
                )}
              </SortableRow>
            );
          })}
        </div>
      </Sortable>
      <button type="button" className={`${btnCls} mt-2`} onClick={add}><Plus size={13} /> Add</button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* images                                                              */
/* ------------------------------------------------------------------ */

type Img = CmsImage;
const asImg = (v: unknown): Img => (v && typeof v === "object" ? (v as Img) : { src: "", alt: "" });

/** Demo mode (no Supabase yet): keep a small WebP in the browser so replacing images can still be tried. */
async function demoImage(file: Blob, crop?: Area): Promise<Img> {
  const bmp = await createImageBitmap(file, { imageOrientation: "from-image" } as ImageBitmapOptions);
  const sx = crop?.x ?? 0, sy = crop?.y ?? 0, sw = crop?.width ?? bmp.width, sh = crop?.height ?? bmp.height;
  const w = Math.min(1200, Math.round(sw));
  const h = Math.round((sh / sw) * w);
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  c.getContext("2d")!.drawImage(bmp, sx, sy, sw, sh, 0, 0, w, h);
  return { src: c.toDataURL("image/webp", 0.75), width: w, height: h, alt: "" };
}

async function storeImage(file: Blob, folder: string, crop?: Area): Promise<Img> {
  if (demoMode) return demoImage(file, crop);
  const up = await uploadImage(file, folder, crop);
  return { src: up.url, srcset: up.srcset || undefined, width: up.width || undefined, height: up.height || undefined, alt: "" };
}

/** Pick → crop → optimise → upload. Keeps the current shape by default so the layout can't change. */
function CropDialog({ src, aspect, onCancel, onDone }: { src: string; aspect?: number; onCancel: () => void; onDone: (crop: Area | undefined) => void }) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [keep, setKeep] = useState(!!aspect);
  const [natural, setNatural] = useState<number | undefined>();
  const area = useRef<Area | undefined>(undefined);
  const onComplete = useCallback((_: Area, px: Area) => { area.current = px; }, []);
  return (
    <div className="fixed inset-0 z-[100] bg-black/70 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Crop image">
      <div className="bg-background w-full max-w-3xl">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h3 className="font-display text-2xl">Crop image</h3>
          <button type="button" className={iconBtn} onClick={onCancel} aria-label="Close"><X size={18} /></button>
        </div>
        <div className="relative h-[55vh] bg-neutral-900">
          <Cropper
            image={src}
            crop={crop}
            zoom={zoom}
            aspect={keep && aspect ? aspect : natural ?? 4 / 3}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onComplete}
            onMediaLoaded={(m) => setNatural(m.naturalWidth / m.naturalHeight)}
          />
        </div>
        <div className="flex flex-wrap items-center gap-4 px-4 py-3">
          <label className="flex items-center gap-2 text-sm">Zoom <input type="range" min={1} max={4} step={0.01} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} /></label>
          {aspect && (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={keep} onChange={(e) => setKeep(e.target.checked)} /> Keep the current shape (recommended)
            </label>
          )}
          <div className="ml-auto flex gap-2">
            <button type="button" className={btnCls} onClick={() => onDone(undefined)}>Use whole image</button>
            <button type="button" className={`${btnCls} bg-foreground text-background hover:bg-foreground/90`} onClick={() => onDone(area.current)}>Crop & use</button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** One image: preview (click to set the focus point), replace, crop, alt text. */
function ImageField({ path, k, value, onChange, ctx }: FP) {
  const img = asImg(value);
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const [picking, setPicking] = useState<{ file: Blob; url: string } | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const aspect = img.width && img.height ? img.width / img.height : undefined;
  useEffect(() => () => { if (picking) URL.revokeObjectURL(picking.url); }, [picking]);

  const choose = (f?: File | null) => {
    setErr("");
    if (!f) return;
    if (!/^image\//.test(f.type)) return setErr("Please choose an image file (JPG, PNG, WebP).");
    if (f.size > 40 * 1024 * 1024) return setErr("That file is over 40 MB. Please export a smaller version.");
    setPicking({ file: f, url: URL.createObjectURL(f) });
  };
  const recrop = async () => {
    setErr("");
    try {
      setBusy("Opening…");
      const blob = await (await fetch(img.src)).blob();
      setPicking({ file: blob, url: URL.createObjectURL(blob) });
    } catch { setErr("Couldn't open this image for cropping. Upload the original instead."); }
    finally { setBusy(""); }
  };
  const done = async (crop?: Area) => {
    if (!picking) return;
    const file = picking.file;
    setPicking(null);
    setBusy("Optimising & uploading…");
    try {
      const next = await storeImage(file, ctx.folder, crop);
      onChange({ ...next, alt: img.alt ?? "" });
    } catch (e) { setErr(e instanceof Error ? e.message : "Upload failed."); }
    finally { setBusy(""); }
  };
  const setFocal = (e: React.MouseEvent<HTMLButtonElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const x = Math.round(((e.clientX - r.left) / r.width) * 100), y = Math.round(((e.clientY - r.top) / r.height) * 100);
    onChange({ ...img, focal: { x, y } });
  };

  return (
    <div>
      <Label path={path} k={k} />
      <div className="flex flex-col sm:flex-row gap-3">
        <button type="button" onClick={setFocal} title="Click the part of the photo that must always stay visible" className="relative w-full sm:w-44 h-32 bg-muted shrink-0 overflow-hidden border border-border">
          {img.src ? <img src={img.src} alt="" className="w-full h-full object-cover" style={img.focal ? { objectPosition: `${img.focal.x}% ${img.focal.y}%` } : undefined} /> : <span className="text-xs text-muted-foreground">No image</span>}
          {img.focal && <span className="absolute w-3 h-3 -ml-1.5 -mt-1.5 rounded-full border-2 border-white shadow" style={{ left: `${img.focal.x}%`, top: `${img.focal.y}%` }} />}
        </button>
        <div className="flex-1 space-y-2 min-w-0">
          <div className="flex flex-wrap gap-2">
            <button type="button" className={btnCls} onClick={() => input.current?.click()} disabled={!!busy}><Upload size={13} /> {img.src ? "Replace" : "Upload"}</button>
            {img.src && <button type="button" className={btnCls} onClick={recrop} disabled={!!busy}><Crop size={13} /> Crop</button>}
            <input ref={input} type="file" accept="image/*" hidden onChange={(e) => { choose(e.target.files?.[0]); e.target.value = ""; }} />
          </div>
          <input className={inputCls} value={img.alt ?? ""} onChange={(e) => onChange({ ...img, alt: e.target.value })} placeholder="Describe the photo (for Google and screen readers)" aria-label="Alt text" />
          <p className="text-xs text-muted-foreground">{busy || (img.width ? `${img.width} × ${img.height}px. Click the photo to set its focus point.` : "Click the photo to set its focus point.")}</p>
          {err && <p className="text-xs text-destructive">{err}</p>}
        </div>
      </div>
      {picking && <CropDialog src={picking.url} aspect={aspect} onCancel={() => setPicking(null)} onDone={done} />}
    </div>
  );
}

/** A gallery or slider: thumbnails you drag to reorder, add many at once, remove, edit alt text. */
function ImagesField({ path, k, value, onChange, ctx }: FP) {
  const list = Array.isArray(value) ? (value as Img[]) : [];
  const ids = useIds(list.length);
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const [edit, setEdit] = useState<number | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const set = (next: Img[], nextIds: string[]) => { ids.current = nextIds; onChange(next); };
  const addFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setErr("");
    const added: Img[] = [];
    let n = 0;
    for (const f of Array.from(files)) {
      if (!/^image\//.test(f.type)) continue;
      setBusy(`Optimising & uploading ${++n} of ${files.length}…`);
      try { added.push({ ...(await storeImage(f, ctx.folder)), alt: list[0]?.alt ?? "" }); }
      catch (e) { setErr(e instanceof Error ? e.message : "Upload failed."); break; }
    }
    setBusy("");
    if (added.length) set([...list, ...added], [...ids.current, ...added.map(() => Math.random().toString(36).slice(2))]);
  };
  return (
    <div>
      <Label path={path} k={k}><span className="text-xs text-muted-foreground">{list.length} images</span></Label>
      <Sortable grid ids={ids.current} onMove={(a, b) => set(arrayMove(list, a, b), arrayMove(ids.current, a, b))}>
        <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-6 gap-2">
          {list.map((img, i) => (
            <SortableRow key={ids.current[i]} id={ids.current[i]}>
              {(handle) => (
                <div className={`relative group border ${edit === i ? "border-foreground" : "border-border"} bg-muted aspect-square`}>
                  <button type="button" className="absolute inset-0" onClick={() => setEdit(edit === i ? null : i)} aria-label={`Edit image ${i + 1}`}>
                    {img.src && <img src={img.src} alt="" loading="lazy" className="w-full h-full object-cover" />}
                  </button>
                  <div className="absolute top-0 left-0 bg-background/90">{handle}</div>
                  <span className="absolute bottom-0 left-0 bg-background/90 text-[10px] px-1 tabular-nums">{i + 1}</span>
                  <button type="button" className="absolute top-0 right-0 bg-background/90 p-1.5 text-muted-foreground hover:text-destructive" aria-label={`Remove image ${i + 1}`}
                    onClick={() => { if (window.confirm("Remove this image from the page?")) { set(list.filter((_, j) => j !== i), ids.current.filter((_, j) => j !== i)); setEdit(null); } }}>
                    <Trash2 size={13} />
                  </button>
                </div>
              )}
            </SortableRow>
          ))}
          <button type="button" onClick={() => input.current?.click()} disabled={!!busy} className="aspect-square border border-dashed border-border flex flex-col items-center justify-center gap-1 text-xs text-muted-foreground hover:bg-muted">
            <ImagePlus size={18} /> Add images
          </button>
        </div>
      </Sortable>
      <input ref={input} type="file" accept="image/*" multiple hidden onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
      {busy && <p className="text-xs text-muted-foreground mt-2">{busy}</p>}
      {err && <p className="text-xs text-destructive mt-2">{err}</p>}
      {edit !== null && list[edit] && (
        <div className="mt-3 border border-border p-3">
          <ImageField path={`${path}.${edit}`} k="image" seed={list[edit]} value={list[edit]} ctx={ctx} onChange={(nv) => onChange(list.map((x, j) => (j === edit ? (nv as Img) : x)))} />
        </div>
      )}
    </div>
  );
}
