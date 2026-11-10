import { useRef, useState } from "react";
import type { FaqContent, SiteContent } from "@/cms/types";
import { Reveal, Rich } from "../ui";
import { IconAngleRight } from "../icons";
import { ContactDetails } from "./Contact";
import { PageHero } from "./Portfolio";

function Item({ q, a, id }: { q: string; a: string; id: string }) {
  const [open, setOpen] = useState(false);
  const inner = useRef<HTMLDivElement>(null);
  return (
    <div className={`faq-item${open ? " open" : ""}`}>
      <h4>
        <button type="button" aria-expanded={open} aria-controls={id} onClick={() => setOpen((o) => !o)}>
          <span>{q}</span>
          <IconAngleRight />
        </button>
      </h4>
      <div id={id} className="answer" role="region" style={{ height: open ? inner.current?.scrollHeight ?? "auto" : 0 }} hidden={!open && typeof window === "undefined" ? false : undefined}>
        <div ref={inner}><Rich html={a} /></div>
      </div>
    </div>
  );
}

export default function Faq({ c, site }: { c: FaqContent; site: SiteContent }) {
  return (
    <>
      <PageHero heading={c.hero.heading} image={c.hero.image} className="hero-faq" />
      <section className="faq-main">
        <div className="box">
          <div className="sec-head">
            <Reveal as="h2">{c.intro.heading}</Reveal>
            <div className="divider" aria-hidden="true"><span /></div>
          </div>
          <div className="faq-list">
            {c.items.map((it, i) => <Item key={i} q={it.question} a={it.answer} id={`faq-${i}`} />)}
          </div>
        </div>
      </section>
      <section className="contact-info faq-foot">
        <div className="box">
          <Reveal className="note"><Rich html={c.contactLine} /></Reveal>
          <ContactDetails site={site} />
        </div>
      </section>
    </>
  );
}
