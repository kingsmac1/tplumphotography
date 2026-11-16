import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense, useEffect, useState } from "react";
import { Preloader } from "@/features/gallery/client/Preloader";

// The client's private gallery: /client-gallery/?id=<gallery id>&k=<private key> (same as PairMediaPro). One pre-rendered
// page serves every gallery; the id and key are read in the browser. The Pages Function in functions/client-gallery swaps
// the share title and image below for the gallery's own, and redirects older /client-gallery/<id>/ links. Never indexed.
const GalleryPage = lazy(() => import("@/features/gallery/client/GalleryPage"));

function ClientGallery() {
  const [id, setId] = useState<string | null>(null);
  useEffect(() => setId(new URLSearchParams(window.location.search).get("id") ?? ""), []);
  if (id === null) return <Preloader />;
  return (
    <Suspense fallback={<Preloader />}>
      <GalleryPage id={id} />
    </Suspense>
  );
}

const TITLE = "Your gallery · Tplum Photography";
const DESCRIPTION = "Your photos from Tplum Photography. Open the link to view them.";

export const Route = createFileRoute("/client-gallery/")({
  component: ClientGallery,
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "robots", content: "noindex, nofollow" },
      { name: "referrer", content: "same-origin" },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:image", content: "/brand/share-default.png" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: TITLE },
      { name: "twitter:image", content: "/brand/share-default.png" },
    ],
  }),
});
