import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { TaskMarkdown } from "../src";
import { only, render } from "./render";

function markdown(source: string) {
  return render(<TaskMarkdown source={source} />);
}

test("a table renders as table elements", () => {
  const view = markdown("| Region | State |\n| --- | --- |\n| eu-west | done |");
  expect(only(view, "table th:first-child").textContent).toBe("Region");
  expect(only(view, "table tbody td:last-child").textContent).toBe("done");
});

test("a bare URL renders as a link", () => {
  const link = only<HTMLAnchorElement>(markdown("See https://example.org/plan today"), "a");
  expect(link.getAttribute("href")).toBe("https://example.org/plan");
  expect(link.textContent).toBe("https://example.org/plan");
});

test("bold, a list and strikethrough render as elements", () => {
  const view = markdown("**heavy** and ~~gone~~\n\n- one\n- two");
  expect(only(view, "strong").textContent).toBe("heavy");
  expect(only(view, "del").textContent).toBe("gone");
  expect([...view.querySelectorAll("ul > li")].map((item) => item.textContent)).toEqual([
    "one",
    "two",
  ]);
});

test("a task list renders as checkboxes in their checked states", () => {
  const view = markdown("- [x] done\n- [ ] open");
  const boxes = [...view.querySelectorAll<HTMLInputElement>("li input")];
  expect(boxes.map((box) => box.getAttribute("type"))).toEqual(["checkbox", "checkbox"]);
  expect(boxes.map((box) => box.checked)).toEqual([true, false]);
  expect(boxes.every((box) => box.disabled)).toBe(true);
});

test.each([
  ["<script>", "<script>window.pwned = 1</script>", "script"],
  ["<img onerror>", '<img src="x" onerror="window.pwned = 1">', "img"],
  [
    "inline onclick",
    '<a href="https://example.org" onclick="window.pwned = 1">go</a>',
    "[onclick]",
  ],
  ["inline span onclick", 'before <span onclick="window.pwned = 1">x</span> after', "[onclick]"],
])("raw HTML: %s produces no such element or attribute", (_name, source, selector) => {
  const view = markdown(source);
  expect(view.querySelector(selector)).toBeNull();
  expect(view.querySelector("[href]")).toBeNull();
  expect(view.textContent).toContain("window.pwned");
});

const UNSAFE_URLS = [
  "javascript:alert(1)",
  "JaVaScRiPt:alert(1)",
  "data:text/html,boom",
  "vbscript:msgbox(1)",
  "file:///etc/passwd",
  "ftp://example.org/a",
];

test.each(UNSAFE_URLS)("a link to %s shows its text with no href", (url) => {
  const view = markdown(`[the words](<${url}>)`);
  expect(view.textContent).toContain("the words");
  expect(view.querySelector("[href]")).toBeNull();
  expect(view.querySelector("[target]")).toBeNull();
});

test.each(["/a/page/path", "#fragment", "./sibling"])(
  "a relative link to %s has no protocol to keep, so it shows as text",
  (url) => {
    const view = markdown(`[the words](${url})`);
    expect(view.textContent).toContain("the words");
    expect(view.querySelector("[href]")).toBeNull();
  },
);

test.each(["http://example.org/a", "https://example.org/a", "mailto:someone@example.org"])(
  "a link to %s keeps it and opens in a new tab",
  (url) => {
    const link = only(markdown(`[the words](${url})`), "a");
    expect(link.getAttribute("href")).toBe(url);
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toBe("noopener noreferrer");
    expect(link.textContent).toBe("the words");
  },
);

test("a remote image is a link to its source under its alt text", () => {
  const view = markdown("![the chart](https://example.org/chart.png)");
  expect(view.querySelector("img")).toBeNull();
  const link = only(view, "a");
  expect(link.getAttribute("href")).toBe("https://example.org/chart.png");
  expect(link.getAttribute("target")).toBe("_blank");
  expect(link.getAttribute("rel")).toBe("noopener noreferrer");
  expect(link.textContent).toBe("the chart");
});

test("a remote image with no alt text is a link under the word image", () => {
  const view = markdown("![](https://example.org/chart.png)");
  expect(view.querySelector("img")).toBeNull();
  expect(only(view, "a").textContent).toBe("image");
});

test.each(["javascript:alert(1)", "data:image/png;base64,AAAA", "file:///etc/passwd"])(
  "an image from %s has no img element and no href",
  (url) => {
    const view = markdown(`![the chart](<${url}>)`);
    expect(view.querySelector("img")).toBeNull();
    expect(view.querySelector("[href]")).toBeNull();
    expect(view.textContent).toContain("the chart");
  },
);

test("an image inside a link becomes that link's text, since a link cannot hold a link", () => {
  const view = markdown("[![build](https://example.org/b.svg)](https://example.org/ci)");
  expect(view.querySelector("img")).toBeNull();
  const link = only(view, "a");
  expect(link.getAttribute("href")).toBe("https://example.org/ci");
  expect(link.textContent).toBe("build");
});

test("an alt-less image nested deeper in a link reads as the word image", () => {
  const view = markdown("[**![](https://example.org/b.svg)**](https://example.org/ci)");
  expect(only(view, "a strong").textContent).toBe("image");
});

test("clamp sets the line count on the root, and no clamp sets none", () => {
  const clamped = only(render(<TaskMarkdown source="words" clamp={4} />), ".otg-markdown");
  expect(clamped.classList.contains("otg-markdown--clamped")).toBe(true);
  expect(renderToStaticMarkup(<TaskMarkdown source="words" clamp={4} />)).toContain(
    "-webkit-line-clamp:4",
  );
  const whole = only(markdown("words"), ".otg-markdown");
  expect(whole.classList.contains("otg-markdown--clamped")).toBe(false);
  expect(whole.getAttribute("style")).toBeNull();
});

test.each([0, -1, 1.5, Number.NaN])(
  "a clamp of %d is not a number of lines, so it shows all",
  (clamp) => {
    const root = only(render(<TaskMarkdown source="words" clamp={clamp} />), ".otg-markdown");
    expect(root.classList.contains("otg-markdown--clamped")).toBe(false);
  },
);

test("a clamped body is limited inline to its lines", () => {
  const view = render(<TaskMarkdown source="words" clamp={4} />);
  expect(only(view, ".otg-markdown").style.maxHeight).toBe("calc(4 * 1lh)");
});

test("a server render of a clamped body is the overflowing form until measured", () => {
  const markup = renderToStaticMarkup(<TaskMarkdown source="words" clamp={4} />);
  expect(markup).toContain("otg-markdown--clamped");
  expect(markup).not.toContain("data-otg-fits");
});
