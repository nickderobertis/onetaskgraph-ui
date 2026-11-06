import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative, resolve } from "node:path";

const repository = resolve(import.meta.dir, "../../..");

export function run(command: string, args: string[], cwd: string) {
  const result = spawnSync(command, args, { cwd, encoding: "utf8" });
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

/** Packs the built package and installs the tarball with npm into a project outside the repository. */
export function installConsumer(): string {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "onetaskgraph-ui-consumer-")));
  const consumer = join(root, "consumer");
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
  return consumer;
}

export function removeConsumer(consumer: string) {
  rmSync(resolve(consumer, ".."), { recursive: true, force: true });
}
