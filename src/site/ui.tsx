import { useEffect, useRef, type CSSProperties, type ElementType, type ReactNode } from "react";
import { sanitizeRich } from "@/cms/sanitize";
import type { CmsImage } from "@/cms/types";
import { IconArrowRight } from "./icons";

/** Responsive image from the CMS (optimised WebP widths in srcset). */
export function Img({ image, sizes = "100vw", className, style, loading = "lazy", fetchPriority, alt }: {
  image?: Partial<CmsImage> | null; sizes?: string; className?: string; style?: CSSProperties; loading?: "lazy" | "eager"; fetchPriority?: "high" | "low" | "auto"; alt?: string;
}) {
  if (!image?.src) return null;
  const pos = image.focal ? `${image.focal.x}% ${image.focal.y}%` : undefined;
  return (
    <img
      src={image.src}
      srcSet={image.srcset || undefined}
      sizes={image.srcset ? sizes : undefined}
      width={image.width}
      height={image.height}
      alt={alt ?? image.alt ?? ""}
      loading={loading}
      decoding="async"
      // @ts-expect-error fetchpriority is a valid attribute
      fetchpriority={fetchPriority}
      className={className}
      style={pos ? { objectPosition: pos, ...style } : style}
    />
  );
}

/** CSS background from a CMS image: picks a sensible width from the srcset. */
export function bgUrl(image?: Partial<CmsImage> | null, want = 2400) {
  if (!image?.src) return undefined;
  if (!image.srcset) return `url("${image.src}")`;
  const cands = image.srcset.split(",").map((s) => s.trim().split(/\s+/)).map(([u, w]) => ({ u, w: parseInt(w) }));
  const pick = cands.filter((c) => c.w >= want).sort((a, b) => a.w - b.w)[0] ?? cands.sort((a, b) => b.w - a.w)[0];
  return `url("${pick.u}")`;
}

/** Sanitised rich text (only p, br, strong, em, a, lists). */
export function Rich({ html, className, as: Tag = "div" }: { html: string; className?: string; as?: ElementType }) {
  return <Tag className={className} dangerouslySetInnerHTML={{ __html: sanitizeRich(html) }} />;
}

/** Elementor-style entrance animation: content renders server-side, animates in when scrolled into view. */
export function Reveal({ children, as: Tag = "div", className = "", delay = 0, fade = false, style, ...rest }: {
  children?: ReactNode; as?: ElementType; className?: string; delay?: number; fade?: boolean; style?: CSSProperties; [k: string]: unknown;
}) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") { el.classList.add("in"); return; }
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting) { el.classList.add("in"); io.disconnect(); }
    }, { rootMargin: "0px 0px -5% 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <Tag ref={ref} className={`reveal${fade ? " fade" : ""} ${className}`.trim()} style={{ ...(delay ? { ["--delay" as string]: `${delay}ms` } : {}), ...style }} {...rest}>
      {children}
    </Tag>
  );
}

/** Elementor button with the arrow icon after the text. */
export function Button({ href, label, light = false, className = "", newTab = false }: { href: string; label: string; light?: boolean; className?: string; newTab?: boolean }) {
  const external = /^https?:/i.test(href);
  return (
    <a href={href} className={`btn${light ? " light" : ""} ${className}`.trim()} {...(external || newTab ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
      <span>{label}</span>
      <IconArrowRight />
    </a>
  );
}
