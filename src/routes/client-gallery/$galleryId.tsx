import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense, useEffect, useState } from "react";
import { Preloader } from "@/features/gallery/client/Preloader";
import { galleryShareInfo } from "@/features/gallery/share";

// The client's private gallery: /client-gallery/<id>/?k=<private key>. Browser-only (it reads the key and the
// sign-in from this device), never indexed.
const GalleryPage = lazy(() => import("@/features/gallery/client/GalleryPage"));

function ClientGallery() {
  const { galleryId } = Route.useParams();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return <Preloader />;
  return (
    <Suspense fallback={<Preloader />}>
      <GalleryPage id={galleryId} />
    </Suspense>
  );
}

export const Route = createFileRoute("/client-gallery/$galleryId")({
  component: ClientGallery,
  // Only the server's HTML matters here: WhatsApp and other apps read their share preview from it.
  loader: async ({ params, location }) => {
    if (typeof window !== "undefined") return null;
    const key = new URLSearchParams(location.searchStr).get("k");
    const info = await galleryShareInfo(params.galleryId, key);
    return info ? { title: info.title, image: info.cover ? `/client-gallery-cover/${params.galleryId}/?k=${encodeURIComponent(key!)}` : null } : null;
  },
  head: ({ loaderData }) => {
    const title = loaderData?.title ?? "Your gallery · Tplum Photography";
    const description = "Your photos from Tplum Photography. Open the link to view them.";
    const image = loaderData?.image ?? "/brand/share-default.png";
    return {
      meta: [
        { title: "Your gallery · Tplum Photography" },
        { name: "robots", content: "noindex, nofollow" },
        { name: "referrer", content: "same-origin" },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:image", content: image },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: title },
        { name: "twitter:image", content: image },
      ],
    };
  },
});
