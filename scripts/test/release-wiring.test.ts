import { expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dir, "../..");
const read = (path: string) => readFileSync(resolve(root, path), "utf8");

type Step = { run?: string; env?: Record<string, string> };
type Workflow = {
  on?: { push?: { branches?: string[] } };
  jobs?: Record<string, { steps?: Step[] }>;
};
type ReleaseConfig = {
  branches?: string[];
  plugins?: (string | [string, Record<string, string>])[];
};
type Wiring = { workflow: Workflow; justfile: string; config: ReleaseConfig };

/** What a step's command really runs: a `just` recipe's own body as well as the line itself. */
function commandOf(step: Step, justfile: string): string {
  const run = step.run ?? "";
  const recipe = run.match(/^just ([\w-]+)/)?.[1];
  if (!recipe) return run;
  const body = justfile.match(
    new RegExp(`^${recipe}(?: [^\\n]*)?:[^\\n]*\\n((?:[ \\t]+.*\\n)*)`, "m"),
  );
  return `${run}\n${body?.[1] ?? ""}`;
}

/** Every way the release workflow would fail to publish the built package on a push to main. */
function wiringProblems({ workflow, justfile, config }: Wiring): string[] {
  const problems: string[] = [];
  if (!workflow.on?.push?.branches?.includes("main")) problems.push("no trigger on push to main");

  const jobs = Object.values(workflow.jobs ?? {});
  const job = jobs.find((candidate) =>
    candidate.steps?.some((step) => commandOf(step, justfile).includes("semantic-release")),
  );
  const steps = job?.steps ?? [];
  const release = steps.findIndex((step) => commandOf(step, justfile).includes("semantic-release"));
  if (release < 0) return [...problems, "no step runs semantic-release"];

  const releaseStep = steps[release] as Step;
  if (commandOf(releaseStep, justfile).includes("--dry-run")) {
    problems.push("the release step only dry-runs");
  }
  const built = steps
    .slice(0, release)
    .some((step) => commandOf(step, justfile).includes("nx run ui:build"));
  if (!built) problems.push("nothing builds the package before the release step");
  if (!releaseStep.env?.NPM_CONFIG_TOKEN?.includes("secrets.NPM_TOKEN")) {
    problems.push("the release step is not given the NPM_TOKEN secret as NPM_CONFIG_TOKEN");
  }

  if (!config.branches?.includes("main")) problems.push("semantic-release does not release main");
  const exec = config.plugins?.find(
    (plugin) => Array.isArray(plugin) && plugin[0] === "@semantic-release/exec",
  ) as [string, Record<string, string>] | undefined;
  const script = exec?.[1].publishCmd?.match(/scripts\/[\w-]+\.mjs/)?.[0];
  if (script !== "scripts/publish-ui.mjs" || !existsSync(resolve(root, script))) {
    problems.push("the semantic-release configuration does not name scripts/publish-ui.mjs");
  }
  return problems;
}

function realWiring(): Wiring {
  return {
    workflow: Bun.YAML.parse(read(".github/workflows/release.yml")) as Workflow,
    justfile: read("justfile"),
    config: JSON.parse(read(".releaserc.json")) as ReleaseConfig,
  };
}

/** The real wiring with its release job's steps edited, for the cases below. */
function withSteps(edit: (steps: Step[]) => Step[]): Wiring {
  const wiring = realWiring();
  const job = Object.values(wiring.workflow.jobs ?? {})[0];
  if (!job?.steps) throw new Error("the release workflow has no job with steps");
  job.steps = edit(job.steps);
  return wiring;
}

test("the release workflow publishes the built package on a push to main", () => {
  expect(wiringProblems(realWiring())).toEqual([]);
});

test("a workflow not triggered by a push to main is refused", () => {
  const wiring = realWiring();
  wiring.workflow.on = {};
  expect(wiringProblems(wiring)).toContain("no trigger on push to main");
});

test("a workflow that does not build first is refused", () => {
  const wiring = withSteps((steps) => steps.filter((step) => step.run !== "just build-ui"));
  expect(wiringProblems(wiring)).toContain("nothing builds the package before the release step");
});

test("a workflow that builds only after releasing is refused", () => {
  const wiring = withSteps((steps) => {
    const build = steps.filter((step) => step.run === "just build-ui");
    return [...steps.filter((step) => step.run !== "just build-ui"), ...build];
  });
  expect(wiringProblems(wiring)).toContain("nothing builds the package before the release step");
});

test("a release step without the token is refused", () => {
  const wiring = withSteps((steps) =>
    steps.map((step) => (step.run === "just publish-release" ? { run: step.run } : step)),
  );
  expect(wiringProblems(wiring)).toContain(
    "the release step is not given the NPM_TOKEN secret as NPM_CONFIG_TOKEN",
  );
});

test("a workflow whose release step does not run semantic-release is refused", () => {
  const wiring = withSteps((steps) => steps.filter((step) => step.run !== "just publish-release"));
  expect(wiringProblems(wiring)).toContain("no step runs semantic-release");
});

test("a recipe that stops running semantic-release is refused", () => {
  const wiring = realWiring();
  wiring.justfile = wiring.justfile.replace("bunx semantic-release", "true");
  expect(wiringProblems(wiring)).toContain("no step runs semantic-release");
});

test("a configuration that does not name the publish script is refused", () => {
  const wiring = realWiring();
  wiring.config.plugins = (wiring.config.plugins ?? []).filter(
    (plugin) => !(Array.isArray(plugin) && plugin[0] === "@semantic-release/exec"),
  );
  expect(wiringProblems(wiring)).toContain(
    "the semantic-release configuration does not name scripts/publish-ui.mjs",
  );
});

test.each([
  ["feat: add a thing", "minor"],
  ["fix: repair a thing", "patch"],
  ["perf: speed a thing up", "patch"],
  ["feat!: break a thing", "minor"],
  ["chore: tidy", null],
  ["docs: explain", null],
  ["ci: retune", null],
])("%s releases %s", async (message, expected) => {
  // @ts-expect-error semantic-release's plugins ship no types.
  const { analyzeCommits } = await import("@semantic-release/commit-analyzer");
  const config = JSON.parse(read(".releaserc.json")) as ReleaseConfig;
  const options = config.plugins?.find(
    (plugin) => Array.isArray(plugin) && plugin[0] === "@semantic-release/commit-analyzer",
  )?.[1];
  const silent = { log() {}, error() {}, success() {} };
  const release = await analyzeCommits(options, {
    commits: [{ hash: "abc", message }],
    cwd: root,
    logger: silent,
  });
  expect(release).toBe(expected);
});
