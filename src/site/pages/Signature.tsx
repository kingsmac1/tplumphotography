import type { SignatureContent } from "@/cms/types";
import { Reveal, Rich, bgUrl } from "../ui";
import { BookBand, PageHero } from "./Portfolio";

export default function Signature({ c }: { c: SignatureContent }) {
  return (
    <>
      <PageHero heading={c.hero.heading} image={c.hero.image} className="hero-signature" />
      <section className="sig-intro"><Reveal className="inner"><Rich html={c.intro.body} /></Reveal></section>
      <section className="sig-banner" style={{ backgroundImage: bgUrl(c.banner.image) }} aria-hidden="true" />
      <section className="process">
        <div className="box">
          <Reveal as="h2" className="h-fulgate">{c.process.heading}</Reveal>
          <div className="grid">
            {c.process.steps.map((s, i) => (
              <Reveal key={i} fade>
                <h3>{s.title}</h3>
                <p>{s.body}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>
      <div className="sig-book"><BookBand book={c.book} /></div>
    </>
  );
}
