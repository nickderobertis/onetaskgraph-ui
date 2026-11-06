import { useEffect, useLayoutEffect, useRef } from "react";

// useLayoutEffect warns during a server render on React 18, where there is nothing to measure.
const useBrowserLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

/**
 * Marks a clamped body whose table is cut by the clamp. The line clamp skips a table, so only the
 * laid-out body can say that one reaches into its lines and needs an ellipsis of its own. The
 * attribute is one React does not own, so a re-render leaves it be.
 */
export function useClampedTableCut(clamp: number | undefined, source: string) {
  const ref = useRef<HTMLDivElement>(null);
  useBrowserLayoutEffect(() => {
    const root = ref.current;
    if (!root || clamp === undefined) return;
    const measure = () => {
      root.removeAttribute("data-otg-table-cut");
      const table = root.querySelector("table");
      if (!table || root.scrollHeight <= root.clientHeight) return;
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
