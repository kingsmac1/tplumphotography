import { useRef, useState } from "react";
import { ArrowUpRight, Mail, Phone, Plus } from "lucide-react";
import type { Video } from "@/cms/content";
import { SEED, type AboutContent, type BookContent, type ContactContent, type FaqContent, type HomeContent, type PortfolioContent, type SignatureContent, type SiteContent, type VideosContent } from "@/cms/types";
import { Img, Reveal, Rich, bgUrl, BG_PHONE_WIDTH } from "../ui";
import { HeroSlider, Masonry, Reviews } from "../widgets";
import ContactForm from "../ContactForm";
import { Player, PlayMark, VideoThumb, usePlayer } from "../video/Player";
import { homeFilms, useCategories } from "../video/ClassicFilms";
import { MBookCard, MPageHero, Pill, prettyPhone, sentence, sentenceCase } from "./MLayout";

/* ============================== shared pieces ============================== */

/** "Telling Pure Lasting / Unscripted Memories": the first letters spell T·P·L·U·M, so they stay bright. */
function Acrostic({ text }: { text: string }) {
  return (
    <>
      {text.split("\n").map((line, li) => (
        <span key={li} className="acro-line">
          {line.split(/(\s+)/).map((w, wi) => (/^\s+$/.test(w) || !w ? w : <span key={wi}><b>{w[0]}</b>{w.slice(1)}</span>))}
        </span>
      ))}
    </>
  );
}

function SectionHead({ title, children, light = false }: { title: string; children?: React.ReactNode; light?: boolean }) {
  return (
    <div className={`mhead${light ? " mhead--light" : ""}`}>
      <Reveal as="h2" className="mh2">{title}</Reveal>
      {children && <div className="mhead__aside">{children}</div>}
    </div>
  );
}

function FilmTile({ v, onPlay, feature = false }: { v: Video; onPlay: () => void; feature?: boolean }) {
  return (
    <button type="button" className={`mfilm${feature ? " mfilm--feature" : ""}`} onClick={onPlay} aria-label={`Play ${v.title || "film"}`}>
      <VideoThumb id={v.youtube_id} alt="" />
      <span className="mfilm__shade" aria-hidden="true" />
      <span className="mfilm__play"><PlayMark size={feature ? "lg" : "sm"} /></span>
      <span className="mfilm__cap">
        {v.category && <span className="mchip mchip--glass">{v.category}</span>}
        <span className="mfilm__title">{v.title || "Untitled film"}</span>
      </span>
    </button>
  );
}

/* ================================== Home ================================== */

function MFilms({ c, videos }: { c: HomeContent["films"]; videos: Video[] }) {
  const films = homeFilms(videos);
  const p = usePlayer(films.length);
  if (!films.length) return null;
  return (
    <section className="mwrap mfilms">
      <div className="mfilms__card">
        <SectionHead title={c.heading} light>
          {c.text && <Rich html={c.text} className="mfilms__text" />}
          {c.button?.label && <Pill href={c.button.href} label={c.button.label} light />}
        </SectionHead>
        <div className={`mfilms__grid n${films.length}`}>
          {films.map((v, i) => <FilmTile key={v.id} v={v} feature={i === 0} onPlay={() => p.open(i)} />)}
        </div>
      </div>
      <Player videos={films} index={p.index} onClose={p.close} onIndex={p.setIndex} />
    </section>
  );
}

export function MHome({ c, videos }: { c: HomeContent; videos: Video[] }) {
  const options = SEED.book.options;
  const [lead, ...rest] = c.candid.images;
  return (
    <>
      <section className="mhero">
        <div className="mhero__card">
          <HeroSlider slides={c.hero.slidesDesktop} className="desktop" hiddenMedia="(max-width: 767px)" />
          <HeroSlider slides={c.hero.slidesMobile} className="mobile" hiddenMedia="(min-width: 768px)" />
          <div className="mhero__shade" aria-hidden="true" />
          <div className="mhero__content">
            <p className="mchip mchip--glass mhero__eyebrow">{c.intro.eyebrow}</p>
            <h1 className="mhero__title"><Acrostic text={c.intro.title} /></h1>
          </div>
          <nav className="mhero__quick" aria-label="Book a session">
            <ul>{options.map((o) => <li key={o.button.href}><a href={o.button.href}>{o.title}</a></li>)}</ul>
            <a href="/book/" className="mhero__book">Book now<i aria-hidden="true"><ArrowUpRight size={16} strokeWidth={2} /></i></a>
          </nav>
        </div>
      </section>

      <section className="mwrap mintro">
        <div className="mintro__mark" aria-hidden="true"><img src="/brand/tplum-logo-dark.png" alt="" width={96} height={54} loading="lazy" /></div>
        <Reveal><Rich html={c.intro.body} className="mintro__body" /></Reveal>
      </section>

      <section className="mwrap mabout">
        <div className="mabout__photo m2-frame"><Img image={c.about.image} sizes="(max-width: 1024px) 92vw, 520px" /></div>
        <div className="mabout__card">
          <Reveal as="h2" className="mh2">{c.about.heading}</Reveal>
          <Reveal><Rich html={c.about.body} className="mbody" /></Reveal>
          <Reveal className="mbtns"><Pill href={c.about.button.href} label={c.about.button.label} light /></Reveal>
        </div>
      </section>

      <section className="mwrap mquote">
        <div className="mquote__card" style={{ ["--bg-l" as string]: bgUrl(c.quote.image), ["--bg-s" as string]: bgUrl(c.quote.imageMobile, BG_PHONE_WIDTH) }}>
          <Reveal className="mquote__text"><span className="mquote__mark" aria-hidden="true">“</span><Rich html={c.quote.text} /></Reveal>
        </div>
      </section>

      <section className="mwrap mcandid">
        <div className="mcandid__head"><Reveal as="h2" className="mh2 mcandid__h">{c.candid.heading}</Reveal></div>
        <div className="mcandid__lead m2-frame"><Img image={lead} sizes="(max-width: 767px) 92vw, 560px" /></div>
        {rest.map((img, i) => <div key={i} className={`mcandid__img mcandid__img--${i + 1} m2-frame`}><Img image={img} sizes="(max-width: 767px) 46vw, 300px" /></div>)}
      </section>

      <section className="mwrap mrecent">
        <SectionHead title={c.recentWork.heading}><Pill href={c.recentWork.button.href} label={c.recentWork.button.label} dark /></SectionHead>
        <div className="mgallery"><Masonry images={c.recentWork.images} label={c.recentWork.heading} /></div>
      </section>

      <MFilms c={c.films} videos={videos} />

      <section className="mwrap mreviews">
        <div className="mreviews__card">
          <SectionHead title={c.testimonials.heading} />
          <Reviews items={c.testimonials.items} />
        </div>
      </section>

      <section className="mwrap mcta">
        <div className="mcta__card">
          <div className="mcta__text">
            <Reveal as="h2" className="mh2">{c.cta.heading}</Reveal>
            <Reveal className="mbtns">
              <Pill href={c.cta.button.href} label={c.cta.button.label} light />
              {c.cta.bookButton?.label && <Pill href={c.cta.bookButton.href} label={c.cta.bookButton.label} className="mpill--ghost" />}
            </Reveal>
          </div>
          <div className="mcta__img m2-frame"><Img image={c.cta.image} sizes="(max-width: 767px) 100vw, 560px" /></div>
        </div>
      </section>
    </>
  );
}

/* =============================== Inner pages =============================== */

export function MPortfolio({ c }: { c: PortfolioContent }) {
  return (
    <>
      <MPageHero heading={c.hero.heading} image={c.hero.image} />
      <section className="mwrap mgallery mgallery--page"><Masonry images={c.gallery.images} label={c.hero.heading} /></section>
      <MBookCard book={c.book} />
    </>
  );
}

export function MAbout({ c }: { c: AboutContent }) {
  return (
    <>
      <MPageHero heading={c.hero.heading} image={c.hero.image} />
      <section className="mwrap mabout mabout--page">
        <div className="mabout__photo m2-frame"><Img image={c.profile.image} sizes="(max-width: 1024px) 92vw, 520px" /></div>
        <div className="mabout__card mabout__card--light">
          <Reveal as="h2" className="mh2">{c.profile.heading}</Reveal>
          <Reveal><Rich html={c.profile.body} className="mbody" /></Reveal>
          <Reveal className="mbtns">
            <Pill href={c.profile.button.href} label={c.profile.button.label} dark />
            {c.profile.bookButton?.label && <Pill href={c.profile.bookButton.href} label={c.profile.bookButton.label} className="mpill--outline" />}
          </Reveal>
        </div>
      </section>
    </>
  );
}

export function MSignature({ c }: { c: SignatureContent }) {
  const steps = c.process.steps.map((s) => {
    const m = /^(\d+)\.\s*(.*)$/.exec(s.title);
    return { n: m ? m[1].padStart(2, "0") : "", title: m ? m[2] : s.title, body: s.body };
  });
  return (
    <>
      <MPageHero heading={c.hero.heading} image={c.hero.image} />
      <section className="mwrap msig-intro"><Reveal><Rich html={c.intro.body} className="mstatement" /></Reveal></section>
      <section className="mwrap"><div className="msig-banner m2-frame" style={{ ["--bg-l" as string]: bgUrl(c.banner.image), ["--bg-s" as string]: bgUrl(c.banner.image, BG_PHONE_WIDTH) }} role="img" aria-label="" /></section>
      <section className="mwrap msteps">
        <SectionHead title={c.process.heading} />
        <ol className="msteps__grid">
          {steps.map((s, i) => (
            <li key={i} className={`mstep${i % 5 === 2 ? " mstep--dark" : ""}`}>
              <span className="mstep__n">{s.n || String(i + 1).padStart(2, "0")}</span>
              <h3 className="mstep__t">{s.title}</h3>
              <p className="mstep__b">{s.body}</p>
            </li>
          ))}
        </ol>
      </section>
      <MBookCard book={c.book} />
    </>
  );
}

function ContactChips({ site }: { site: SiteContent }) {
  return (
    <div className="mchips">
      <a className="mcontact" href={`mailto:${site.contact.email.toLowerCase()}`}><i aria-hidden="true"><Mail size={16} /></i>{site.contact.email.toLowerCase()}</a>
      <a className="mcontact" href={`tel:${site.contact.phone.replace(/[^+\d]/g, "")}`}><i aria-hidden="true"><Phone size={16} /></i>{prettyPhone(site.contact.phone)}</a>
    </div>
  );
}

export function MContact({ c, site }: { c: ContactContent; site: SiteContent }) {
  return (
    <>
      <MPageHero heading={c.hero.heading} image={c.hero.image} />
      <section className="mwrap mcontact-grid">
        <div className="mcard mcard--dark mcontact-side">
          <Reveal as="h2" className="mh2">{c.intro.heading}</Reveal>
          <Reveal><Rich html={c.intro.body} className="mlist" /></Reveal>
          {c.intro.bookButton?.label && <Reveal className="mbtns"><Pill href={c.intro.bookButton.href} label={c.intro.bookButton.label} light /></Reveal>}
          <ContactChips site={site} />
        </div>
        <div className="mcard mform"><ContactForm form={c.form} /></div>
      </section>
    </>
  );
}

function FaqItem({ q, a, id }: { q: string; a: string; id: string }) {
  const [open, setOpen] = useState(false);
  const inner = useRef<HTMLDivElement>(null);
  return (
    <div className={`mfaq${open ? " is-open" : ""}`}>
      <h3>
        <button type="button" aria-expanded={open} aria-controls={id} onClick={() => setOpen((o) => !o)}>
          <span>{sentenceCase(q)}</span>
          <i aria-hidden="true"><Plus size={18} /></i>
        </button>
      </h3>
      <div id={id} className="mfaq__a" role="region" style={{ height: open ? inner.current?.scrollHeight ?? "auto" : 0 }}>
        <div ref={inner}><Rich html={a} /></div>
      </div>
    </div>
  );
}

export function MFaq({ c, site }: { c: FaqContent; site: SiteContent }) {
  return (
    <>
      <MPageHero heading={c.hero.heading} image={c.hero.image} />
      <section className="mwrap mfaq-grid">
        <aside className="mfaq-side">
          <Reveal as="h2" className="mh2">{c.intro.heading}</Reveal>
          <div className="mcard mcard--dark">
            <Rich html={c.contactLine} className="mbody" />
            <ContactChips site={site} />
          </div>
        </aside>
        <div className="mfaq-list">{c.items.map((it, i) => <FaqItem key={i} q={it.question} a={it.answer} id={`mfaq-${i}`} />)}</div>
      </section>
    </>
  );
}

export function MBook({ c }: { c: BookContent }) {
  return (
    <>
      <MPageHero heading={c.hero.heading} image={c.hero.image} />
      <section className="mwrap mbook-intro">
        <SectionHead title={c.intro.heading}><Rich html={c.intro.body} className="mbody" /></SectionHead>
        <ul className="mopts">
          {c.options.map((o, i) => (
            <li key={o.title + i}>
              <a href={o.button.href} className="mopt">
                <span className="mopt__img m2-frame"><Img image={o.image} sizes="(max-width: 767px) 92vw, (max-width: 1100px) 46vw, 300px" /></span>
                <span className="mopt__shade" aria-hidden="true" />
                <span className="mopt__n" aria-hidden="true">{String(i + 1).padStart(2, "0")}</span>
                <span className="mopt__body">
                  <span className="mopt__t">{o.title}</span>
                  <span className="mopt__p">{o.text}</span>
                  <span className="mopt__btn">{sentence(o.button.label)}<i aria-hidden="true"><ArrowUpRight size={15} strokeWidth={2} /></i></span>
                </span>
              </a>
            </li>
          ))}
        </ul>
      </section>
      <section className="mwrap">
        <div className="mhelp">
          <div>
            <Reveal as="h2" className="mh2">{c.help.heading}</Reveal>
            <Reveal as="p" className="mbody">{c.help.text}</Reveal>
          </div>
          <Pill href={c.help.button.href} label={c.help.button.label} light />
        </div>
      </section>
    </>
  );
}

export function MVideos({ c, videos }: { c: VideosContent; videos: Video[] }) {
  const { cats, cat, setCat, shown } = useCategories(videos);
  const p = usePlayer(shown.length);
  return (
    <>
      <MPageHero heading={c.hero.heading} image={c.hero.image} />
      <section className="mwrap mvideos">
        <SectionHead title={c.intro.heading}><Rich html={c.intro.body} className="mbody" /></SectionHead>
        {videos.length === 0 ? (
          <div className="mcard mvideos__empty"><Rich html={c.emptyText} className="mbody" /></div>
        ) : (
          <>
            {cats.length > 1 && (
              <div className="mfilter" role="group" aria-label="Show films">
                <button type="button" aria-pressed={cat === ""} onClick={() => setCat("")}>All <span>{videos.length}</span></button>
                {cats.map((x) => <button key={x} type="button" aria-pressed={cat === x} onClick={() => setCat(x)}>{x} <span>{videos.filter((v) => v.category === x).length}</span></button>)}
              </div>
            )}
            <div className="mvideos__grid">{shown.map((v, i) => <FilmTile key={v.id} v={v} onPlay={() => p.open(i)} />)}</div>
          </>
        )}
      </section>
      <MBookCard book={c.book} />
      <Player videos={shown} index={p.index} onClose={p.close} onIndex={p.setIndex} />
    </>
  );
}
