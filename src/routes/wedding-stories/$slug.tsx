import { createFileRoute } from "@tanstack/react-router";
import { getPageContent, useLiveContent, type FeedPost } from "@/cms/content";
import type { StoriesContent } from "@/cms/types";

const loadStories = async () => {
  const d = await getPageContent({ data: "wedding-stories" });
  return { ...d, page: d.page as StoriesContent };
};
import { pageHead } from "@/site/seo";
import { Designs } from "@/site/design";
import { SiteLayout } from "@/site/Layout";
import { MLayout } from "@/site/m/MLayout";
import { ClassicStoryPage, MStoryPage, findAlbum } from "@/site/stories";
import { NotFoundView } from "@/site/NotFound";

/** /wedding-stories/<couple>/: one couple's photos (both designs). Albums: Dashboard → Website → Wedding Stories. */
export const Route = createFileRoute("/wedding-stories/$slug")({
  loader: loadStories,
  head: ({ loaderData, params }) => {
    if (!loaderData) return {};
    const a = findAlbum(loaderData.page, params.slug);
    if (!a) return { meta: [{ title: "Wedding story not found → Tplum Photography" }, { name: "robots", content: "noindex" }] };
    const base = loaderData.page.seo;
    const cover = a.cover?.src ? a.cover : a.photos[0];
    const title = `${a.name} → Tplum Photography`;
    const description = `${a.name}${a.subtitle ? ` (${a.subtitle.toLowerCase()})` : ""}: ${a.photos.length} photo${a.photos.length === 1 ? "" : "s"} by Tplum Photography, Calgary | Edmonton | Toronto wedding photographer.`;
    const h = pageHead({ ...base, title, ogTitle: title, twitterTitle: title, description, ogDescription: description, twitterDescription: description, shareImage: cover ?? base.shareImage }, `/wedding-stories/${params.slug}/`, { origin: loaderData.origin, indexable: loaderData.indexable });
    return { meta: h.meta, links: h.links };
  },
  component: Story,
});

function Story() {
  const built = Route.useLoaderData();
  const { slug } = Route.useParams();
  const data = useLiveContent("wedding-stories", built);
  const a = findAlbum(data.page, slug);
  const posts = data.posts as FeedPost[];
  if (!a) {
    return <Designs classic={<SiteLayout site={data.site} posts={posts}><NotFoundView /></SiteLayout>} modern={<MLayout site={data.site} posts={posts}><NotFoundView /></MLayout>} />;
  }
  return (
    <Designs
      classic={<SiteLayout site={data.site} posts={posts} igClass="inner"><ClassicStoryPage a={a} c={data.page} /></SiteLayout>}
      modern={<MLayout site={data.site} posts={posts}><MStoryPage a={a} c={data.page} /></MLayout>}
    />
  );
}
