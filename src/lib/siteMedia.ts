import { supabase } from "@/lib/supabaseClient";

/**
 * Website images (CMS, email builder) live in the public Supabase Storage bucket "site-images".
 * (DMI used a GitHub repository for this; Tplum uses Supabase Storage. Client-gallery photos are
 * separate and live in Tplum's private Cloudflare R2 bucket.)
 *
 * Every upload is optimised in the browser first: resized to sensible widths and converted to WebP,
 * so the photographer can upload straight from the camera and the site stays fast.
 */
export const BUCKET = "site-images";
export const WIDTHS = [480, 960, 1600, 2400];

export type UploadedImage = { url: string; path: string; srcset: string; width: number; height: number; paths: string[] };

const uniqueName = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

async function decode(file: Blob): Promise<ImageBitmap> {
  return await createImageBitmap(file, { imageOrientation: "from-image" } as ImageBitmapOptions);
}

async function encode(bmp: ImageBitmap, width: number, quality = 0.82): Promise<Blob> {
  const height = Math.round((bmp.height / bmp.width) * width);
  const canvas = typeof OffscreenCanvas !== "undefined" ? new OffscreenCanvas(width, height) : Object.assign(document.createElement("canvas"), { width, height });
  const ctx = (canvas as HTMLCanvasElement).getContext("2d") as CanvasRenderingContext2D;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bmp, 0, 0, width, height);
  if ("convertToBlob" in canvas) return await (canvas as OffscreenCanvas).convertToBlob({ type: "image/webp", quality });
  return await new Promise<Blob>((res, rej) => (canvas as HTMLCanvasElement).toBlob((b) => (b ? res(b) : rej(new Error("Could not encode image"))), "image/webp", quality));
}

const publicUrl = (path: string) => supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;

/** Optimise + upload. Returns the largest URL, a srcset and every stored path (so all sizes can be deleted later). */
export async function uploadImage(file: Blob, folder = "site", crop?: { x: number; y: number; width: number; height: number }): Promise<UploadedImage> {
  if (file.type === "image/svg+xml" || file.type === "image/gif") {
    const path = `${folder}/${uniqueName()}.${file.type === "image/gif" ? "gif" : "svg"}`;
    const { error } = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type, cacheControl: "31536000" });
    if (error) throw new Error(error.message);
    return { url: publicUrl(path), path, srcset: "", width: 0, height: 0, paths: [path] };
  }
  let bmp = await decode(file);
  if (crop) {
    const c = new OffscreenCanvas(Math.round(crop.width), Math.round(crop.height));
    c.getContext("2d")!.drawImage(bmp, crop.x, crop.y, crop.width, crop.height, 0, 0, crop.width, crop.height);
    bmp = await createImageBitmap(c);
  }
  const base = `${folder}/${uniqueName()}`;
  const widths = [...new Set(WIDTHS.filter((w) => w < bmp.width).concat([Math.min(bmp.width, 2400)]))].sort((a, b) => a - b);
  const paths: string[] = [];
  for (const w of widths) {
    const blob = await encode(bmp, w);
    const path = `${base}-${w}.webp`;
    const { error } = await supabase.storage.from(BUCKET).upload(path, blob, { contentType: "image/webp", cacheControl: "31536000", upsert: false });
    if (error) throw new Error(error.message);
    paths.push(path);
  }
  const largest = paths[paths.length - 1];
  return {
    url: publicUrl(largest),
    path: largest,
    srcset: paths.map((p, i) => `${publicUrl(p)} ${widths[i]}w`).join(", "),
    width: Math.min(bmp.width, 2400),
    height: Math.round((bmp.height / bmp.width) * Math.min(bmp.width, 2400)),
    paths,
  };
}

/** Deletes files from the site-images bucket (all sizes of an image when given its largest path). */
export async function deleteImagePaths(paths: string[]) {
  const all = new Set<string>();
  for (const p of paths.filter(Boolean)) {
    all.add(p);
    const m = /^(.*)-\d+\.webp$/.exec(p);
    if (m) for (const w of WIDTHS) all.add(`${m[1]}-${w}.webp`);
  }
  if (all.size) await supabase.storage.from(BUCKET).remove([...all]);
}
