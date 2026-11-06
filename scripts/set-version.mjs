#!/usr/bin/env bun
// Materializes the version semantic-release computed into the published manifest, for this
// release job only: it is not committed, and the tag is what records the version.
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const version = process.argv[2];
if (!version || !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version)) {
  console.error("set-version: run RELEASE_VERSION=<major.minor.patch> just set-version");
  process.exit(1);
}
const path = resolve(import.meta.dir, "../packages/ui/package.json");
const manifest = JSON.parse(readFileSync(path, "utf8"));
manifest.version = version;
writeFileSync(path, `${JSON.stringify(manifest, null, 2)}\n`);
