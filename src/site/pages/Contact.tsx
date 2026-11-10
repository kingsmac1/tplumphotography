import type { ContactContent, SiteContent } from "@/cms/types";
import { Reveal, Rich } from "../ui";
import { IconMailBulk, IconPhoneAlt } from "../icons";
import ContactForm from "../ContactForm";
import { PageHero } from "./Portfolio";

export function ContactDetails({ site }: { site: SiteContent }) {
  return (
    <div className="items">
      <a className="icon-box" href={`mailto:${site.contact.email}`}><IconMailBulk /><span className="email">{site.contact.email}</span></a>
      <a className="icon-box" href={`tel:${site.contact.phone.replace(/[^+\d]/g, "")}`}><IconPhoneAlt /><span>{site.contact.phone}</span></a>
    </div>
  );
}

export default function Contact({ c, site }: { c: ContactContent; site: SiteContent }) {
  return (
    <>
      <PageHero heading={c.hero.heading} image={c.hero.image} className="hero-contact" />
      <section className="contact-main">
        <div className="box">
          <div className="sec-head">
            <Reveal as="h2">{c.intro.heading}</Reveal>
            <div className="divider" aria-hidden="true"><span /></div>
            <Reveal><Rich html={c.intro.body} className="bullets" /></Reveal>
            <div className="divider" aria-hidden="true"><span /></div>
          </div>
          <ContactForm form={c.form} />
        </div>
      </section>
      <section className="contact-info"><div className="box"><ContactDetails site={site} /></div></section>
    </>
  );
}
