import { afterEach } from "bun:test";
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";

const mounted: { root: Root; container: HTMLElement }[] = [];

/** Mounts `node` through react-dom into the document and answers its container. */
export function render(node: ReactNode): HTMLElement {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  act(() => root.render(node));
  mounted.push({ root, container });
  return container;
}

afterEach(() => {
  for (const { root, container } of mounted.splice(0)) {
    act(() => root.unmount());
    container.remove();
  }
});

/** The one element `selector` matches, failing the test by name when there is none. */
export function only<E extends Element = HTMLElement>(parent: ParentNode, selector: string): E {
  const matches = parent.querySelectorAll<E>(selector);
  if (matches.length !== 1) {
    throw new Error(`expected one ${selector}, found ${matches.length}`);
  }
  return matches[0] as E;
}
