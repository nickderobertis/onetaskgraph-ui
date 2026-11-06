import { afterAll, beforeAll, expect, test } from "bun:test";
import { cpSync, mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { type Browser, chromium, type Locator, type Page } from "playwright";
import { PNG } from "pngjs";
import { installConsumer, removeConsumer } from "./consumer";

const fixture = resolve(import.meta.dir, "../fixture");
const fontFile = resolve(
  import.meta.dir,
  "../node_modules/@fontsource/actor/files/actor-latin-400-normal.woff2",
);

let consumer: string;
let server: ReturnType<typeof Bun.serve>;
let browser: Browser;
let page: Page;
const requested: string[] = [];
const pageProblems: string[] = [];

beforeAll(async () => {
  consumer = installConsumer();
  cpSync(join(fixture, "page.jsx"), join(consumer, "page.jsx"));
  const site = join(consumer, "site");
  mkdirSync(site);
  cpSync(join(fixture, "page.html"), join(site, "index.html"));
  cpSync(fontFile, join(site, "actor.woff2"));
  const bundle = await Bun.build({
    entrypoints: [join(consumer, "page.jsx")],
    outdir: site,
    target: "browser",
    define: { "process.env.NODE_ENV": '"production"' },
  });
  if (!bundle.success) throw new Error(`bundling the page failed: ${bundle.logs.join("\n")}`);

  server = Bun.serve({
    port: 0,
    hostname: "127.0.0.1",
    async fetch(request) {
      const { pathname } = new URL(request.url);
      requested.push(pathname);
      const file = Bun.file(join(site, pathname === "/" ? "index.html" : pathname));
      return (await file.exists()) ? new Response(file) : new Response("", { status: 404 });
    },
  });
  browser = await chromium.launch();
  page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on("pageerror", (error) => pageProblems.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") pageProblems.push(message.text());
  });
  await page.goto(server.url.href);
  await page.locator("[data-section=workload] article").first().waitFor();
  await page.evaluate(() => document.fonts.ready);
});

afterAll(async () => {
  await browser?.close();
  await server?.stop(true);
  if (consumer) removeConsumer(consumer);
});

type Escape = { card: string; what: string };

/** Everything inside a card, boxes and lines of text alike, that sits outside the card's box. */
function escapesFromCards(): Promise<Escape[]> {
  return page.evaluate(() => {
    const SLACK = 0.5;
    const found: Escape[] = [];
    for (const card of document.querySelectorAll("[data-section=workload] article")) {
      const bounds = card.getBoundingClientRect();
      const check = (rect: DOMRect, what: string, clampedAway: boolean) => {
        const sideways = rect.left < bounds.left - SLACK || rect.right > bounds.right + SLACK;
        // A clamped body's hidden lines lie below it by design; the clamped root itself must not.
        const vertical = rect.top < bounds.top - SLACK || rect.bottom > bounds.bottom + SLACK;
        if (sideways || (vertical && !clampedAway)) {
          found.push({ card: card.getAttribute("data-card") ?? "", what });
        }
      };
      for (const element of card.querySelectorAll("*")) {
        const clampedAway = element.closest(".otg-markdown--clamped") !== null;
        check(
          element.getBoundingClientRect(),
          element.tagName,
          clampedAway && element.className !== "otg-markdown otg-markdown--clamped",
        );
      }
      const walker = document.createTreeWalker(card, NodeFilter.SHOW_TEXT);
      while (walker.nextNode()) {
        const text = walker.currentNode;
        const range = document.createRange();
        range.selectNodeContents(text);
        const clampedAway = text.parentElement?.closest(".otg-markdown--clamped") !== null;
        for (const rect of range.getClientRects()) {
          check(rect, `text "${text.textContent?.slice(0, 30)}"`, clampedAway);
        }
      }
      if (card.scrollWidth > card.clientWidth) {
        found.push({ card: card.getAttribute("data-card") ?? "", what: "the card scrolls" });
      }
    }
    return found;
  });
}

type Box = { left: number; right: number; top: number; bottom: number };

async function box(locator: Locator): Promise<Box> {
  const rect = await locator.boundingBox();
  if (!rect) throw new Error(`no box for ${locator}`);
  return {
    left: rect.x,
    right: rect.x + rect.width,
    top: rect.y,
    bottom: rect.y + rect.height,
  };
}

const card = (id: string) => page.locator(`[data-card="${id}"]`);
const actionsOf = (id: string) => card(id).locator("[data-slot=actions]");
const badgesOf = (id: string) => card(id).locator("[data-slot=badges]");
const titleOf = (id: string) => card(id).locator("h3");
const rendering = (name: string) => page.locator(`[data-rendering="${name}"]`);

/** The first one shares the second's row when it starts at or above where the second ends. */
function sharesRow(first: Box, second: Box) {
  return first.top < second.bottom && second.top < first.bottom;
}

for (const width of [390, 1440]) {
  test(`at ${width} wide, nothing leaves any of the six cards and their section does not scroll sideways`, async () => {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.locator("[data-section=workload] article").count()).toBe(6);
    expect(await escapesFromCards()).toEqual([]);
    const sectionWidth = await page.evaluate(() => {
      const workload = document.querySelector("[data-section=workload]");
      return workload?.scrollWidth ?? Number.POSITIVE_INFINITY;
    });
    expect(sectionWidth).toBeLessThanOrEqual(width);
  });

  test(`at ${width} wide, badges and actions keep their places beside a long title`, async () => {
    await page.setViewportSize({ width, height: 900 });
    const id = "workload-1";
    const [badges, title, actions, bounds] = await Promise.all([
      box(badgesOf(id)),
      box(titleOf(id)),
      box(actionsOf(id)),
      box(card(id)),
    ]);
    expect(badges.right).toBeLessThanOrEqual(title.left);
    expect(sharesRow(badges, title)).toBe(true);
    if (width === 1440) {
      expect(actions.left).toBeGreaterThanOrEqual(title.right);
      expect(sharesRow(actions, title)).toBe(true);
      expect(actions.right).toBeLessThanOrEqual(bounds.right);
    } else {
      expect(actions.top).toBeGreaterThanOrEqual(title.bottom);
    }
  });
}

test("at one viewport width, the actions follow the card's own width, across 560px", async () => {
  await page.setViewportSize({ width: 1440, height: 900 });
  for (const [width, ownRow] of [
    [800, false],
    [560, false],
    [559, true],
    [400, true],
  ] as const) {
    const id = `width-${width}`;
    expect((await box(card(id))).right - (await box(card(id))).left).toBe(width);
    const [title, actions] = await Promise.all([box(titleOf(id)), box(actionsOf(id))]);
    if (ownRow) {
      expect(actions.top).toBeGreaterThanOrEqual(title.bottom);
    } else {
      expect(sharesRow(actions, title)).toBe(true);
      expect(actions.left).toBeGreaterThanOrEqual(title.right);
    }
  }
});

test("the article is exposed to assistive technology under its title", async () => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const article = page.getByRole("article", { name: "A card 800 wide" });
  expect(await article.getAttribute("data-card")).toBe("width-800");
  const link = article.getByRole("link", { name: "Open GitHub issue #width-800" });
  expect(await link.getAttribute("target")).toBe("_blank");
});

/** One row of RGBA pixels per screenshot row, so two screenshots compare a row at a time. */
function rowsOf(screenshot: Buffer) {
  const { data, width, height } = PNG.sync.read(screenshot);
  const rows = Array.from({ length: height }, (_, row) =>
    data.subarray(row * width * 4, (row + 1) * width * 4),
  );
  return { width, height, rows };
}

function rowsMatch(
  a: ReturnType<typeof rowsOf>,
  b: ReturnType<typeof rowsOf>,
  from: number,
  to: number,
) {
  for (let row = from; row < to; row += 1) {
    const [first, second] = [a.rows[row], b.rows[row]];
    if (!first || !second || !first.equals(second)) return false;
  }
  return true;
}

async function lineHeightOf(name: string) {
  return page.evaluate((selector) => {
    const root = document.querySelector(`${selector} .otg-markdown`);
    return Number.parseFloat(root ? getComputedStyle(root).lineHeight : "");
  }, `[data-rendering="${name}"]`);
}

async function screenshotClippedTo(name: string, height: number) {
  const target = rendering(name);
  await target.evaluate((element, clip) => {
    (element as HTMLElement).style.height = `${clip}px`;
    (element as HTMLElement).style.overflow = "hidden";
  }, height);
  const screenshot = await target.screenshot();
  await target.evaluate((element) => {
    (element as HTMLElement).style.removeProperty("height");
    (element as HTMLElement).style.removeProperty("overflow");
  });
  return screenshot;
}

/**
 * The clamped body against the same body unclamped at the same width, inside a wrapper this journey
 * clips to four lines. Merely clipping the body, or clipping the ellipsis away, leaves the fourth
 * line matching; spacing that differs between the two leaves the first three lines apart.
 */
for (const body of [
  "long",
  "mixed",
  "table",
  "text-then-table",
  "long-then-table",
  "four-then-table",
  "three-then-table",
  "rich",
]) {
  test(`a clamp of four lines limits the ${body} body and ends it in a visible ellipsis`, async () => {
    await page.setViewportSize({ width: 1440, height: 900 });
    const lineHeight = await lineHeightOf(`${body}-clamped`);
    expect(lineHeight).toBe(24);
    const clampedBox = await box(rendering(`${body}-clamped`));
    expect(clampedBox.bottom - clampedBox.top).toBe(4 * lineHeight);

    const clamped = rowsOf(await rendering(`${body}-clamped`).screenshot());
    const clipped = rowsOf(await screenshotClippedTo(`${body}-unclamped`, 4 * lineHeight));
    expect([clamped.width, clamped.height]).toEqual([clipped.width, clipped.height]);
    expect(rowsMatch(clamped, clipped, 0, 3 * lineHeight)).toBe(true);
    expect(rowsMatch(clamped, clipped, 3 * lineHeight, 4 * lineHeight)).toBe(false);
  });
}

test("a body shorter than the clamp shows whole and matches its unclamped screenshot", async () => {
  await page.setViewportSize({ width: 1440, height: 900 });
  for (const body of ["short", "blocks", "short-table"]) {
    const clamped = await rendering(`${body}-clamped`).screenshot();
    const unclamped = await rendering(`${body}-unclamped`).screenshot();
    expect(clamped.equals(unclamped)).toBe(true);
  }
});

test("a body clamped short of its table keeps the table's rows and cells", async () => {
  await page.setViewportSize({ width: 1440, height: 900 });
  for (const body of ["short-table", "table", "text-then-table"]) {
    const display = await rendering(`${body}-clamped`)
      .locator("td")
      .first()
      .evaluate((cell) => getComputedStyle(cell).display);
    expect(display).toBe("table-cell");
  }
});

test("a narrower container clamps a body that fitted a wider one", async () => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const target = rendering("short-clamped");
  const fitsWhole = await box(target);
  expect(fitsWhole.bottom - fitsWhole.top).toBeLessThan(4 * 24);
  await target.evaluate((element) => {
    (element as HTMLElement).style.width = "60px";
  });
  await page.waitForFunction(
    () =>
      document.querySelector('[data-rendering="short-clamped"]')?.getBoundingClientRect().height ===
      96,
  );
  await target.evaluate((element) => (element as HTMLElement).style.removeProperty("width"));
  await page.waitForFunction(
    (height) =>
      document.querySelector('[data-rendering="short-clamped"]')?.getBoundingClientRect().height ===
      height,
    fitsWhole.bottom - fitsWhole.top,
  );
});

test("an unclamped longer body shows every line", async () => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const lineHeight = await lineHeightOf("long-unclamped");
  const lines = await rendering("long-unclamped").evaluate((element) => {
    const range = document.createRange();
    range.selectNodeContents(element.querySelector("p")?.firstChild as Node);
    return new Set([...range.getClientRects()].map((rect) => Math.round(rect.top))).size;
  });
  expect(lines).toBeGreaterThan(4);
  const whole = await box(rendering("long-unclamped"));
  expect(whole.bottom - whole.top).toBe(lines * lineHeight);
});

test("bodies filling their lines exactly lose nothing to the clamp", async () => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const clamped = await box(rendering("four-blocks-clamped"));
  expect(clamped.bottom - clamped.top).toBe(4 * 24);
  const overshoot = await rendering("four-blocks-clamped").evaluate((element) => {
    const root = element.querySelector(".otg-markdown") as HTMLElement;
    const last = root.lastElementChild?.getBoundingClientRect();
    return (last?.bottom ?? Number.POSITIVE_INFINITY) - root.getBoundingClientRect().bottom;
  });
  expect(overshoot).toBeLessThanOrEqual(0);
});

test("the same words bold and regular differ, in a font with no bold face", async () => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const synthesis = await page.evaluate(
    () => getComputedStyle(document.documentElement).fontSynthesisWeight,
  );
  expect(synthesis).toBe("none");
  const bold = await rendering("bold").screenshot();
  const regular = await rendering("regular").screenshot();
  expect(bold.equals(regular)).toBe(false);
});

test("untrusted markdown runs no script and fetches no image", async () => {
  const view = rendering("untrusted");
  expect(await page.evaluate(() => "pwned" in window)).toBe(false);
  expect(await view.locator("script, img, [onclick], [onerror]").count()).toBe(0);
  expect(requested.filter((path) => path.startsWith("/remote/"))).toEqual([]);
  const tracking = view.getByRole("link", { name: "tracking pixel" });
  expect(await tracking.getAttribute("href")).toEndWith("/remote/markdown.png");
  expect(await view.getByRole("link", { name: "badge" }).getAttribute("href")).toBe(
    "https://example.org/linked",
  );
});

test("the custom properties theme the card and an unset one falls back to its default", async () => {
  const link = page.getByRole("link", { name: "tracking pixel" });
  const colourOf = () => link.evaluate((element) => getComputedStyle(element).color);
  const before = await colourOf();
  expect(before).toBe("rgb(37, 99, 235)");
  await page.evaluate(() =>
    document.documentElement.style.setProperty("--otg-accent", "rgb(1, 2, 3)"),
  );
  expect(await colourOf()).toBe("rgb(1, 2, 3)");
  await page.evaluate(() => document.documentElement.style.removeProperty("--otg-accent"));
});

test("the page rendered with no error or console error", () => {
  expect(pageProblems).toEqual([]);
});
