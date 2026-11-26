import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useLocation } from "@tanstack/react-router";
import Lenis from "lenis";
import { ArrowUp, Camera, Home as HomeIcon, LayoutGrid, Mail, Menu as MenuIcon } from "lucide-react";
import { SEED, type CmsImage, type SiteContent } from "@/cms/types";
import { Img } from "./ui";
import { IconFacebook, IconInstagram } from "./icons";

/**
 * The site's header, menu and motion, after the PairMediaPro site: split header with a centred logo that hides on
 * scroll down, a full-screen menu, an app-style tab bar on phones, a progress-ring back-to-top button, a cursor dot with
 * magnetic buttons, Lenis smooth scrolling and photographs that open as they come into view. Content is the same CMS
 * content from the CMS. Styles: modern.css.
 */

const reduced = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const finePointer = () => typeof window !== "undefined" && window.matchMedia("(hover: hover) and (pointer: fine)").matches;
const norm = (p: string) => (p.endsWith("/") ? p : p + "/");

let lenis: Lenis | null = null;
export const scrollToTop = () => (lenis ? lenis.scrollTo(0, { duration: 1.2 }) : window.scrollTo({ top: 0, behavior: reduced() ? "auto" : "smooth" }));

/** Photographs that open from the bottom as they scroll into view (text reveals use the existing Reveal component). */
const FRAMES = ".about-card .photo, .profile .photo, .candid .row > *, .masonry .item, .book-card .photo, .ig-tiles a, .m2-frame";

export function useModernMotion(enabled: boolean, key: string) {
  // smooth scroll
  useEffect(() => {
    if (!enabled || reduced()) return;
    const l = new Lenis({ lerp: 0.09, wheelMultiplier: 1, anchors: { offset: -90 } });
    lenis = l;
    let raf = 0;
    const tick = (t: number) => { l.raf(t); raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); l.destroy(); lenis = null; };
  }, [enabled]);
  // photo reveals
  useEffect(() => {
    if (!enabled) return;
    const els = Array.from(document.querySelectorAll<HTMLElement>(FRAMES));
    if (reduced() || !("IntersectionObserver" in window)) return;
    // A fully clipped element reports no intersection, so each photo is watched through its parent (as on PairMediaPro).
    const targets = new Map<Element, HTMLElement[]>();
    const io = new IntersectionObserver((entries) => entries.forEach((e) => {
      if (!e.isIntersecting) return;
      (targets.get(e.target) ?? []).forEach((el) => el.classList.add("is-in"));
      io.unobserve(e.target);
      targets.delete(e.target);
    }), { rootMargin: "0px 0px -6% 0px" });
    els.forEach((el, i) => {
      el.style.setProperty("--d", String(i % 4));
      el.classList.add("m-frame");
      const watch = el.parentElement ?? el;
      if (!targets.has(watch)) { targets.set(watch, []); io.observe(watch); }
      targets.get(watch)!.push(el);
    });
    // failsafe: never leave a photo closed
    const t = window.setTimeout(() => els.forEach((el) => { const r = el.getBoundingClientRect(); if (r.top < innerHeight && r.bottom > 0) el.classList.add("is-in"); }), 1500);
    return () => { io.disconnect(); clearTimeout(t); };
  }, [enabled, key]);
}

/* ------------------------------------------------------------------ */

function Socials({ site }: { site: SiteContent }) {
  return (
    <ul className="m-socials">
      <li><a href={site.contact.instagramUrl} target="_blank" rel="noopener noreferrer" aria-label="Instagram"><IconInstagram className="m-ico" /></a></li>
      <li><a href={site.contact.facebookUrl} target="_blank" rel="noopener noreferrer" aria-label="Facebook"><IconFacebook className="m-ico" /></a></li>
    </ul>
  );
}

/** Split navigation round a centred logo. Hides while scrolling down, returns on scroll up. */
export function ModernHeader({ site, onMenu, menuOpen, solid }: { site: SiteContent; onMenu: () => void; menuOpen: boolean; solid?: boolean }) {
  const { pathname } = useLocation();
  const [scrolled, setScrolled] = useState(false);
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    let last = window.scrollY;
    const on = () => {
      const y = window.scrollY;
      setScrolled(y > 10);
      if (y > 420 && y > last + 2) setHidden(true);
      if (y < last - 2 || y < 420) setHidden(false);
      last = y;
    };
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  const book = site.header?.bookButton;
  void pathname;
  // the menu lives in the full-screen overlay ("Menu" button), not in the header
  return (
    <header className={`m-header${scrolled || solid ? " is-scrolled" : ""}${hidden && !menuOpen ? " is-hidden" : ""}`}>
      <div className="m-header__in">
        <button type="button" className="m-menu-btn" onClick={onMenu} aria-haspopup="dialog" aria-expanded={menuOpen}>
          <i aria-hidden="true"><b /><b /></i>Menu
        </button>
        <a href="/" className="m-brand" aria-label={`${site.brand.siteName} home`}>
          <Img image={site.brand.logoLight} sizes="160px" loading="eager" alt={site.brand.siteName} />
        </a>
        <nav className="m-split m-split--right" aria-label="Book">
          <ul>
            {book?.label && <li><a href={book.href} className="m-book magnetic"><span className="m-dot" aria-hidden="true" />{book.label}</a></li>}
          </ul>
        </nav>
        <a className="m-head-ig" href={site.contact.instagramUrl} target="_blank" rel="noopener noreferrer" aria-label="Instagram"><IconInstagram /></a>
      </div>
    </header>
  );
}

/** A photograph for each menu link, taken from that page's own banner (falls back to the home slideshow). */
const previewFor = (href: string): Partial<CmsImage> | undefined => {
  const p = norm(href).replace(/^\/|\/$/g, "");
  const s = SEED as unknown as Record<string, { hero?: { image?: CmsImage; slidesDesktop?: CmsImage[] } }>;
  const alias: Record<string, string> = { "booking/wedding": "wedding-stories", booking: "portfolio", "booking/kiddies": "book" };
  const key = alias[p] ?? p;
  return (key ? s[key]?.hero?.image : undefined) ?? s.home?.hero?.slidesDesktop?.[0];
};

type MenuLink = { label: string; href: string; children?: { label: string; href: string }[] };

/** Every link in the menu, sub-menus included (for the photo previews and anywhere a flat list is needed). */
export const flatMenu = (items: MenuLink[]) => items.flatMap((i) => [i, ...(i.children ?? [])]);

const EASE = [0.16, 1, 0.3, 1] as const;

/**
 * Full-screen menu: very large numbered links, each section's sub-menu shown under it straight away as a row of pill
 * links (Services → Wedding, Photography & Videography, Tplum Kiddies; Portfolio → Wedding Stories, Videos, Our Recent
 * Work), a photograph for the link you point at, and ways to get in touch. Entrance: a short stagger (framer-motion).
 * It scrolls on its own (data-lenis-prevent: the page's smooth scrolling is paused while it is open).
 */
export function ModernMenu({ site, open, onClose }: { site: SiteContent; open: boolean; onClose: () => void }) {
  const { pathname } = useLocation();
  const items = site.menu.items as MenuLink[];
  const all = flatMenu(items);
  const reduce = useReducedMotion();
  const current = all.find((i) => norm(i.href) === norm(pathname))?.href ?? items[0]?.href ?? "/";
  const [hover, setHover] = useState(current);
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    setHover(current);
    lenis?.stop();
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // the menu has its own logo and Close button: the site header (and the design switch) hide while it is open
    document.documentElement.classList.add("menu-open");
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    closeRef.current?.focus();
    return () => { lenis?.start(); document.body.style.overflow = prev; document.documentElement.classList.remove("menu-open"); document.removeEventListener("keydown", onKey); };
  }, [open, onClose, current]);
  if (!open) return null;
  const book = site.header?.bookButton;
  const contactItem = all.find((i) => norm(i.href) === "/contact/");
  const phone = site.contact.phone;
  return (
    <div className="m-menu" role="dialog" aria-modal="true" aria-label="Menu" data-lenis-prevent>
      <div className="m-menu__top">
        <a href="/" onClick={onClose} aria-label={`${site.brand.siteName} home`} className="m-menu__logo"><Img image={site.brand.menuLogo ?? site.brand.logoLight} sizes="160px" alt={site.brand.siteName} /></a>
        <button ref={closeRef} type="button" className="m-menu__close" onClick={onClose}>
          <span>Close</span><span className="x" aria-hidden="true"><i /><i /></span>
        </button>
      </div>
      <div className="m-menu__body">
        <nav aria-label="Main">
          <motion.ul initial="hidden" animate="shown" variants={{ shown: { transition: { staggerChildren: reduce ? 0 : 0.055, delayChildren: reduce ? 0 : 0.12 } } }}>
            {items.map((n, i) => {
              const kids = n.children?.filter((c) => c.label && c.href) ?? [];
              return (
                <motion.li key={n.href + n.label} className={`m-menu__group${kids.length ? " has-sub" : ""}`}
                  variants={{ hidden: { opacity: 0, y: reduce ? 0 : 28 }, shown: { opacity: 1, y: 0, transition: { duration: reduce ? 0 : 0.7, ease: EASE } } }}>
                  <a
                    href={n.href}
                    onClick={onClose}
                    onPointerEnter={() => setHover(n.href)}
                    onFocus={() => setHover(n.href)}
                    aria-current={norm(n.href) === norm(pathname) ? "page" : undefined}
                    className={`m-menu__link${hover === n.href ? " is-hover" : ""}`}
                  >
                    <sup aria-hidden="true">{String(i + 1).padStart(2, "0")}</sup>
                    <span>{n.label}</span>
                  </a>
                  {kids.length > 0 && (
                    <motion.ul className="m-menu__sub" aria-label={`${n.label}: pages`} initial="hidden" animate="shown"
                      variants={{ shown: { transition: { staggerChildren: reduce ? 0 : 0.06, delayChildren: reduce ? 0 : 0.35 + i * 0.05 } } }}>
                      {kids.map((c) => (
                        <motion.li key={c.href + c.label} variants={{ hidden: { opacity: 0, x: reduce ? 0 : -10 }, shown: { opacity: 1, x: 0, transition: { duration: reduce ? 0 : 0.5, ease: EASE } } }}>
                          <a href={c.href} onClick={onClose} onPointerEnter={() => setHover(c.href)} onFocus={() => setHover(c.href)}
                            aria-current={norm(c.href) === norm(pathname) ? "page" : undefined}
                            className={`m-menu__pill${hover === c.href ? " is-hover" : ""}`}>
                            {c.label}
                            <svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true"><path d="M7 17 17 7M8 7h9v9" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                          </a>
                        </motion.li>
                      ))}
                    </motion.ul>
                  )}
                </motion.li>
              );
            })}
          </motion.ul>
        </nav>
        <aside className="m-menu__aside" aria-label="Book or get in touch">
          <div className="m-menu__item m-menu__preview" style={{ animationDelay: "200ms" }} aria-hidden="true">
            {[...new Map(all.map((n) => [n.href, n])).values()].map((n) => {
              const img = previewFor(n.href);
              return img?.src ? <div key={n.href} style={{ opacity: hover === n.href ? 1 : 0 }}><Img image={img} sizes="34vw" /></div> : null;
            })}
          </div>
          <div className="m-menu__item m-menu__ctas" style={{ animationDelay: "320ms" }}>
            {book?.label && <a href={book.href} onClick={onClose} className="btn solid light">{book.label}</a>}
            {contactItem && <a href={contactItem.href} onClick={onClose} className="btn light">{contactItem.label}</a>}
          </div>
          <div className="m-menu__item m-menu__contact" style={{ animationDelay: "400ms" }}>
            <a href={`mailto:${site.contact.email}`}>{site.contact.email.toLowerCase()}</a>
            <a href={`tel:${phone.replace(/[^+\d]/g, "")}`}>{/^\+?1\d{10}$/.test(phone.replace(/[^+\d]/g, "")) ? phone.replace(/[^\d]/g, "").replace(/^1(\d{3})(\d{3})(\d{4})$/, "+1 $1 $2 $3") : phone}</a>
            <Socials site={site} />
          </div>
        </aside>
      </div>
    </div>
  );
}

/** Phones: an app-style bar along the bottom, with the booking button raised in the middle. */
export function TabBar({ site, onMenu }: { site: SiteContent; onMenu: () => void }) {
  const { pathname } = useLocation();
  const find = (p: string) => site.menu.items.find((i) => norm(i.href) === p);
  const home = find("/"), work = find("/portfolio/"), contact = find("/contact/");
  const book = site.header?.bookButton;
  const on = (href?: string) => (href && norm(pathname) === norm(href) ? "page" : undefined);
  return (
    <nav className="m-tabbar" aria-label="Quick links">
      {home && <a href={home.href} aria-current={on(home.href)}><HomeIcon size={20} aria-hidden="true" />{home.label}</a>}
      {work && <a href={work.href} aria-current={on(work.href)}><LayoutGrid size={20} aria-hidden="true" />{work.label}</a>}
      {book?.label && <a href={book.href} className="m-tab-book" aria-current={on(book.href)}><span><Camera size={22} aria-hidden="true" /></span>{book.label.replace(/\s*now$/i, "")}</a>}
      {contact && <a href={contact.href} aria-current={on(contact.href)}><Mail size={20} aria-hidden="true" />{contact.label}</a>}
      <button type="button" onClick={onMenu}><MenuIcon size={20} aria-hidden="true" />Menu</button>
    </nav>
  );
}

/** Back to the top, with a ring that fills as you read down the page. */
export function RingToTop() {
  const ring = useRef<SVGCircleElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const on = () => {
      const y = window.scrollY;
      const max = document.documentElement.scrollHeight - innerHeight;
      setVisible(y > 600);
      if (ring.current && max > 0) ring.current.style.strokeDashoffset = (150.8 * (1 - Math.min(1, y / max))).toFixed(1);
    };
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  return (
    <button type="button" className={`m-to-top${visible ? " is-visible" : ""}`} onClick={scrollToTop} aria-label="Back to the top" tabIndex={visible ? 0 : -1}>
      <svg className="ring" viewBox="0 0 52 52" aria-hidden="true"><circle cx="26" cy="26" r="24" /><circle ref={ring} className="bar" cx="26" cy="26" r="24" /></svg>
      <ArrowUp size={18} aria-hidden="true" />
    </button>
  );
}

/** Mouse only: a dot that follows the pointer, grows over links and says "View" over photographs; buttons lean towards it. */
export function Cursor() {
  const dot = useRef<HTMLDivElement>(null);
  const [on, setOn] = useState(false);
  useEffect(() => {
    if (!finePointer() || reduced()) return;
    setOn(true);
    let mx = -100, my = -100, cx = -100, cy = -100, raf = 0;
    let mag: HTMLElement | null = null;
    const move = (e: MouseEvent) => {
      mx = e.clientX; my = e.clientY;
      const m = (e.target as Element).closest<HTMLElement>(".magnetic, .tp .btn, .header-book");
      if (mag && mag !== m) mag.style.translate = "";
      mag = m;
      if (m) {
        const r = m.getBoundingClientRect();
        m.style.translate = `${((mx - r.left - r.width / 2) * 0.22).toFixed(1)}px ${((my - r.top - r.height / 2) * 0.3).toFixed(1)}px`;
      }
    };
    const over = (e: MouseEvent) => {
      const t = e.target as Element;
      const view = t.closest(".masonry .item, .ig-tiles a, .book-card .photo, .candid .row > *");
      const link = !view && t.closest("a, button, input, select, textarea, label, summary");
      dot.current?.classList.toggle("is-view", !!view);
      dot.current?.classList.toggle("is-link", !!link);
    };
    const leave = () => dot.current?.classList.add("is-hidden");
    const enter = () => dot.current?.classList.remove("is-hidden");
    const follow = () => {
      cx += (mx - cx) * 0.2; cy += (my - cy) * 0.2;
      if (dot.current) dot.current.style.transform = `translate3d(${cx}px,${cy}px,0)`;
      raf = requestAnimationFrame(follow);
    };
    raf = requestAnimationFrame(follow);
    document.addEventListener("mousemove", move, { passive: true });
    document.addEventListener("mouseover", over);
    document.documentElement.addEventListener("mouseleave", leave);
    document.documentElement.addEventListener("mouseenter", enter);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("mousemove", move);
      document.removeEventListener("mouseover", over);
      document.documentElement.removeEventListener("mouseleave", leave);
      document.documentElement.removeEventListener("mouseenter", enter);
    };
  }, []);
  if (!on) return null;
  return <div ref={dot} className="m-cursor" aria-hidden="true"><span>View</span></div>;
}
