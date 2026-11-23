import type { PortfolioContent } from "@/cms/types";
import { BG_PHONE_WIDTH, Reveal, bgUrl, bgVars } from "../ui";
import { Masonry } from "../widgets";

export function PageHero({ heading, image, className }: { heading: string; image: Parameters<typeof bgUrl>[0]; className: string }) {
  return (
    <section className={`page-hero ${className}`} style={{ ["--bg-l" as string]: bgUrl(image), ["--bg-s" as string]: bgUrl(image, BG_PHONE_WIDTH) }}>
      <Reveal as="h1" delay={150}>{heading}</Reveal>
    </section>
  );
}

/** "Click here to book" strip. The photo is cropped around its focus point (set in Dashboard → Website), so faces stay in. */
export function BookBand({ book }: { book: PortfolioContent["book"] & { image: { focal?: { x: number; y: number } } } }) {
  return (
    <a className="book-band bgv" href={book.href} target="_blank" rel="noopener" aria-label={`${book.heading}: ${book.text}`}
      style={{ ...bgVars(book.image), ...(book.image?.focal ? { backgroundPosition: `${book.image.focal.x}% ${book.image.focal.y}%` } : {}) }}>
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
