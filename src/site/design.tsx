import { useEffect, useState, type ReactNode } from "react";
import { BUILT_DESIGN } from "@/cms/content";

/**
 * The website's two designs: "classic" (the copy of the WordPress site with the PairMediaPro header and motion) and
 * "modern" (rounded cards, bento grids and big type, after the client's reference screenshots). Same pages, same
 * content from the CMS; only the layout and styling differ.
 *
 * The site is pre-rendered (Cloudflare Pages), so every public page carries both versions in its HTML and a tiny script
 * in <head> picks one before anything paints (`<html data-design="classic|modern">`): no flash, no server needed.
 * After the page has started, the other version is removed from the page, so only one is ever live.
 *
 * Who decides: the owner, in Dashboard → Website → Website design (default design + whether visitors may switch).
 * With switching on, a visitor's own choice is remembered in this browser. ?design=modern / ?design=classic shows that
 * design for the page view (the owner's preview links), and is remembered too when switching is on.
 */
export type Design = "classic" | "modern";
const KEY = "tplum-design";

/** Runs in <head> before the first paint. */
export const designHeadScript = () =>
  `(function(){var d=document.documentElement,def=${JSON.stringify(BUILT_DESIGN.site_design)},allow=${BUILT_DESIGN.allow_design_switch ? "true" : "false"},v=def;` +
  `try{var q=new URLSearchParams(location.search).get('design');if(allow){var s=localStorage.getItem('${KEY}');if(s==='modern'||s==='classic')v=s;if(q==='modern'||q==='classic'){localStorage.setItem('${KEY}',q)}}if(q==='modern'||q==='classic')v=q}catch(e){}` +
  `d.setAttribute('data-design',v)})()`;

/** The design the page is showing (read from <html>, set by the head script). */
export const readDesign = (): Design =>
  typeof document !== "undefined" && document.documentElement.getAttribute("data-design") === "modern" ? "modern" : "classic";

export const defaultDesign = (): Design => BUILT_DESIGN.site_design;
export const switchAllowed = () => BUILT_DESIGN.allow_design_switch;

export function setDesign(d: Design) {
  try { localStorage.setItem(KEY, d); } catch { /* private mode: this visit only */ }
  // a fresh load starts every effect (smooth scroll, reveals, sliders) cleanly in the chosen design
  const u = new URL(window.location.href);
  u.searchParams.delete("design");
  window.location.replace(u.toString());
}

/** Set once the first page has started: later pages (opened inside the site) render only the active design. */
let started = false;

/** null while the first page is hydrating (both versions present), then the design shown. */
function useActiveDesign(): Design | null {
  const [d, setD] = useState<Design | null>(() => (started ? readDesign() : null));
  useEffect(() => { started = true; setD(readDesign()); }, []);
  return d;
}

/**
 * Both versions in the pre-rendered HTML (CSS shows the one <html data-design> names); once the page is running,
 * only the active one stays mounted.
 */
export function Designs({ classic, modern }: { classic: ReactNode; modern: ReactNode }) {
  const d = useActiveDesign();
  return (
    <>
      {(d === null || d === "classic") && <div className="d-classic">{classic}</div>}
      {(d === null || d === "modern") && <div className="d-modern">{modern}</div>}
    </>
  );
}

/** Classic / Modern switch, bottom-left on every public page (hidden when the owner turned switching off). */
export function DesignSwitch() {
  const d = useActiveDesign();
  if (!switchAllowed() || d === null) return null;
  return (
    <div className="design-switch" role="group" aria-label="Website design">
      <span className="design-switch__label">Design</span>
      {(["classic", "modern"] as const).map((v) => (
        <button key={v} type="button" aria-pressed={d === v} onClick={() => d !== v && setDesign(v)}>
          {v === "classic" ? "Classic" : "Modern"}
        </button>
      ))}
    </div>
  );
}
