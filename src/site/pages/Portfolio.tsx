import type { PortfolioContent } from "@/cms/types";
import { Reveal, bgUrl } from "../ui";
import { Masonry } from "../widgets";

export function PageHero({ heading, image, className }: { heading: string; image: Parameters<typeof bgUrl>[0]; className: string }) {
  return (
    <section className={`page-hero ${className}`} style={{ backgroundImage: bgUrl(image) }}>
      <Reveal as="h1" delay={150}>{heading}</Reveal>
    </section>
  );
}

export function BookBand({ book }: { book: PortfolioContent["book"] }) {
  return (
    <a className="book-band" href={book.href} target="_blank" rel="noopener" style={{ backgroundImage: bgUrl(book.image) }}>
      <Reveal as="h2" delay={150}>{book.heading}</Reveal>
      <Reveal as="p">{book.text}</Reveal>
    </a>
  );
}

export default function Portfolio({ c }: { c: PortfolioContent }) {
  return (
    <>
      <PageHero heading={c.hero.heading} image={c.hero.image} className="hero-portfolio" />
      <section className="portfolio-gallery"><Masonry images={c.gallery.images} label={c.hero.heading} /></section>
      <BookBand book={c.book} />
    </>
  );
}
