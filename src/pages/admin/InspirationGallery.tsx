import { useEffect, useState } from "react";
import { callFn } from "@/features/gallery/api";

/** The inspiration images the client uploaded with the booking form (private files: the links are signed and short-lived). */
export default function InspirationGallery({ bookingId }: { bookingId: string }) {
  const [images, setImages] = useState<{ key: string; url: string }[]>([]);
  useEffect(() => {
    let live = true;
    callFn<{ images: { key: string; url: string }[] }>("gallery-inspiration", { action: "view", booking_id: bookingId }).then((r) => {
      if (live && r.ok) setImages(Array.isArray(r.images) ? r.images : []);
    });
    return () => { live = false; };
  }, [bookingId]);
  if (!images.length) return null;
  return (
    <div className="border-b border-border pb-3">
      <div className="text-xs font-body font-bold tracking-widest text-muted-foreground mb-2">INSPIRATION IMAGES</div>
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
        {images.map((i, n) => (
          <a key={i.key} href={i.url} target="_blank" rel="noreferrer" aria-label={`Open inspiration image ${n + 1}`}>
            <img src={i.url} alt="" loading="lazy" className="block w-full aspect-square object-cover" />
          </a>
        ))}
      </div>
    </div>
  );
}
