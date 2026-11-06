import { useEffect, useLayoutEffect, useRef } from "react";

// useLayoutEffect warns during a server render on React 18, where there is nothing to measure.
const useBrowserLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

/**
 * Decides, from the laid-out body, which of the stylesheet's two clamped forms applies: only a
 * browser can tell whether a body with gaps between its blocks fits its lines. It writes attributes
 * React does not own, so a re-render leaves them be, and a server render, having no measure, is
 * the overflowing form until this runs.
 */
export function useClampFit(clamp: number | undefined, source: string) {
  const ref = useRef<HTMLDivElement>(null);
  useBrowserLayoutEffect(() => {
    const root = ref.current;
    if (!root || clamp === undefined) return;
    const measure = () => {
      root.removeAttribute("data-otg-table-cut");
      root.setAttribute("data-otg-fits", "");
      if (root.scrollHeight <= root.clientHeight) return;
      root.removeAttribute("data-otg-fits");
      // The line clamp skips a table, so one that reaches into the lines needs its own ellipsis.
      const table = root.querySelector("table");
      if (!table) return;
      const top = table.getBoundingClientRect().top - root.getBoundingClientRect().top;
      root.toggleAttribute("data-otg-table-cut", top < root.clientHeight);
    };
    measure();
    let width = root.clientWidth;
    const observer = new ResizeObserver(() => {
      if (root.clientWidth === width) return;
      width = root.clientWidth;
      measure();
    });
    observer.observe(root);
    // A web font arriving rewraps the body without resizing it.
    let current = true;
    document.fonts?.ready.then(() => {
      if (current) measure();
    });
    return () => {
      current = false;
      observer.disconnect();
    };
  }, [clamp, source]);
  return ref;
}
