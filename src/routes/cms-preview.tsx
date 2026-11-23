import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { mergeContent, SEED, type PageKey, type SiteContent } from "@/cms/types";
import { BUILT_VIDEOS, type FeedPost } from "@/cms/content";
import { PREVIEW_KEY, readPreview, type PreviewPayload } from "@/features/cms/previewChannel";
import { PageInBothDesigns } from "@/site/PageRoute";
import { PAGE_REGISTRY } from "@/site/pageRegistry";

/**
 * CMS live preview: renders the real page components with the editor's unpublished content.
 * Browser-only (the draft lives in this browser), never indexed, and not linked from the site.
 */
function Preview() {
  const [p, setP] = useState<PreviewPayload | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    setP(readPreview());
    setReady(true);
    const on = (e: StorageEvent) => { if (e.key === PREVIEW_KEY) setP(readPreview()); };
    window.addEventListener("storage", on);
    return () => window.removeEventListener("storage", on);
  }, []);
  if (!ready) return null;
  const key: PageKey = p?.page && p.page in PAGE_REGISTRY ? p.page : "home";
  const site = mergeContent(SEED.site, p?.site) as SiteContent;
  const content = mergeContent(SEED[key], p?.content);
  return (
    <>
      <div style={{ position: "fixed", zIndex: 99999, left: 8, top: 8, background: "#000", color: "#fff", font: "600 11px/1 Lato, sans-serif", letterSpacing: ".08em", padding: "7px 10px", pointerEvents: "none", opacity: 0.85 }}>
        PREVIEW · NOT PUBLISHED
      </div>
      {/* the preview shows the design this browser is set to (the corner switch changes it) */}
      <PageInBothDesigns pageKey={key} page={content} site={site} posts={site.instagramSection.posts as FeedPost[]} videos={BUILT_VIDEOS} />
    </>
  );
}

export const Route = createFileRoute("/cms-preview")({
  component: Preview,
  head: () => ({ meta: [{ title: "Preview · Tplum Photography" }, { name: "robots", content: "noindex, nofollow" }] }),
});
