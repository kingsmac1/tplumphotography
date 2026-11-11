import type { HomeContent } from "@/cms/types";
import { Button, Img, Reveal, Rich, bgUrl } from "../ui";
import { HeroSlider, Masonry, ParallaxBg, Reviews } from "../widgets";

/** "Telling Pure Lasting / Unscripted Memories": the first letter of every word is black (as on the original). */
function InitialsTitle({ text }: { text: string }) {
  return (
    <>
      {text.split("\n").map((line, li) => (
        <span key={li}>
          {li > 0 && <br />}
          {line.split(/(\s+)/).map((w, wi) => (/^\s+$/.test(w) || !w ? w : <span key={wi}><b>{w[0]}</b>{w.slice(1)}</span>))}
        </span>
      ))}
    </>
  );
}

export default function Home({ c }: { c: HomeContent }) {
  return (
    <>
      <h1 className="sr-only">Tplum Photography</h1>
      <HeroSlider slides={c.hero.slidesDesktop} className="desktop" hiddenMedia="(max-width: 767px)" />
      <HeroSlider slides={c.hero.slidesMobile} className="mobile" hiddenMedia="(min-width: 768px)" />

      <section className="intro">
        <div className="box">
          <div className="left">
            <Reveal as="h4" className="eyebrow">{c.intro.eyebrow}</Reveal>
            <p className="title"><InitialsTitle text={c.intro.title} /></p>
          </div>
          <div className="right">
            <Reveal><Rich html={c.intro.body} className="body-lato" /></Reveal>
          </div>
        </div>
      </section>

      <section className="about-card-wrap">
        <div className="about-card">
          <div className="photo"><Img image={c.about.image} sizes="(max-width: 1024px) 90vw, 480px" /></div>
          <div className="text">
            <Reveal as="h2" className="h-fulgate">{c.about.heading}</Reveal>
            <Reveal><Rich html={c.about.body} className="body-lato" /></Reveal>
            <Reveal className="cta" delay={100}><Button href={c.about.button.href} label={c.about.button.label} light /></Reveal>
          </div>
        </div>
      </section>

      <section className="quote" style={{ backgroundImage: bgUrl(c.quote.image) }}>
        <div className="box">
          <Reveal className="card"><Rich html={c.quote.text} /></Reveal>
        </div>
      </section>
      <section className="quote-m" style={{ backgroundImage: bgUrl(c.quote.imageMobile, 960) }}>
        <Reveal className="card"><Rich html={c.quote.textMobile} /></Reveal>
      </section>

      <section className="candid">
        <div className="box">
          <div className="head"><Reveal as="h2" className="h-fulgate">{c.candid.heading}</Reveal></div>
          <div className="row">
            <Img image={c.candid.images[0]} sizes="(max-width: 767px) 100vw, 560px" />
            <Img image={c.candid.images[1]} sizes="(max-width: 767px) 100vw, 560px" />
          </div>
          <div className="row">
            <Img image={c.candid.images[2]} sizes="(max-width: 767px) 100vw, 560px" />
            <Img image={c.candid.images[3]} sizes="(max-width: 767px) 100vw, 560px" />
          </div>
        </div>
      </section>

      <section className="recent">
        <div className="head"><Reveal as="h2" className="h-fulgate">{c.recentWork.heading}</Reveal></div>
        <div className="gallery"><Masonry images={c.recentWork.images} label={c.recentWork.heading} /></div>
        <Reveal className="more"><Button href={c.recentWork.button.href} label={c.recentWork.button.label} /></Reveal>
      </section>

      <section className="testimonials">
        <div className="box">
          <Reveal as="h2" className="h-fulgate">{c.testimonials.heading}</Reveal>
          <Reviews items={c.testimonials.items} />
        </div>
      </section>

      <section className="cta-band">
        <ParallaxBg className="bg no-mobile" style={{ backgroundImage: bgUrl(c.cta.image) }} />
        <ParallaxBg className="bg only-mobile" style={{ backgroundImage: bgUrl(c.cta.imageMobile, 960) }} />
        <div className="box">
          <div className="inner">
            <Reveal as="h2" className="h-fulgate">{c.cta.heading}</Reveal>
            <Reveal className="btn-row">
              <Button href={c.cta.button.href} label={c.cta.button.label} light />
              {c.cta.bookButton?.label && <Button href={c.cta.bookButton.href} label={c.cta.bookButton.label} light className="solid" />}
            </Reveal>
          </div>
        </div>
      </section>
    </>
  );
}
