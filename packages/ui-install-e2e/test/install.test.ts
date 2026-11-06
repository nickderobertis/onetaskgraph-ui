import { afterAll, beforeAll, expect, test } from "bun:test";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { installConsumer, removeConsumer, run } from "./consumer";

let consumer: string;

function runInConsumer(source: string) {
  writeFileSync(join(consumer, "probe.mjs"), source);
  return run("node", ["probe.mjs"], consumer);
}

beforeAll(() => {
  consumer = installConsumer();
});

afterAll(() => removeConsumer(consumer));

test("TaskMarkdown server-renders a GFM table through its declared dependencies", () => {
  const result = runInConsumer(`
    import { createElement } from "react";
    import { renderToStaticMarkup } from "react-dom/server";
    import { TaskMarkdown } from "@onetaskgraph/ui";
    const source = "| Region | State |\\n| --- | --- |\\n| eu-west | **done** |";
    console.log(renderToStaticMarkup(createElement(TaskMarkdown, { source })));
  `);
  expect(result.stderr).toBe("");
  expect(result.status).toBe(0);
  expect(result.stdout).toMatch(
    /<table>[\s\S]*<th>Region<\/th>[\s\S]*<td><strong>done<\/strong><\/td>/,
  );
});

test("TaskCard server-renders its article, title and markdown body", () => {
  const result = runInConsumer(`
    import { createElement } from "react";
    import { renderToStaticMarkup } from "react-dom/server";
    import { TaskCard, TaskSourceLink } from "@onetaskgraph/ui";
    console.log(renderToStaticMarkup(createElement(TaskCard, {
      title: "Ship it",
      body: "See https://example.org/plan",
      links: createElement(TaskSourceLink, { url: "https://linear.app/t/T-1", label: "T-1" }),
      "data-task": "T-1",
    })));
  `);
  expect(result.stderr).toBe("");
  expect(result.status).toBe(0);
  const titleId = result.stdout.match(/<article[^>]*aria-labelledby="([^"]+)"/)?.[1];
  expect(titleId).toBeTruthy();
  expect(result.stdout).toContain(`<h3 class="otg-card__title" id="${titleId}">Ship it</h3>`);
  expect(result.stdout).toContain('data-task="T-1"');
  expect(result.stdout).toContain('aria-label="Open Linear issue T-1"');
  expect(result.stdout).toContain(
    '<a href="https://example.org/plan" target="_blank" rel="noopener noreferrer">',
  );
});

test("styles.css resolves through its export to a real stylesheet", () => {
  const result = runInConsumer(`
    import { readFileSync } from "node:fs";
    import { fileURLToPath } from "node:url";
    const path = fileURLToPath(import.meta.resolve("@onetaskgraph/ui/styles.css"));
    console.log(path);
    console.log(readFileSync(path, "utf8"));
  `);
  expect(result.stderr).toBe("");
  expect(result.stdout).toContain(
    join("node_modules", "@onetaskgraph", "ui", "dist", "styles.css"),
  );
  expect(result.stdout).toContain(".otg-card");
  expect(result.stdout).toContain(".otg-markdown");
});

test("the declared types ship in the tarball", () => {
  const result = runInConsumer(`
    import { createRequire } from "node:module";
    import { existsSync } from "node:fs";
    import { dirname, join } from "node:path";
    import { fileURLToPath } from "node:url";
    const manifestPath = fileURLToPath(import.meta.resolve("@onetaskgraph/ui/package.json"));
    const manifest = createRequire(import.meta.url)(manifestPath);
    console.log(String(existsSync(join(dirname(manifestPath), manifest.exports["."].types))));
  `);
  expect(result.stderr).toBe("");
  expect(result.stdout.trim()).toBe("true");
});

test("a path the package does not export is refused", () => {
  const result = runInConsumer(`import "@onetaskgraph/ui/dist/index.mjs";`);
  expect(result.status).not.toBe(0);
  expect(result.stderr).toContain("ERR_PACKAGE_PATH_NOT_EXPORTED");
});
