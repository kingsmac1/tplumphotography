import type { BookContent } from "@/cms/types";
import { Button, Img, Reveal, Rich } from "../ui";
import { PageHero } from "./Portfolio";

/** /book/: the booking hub. One card per kind of shoot, each opening its booking flow. All content comes from the CMS. */
export default function Book({ c }: { c: BookContent }) {
  return (
    <>
      <PageHero heading={c.hero.heading} image={c.hero.image} className="hero-book" />
      <section className="book-main">
        <div className="box">
          <div className="sec-head">
            <Reveal as="h2">{c.intro.heading}</Reveal>
            <div className="divider" aria-hidden="true"><span /></div>
            <Reveal><Rich html={c.intro.body} className="lead" /></Reveal>
          </div>
          <ul className="book-options">
            {c.options.map((o, i) => (
              <li key={o.title + i}>
                <Reveal className="book-card" delay={i * 80}>
                  <a href={o.button.href} className="photo" tabIndex={-1} aria-hidden="true">
                    <Img image={o.image} sizes="(max-width: 767px) 100vw, (max-width: 1024px) 50vw, 270px" />
                  </a>
                  <div className="text">
                    <h3>{o.title}</h3>
                    <p>{o.text}</p>
                    <Button href={o.button.href} label={o.button.label} />
                  </div>
                </Reveal>
              </li>
            ))}
          </ul>
        </div>
      </section>
      <section className="book-help">
        <Reveal className="box">
          <h2 className="h-fulgate">{c.help.heading}</h2>
          <p>{c.help.text}</p>
          <Button href={c.help.button.href} label={c.help.button.label} light />
        </Reveal>
      </section>
    </>
  );
}
