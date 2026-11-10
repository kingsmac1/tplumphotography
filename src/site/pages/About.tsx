import type { AboutContent } from "@/cms/types";
import { Button, Img, Reveal, Rich } from "../ui";
import { PageHero } from "./Portfolio";

export default function About({ c }: { c: AboutContent }) {
  return (
    <>
      <PageHero heading={c.hero.heading} image={c.hero.image} className="hero-about" />
      <section className="profile-wrap">
        <div className="profile">
          <div className="photo"><Img image={c.profile.image} sizes="(max-width: 767px) 80vw, 421px" /></div>
          <div className="text">
            <Reveal as="h2" className="h-fulgate">{c.profile.heading}</Reveal>
            <Reveal><Rich html={c.profile.body} className="body" /></Reveal>
            <Reveal className="cta"><Button href={c.profile.button.href} label={c.profile.button.label} /></Reveal>
          </div>
        </div>
      </section>
    </>
  );
}
