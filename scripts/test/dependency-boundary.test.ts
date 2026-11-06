import { afterAll, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dir, "../..");
const scratch = mkdtempSync(join(tmpdir(), "onetaskgraph-ui-boundary-"));
afterAll(() => rmSync(scratch, { recursive: true, force: true }));

function check(...args: string[]) {
  const result = Bun.spawnSync(["node", "scripts/check-ui-dependencies.mjs", ...args], {
    cwd: root,
  });
  return { status: result.exitCode, stderr: result.stderr.toString() };
}

function checkManifest(manifest: unknown) {
  const path = join(scratch, "package.json");
  writeFileSync(path, JSON.stringify(manifest));
  return check(path);
}

test("the real manifest names nothing from onepipeline", () => {
  expect(check()).toEqual({ status: 0, stderr: "" });
});

test.each([
  ["dependencies", "onepipeline-ui"],
  ["dependencies", "@onepipeline-ui/view"],
  ["devDependencies", "@onepipeline/cli"],
  ["peerDependencies", "onepipeline-cli"],
  ["optionalDependencies", "onepipeline"],
])("%s naming %s is refused", (field, name) => {
  const result = checkManifest({ [field]: { react: "^19", [name]: "^1.0.0" } });
  expect(result.status).toBe(1);
  expect(result.stderr).toContain(`${field}: ${name}@^1.0.0`);
  expect(result.stderr).not.toContain("react");
});

test("an alias resolving to onepipeline is refused", () => {
  const result = checkManifest({ dependencies: { view: "npm:@onepipeline-ui/view@1" } });
  expect(result.status).toBe(1);
  expect(result.stderr).toContain("view@npm:@onepipeline-ui/view@1");
});

test("a manifest without it passes", () => {
  expect(checkManifest({ dependencies: { react: "^19" } }).status).toBe(0);
});

test("an unreadable manifest is an error, not a pass", () => {
  const result = check(join(scratch, "missing.json"));
  expect(result.status).toBe(2);
  expect(result.stderr).toContain("cannot read");
});
