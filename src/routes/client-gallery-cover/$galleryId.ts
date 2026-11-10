import { createFileRoute } from "@tanstack/react-router";
import { galleryShareInfo } from "@/features/gallery/share";

// The gallery's cover as the share image. R2 links expire, so apps get this steady address and it signs a fresh one.
export const Route = createFileRoute("/client-gallery-cover/$galleryId")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const url = new URL(request.url);
        const info = await galleryShareInfo(params.galleryId, url.searchParams.get("k"));
        const image = info?.cover ? await fetch(info.cover).catch(() => null) : null;
        if (!image?.ok) return Response.redirect(`${url.origin}/brand/share-default.png`, 302);
        return new Response(image.body, {
          headers: { "Content-Type": image.headers.get("content-type") ?? "image/jpeg", "Cache-Control": "public, max-age=3600", "X-Robots-Tag": "noindex, nofollow" },
        });
      },
    },
  },
});
