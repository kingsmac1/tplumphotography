import { useEffect, useState, type ReactNode } from "react";
import { useLocation } from "@tanstack/react-router";
import type { CmsImage, SiteContent } from "@/cms/types";
import { backendReady, callFunction } from "@/lib/functions";
import { Img, Reveal } from "./ui";
import { Cursor, ModernHeader, ModernMenu, RingToTop, TabBar, useModernMotion } from "./modern";
import { releasePreloader } from "./preloader";
import { DesignSwitch } from "./design";
import { IconFacebook, IconInstagram } from "./icons";

export type IgPost = { image: Partial<CmsImage> & { src: string }; caption?: string; url: string };

/** Instagram and Facebook, linked, on every page (the old About page showed unlinked Facebook/Twitter/YouTube icons; replaced at the client's request). */
function Socials({ site }: { site: SiteContent; variant?: "default" | "about" }) {
  return (
    <div className="socials">
      <a href={site.contact.instagramUrl} target="_blank" rel="noopener noreferrer" aria-label="Instagram"><IconInstagram /></a>
      <a href={site.contact.facebookUrl} target="_blank" rel="noopener noreferrer" aria-label="Facebook"><IconFacebook /></a>
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
  // Nkopno pattern: after the page has loaded, quietly ask the sync function to check Instagram for new posts
  // (it skips if checked in the last minute). New posts appear on the next page load.
  useEffect(() => {
    if (!backendReady()) return;
    try { if (sessionStorage.getItem("ig-sync")) return; sessionStorage.setItem("ig-sync", "1"); } catch { /* private mode */ }
    const t = setTimeout(() => void callFunction("instagram-sync", {}), 4000);
    return () => clearTimeout(t);
  }, []);
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

export function Footer({ site }: { site: SiteContent }) {
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

/** Header, full-screen menu, phone tab bar, back-to-top and cursor (the site design, after PairMediaPro), plus smooth
 *  scrolling and photo reveals. Content comes from the CMS; see modern.tsx and modern.css. */
export function SiteChrome({ site, app }: { site: SiteContent; app: boolean }) {
  const { pathname } = useLocation();
  const [menu, setMenu] = useState(false);
  useModernMotion(true, pathname);
  useEffect(() => { releasePreloader(); }, []);
  return (
    <>
      <a href="#content" className="sr-only">Skip to content</a>
      <ModernHeader site={site} onMenu={() => setMenu(true)} menuOpen={menu} solid={app} />
      <ModernMenu site={site} open={menu} onClose={() => setMenu(false)} />
      <TabBar site={site} onMenu={() => setMenu(true)} />
      <RingToTop />
      <Cursor />
      <DesignSwitch />
    </>
  );
}

/** Every public page: header + menu, page content, Instagram band, footer. */
export function SiteLayout({ site, posts, children, igVariant, igClass, app = false }: { site: SiteContent; posts: IgPost[]; children: ReactNode; igVariant?: "default" | "about"; igClass?: string; app?: boolean }) {
  if (app) {
    // Booking / client pages: the Tplum header + footer around a DMI-style app area (no public-page typography inside).
    return (
      <>
        <div className="tp"><SiteChrome site={site} app /></div>
        <main id="content" className="app">{children}</main>
        <div className="tp"><Footer site={site} /></div>
      </>
    );
  }
  return (
    <div className="tp">
      <SiteChrome site={site} app={false} />
      <main id="content">{children}</main>
      <InstagramBand site={site} posts={posts} variant={igVariant} className={igClass} />
      <Footer site={site} />
    </div>
  );
}
