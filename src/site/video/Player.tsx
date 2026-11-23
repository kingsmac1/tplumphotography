import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Video } from "@/cms/content";
import { embedUrl, thumbHq, thumbMax } from "@/lib/youtube";
import "./video.css";

/**
 * Video portfolio, shared by both designs: a thumbnail that loads nothing from YouTube until it is pressed, and a
 * full-screen "cinema" player (dark blurred backdrop, rounded 16:9 frame, title and category below, previous/next,
 * an up-next strip, Esc / ← / → on the keyboard). Plays through YouTube's privacy-enhanced embed.
 */

/** hqdefault straight away; swapped for the sharp 1280×720 frame when YouTube has one (it answers a tiny grey
 *  120×90 placeholder, not an error, when it doesn't, so the width is checked). */
export function VideoThumb({ id, alt, eager = false, className = "" }: { id: string; alt: string; eager?: boolean; className?: string }) {
  const [src, setSrc] = useState(thumbHq(id));
  useEffect(() => {
    setSrc(thumbHq(id));
    const img = new Image();
    img.onload = () => { if (img.naturalWidth > 200) setSrc(thumbMax(id)); };
    img.src = thumbMax(id);
  }, [id]);
  return <img className={`vthumb ${className}`.trim()} src={src} alt={alt} loading={eager ? "eager" : "lazy"} decoding="async" width={1280} height={720} />;
}

/** The round play mark on a thumbnail. */
export function PlayMark({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  return (
    <span className={`vplay vplay--${size}`} aria-hidden="true">
      <svg viewBox="0 0 24 24" width="40%" height="40%"><path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.4-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5Z" fill="currentColor" /></svg>
    </span>
  );
}

/** Which film is open (index into the list), or null. */
export function usePlayer(count: number) {
  const [index, setIndex] = useState<number | null>(null);
  const open = useCallback((i: number) => setIndex(i), []);
  const close = useCallback(() => setIndex(null), []);
  const step = useCallback((d: number) => setIndex((i) => (i === null || !count ? i : (i + d + count) % count)), [count]);
  return { index, open, close, step, setIndex };
}

export function Player({ videos, index, onClose, onIndex }: { videos: Video[]; index: number | null; onClose: () => void; onIndex: (i: number) => void }) {
  const closeBtn = useRef<HTMLButtonElement>(null);
  const opener = useRef<Element | null>(null);
  const isOpen = index !== null && !!videos[index];
  const v = isOpen ? videos[index!] : null;

  // keyboard, scroll lock and focus (back to the thumbnail that opened it on close)
  useEffect(() => {
    if (!isOpen) return;
    opener.current = document.activeElement;
    const html = document.documentElement;
    const prevOverflow = html.style.overflow;
    html.style.overflow = "hidden";
    html.classList.add("lenis-stopped");
    closeBtn.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight" && videos.length > 1) onIndex(((index ?? 0) + 1) % videos.length);
      else if (e.key === "ArrowLeft" && videos.length > 1) onIndex(((index ?? 0) - 1 + videos.length) % videos.length);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      html.style.overflow = prevOverflow;
      html.classList.remove("lenis-stopped");
      (opener.current as HTMLElement | null)?.focus?.();
    };
  }, [isOpen, index, onClose, onIndex, videos.length]);

  if (!isOpen || !v || typeof document === "undefined") return null;
  const many = videos.length > 1;
  return createPortal(
    <div className="vcinema" role="dialog" aria-modal="true" aria-label={`Film: ${v.title || "Tplum Photography"}`} data-lenis-prevent onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="vcinema__top">
        <span className="vcinema__count">{many ? `${index! + 1} / ${videos.length}` : "Tplum Photography"}</span>
        <button ref={closeBtn} type="button" className="vcinema__close" onClick={onClose} aria-label="Close the film">
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
        </button>
      </div>

      <div className="vcinema__stage">
        {many && (
          <button type="button" className="vcinema__nav vcinema__nav--prev" onClick={() => onIndex((index! - 1 + videos.length) % videos.length)} aria-label="Previous film">
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
        )}
        <div className="vcinema__frame" key={v.youtube_id}>
          <iframe
            src={embedUrl(v.youtube_id)}
            title={v.title || "Tplum Photography film"}
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
          />
        </div>
        {many && (
          <button type="button" className="vcinema__nav vcinema__nav--next" onClick={() => onIndex((index! + 1) % videos.length)} aria-label="Next film">
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
        )}
      </div>

      <div className="vcinema__info">
        <div className="vcinema__meta">
          {v.category && <span className="vcinema__chip">{v.category}</span>}
          <h2 className="vcinema__title">{v.title || "Untitled film"}</h2>
          {v.description && <p className="vcinema__desc">{v.description}</p>}
        </div>
        {many && (
          <ul className="vcinema__strip" aria-label="Up next">
            {videos.map((x, i) => (
              <li key={x.id}>
                <button type="button" aria-current={i === index || undefined} onClick={() => onIndex(i)} aria-label={`Play ${x.title || `film ${i + 1}`}`}>
                  <img src={thumbHq(x.youtube_id)} alt="" loading="lazy" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>,
    document.body,
  );
}
