import { afterAll, beforeAll, expect, test } from "bun:test";
import { accessSync, constants, existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dir, "../..");
const TARGET = "npm:@onetaskgraph/ui";

let respond: () => Response = () => new Response("", { status: 404 });
let registry: ReturnType<typeof Bun.serve>;
const requests: string[] = [];

beforeAll(() => {
  registry = Bun.serve({
    port: 0,
    fetch(request) {
      requests.push(new URL(request.url).pathname);
      return respond();
    },
  });
});
afterAll(() => {
  registry.stop(true);
});

async function probe(args: string[], origin = `http://127.0.0.1:${registry.port}`) {
  const child = Bun.spawn(["scripts/release-probe.sh", ...args], {
    cwd: root,
    env: { PATH: process.env.PATH ?? "", ONETASKGRAPH_UI_PROBE_REGISTRY: origin },
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdout, stderr, status] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ]);
  return { status, stdout, stderr };
}

test("the declaration names exactly the one target and files that exist", () => {
  const declaration = Bun.TOML.parse(
    readFileSync(resolve(root, "release-targets.toml"), "utf8"),
  ) as {
    probe: string;
    target: { id: string; name: string; manifest: string }[];
  };
  expect(declaration.target.map(({ id, name }) => [id, name])).toEqual([[TARGET, "npm"]]);
  const [target] = declaration.target;
  const manifest = JSON.parse(readFileSync(resolve(root, target?.manifest ?? ""), "utf8"));
  expect(`npm:${manifest.name}`).toBe(TARGET);
  expect(existsSync(resolve(root, declaration.probe))).toBe(true);
  accessSync(resolve(root, declaration.probe), constants.X_OK);
});

test("answers the version npm serves", async () => {
  respond = () => Response.json({ name: "@onetaskgraph/ui", version: "1.2.3" });
  requests.length = 0;
  expect(await probe([TARGET])).toEqual({ status: 0, stdout: "1.2.3\n", stderr: "" });
  expect(requests).toEqual(["/@onetaskgraph%2Fui/latest"]);
});

test("a 404 is npm saying there is no release, an empty answer", async () => {
  respond = () => new Response("not found", { status: 404 });
  expect(await probe([TARGET])).toEqual({ status: 0, stdout: "", stderr: "" });
});

test.each([
  ["a server error", () => new Response("down", { status: 503 })],
  ["a body that is not JSON", () => new Response("<html>", { status: 200 })],
  ["a document with no version", () => Response.json({ name: "@onetaskgraph/ui" })],
  ["a version that is not one", () => Response.json({ version: "latest; rm -rf" })],
])("%s is not answered rather than empty", async (_name, response) => {
  respond = response;
  const result = await probe([TARGET]);
  expect(result.status).toBe(1);
  expect(result.stdout).toBe("");
  expect(result.stderr).toContain("release-probe:");
});

test("a registry it cannot reach is not answered", async () => {
  const result = await probe([TARGET], "http://127.0.0.1:1");
  expect(result.status).toBe(1);
  expect(result.stdout).toBe("");
});

test("a target this repository does not declare is not answered", async () => {
  const result = await probe(["npm:react"]);
  expect(result.status).toBe(1);
  expect(result.stderr).toContain("not a target");
});

test("a missing identifier is a usage error", async () => {
  expect((await probe([])).status).toBe(2);
});
