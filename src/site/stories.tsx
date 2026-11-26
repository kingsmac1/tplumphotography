import { ArrowUpRight } from "lucide-react";
import { albumSlug, type Album, type HomeContent, type StoriesContent } from "@/cms/types";
import { Button, Img, Reveal, Rich } from "./ui";
import { Masonry } from "./widgets";
import { BookBand, PageHero } from "./pages/Portfolio";
import { MBookCard, MPageHero, Pill } from "./m/MLayout";

/**
 * Wedding Stories: one album per couple (as on the Uforo and JZE sites). The home page shows the couples as cards with
 * their photo and names; /wedding-stories/ lists them all; each card opens /wedding-stories/<couple>/ with every photo
 * of their day (the lightbox from the portfolio). Albums are edited in Dashboard → Website → Wedding Stories.
 */
export const storyHref = (a: Album) => `/wedding-stories/${albumSlug(a.name)}/`;
export const findAlbum = (s: StoriesContent, slug: string) => s.albums.find((a) => albumSlug(a.name) === slug);
const coverOf = (a: Album) => (a.cover?.src ? a.cover : a.photos[0]);
const countOf = (a: Album) => `${a.photos.length} photo${a.photos.length === 1 ? "" : "s"}`;

/* ------------------------------ classic design ------------------------------ */

function ClassicCard({ a }: { a: Album }) {
  return (
    <a href={storyHref(a)} className="story-card">
      <span className="photo"><Img image={coverOf(a)} sizes="(max-width: 767px) 92vw, (max-width: 1024px) 46vw, 280px" alt={a.name} /></span>
      <span className="name">{a.name}</span>
      {a.subtitle && <span className="sub">{a.subtitle}</span>}
    </a>
  );
}

export function ClassicStoriesSection({ c, stories }: { c: HomeContent["stories"]; stories: StoriesContent }) {
  const list = stories.albums.filter((a) => a.name && coverOf(a)?.src).slice(0, 4);
  if (!list.length) return null;
  return (
    <section className="stories">
      <div className="box">
        <div className="stories-head">
          <Reveal as="h2" className="h-fulgate">{c.heading}</Reveal>
          {c.text && <Reveal><Rich html={c.text} className="body-lato" /></Reveal>}
        </div>
        <div className="stories-grid">{list.map((a) => <ClassicCard key={a.name} a={a} />)}</div>
        {c.button?.label && <Reveal className="more"><Button href={c.button.href} label={c.button.label} /></Reveal>}
      </div>
    </section>
  );
}

export function ClassicStoriesPage({ c }: { c: StoriesContent }) {
  return (
    <>
      <PageHero heading={c.hero.heading} image={c.hero.image} className="hero-stories" />
      <section className="stories-main">
        <div className="box">
          <div className="sec-head">
            <Reveal as="h2">{c.intro.heading}</Reveal>
            <div className="divider" aria-hidden="true"><span /></div>
            <Reveal><Rich html={c.intro.body} className="lead" /></Reveal>
          </div>
          <div className="stories-grid stories-grid--page">{c.albums.filter((a) => a.name).map((a) => <ClassicCard key={a.name} a={a} />)}</div>
        </div>
      </section>
      <BookBand book={c.book} />
    </>
  );
}

export function ClassicStoryPage({ a, c }: { a: Album; c: StoriesContent }) {
  return (
    <>
      <PageHero heading={a.name} image={coverOf(a)} className="hero-story" />
      <section className="story-main">
        <div className="box">
          <div className="story-meta">
            <a href="/wedding-stories/" className="back">← All wedding stories</a>
            <span>{[a.subtitle, countOf(a)].filter(Boolean).join(" · ")}</span>
          </div>
        </div>
        <div className="story-gallery"><Masonry images={a.photos} label={a.name} /></div>
      </section>
      <BookBand book={c.book} />
    </>
  );
}

/* ------------------------------ modern design ------------------------------ */

function ModernCard({ a, i }: { a: Album; i: number }) {
  return (
    <a href={storyHref(a)} className="mstory" style={{ ["--i" as string]: i }}>
      <span className="mstory__img m2-frame"><Img image={coverOf(a)} sizes="(max-width: 767px) 92vw, (max-width: 1100px) 46vw, 320px" alt={a.name} /></span>
      <span className="mstory__shade" aria-hidden="true" />
      <span className="mchip mchip--glass mstory__count">{countOf(a)}</span>
      <span className="mstory__body">
        {a.subtitle && <span className="mstory__sub">{a.subtitle}</span>}
        <span className="mstory__name">{a.name}</span>
        <span className="mstory__go" aria-hidden="true"><ArrowUpRight size={16} strokeWidth={2} /></span>
      </span>
    </a>
  );
}

export function MStoriesSection({ c, stories }: { c: HomeContent["stories"]; stories: StoriesContent }) {
  const list = stories.albums.filter((a) => a.name && coverOf(a)?.src).slice(0, 4);
  if (!list.length) return null;
  return (
    <section className="mwrap mstories">
      <div className="mhead">
        <Reveal as="h2" className="mh2">{c.heading}</Reveal>
        <div className="mhead__aside">
          {c.text && <Rich html={c.text} className="mbody" />}
          {c.button?.label && <Pill href={c.button.href} label={c.button.label} dark />}
        </div>
      </div>
      <div className="mstories__grid">{list.map((a, i) => <ModernCard key={a.name} a={a} i={i} />)}</div>
    </section>
  );
}

export function MStoriesPage({ c }: { c: StoriesContent }) {
  return (
    <>
      <MPageHero heading={c.hero.heading} image={c.hero.image} />
      <section className="mwrap mstories mstories--page">
        <div className="mhead">
          <Reveal as="h2" className="mh2">{c.intro.heading}</Reveal>
          <div className="mhead__aside"><Rich html={c.intro.body} className="mbody" /></div>
        </div>
        <div className="mstories__grid">{c.albums.filter((a) => a.name).map((a, i) => <ModernCard key={a.name} a={a} i={i} />)}</div>
      </section>
      <MBookCard book={c.book} />
    </>
  );
}

export function MStoryPage({ a, c }: { a: Album; c: StoriesContent }) {
  return (
    <>
      <MPageHero heading={a.name} image={coverOf(a)} crumb={`Wedding Stories / ${a.name}`} />
      <section className="mwrap mstory-page">
        <div className="mstory-page__bar">
          <a href="/wedding-stories/" className="mpill mpill--outline"><span>All wedding stories</span><i aria-hidden="true"><ArrowUpRight size={16} strokeWidth={2} /></i></a>
          <span className="mbody">{[a.subtitle, countOf(a)].filter(Boolean).join(" · ")}</span>
        </div>
        <div className="mgallery"><Masonry images={a.photos} label={a.name} /></div>
      </section>
      <MBookCard book={c.book} />
    </>
  );
}
