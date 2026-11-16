import { useEffect, useState } from "react";

/**
 * TEMPORARY design switch (client review): "classic" is the exact WordPress copy, "modern" layers the PairMediaPro-style
 * header, menu, motion, preloader and buttons on top. The choice lives in this browser only and is applied as
 * `html.design-modern` before the first paint (see DESIGN_HEAD_SCRIPT), so there is no flash. Once the client picks one,
 * delete this file, the switch, and either the modern layer (src/site/modern.tsx + modern.css) or the classic styles.
 */
export type Design = "classic" | "modern";
const KEY = "tplum-design";
const EVENT = "tplum-design-change";

/** Runs in <head> before anything paints. */
export const DESIGN_HEAD_SCRIPT = `try{if(localStorage.getItem('${KEY}')==='modern')document.documentElement.classList.add('design-modern')}catch(e){}`;

export const readDesign = (): Design =>
  typeof document !== "undefined" && document.documentElement.classList.contains("design-modern") ? "modern" : "classic";

export function setDesign(d: Design) {
  try { localStorage.setItem(KEY, d); } catch { /* private mode: applies for this visit only */ }
  // Reload so every component (header, motion, smooth scroll) starts cleanly in the chosen design.
  window.location.reload();
}

/** The current design, available after hydration ("classic" during server render). */
export function useDesign(): Design {
  const [d, setD] = useState<Design>("classic");
  useEffect(() => {
    setD(readDesign());
    const on = () => setD(readDesign());
    window.addEventListener(EVENT, on);
    return () => window.removeEventListener(EVENT, on);
  }, []);
  return d;
}

/** Floating Classic / Modern toggle, bottom-left on every public page. */
export function DesignSwitch() {
  const d = useDesign();
  return (
    <div className="design-switch" role="group" aria-label="Preview design">
      <span className="design-switch__label">Design</span>
      {(["classic", "modern"] as const).map((v) => (
        <button key={v} type="button" aria-pressed={d === v} onClick={() => d !== v && setDesign(v)}>
          {v === "classic" ? "Classic" : "Modern"}
        </button>
      ))}
    </div>
  );
}
