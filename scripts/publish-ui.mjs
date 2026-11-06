#!/usr/bin/env bun
// Publishes the built @onetaskgraph/ui, or with --dry-run walks the same path up to and through
// `bun publish --dry-run`. --verify-token checks the credential alone, which semantic-release
// runs before it tags, so a missing secret fails a release with nothing to clean up.
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const PACKAGE_NAME = "@onetaskgraph/ui";
const root = resolve(import.meta.dir, "..");
const packageRoot = resolve(root, "packages/ui");
const registry = (process.env.NPM_CONFIG_REGISTRY ?? "https://registry.npmjs.org").replace(
  /\/$/,
  "",
);

function fail(message) {
  console.error(`publish-ui: ${message}`);
  process.exit(1);
}

const flags = process.argv.slice(2);
const unknown = flags.filter((flag) => flag !== "--dry-run" && flag !== "--verify-token");
if (unknown.length > 0) {
  fail(`unsupported argument ${unknown[0]}; it takes only --dry-run or --verify-token`);
}
const isDryRun = flags.includes("--dry-run");

const token = process.env.NPM_CONFIG_TOKEN;
if (!token || token.length > 1024 || /[\s\p{Cc}]/u.test(token)) {
  fail(
    "NPM_CONFIG_TOKEN must be a non-empty npm token with no whitespace; set it from the NPM_TOKEN secret",
  );
}
if (flags.includes("--verify-token")) process.exit(0);

const manifest = JSON.parse(readFileSync(resolve(packageRoot, "package.json"), "utf8"));
if (manifest.name !== PACKAGE_NAME) {
  fail(`packages/ui/package.json is named ${manifest.name}, not ${PACKAGE_NAME}; restore it`);
}

const targets = Object.values(manifest.exports).flatMap((value) =>
  typeof value === "string" ? [value] : Object.values(value),
);
const unbuilt = targets.filter((target) => !existsSync(resolve(packageRoot, target)));
if (unbuilt.length > 0)
  fail(`declared exports are not built: ${unbuilt.join(", ")}; run just build-ui`);

const pack = Bun.spawnSync(["npm", "pack", "--dry-run", "--json"], { cwd: packageRoot });
if (pack.exitCode !== 0) fail(`npm pack failed: ${pack.stderr.toString()}`);
const packed = new Set(JSON.parse(pack.stdout.toString())[0].files.map(({ path }) => path));
const unpacked = targets.filter((target) => !packed.has(target.replace(/^\.\//, "")));
if (unpacked.length > 0) {
  fail(`the tarball would omit declared exports: ${unpacked.join(", ")}; correct "files"`);
}

// A re-run after a partial failure skips a version the registry already serves.
const encodedName = PACKAGE_NAME.replace("/", "%2F");
const published = await fetch(`${registry}/${encodedName}/${manifest.version}`);
if (published.ok) {
  console.log(`${PACKAGE_NAME}@${manifest.version} is already published; nothing to do`);
  process.exit(0);
}
if (published.status !== 404) {
  fail(`${registry} answered ${published.status} for ${PACKAGE_NAME}@${manifest.version}; retry`);
}

const publish = Bun.spawnSync(
  ["bun", "publish", "--access", "public", ...(isDryRun ? ["--dry-run"] : [])],
  { cwd: packageRoot, stderr: "pipe", stdout: "pipe" },
);
const output = `${publish.stdout.toString()}${publish.stderr.toString()}`;
if (publish.exitCode !== 0) fail(`bun publish failed: ${output}`);
if (isDryRun) {
  if (!output.includes(PACKAGE_NAME)) fail(`the dry run did not name ${PACKAGE_NAME}: ${output}`);
  console.log(`${PACKAGE_NAME}@${manifest.version} dry run: would publish to ${registry}`);
  console.log(output.trim());
} else {
  console.log(`${PACKAGE_NAME}@${manifest.version} published`);
}
