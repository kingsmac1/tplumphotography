import { useEffect, useState, type ReactNode } from "react";
import { useLocation } from "@tanstack/react-router";
import type { CmsImage, SiteContent } from "@/cms/types";
import { Img, Reveal } from "./ui";
import { IconClose, IconFacebook, IconInstagram, IconStream, ScrollTopArrow, socialIcon } from "./icons";

export type IgPost = { image: Partial<CmsImage> & { src: string }; caption?: string; url: string };

function Socials({ site, variant = "default" }: { site: SiteContent; variant?: "default" | "about" }) {
  if (variant === "about") {
    // The About page's original footer shows Facebook, Twitter and YouTube icons with no links (kept as-is; see MIGRATION-NOTES.md).
    return (
      <div className="socials">
        {["facebook", "twitter", "youtube"].map((n) => { const I = socialIcon(n); return <span key={n} aria-hidden="true"><I /></span>; })}
      </div>
    );
  }
  return (
    <div className="socials">
      <a href={site.contact.instagramUrl} target="_blank" rel="noopener noreferrer" aria-label="Instagram"><IconInstagram /></a>
      <a href={site.contact.facebookUrl} target="_blank" rel="noopener noreferrer" aria-label="Facebook"><IconFacebook /></a>
    </div>
  );
}

function Header({ site, onMenu }: { site: SiteContent; onMenu: () => void }) {
  return (
    <header className="site-header">
      <a className="logo" href="/" aria-label={`${site.brand.siteName} home`}>
        <Img image={site.brand.logoLight} sizes="160px" loading="eager" alt={site.brand.siteName} />
      </a>
      <div className="right">
        <Socials site={site} />
        <button type="button" className="menu-toggle" aria-label="Open menu" aria-haspopup="dialog" onClick={onMenu}>
          <IconStream />
        </button>
      </div>
    </header>
  );
}

function MenuOverlay({ site, open, onClose }: { site: SiteContent; open: boolean; onClose: () => void }) {
  const { pathname } = useLocation();
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [open, onClose]);
  const norm = (p: string) => (p.endsWith("/") ? p : p + "/");
  return (
    <div className={`menu-overlay${open ? " open" : ""}`} role="dialog" aria-modal="true" aria-label="Menu" aria-hidden={!open} inert={!open || undefined}>
      <button type="button" className="menu-close" aria-label="Close menu" onClick={onClose}><IconClose /></button>
      <div className="menu-inner">
        <a href="/" className="menu-logo" onClick={onClose}><Img image={site.brand.menuLogo} sizes="240px" alt={site.brand.siteName} /></a>
        <nav aria-label="Main">
          {site.menu.items.map((item) => (
            <a key={item.href + item.label} href={item.href} className={norm(pathname) === norm(item.href) ? "active" : undefined} onClick={onClose}>
              {item.label}
            </a>
          ))}
        </nav>
        <Socials site={site} />
      </div>
    </div>
  );
}

/** Row pattern of the original justified Instagram strip: one row on desktop, rows of 3 / 2 / 3 on phones. */
const MOBILE_PATTERN = [3, 2, 3];
function chunk<T>(items: T[], pattern: number[]): T[][] {
  const rows: T[][] = [];
  let i = 0, p = 0;
  while (i < items.length) { const n = pattern[p++ % pattern.length]; rows.push(items.slice(i, i + n)); i += n; }
  return rows;
}
function Tiles({ posts, rows, gap, className }: { posts: IgPost[]; rows: IgPost[][]; gap: number; className: string }) {
  void posts;
  return (
    <div className={`ig-tiles ${className}`} style={{ ["--gap" as string]: `${gap}px` }}>
      {rows.map((row, r) => (
        <div className="row" key={r}>
          {row.map((p) => {
            const ar = p.image.width && p.image.height ? p.image.width / p.image.height : 0.8;
            return (
              <a key={p.url + r} href={p.url} target="_blank" rel="noopener noreferrer" style={{ flex: `${ar} 1 0`, aspectRatio: String(ar) }} aria-label={p.caption ? `Instagram post: ${p.caption.slice(0, 80)}` : "Instagram post"}>
                <Img image={p.image} sizes="(max-width: 767px) 50vw, 260px" alt={(p.caption ?? "").slice(0, 120)} />
              </a>
            );
          })}
        </div>
      ))}
    </div>
  );
}

export function InstagramBand({ site, posts, variant, className = "" }: { site: SiteContent; posts: IgPost[]; variant?: "default" | "about"; className?: string }) {
  const shown = posts.slice(0, 8);
  const handle = site.contact.instagramHandle;
  const [before, after] = site.instagramSection.followText.split(handle);
  return (
    <section className={`ig-band ${className}`.trim()} aria-label="Instagram">
      <div className="box">
        <div className="top">
          <Reveal className="follow" fade>
            <p>
              {before}
              {after !== undefined && <a href={site.contact.instagramProfileUrl} target="_blank" rel="noopener noreferrer">{handle}</a>}
              {after}
            </p>
          </Reveal>
          <Socials site={site} variant={variant} />
        </div>
      </div>
      <Tiles posts={shown} rows={[shown]} gap={8} className="no-mobile" />
      <Tiles posts={shown} rows={chunk(shown, MOBILE_PATTERN)} gap={9} className="only-mobile" />
    </section>
  );
}

function Footer({ site }: { site: SiteContent }) {
  const f = site.footer;
  return (
    <footer className="site-footer">
      <div className="inner">
        <p>
          {f.copyright} | {f.creditPrefix}{" "}
          <em><a href={f.creditUrl} target="_blank" rel="noopener">{f.creditLabel}</a></em>
        </p>
      </div>
    </footer>
  );
}

function ToTop() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const on = () => setShow(window.scrollY > 300);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  return (
    <button type="button" className={`to-top${show ? " show" : ""}`} aria-label="Scroll to top" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
      <ScrollTopArrow />
    </button>
  );
}

/** Every public page: header + pop-out menu, page content, Instagram band, footer, back to top. */
export function SiteLayout({ site, posts, children, igVariant, igClass, app = false }: { site: SiteContent; posts: IgPost[]; children: ReactNode; igVariant?: "default" | "about"; igClass?: string; app?: boolean }) {
  const [menu, setMenu] = useState(false);
  if (app) {
    // Booking / rental / client pages: Tplum header + footer around a DMI-style app area (no public-page typography inside).
    return (
      <>
        <div className="tp tp-solid">
          <a href="#content" className="sr-only">Skip to content</a>
          <Header site={site} onMenu={() => setMenu(true)} />
          <MenuOverlay site={site} open={menu} onClose={() => setMenu(false)} />
        </div>
        <main id="content" className="app">{children}</main>
        <div className="tp"><Footer site={site} /><ToTop /></div>
      </>
    );
  }
  return (
    <div className="tp">
      <a href="#content" className="sr-only">Skip to content</a>
      <Header site={site} onMenu={() => setMenu(true)} />
      <MenuOverlay site={site} open={menu} onClose={() => setMenu(false)} />
      <main id="content">{children}</main>
      <InstagramBand site={site} posts={posts} variant={igVariant} className={igClass} />
      <Footer site={site} />
      <ToTop />
    </div>
  );
}
