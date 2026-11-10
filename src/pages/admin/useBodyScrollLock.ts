import { useEffect } from "react";

/**
 * Lock body scrolling while a modal is open. Without this, mouse-wheel
 * events at the edge of a modal bubble up and scroll the page underneath
 * instead of the modal content.
 */
export function useBodyScrollLock(active: boolean) {
  useEffect(() => {
    if (!active || typeof document === "undefined") return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [active]);
}