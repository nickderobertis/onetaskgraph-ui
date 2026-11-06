import { afterAll, beforeAll, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative, resolve } from "node:path";

const repository = resolve(import.meta.dir, "../../..");
let consumer: string;

function run(command: string, args: string[], cwd: string) {
  const result = spawnSync(command, args, { cwd, encoding: "utf8" });
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

function runInConsumer(source: string) {
  writeFileSync(join(consumer, "probe.mjs"), source);
  return run("node", ["probe.mjs"], consumer);
}

beforeAll(() => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "onetaskgraph-ui-consumer-")));
  consumer = join(root, "consumer");
  mkdirSync(consumer);
  if (!relative(repository, consumer).startsWith("..")) {
    throw new Error(`the consumer must sit outside the repository; TMPDIR put it at ${consumer}`);
  }

  const pack = run(
    "npm",
    ["pack", "--json", "--pack-destination", root],
    join(repository, "packages/ui"),
  );
  if (pack.status !== 0) throw new Error(`npm pack failed; run just build-ui: ${pack.stderr}`);
  const [report] = JSON.parse(pack.stdout);

  writeFileSync(
    join(consumer, "package.json"),
    JSON.stringify({ name: "consumer", private: true, type: "module" }),
  );
  const install = run(
    "npm",
    ["install", "--no-audit", "--no-fund", join(root, report.filename)],
    consumer,
  );
  if (install.status !== 0) throw new Error(`npm install failed: ${install.stderr}`);
});

afterAll(() => {
  rmSync(resolve(consumer, ".."), { recursive: true, force: true });
});

test("the main entry resolves through its export and renders", () => {
  const result = runInConsumer(`
    import { createElement } from "react";
    import { renderToStaticMarkup } from "react-dom/server";
    import { TaskPlaceholder } from "@onetaskgraph/ui";
    console.log(renderToStaticMarkup(createElement(TaskPlaceholder, { title: "Ship it" })));
  `);
  expect(result.stderr).toBe("");
  expect(result.stdout.trim()).toBe('<article class="otg-task">Ship it</article>');
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
  expect(result.stdout).toContain(".otg-task");
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
