import { afterAll, expect, test } from "bun:test";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const scratch = mkdtempSync(join(tmpdir(), "onetaskgraph-ui-version-"));
afterAll(() => rmSync(scratch, { recursive: true, force: true }));
mkdirSync(join(scratch, "scripts"));
mkdirSync(join(scratch, "packages/ui"), { recursive: true });
copyFileSync(
  resolve(import.meta.dir, "../set-version.mjs"),
  join(scratch, "scripts/set-version.mjs"),
);
const manifest = join(scratch, "packages/ui/package.json");

function setVersion(...args: string[]) {
  writeFileSync(manifest, JSON.stringify({ name: "@onetaskgraph/ui", version: "0.0.0" }));
  return Bun.spawnSync(["bun", "scripts/set-version.mjs", ...args], { cwd: scratch });
}

test("writes the computed version into the published manifest", () => {
  expect(setVersion("0.1.0").exitCode).toBe(0);
  expect(JSON.parse(readFileSync(manifest, "utf8"))).toEqual({
    name: "@onetaskgraph/ui",
    version: "0.1.0",
  });
});

test.each([[[]], [["next"]], [["1.0"]]])("refuses %j", (args) => {
  const result = setVersion(...args);
  expect(result.exitCode).toBe(1);
  expect(result.stderr.toString()).toContain("RELEASE_VERSION");
  expect(JSON.parse(readFileSync(manifest, "utf8")).version).toBe("0.0.0");
});
