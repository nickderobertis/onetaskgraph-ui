#!/usr/bin/env node
// Holds @onetaskgraph/ui's manifest free of onepipeline: the pipeline's view consumes this
// package, so an edge back would put task-store concerns behind the pipeline again.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const FIELDS = ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"];
const FORBIDDEN = /onepipeline/i;

const manifestPath = resolve(
  process.argv[2] ?? new URL("../packages/ui/package.json", import.meta.url).pathname,
);
let manifest;
try {
  manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
} catch (error) {
  console.error(`dependency boundary: cannot read ${manifestPath}: ${error.message}`);
  process.exit(2);
}

const offenders = FIELDS.flatMap((field) =>
  Object.entries(manifest[field] ?? {})
    .filter(([name, spec]) => FORBIDDEN.test(name) || FORBIDDEN.test(String(spec)))
    .map(([name, spec]) => `${field}: ${name}@${spec}`),
);
if (offenders.length > 0) {
  console.error(
    `dependency boundary: ${manifestPath} names onepipeline:\n  ${offenders.join("\n  ")}\nremove them; @onetaskgraph/ui must not depend on the pipeline.`,
  );
  process.exit(1);
}
