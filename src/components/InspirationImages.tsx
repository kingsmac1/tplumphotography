/**
 * The booking form's inspiration image upload. Files stay on the client's device until the booking is saved; each is then
 * resized to a JPEG here and sent to the gallery-inspiration function, tagged with the booking.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { X } from "lucide-react";

const MAX_FILES = 6;
const MAX_LONG_EDGE = 2000;
const ACCEPT = ["image/jpeg", "image/png", "image/webp"];

export default function InspirationImages({ files, onChange }: { files: File[]; onChange: (f: File[]) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [notice, setNotice] = useState("");
  const previews = useMemo(() => files.map((f) => URL.createObjectURL(f)), [files]);
  useEffect(() => () => previews.forEach((u) => URL.revokeObjectURL(u)), [previews]);

  const add = (list: FileList | null) => {
    if (!list) return;
    const picked = [...list];
    const ok = picked.filter((f) => ACCEPT.includes(f.type));
    onChange([...files, ...ok].slice(0, MAX_FILES));
    if (ok.length < picked.length) setNotice("Only JPG, PNG and WebP images can be added.");
    else if (files.length + ok.length > MAX_FILES) setNotice(`You can add up to ${MAX_FILES} images.`);
    else setNotice("");
  };

  return (
    <div className="mt-4">
      <p className="text-[11px] font-body text-muted-foreground mb-2">Or upload the images directly.</p>
      <input ref={input} id="inspiration-images" type="file" multiple accept={ACCEPT.join(",")} hidden aria-label="Upload inspiration images" onChange={(e) => { add(e.target.files); e.target.value = ""; }} />
      {files.length < MAX_FILES && (
        <button
          type="button"
          onClick={() => input.current?.click()}
          className="w-full border border-dashed border-border bg-background px-5 py-5 text-sm font-body text-center hover:border-foreground focus-visible:border-foreground outline-none transition-colors"
        >
          <span className="block font-bold tracking-widest text-xs">UPLOAD INSPIRATION IMAGES</span>
          <span className="block text-[11px] text-muted-foreground mt-1">Up to {MAX_FILES} images, JPG, PNG or WebP</span>
        </button>
      )}
      {files.length > 0 && (
        <ul className="grid grid-cols-3 sm:grid-cols-6 gap-2 mt-3" data-inspiration-list>
          {files.map((f, i) => (
            <li key={previews[i]} className="relative aspect-square border border-border">
              <img src={previews[i]} alt={f.name} className="block w-full h-full object-cover" />
              <button type="button" aria-label={`Remove ${f.name}`} onClick={() => onChange(files.filter((_, n) => n !== i))} className="absolute top-1 right-1 w-8 h-8 rounded-full bg-black/75 text-white flex items-center justify-center">
                <X size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}
      {notice && <p role="alert" className="text-xs font-body text-destructive mt-2">{notice}</p>}
    </div>
  );
}

async function toJpegBlob(file: File): Promise<Blob> {
  const { decode, resize, toJpeg } = await import("@/features/gallery/imaging/core");
  const bmp = await decode(file);
  try {
    return await toJpeg(resize(bmp, bmp.width, bmp.height, MAX_LONG_EDGE), 0.82);
  } finally {
    bmp.close();
  }
}

/** Uploads the chosen images for a saved booking. Never throws: the booking is already safe. */
export async function uploadInspiration(files: File[], bookingId: string): Promise<{ uploaded: number; failed: number }> {
  if (!files.length) return { uploaded: 0, failed: 0 };
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  if (!url || !anon) return { uploaded: 0, failed: files.length };
  const results = await Promise.all(files.map(async (file) => {
    try {
      const res = await fetch(`${url.replace(/\/$/, "")}/functions/v1/gallery-inspiration?booking_id=${bookingId}`, {
        method: "POST",
        headers: { "Content-Type": "image/jpeg", apikey: anon, Authorization: `Bearer ${anon}` },
        body: await toJpegBlob(file),
        signal: AbortSignal.timeout(60_000),
      });
      const data = (await res.json()) as { ok?: boolean };
      return res.ok && !!data.ok;
    } catch (err) {
      console.error("inspiration upload failed", err);
      return false;
    }
  }));
  const uploaded = results.filter(Boolean).length;
  return { uploaded, failed: files.length - uploaded };
}
