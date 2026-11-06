import { afterAll, beforeAll, expect, test } from "bun:test";
import { resolve } from "node:path";

const root = resolve(import.meta.dir, "../..");
const PLACEHOLDER_TOKEN = "npm_placeholder-for-the-suite";

let answer = 404;
const requests: string[] = [];
let registry: ReturnType<typeof Bun.serve>;

beforeAll(() => {
  registry = Bun.serve({
    port: 0,
    fetch(request) {
      requests.push(new URL(request.url).pathname);
      return new Response("{}", { status: answer });
    },
  });
});
afterAll(() => {
  registry.stop(true);
});

// The registry above runs on this process's event loop, so the wait for the child must be
// asynchronous: a synchronous spawn blocks the loop that answers the child's request.
async function publish(args: string[], token: string | null = PLACEHOLDER_TOKEN) {
  const env: Record<string, string> = {
    PATH: process.env.PATH ?? "",
    HOME: process.env.HOME ?? "",
    NPM_CONFIG_REGISTRY: `http://127.0.0.1:${registry.port}/`,
    // CI is not passed down, so a fresh HOME has npm ask this registry for its own latest version.
    NPM_CONFIG_UPDATE_NOTIFIER: "false",
  };
  if (token !== null) env.NPM_CONFIG_TOKEN = token;
  const child = Bun.spawn(["bun", "scripts/publish-ui.mjs", ...args], {
    cwd: root,
    env,
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

test("a dry run walks the whole path and names the package", async () => {
  answer = 404;
  requests.length = 0;
  const result = await publish(["--dry-run"]);
  expect(result.stderr).toBe("");
  expect(result.status).toBe(0);
  expect(result.stdout).toContain("@onetaskgraph/ui@");
  expect(requests[0]).toMatch(/^\/@onetaskgraph%2[Ff]ui\/\d+\.\d+\.\d+/);
});

test("a version the registry already serves is skipped", async () => {
  answer = 200;
  const result = await publish(["--dry-run"]);
  expect(result.status).toBe(0);
  expect(result.stdout).toContain("already published");
});

test("a registry that does not answer stops the publish", async () => {
  answer = 503;
  const result = await publish(["--dry-run"]);
  expect(result.status).toBe(1);
  expect(result.stderr).toContain("answered 503");
});

test.each([
  ["absent", null],
  ["empty", ""],
  ["carrying whitespace", "npm token"],
])("a token %s is refused", async (_name, token) => {
  const result = await publish(["--dry-run"], token);
  expect(result.status).toBe(1);
  expect(result.stderr).toContain("set it from the NPM_TOKEN secret");
});

test("--verify-token answers on the token alone", async () => {
  requests.length = 0;
  expect((await publish(["--verify-token"])).status).toBe(0);
  expect(requests).toEqual([]);
  expect((await publish(["--verify-token"], "")).status).toBe(1);
});

test("an unsupported argument is refused", async () => {
  const result = await publish(["--tag=next"]);
  expect(result.status).toBe(1);
  expect(result.stderr).toContain("unsupported argument --tag=next");
});
