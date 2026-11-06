import { afterEach, beforeEach, expect, test } from "bun:test";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { TaskMarkdown } from "../src";
import { only, render } from "./render";

// happy-dom lays nothing out, so these tests hand the hook the numbers a browser would. They hold
// its decisions and its re-measuring; ui-install-e2e's browser journey proves the layout itself.
type Layout = { scrollHeight: number; clientHeight: number; clientWidth: number; tableTop: number };
let layout: Layout;
let observers: { callback: () => void; disconnected: boolean }[];
let fontsReady: () => void;

const realResizeObserver = globalThis.ResizeObserver;
const realFonts = document.fonts;
const realTableRect = HTMLElement.prototype.getBoundingClientRect;
const LAYOUT_KEYS = ["scrollHeight", "clientHeight", "clientWidth"] as const;

beforeEach(() => {
  layout = { scrollHeight: 50, clientHeight: 96, clientWidth: 400, tableTop: 0 };
  observers = [];
  for (const key of LAYOUT_KEYS) {
    Object.defineProperty(HTMLElement.prototype, key, {
      configurable: true,
      get: () => layout[key],
    });
  }
  HTMLElement.prototype.getBoundingClientRect = function (this: HTMLElement) {
    return { top: this.tagName === "TABLE" ? layout.tableTop : 0 } as DOMRect;
  };
  globalThis.ResizeObserver = class {
    entry: { callback: () => void; disconnected: boolean };
    constructor(callback: () => void) {
      this.entry = { callback, disconnected: false };
      observers.push(this.entry);
    }
    observe() {}
    unobserve() {}
    disconnect() {
      this.entry.disconnected = true;
    }
  } as unknown as typeof ResizeObserver;
  const ready = new Promise<void>((resolve) => {
    fontsReady = resolve;
  });
  Object.defineProperty(document, "fonts", { configurable: true, value: { ready } });
});

afterEach(() => {
  for (const key of LAYOUT_KEYS) delete (HTMLElement.prototype as Partial<HTMLElement>)[key];
  HTMLElement.prototype.getBoundingClientRect = realTableRect;
  globalThis.ResizeObserver = realResizeObserver;
  Object.defineProperty(document, "fonts", { configurable: true, value: realFonts });
});

const TABLE = "| a |\n| --- |\n| b |";

function clamped(source: string) {
  return only(render(<TaskMarkdown source={source} clamp={4} />), ".otg-markdown");
}

function resize(width: number) {
  layout.clientWidth = width;
  for (const { callback } of observers) callback();
}

test("a body that fits is marked as fitting", () => {
  expect(clamped("words").hasAttribute("data-otg-fits")).toBe(true);
});

test("a body that overflows is not, and without a table it needs no table ellipsis", () => {
  layout.scrollHeight = 200;
  const root = clamped("words");
  expect(root.hasAttribute("data-otg-fits")).toBe(false);
  expect(root.hasAttribute("data-otg-table-cut")).toBe(false);
});

test("an overflowing body's table is cut only when it reaches into the lines", () => {
  layout.scrollHeight = 200;
  layout.tableTop = 24;
  expect(clamped(TABLE).hasAttribute("data-otg-table-cut")).toBe(true);
  layout.tableTop = 96;
  expect(clamped(TABLE).hasAttribute("data-otg-table-cut")).toBe(false);
});

test("a change of width decides again, and a change of height alone does not", () => {
  const root = clamped("words");
  layout.scrollHeight = 200;
  resize(400);
  expect(root.hasAttribute("data-otg-fits")).toBe(true);
  resize(100);
  expect(root.hasAttribute("data-otg-fits")).toBe(false);
});

test("a font arriving decides again", async () => {
  const root = clamped("words");
  layout.scrollHeight = 200;
  await act(async () => {
    fontsReady();
    await document.fonts.ready;
  });
  expect(root.hasAttribute("data-otg-fits")).toBe(false);
});

test("a font arriving after the body has gone changes nothing", async () => {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  act(() => root.render(<TaskMarkdown source="words" clamp={4} />));
  const body = only(container, ".otg-markdown");
  act(() => root.unmount());
  expect(observers.map(({ disconnected }) => disconnected)).toEqual([true]);
  layout.scrollHeight = 200;
  await act(async () => {
    fontsReady();
    await document.fonts.ready;
  });
  expect(body.hasAttribute("data-otg-fits")).toBe(true);
  container.remove();
});

test("a new source decides again, and the old observer is let go", () => {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  act(() => root.render(<TaskMarkdown source="short" clamp={4} />));
  const body = only(container, ".otg-markdown");
  expect(body.hasAttribute("data-otg-fits")).toBe(true);
  layout.scrollHeight = 200;
  act(() => root.render(<TaskMarkdown source="now far longer" clamp={4} />));
  expect(body.hasAttribute("data-otg-fits")).toBe(false);
  expect(observers.map(({ disconnected }) => disconnected)).toEqual([true, false]);
  act(() => root.unmount());
  container.remove();
});

test("an unclamped body measures nothing", () => {
  const root = only(render(<TaskMarkdown source="words" />), ".otg-markdown");
  expect(root.hasAttribute("data-otg-fits")).toBe(false);
  expect(observers).toHaveLength(0);
});
