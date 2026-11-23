import { useMemo, useState } from "react";
import type { Video } from "@/cms/content";
import type { HomeContent, VideosContent } from "@/cms/types";
import { Button, Reveal, Rich } from "../ui";
import { BookBand, PageHero } from "../pages/Portfolio";
import { Player, PlayMark, VideoThumb, usePlayer } from "./Player";

/** Films marked for the home page (up to five), in the order set in the dashboard. */
export const homeFilms = (videos: Video[]) => videos.filter((v) => v.on_home).slice(0, 5);

function FilmCard({ v, onPlay, feature = false }: { v: Video; onPlay: () => void; feature?: boolean }) {
  return (
    <button type="button" className={`film-card${feature ? " feature" : ""}`} onClick={onPlay} aria-label={`Play ${v.title || "film"}`}>
      <span className="frame">
        <VideoThumb id={v.youtube_id} alt="" />
        <span className="shade" aria-hidden="true" />
        <PlayMark size={feature ? "lg" : "md"} />
      </span>
      <span className="caption">
        <span className="title">{v.title || "Untitled film"}</span>
        {v.category && <span className="cat">{v.category}</span>}
      </span>
    </button>
  );
}

/** Home page: "Video Portfolio" with up to five films (a large one and four beside it). Hidden until a film is added. */
export function ClassicFilmsSection({ c, videos }: { c: HomeContent["films"]; videos: Video[] }) {
  const films = homeFilms(videos);
  const p = usePlayer(films.length);
  if (!films.length) return null;
  return (
    <section className="films">
      <div className="box">
        <div className="films-head">
          <Reveal as="h2" className="h-fulgate">{c.heading}</Reveal>
          {c.text && <Reveal><Rich html={c.text} className="body-lato" /></Reveal>}
        </div>
        <div className={`films-grid n${films.length}`}>
          {films.map((v, i) => <FilmCard key={v.id} v={v} feature={i === 0} onPlay={() => p.open(i)} />)}
        </div>
        {c.button?.label && <Reveal className="more"><Button href={c.button.href} label={c.button.label} /></Reveal>}
      </div>
      <Player videos={films} index={p.index} onClose={p.close} onIndex={p.setIndex} />
    </section>
  );
}

/** Category filter shared by both designs' Video Portfolio pages. */
export function useCategories(videos: Video[]) {
  const cats = useMemo(() => [...new Set(videos.map((v) => v.category).filter(Boolean))], [videos]);
  const [cat, setCat] = useState("");
  const shown = useMemo(() => (cat ? videos.filter((v) => v.category === cat) : videos), [videos, cat]);
  return { cats, cat, setCat, shown };
}

/** /videos/ in the classic design. */
export function ClassicVideosPage({ c, videos }: { c: VideosContent; videos: Video[] }) {
  const { cats, cat, setCat, shown } = useCategories(videos);
  const p = usePlayer(shown.length);
  return (
    <>
      <PageHero heading={c.hero.heading} image={c.hero.image} className="hero-videos" />
      <section className="videos-main">
        <div className="box">
          <div className="sec-head">
            <Reveal as="h2">{c.intro.heading}</Reveal>
            <div className="divider" aria-hidden="true"><span /></div>
            <Reveal><Rich html={c.intro.body} className="lead" /></Reveal>
          </div>
          {videos.length === 0 ? (
            <Reveal className="videos-empty"><Rich html={c.emptyText} /></Reveal>
          ) : (
            <>
              {cats.length > 1 && (
                <div className="video-filter" role="group" aria-label="Show films">
                  <button type="button" aria-pressed={cat === ""} onClick={() => setCat("")}>All</button>
                  {cats.map((x) => <button key={x} type="button" aria-pressed={cat === x} onClick={() => setCat(x)}>{x}</button>)}
                </div>
              )}
              <div className="videos-grid">
                {shown.map((v, i) => <FilmCard key={v.id} v={v} onPlay={() => p.open(i)} />)}
              </div>
            </>
          )}
        </div>
      </section>
      <BookBand book={c.book} />
      <Player videos={shown} index={p.index} onClose={p.close} onIndex={p.setIndex} />
    </>
  );
}
