import { useEffect, useState, type ReactNode } from "react";
import { useLocation } from "@tanstack/react-router";
import { ArrowUpRight, Menu as MenuIcon } from "lucide-react";
import type { CmsImage, SiteContent } from "@/cms/types";
import { Img, Reveal, bgUrl, BG_PHONE_WIDTH } from "../ui";
import { ModernMenu, RingToTop, TabBar, useModernMotion } from "../modern";
import { releasePreloader } from "../preloader";
import { IconFacebook, IconInstagram } from "../icons";
import { DesignSwitch } from "../design";
import type { IgPost } from "../Layout";
import "./m.css";

/**
 * The "modern" design (after the client's reference screenshots): a light grey page, rounded photo cards and bento
 * grids, big Fulgate headlines, pill buttons, a floating header and a dark footer. Same content as the classic design.
 * Everything sits under `.tp.tpm` (it reuses the classic widgets' mechanics and restyles them); styles in m.css.
 */

/** Button labels are stored in capitals for the classic design ("VIEW FULL GALLERY"); this design uses sentence case. */
export const sentence = (s: string) => (s && s === s.toUpperCase() ? s.charAt(0) + s.slice(1).toLowerCase() : s);
/** Whole sentences stored in capitals (the FAQ questions): sentence case, keeping "I" and "I'm" capitalised. */
export const sentenceCase = (s: string) =>
  s && s === s.toUpperCase() && /[A-Z]/.test(s) ? (s.charAt(0) + s.slice(1).toLowerCase()).replace(/\bi\b/g, "I") : s;
const norm = (p: string) => (p.endsWith("/") ? p : p + "/");
/** "+14034935511" → "+1 403 493 5511" (North American numbers; anything else is shown as stored). */
export const prettyPhone = (p: string) => {
  const d = p.replace(/[^\d]/g, "");
  return /^1\d{10}$/.test(d) ? `+1 ${d.slice(1, 4)} ${d.slice(4, 7)} ${d.slice(7)}` : p;
};

export function Pill({ href, label, dark = false, light = false, className = "", newTab = false }: { href: string; label: string; dark?: boolean; light?: boolean; className?: string; newTab?: boolean }) {
  const external = /^https?:/i.test(href) || newTab;
  return (
    <a href={href} className={`mpill${dark ? " mpill--dark" : ""}${light ? " mpill--light" : ""} ${className}`.trim()} {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
      <span>{sentence(label)}</span>
      <i aria-hidden="true"><ArrowUpRight size={16} strokeWidth={2} /></i>
    </a>
  );
}

function MHeader({ site, onMenu, menuOpen, solid }: { site: SiteContent; onMenu: () => void; menuOpen: boolean; solid?: boolean }) {
  const { pathname } = useLocation();
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 40);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  const book = site.header?.bookButton;
  const links = site.menu.items.filter((i) => i.href !== "/" && i.href !== book?.href);
  return (
    <header className={`mh${scrolled || solid ? " is-solid" : ""}`}>
      <div className="mh__bar">
        <a href="/" className="mh__brand" aria-label={`${site.brand.siteName} home`}>
          <img className="mh__logo mh__logo--light" src="/brand/tplum-logo-white.png" alt="" width={110} height={62} />
          <img className="mh__logo mh__logo--dark" src="/brand/tplum-logo-dark.png" alt="" width={110} height={62} />
        </a>
        <nav className="mh__nav" aria-label="Main">
          <ul>{links.map((i) => <li key={i.href}><a href={i.href} aria-current={norm(pathname) === norm(i.href) ? "page" : undefined}>{i.label}</a></li>)}</ul>
        </nav>
        <div className="mh__end">
          {book?.label && <a href={book.href} className="mh__book">{sentence(book.label)}<i aria-hidden="true"><ArrowUpRight size={15} strokeWidth={2} /></i></a>}
          <button type="button" className="mh__menu" onClick={onMenu} aria-haspopup="dialog" aria-expanded={menuOpen} aria-label="Open the menu"><MenuIcon size={18} /></button>
        </div>
      </div>
    </header>
  );
}

export function MChrome({ site, app }: { site: SiteContent; app: boolean }) {
  const { pathname } = useLocation();
  const [menu, setMenu] = useState(false);
  useModernMotion(true, pathname);
  useEffect(() => { releasePreloader(); }, []);
  return (
    <>
      <a href="#content" className="sr-only">Skip to content</a>
      <MHeader site={site} onMenu={() => setMenu(true)} menuOpen={menu} solid={app} />
      <ModernMenu site={site} open={menu} onClose={() => setMenu(false)} />
      <TabBar site={site} onMenu={() => setMenu(true)} />
      <RingToTop />
      <DesignSwitch />
    </>
  );
}

export function MInstagram({ site, posts }: { site: SiteContent; posts: IgPost[] }) {
  const shown = posts.slice(0, 8);
  const handle = site.contact.instagramHandle;
  return (
    <section className="mig" aria-label="Instagram">
      <div className="mwrap">
        <div className="mig__head">
          <Reveal as="p" className="mig__lead">Follow along on Instagram</Reveal>
          <a className="mig__handle" href={site.contact.instagramProfileUrl} target="_blank" rel="noopener noreferrer">{handle}<i aria-hidden="true"><ArrowUpRight size={22} /></i></a>
        </div>
        <div className="mig__grid">
          {shown.map((p, i) => (
            <a key={p.url + i} href={p.url} target="_blank" rel="noopener noreferrer" className="mig__tile m2-frame" aria-label={p.caption ? `Instagram post: ${p.caption.slice(0, 80)}` : "Instagram post"}>
              <Img image={p.image} sizes="(max-width: 767px) 50vw, 300px" alt={(p.caption ?? "").slice(0, 120)} />
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}

export function MFooter({ site }: { site: SiteContent }) {
  const f = site.footer;
  const links = site.menu.items;
  const phone = site.contact.phone;
  return (
    <footer className="mfoot">
      <div className="mfoot__in">
        <div className="mfoot__top">
          <div className="mfoot__brand">
            <img src="/brand/tplum-logo-white.png" alt={site.brand.siteName} width={170} height={95} loading="lazy" />
            <p>...capturing moments beautifully.</p>
          </div>
          <nav className="mfoot__col" aria-label="Footer">
            <p className="mfoot__label">Pages</p>
            <ul>{links.map((l) => <li key={l.href}><a href={l.href}>{l.label}</a></li>)}</ul>
          </nav>
          <div className="mfoot__col">
            <p className="mfoot__label">Get in touch</p>
            <ul>
              <li><a href={`mailto:${site.contact.email.toLowerCase()}`}>{site.contact.email.toLowerCase()}</a></li>
              <li><a href={`tel:${phone.replace(/[^+\d]/g, "")}`}>{prettyPhone(phone)}</a></li>
            </ul>
            <div className="mfoot__social">
              <a href={site.contact.instagramUrl} target="_blank" rel="noopener noreferrer" aria-label="Instagram"><IconInstagram /></a>
              <a href={site.contact.facebookUrl} target="_blank" rel="noopener noreferrer" aria-label="Facebook"><IconFacebook /></a>
            </div>
          </div>
        </div>
        <p className="mfoot__word" aria-hidden="true">Tplum</p>
        <div className="mfoot__bottom">
          <span>{f.copyright}</span>
          <span>{f.creditPrefix} <a href={f.creditUrl} target="_blank" rel="noopener">{f.creditLabel}</a></span>
        </div>
      </div>
    </footer>
  );
}

/** Every public page in the modern design. `app`: booking and client pages (no Instagram strip, solid header). */
export function MLayout({ site, posts, children, app = false }: { site: SiteContent; posts: IgPost[]; children: ReactNode; app?: boolean }) {
  if (app) {
    // booking and client pages keep their own app styling: only the header and footer use the public-site styles
    return (
      <>
        <div className="tp tpm"><MChrome site={site} app /></div>
        <main id="content" className="app mapp">{children}</main>
        <div className="tp tpm"><MFooter site={site} /></div>
      </>
    );
  }
  return (
    <div className="tp tpm">
      <MChrome site={site} app={false} />
      <main id="content">{children}</main>
      <MInstagram site={site} posts={posts} />
      <MFooter site={site} />
    </div>
  );
}

/** Inner page banner: a rounded photo card, the title large at its foot, a small "you are here" pill. */
export function MPageHero({ heading, image, crumb }: { heading: string; image?: Partial<CmsImage> | null; crumb?: string }) {
  return (
    <section className="mhero2">
      <div className="mhero2__card" style={{ ["--bg-l" as string]: bgUrl(image), ["--bg-s" as string]: bgUrl(image, BG_PHONE_WIDTH) }}>
        <div className="mhero2__shade" aria-hidden="true" />
        <div className="mhero2__content">
          <p className="mchip mchip--glass">Tplum Photography <span aria-hidden="true">/</span> {crumb ?? heading.replace(/\n/g, " ")}</p>
          <Reveal as="h1" className="mhero2__title" delay={120}>{heading}</Reveal>
        </div>
      </div>
    </section>
  );
}

/** "Book a session" card: dark rounded block, words on the left, the photo inset on the right. */
export function MBookCard({ book }: { book: { href: string; image?: Partial<CmsImage> | null; heading: string; text: string } }) {
  return (
    <section className="mwrap mbook">
      <a className="mbook__card" href={book.href} target={/^https?:/.test(book.href) ? "_blank" : undefined} rel="noopener">
        <div className="mbook__text">
          <Reveal as="h2" className="mbook__h">{book.heading}</Reveal>
          <Reveal as="p" className="mbook__p">{book.text}</Reveal>
          <span className="mpill mpill--light mbook__btn"><span>Book a session</span><i aria-hidden="true"><ArrowUpRight size={16} strokeWidth={2} /></i></span>
        </div>
        <div className="mbook__img m2-frame"><Img image={book.image} sizes="(max-width: 767px) 100vw, 520px" /></div>
      </a>
    </section>
  );
}
