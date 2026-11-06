import { afterEach, beforeEach, expect, test } from "bun:test";
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const script = resolve(import.meta.dir, "../setup-llmlint.sh");
const bash = Bun.which("bash") ?? "/bin/bash";

let home: string;
let bin: string;

beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), "setup-llmlint-"));
  bin = join(home, "bin");
  mkdirSync(join(home, ".local/bin"), { recursive: true });
  mkdirSync(bin);
  doubles();
});
afterEach(() => {
  rmSync(home, { recursive: true, force: true });
});

function executable(path: string, body: string) {
  writeFileSync(path, `#!/bin/sh\n${body}\n`);
  chmodSync(path, 0o755);
}

// The doubles install what the real tools do, where they do: pipx puts uv on ~/.local/bin, and
// `uv tool install` puts llmlint there. PATH is only `bin`, so a uv elsewhere on the host cannot
// answer in the double's place.
function doubles() {
  symlinkSync(Bun.which("cp") ?? "/bin/cp", join(bin, "cp"));
  executable(join(home, "llmlint.double"), "echo llmlint-double");
  executable(
    join(home, "uv.double"),
    'echo "$*" >> "$HOME/uv.calls"; cp "$HOME/llmlint.double" "$HOME/.local/bin/llmlint"',
  );
}

function stubPipx(exitCode = 0) {
  const install = 'cp "$HOME/uv.double" "$HOME/.local/bin/uv"';
  executable(
    join(bin, "pipx"),
    `echo "$*" >> "$HOME/pipx.calls"\n${exitCode === 0 ? install : `exit ${exitCode}`}`,
  );
}

function setup() {
  const child = Bun.spawnSync([bash, script], {
    env: { HOME: home, PATH: bin },
    stdout: "pipe",
    stderr: "pipe",
  });
  return { status: child.exitCode, stderr: child.stderr.toString() };
}

const called = (name: string) => {
  const path = join(home, `${name}.calls`);
  return existsSync(path) ? Bun.file(path).text() : Promise.resolve("");
};

test("with only pipx present, uv comes through it and installs llmlint", async () => {
  stubPipx();
  const { status, stderr } = setup();
  expect(status).toBe(0);
  expect(await called("pipx")).toBe("install uv\n");
  expect(await called("uv")).toContain("tool install --upgrade llmlint-cli>=");
  expect(stderr).toContain("ready (llmlint:");
});

test("a uv already present is used without touching pipx", async () => {
  stubPipx();
  copyFileSync(join(home, "uv.double"), join(bin, "uv"));
  const { status, stderr } = setup();
  expect(status).toBe(0);
  expect(await called("pipx")).toBe("");
  expect(await called("uv")).toContain("tool install");
  expect(stderr).toContain("ready (llmlint:");
});

test("neither uv nor pipx names what to install and does not abort", () => {
  const { status, stderr } = setup();
  expect(status).toBe(0);
  expect(stderr).toContain("uv not found; cannot install llmlint");
  expect(stderr).toContain("llmlint not installed");
});

test("a pipx that fails is reported and does not abort", async () => {
  stubPipx(1);
  const { status, stderr } = setup();
  expect(status).toBe(0);
  expect(await called("pipx")).toBe("install uv\n");
  expect(stderr).toContain("uv install via pipx failed");
  expect(stderr).toContain("llmlint not installed");
});
