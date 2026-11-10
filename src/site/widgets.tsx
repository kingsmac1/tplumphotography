import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CmsImage } from "@/cms/types";
import { Img } from "./ui";
import { IconClose, IconStar, SlideArrow, socialIcon } from "./icons";

/* ------------------------------------------------------------------ */
/* Hero slider: fade every 3 s, Ken Burns zoom, dots + round arrows,   */
/* swipe/drag. Matches the Prime Slider settings of the original.      */
/* ------------------------------------------------------------------ */
export function HeroSlider({ slides, className, interval = 3000 }: { slides: Partial<CmsImage>[]; className: string; interval?: number }) {
  const [index, setIndex] = useState(0);
  const [prev, setPrev] = useState<number | null>(null);
  const count = slides.length;
  const go = useCallback((n: number) => {
    setIndex((cur) => { setPrev(cur); return ((n % count) + count) % count; });
  }, [count]);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const restart = useCallback(() => {
    if (timer.current) clearInterval(timer.current);
    if (typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    timer.current = setInterval(() => setIndex((cur) => { setPrev(cur); return (cur + 1) % count; }), interval);
  }, [count, interval]);
  useEffect(() => { restart(); return () => { if (timer.current) clearInterval(timer.current); }; }, [restart]);
  const startX = useRef<number | null>(null);
  if (!count) return null;
  return (
    <section
      className={`hero ${className}`}
      aria-roledescription="carousel"
      aria-label="Featured photographs"
      onPointerDown={(e) => { startX.current = e.clientX; }}
      onPointerUp={(e) => {
        if (startX.current === null) return;
        const dx = e.clientX - startX.current;
        startX.current = null;
        if (Math.abs(dx) > 40) { go(index + (dx < 0 ? 1 : -1)); restart(); }
      }}
    >
      <div className="slides">
        {slides.map((s, i) => (
          <div key={i} className={`slide${i === index ? " active" : ""}${i === prev ? " leaving" : ""}`} aria-roledescription="slide" aria-label={`${i + 1} of ${count}`} aria-hidden={i !== index}>
            <div className="kb">
              <Img image={s} sizes="100vw" loading={i === 0 ? "eager" : "lazy"} fetchPriority={i === 0 ? "high" : undefined} />
            </div>
          </div>
        ))}
      </div>
      <ul className="dots" aria-label="Choose slide to display">
        {slides.map((_, i) => (
          <li key={i}><button type="button" aria-label={`Slide ${i + 1}`} aria-current={i === index} onClick={() => { go(i); restart(); }} /></li>
        ))}
      </ul>
      <div className="arrows">
        <button type="button" aria-label="Previous slide" onClick={() => { go(index - 1); restart(); }}><SlideArrow dir="prev" /></button>
        <button type="button" aria-label="Next slide" onClick={() => { go(index + 1); restart(); }}><SlideArrow dir="next" /></button>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Testimonials: 2 per view (1 on phones), loop, autoplay 5 s,         */
/* pause on hover, bullets.                                            */
/* ------------------------------------------------------------------ */
export type Review = { name: string; title: string; text: string; rating: number; source: string; image: Partial<CmsImage> };
export function Reviews({ items }: { items: Review[] }) {
  const [perView, setPerView] = useState(2);
  const [page, setPage] = useState(0);
  const [hover, setHover] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const on = () => setPerView(mq.matches ? 1 : 2);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  const pages = items.length > perView ? items.length : 1;
  // loop like Swiper: the first slides are repeated at the end so the last page is never half empty
  const looped = items.length > perView ? [...items, ...items.slice(0, perView - 1)] : items;
  useEffect(() => {
    if (hover || pages < 2) return;
    const t = setInterval(() => setPage((p) => (p + 1) % pages), 5000);
    return () => clearInterval(t);
  }, [hover, pages]);
  useEffect(() => { if (page >= pages) setPage(0); }, [page, pages]);
  const gap = perView === 1 ? 10 : 15;
  return (
    <div className="reviews" onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
      <div className="viewport">
        <div className="track" style={{ transform: `translateX(calc(${-page} * ((100% - ${(perView - 1) * gap}px) / ${perView} + ${gap}px)))` }}>
          {looped.map((r, i) => {
            const Src = socialIcon(r.source);
            return (
              <article className="card" key={r.name + i} aria-hidden={i < page || i >= page + perView}>
                <header>
                  <Img image={r.image} sizes="63px" alt={r.name} />
                  <cite>
                    <span className="name">{r.name}</span>
                    <span className="stars" role="img" aria-label={`Rated ${r.rating} out of 5`}>
                      {[1, 2, 3, 4, 5].map((n) => <IconStar key={n} className={n <= r.rating ? undefined : "off"} />)}
                    </span>
                    <span className="role">{r.title}</span>
                  </cite>
                  {r.source && <span className="src" aria-hidden="true"><Src /></span>}
                </header>
                <div className="text">{r.text}</div>
              </article>
            );
          })}
        </div>
      </div>
      {pages > 1 && (
        <div className="bullets">
          {Array.from({ length: pages }, (_, i) => (
            <button key={i} type="button" aria-label={`Go to slide ${i + 1}`} aria-current={i === page} onClick={() => setPage(i)} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Masonry gallery: images go into the shortest column (same placement */
/* as the original Isotope grid, computed from image sizes so the      */
/* server and browser agree). Click opens the lightbox.                */
/* ------------------------------------------------------------------ */
function columnsFor(images: Partial<CmsImage>[], cols: number) {
  const heights = Array(cols).fill(0);
  const out: { img: Partial<CmsImage>; i: number }[][] = Array.from({ length: cols }, () => []);
  images.forEach((img, i) => {
    const ar = img.width && img.height ? img.height / img.width : 1;
    let c = 0;
    for (let k = 1; k < cols; k++) if (heights[k] < heights[c] - 0.001) c = k;
    out[c].push({ img, i });
    heights[c] += ar;
  });
  return out;
}
export function Masonry({ images, label }: { images: Partial<CmsImage>[]; label: string }) {
  const [open, setOpen] = useState<number | null>(null);
  const desktop = useMemo(() => columnsFor(images, 3), [images]);
  const mobile = useMemo(() => columnsFor(images, 2), [images]);
  const render = (cols: typeof desktop, cls: string, sizes: string) => (
    <div className={`masonry ${cls}`}>
      {cols.map((col, c) => (
        <div className="col" key={c}>
          {col.map(({ img, i }) => (
            <a key={i} className="item" href={img.src} onClick={(e) => { e.preventDefault(); setOpen(i); }} aria-label={`Open photo ${i + 1} of ${images.length} (${label})`}>
              <Img image={img} sizes={sizes} />
            </a>
          ))}
        </div>
      ))}
    </div>
  );
  return (
    <>
      {render(desktop, "no-mobile", "(max-width: 1024px) 33vw, 480px")}
      {render(mobile, "only-mobile", "50vw")}
      {open !== null && <Lightbox images={images} index={open} onIndex={setOpen} onClose={() => setOpen(null)} />}
    </>
  );
}

export function Lightbox({ images, index, onIndex, onClose }: { images: Partial<CmsImage>[]; index: number; onIndex: (i: number) => void; onClose: () => void }) {
  const n = images.length;
  const prev = useCallback(() => onIndex((index - 1 + n) % n), [index, n, onIndex]);
  const next = useCallback(() => onIndex((index + 1) % n), [index, n, onIndex]);
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); if (e.key === "ArrowLeft") prev(); if (e.key === "ArrowRight") next(); };
    document.addEventListener("keydown", onKey);
    const o = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = o; };
  }, [onClose, prev, next]);
  const startX = useRef<number | null>(null);
  const img = images[index];
  return (
    <div className="tp-lightbox" role="dialog" aria-modal="true" aria-label="Photo viewer" onClick={(e) => e.target === e.currentTarget && onClose()}
      onPointerDown={(e) => { startX.current = e.clientX; }}
      onPointerUp={(e) => { if (startX.current === null) return; const dx = e.clientX - startX.current; startX.current = null; if (Math.abs(dx) > 50) (dx < 0 ? next : prev)(); }}>
      <span className="count">{index + 1} / {n}</span>
      <img src={img.src} srcSet={img.srcset} sizes="100vw" alt={img.alt ?? ""} />
      <button ref={closeRef} type="button" className="close" aria-label="Close" onClick={onClose}><IconClose /></button>
      {n > 1 && <button type="button" className="prev" aria-label="Previous photo" onClick={prev}><SlideArrow dir="prev" /></button>}
      {n > 1 && <button type="button" className="next" aria-label="Next photo" onClick={next}><SlideArrow dir="next" /></button>}
    </div>
  );
}

/* Background layer that drifts slightly as the page scrolls (Elementor "motion effects: vertical scroll"). */
export function ParallaxBg({ className, style }: { className: string; style: React.CSSProperties }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0;
    const on = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const r = el.parentElement!.getBoundingClientRect();
        const progress = Math.min(1, Math.max(0, (window.innerHeight - r.top) / (window.innerHeight + r.height)));
        // Elementor vertical-scroll motion: the layer (164% tall) drifts up by its extra height while the section crosses the screen
        const h = el.parentElement!.offsetHeight;
        el.style.transform = `translate3d(0, ${-(0.052 * h + progress * (0.64 * h - 0.052 * h))}px, 0)`;
      });
    };
    on();
    window.addEventListener("scroll", on, { passive: true });
    window.addEventListener("resize", on);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("scroll", on); window.removeEventListener("resize", on); };
  }, []);
  return <div ref={ref} className={className} style={style} aria-hidden="true" />;
}
