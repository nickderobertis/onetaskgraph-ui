import { expect, mock, test } from "bun:test";
import { act } from "react";
import { TaskSourceLink, taskSourceProvider } from "../src";
import { only, render } from "./render";

const PROVIDERS = [
  ["https://github.com/o/r/issues/1", "GitHub", true],
  ["https://linear.app/acme/issue/T-1", "Linear", true],
  ["https://jira.example.org/browse/T-1", "tracker", true],
  ["not a url", "tracker", false],
] as const;

test.each(PROVIDERS)("%s belongs to %s, and its link says so", (url, provider, linkable) => {
  expect(taskSourceProvider(url)).toBe(provider);
  const link = only(render(<TaskSourceLink url={url} label="T-1" />), "a");
  expect(link.getAttribute("aria-label")).toBe(`Open ${provider} issue T-1`);
  expect(link.textContent).toBe("T-1");
  expect(link.getAttribute("target")).toBe("_blank");
  expect(link.getAttribute("rel")).toBe("noopener noreferrer");
  expect(link.getAttribute("href")).toBe(linkable ? url : null);
});

test.each([
  "https://github.com.example.org/a",
  "https://notgithub.com/a",
  "https://gist.github.com/a",
  "https://linear.app.example.org/a",
  "https://example.org/github.com/linear.app",
])("%s only contains a provider's name, so it is a tracker", (url) => {
  expect(taskSourceProvider(url)).toBe("tracker");
});

test("a hostname is matched as a browser reads it, whatever its case", () => {
  expect(taskSourceProvider("https://GitHub.COM/a")).toBe("GitHub");
});

test.each([
  "javascript:alert(1)",
  "JaVaScRiPt:alert(1)",
  " java\tscript:alert(1)",
  "data:text/html,boom",
  "/relative/path",
])("a link to %j has no href", (url) => {
  expect(only(render(<TaskSourceLink url={url} label="T-1" />), "a").hasAttribute("href")).toBe(
    false,
  );
});

test("other attributes reach the anchor, and a pressed link calls its handler", () => {
  const onClick = mock((event: { preventDefault(): void }) => event.preventDefault());
  const link = only(
    render(
      <TaskSourceLink
        url="https://github.com/o/r/issues/1"
        label="#1"
        tabIndex={-1}
        data-card-action="true"
        className="mine"
        onClick={onClick}
      />,
    ),
    "a",
  );
  expect(link.getAttribute("tabindex")).toBe("-1");
  expect(link.getAttribute("data-card-action")).toBe("true");
  expect(link.classList.contains("mine")).toBe(true);
  expect(link.classList.contains("otg-source-link")).toBe(true);
  act(() => link.click());
  expect(onClick).toHaveBeenCalledTimes(1);
});

test("a consumer may name the link itself", () => {
  const link = only(
    render(<TaskSourceLink url="https://github.com/o/r/1" label="#1" aria-label="The thread" />),
    "a",
  );
  expect(link.getAttribute("aria-label")).toBe("The thread");
});

test("attributes the type forbids cannot reach the anchor from untyped callers", () => {
  const smuggled = { href: "javascript:alert(1)", target: "_self", rel: "opener" };
  const link = only(
    render(<TaskSourceLink url="https://github.com/o/r/1" label="#1" {...smuggled} />),
    "a",
  );
  expect(link.getAttribute("href")).toBe("https://github.com/o/r/1");
  expect(link.getAttribute("target")).toBe("_blank");
  expect(link.getAttribute("rel")).toBe("noopener noreferrer");
});
