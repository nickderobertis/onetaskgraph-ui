# AGENTS.md

Durable instructions for humans and agents working in this repo. Write for a
future maintainer, not as a session log. Put deterministic steps in scripts and
keep this file for constraints, tradeoffs, and judgment.

> Keep this file terse — it is always-loaded context, so its length is a
> standing tax on every session's budget. Add a line only if it is relevant to a
> future task **and** the task wouldn't surface it anyway (a failing gate,
> `just --list`, the code, or a linked doc); state the rule or intent, and leave
> mechanisms, tool/rule-IDs, and inventories of what a tool already shows to
> their source of truth — link it, don't restate it. Rules cleanly scoped to a
> folder go in a nested `AGENTS.md` (e.g. `tests/AGENTS.md`); content that is
> neither always relevant nor cleanly scoped to one folder goes in a reference
> doc (e.g. under `docs/`) linked from here, not inlined.

> `CLAUDE.md` is a symlink to this file (`ln -s AGENTS.md CLAUDE.md`) so the two
> never drift. Edit `AGENTS.md` only.

## What this repo is

`@onetaskgraph/ui`, a published React component library showing onetaskgraph tasks: task markdown, links out to sources and the display of a task. Every surface that shows a task consumes it, the pipeline's browser view among them, so task-store concerns live here and a fix reaches them all.

## Two standing goals on every task

The user drives product features and their request is the priority — but carry
two goals into *every* task. When either is the lowest-error path to what the
user asked, fold it into the same task without asking first; surface the rest as
follow-ups (see "After the main task").

1. **Engineer the context for next time.** Make the next agent (and you) see
   more for less: realistic end-to-end tests that exercise what the user
   actually sees — especially when they report a bug existing tests missed —
   scripts and skills that automate repetitive steps and shrink their output to
   signal, and terse `AGENTS.md` notes capturing what the code doesn't make
   obvious.
2. **Engineer the codebase and environment.** Be the engineer the user isn't:
   prioritize the technical initiatives that keep the codebase clean,
   maintainable, and repeatable, and keep environment setup automated and
   consistent (`just bootstrap` from a clean clone). Strict quality gates plus
   local/CI parity (same checks, same pinned toolchain) make results
   repeatable — not "works on my machine." A clean base and a reproducible
   environment are usually how the user's feature ships with a low error rate.

## Stack and composition

How this repo was built up from the create-repo reference pieces. Record the
decision so the next maintainer can see why the tooling is what it is — and so
the choice was made deliberately rather than skipped.

- **Product shape:** library
- **Language(s):** typescript
- **References composed:** base.md, project-graph.md, shapes/library.md, languages/typescript.md, ci.md, llmlint.md, releasing.md, tools/onebudgetspec.md
- **Projects in the graph:** `ui` (the published package, its fast tests); `ui-install-e2e` (installs the built tarball into an outside consumer and drives it in Chromium, the registry and browser contact a `ui` change alone should reach); `repo` (the root: release wiring, publish script, probe and their tests); `report-job` (`.github/reporting`, the budget report job).
- **Excluded, and why:** release-plz, its bot release pull request and the tag-triggered `build-*`/`publish` jobs, which `--ci-cd` renders: the owner chose semantic-release publishing on push to `main`, the shape `oneharness-ui` publishes in, and one platform-independent npm package has no per-platform build. So `compose_repo_plan.py --ci-cd` is not re-runnable here. asdf is only a `.tool-versions` convenience; direnv has no use here.

## Command surface

Use the `just` recipes; do not hand-roll equivalent commands. Each one
delegates to the Nx project graph (`nx affected` / `nx run-many`) rather than
looping over projects, and each project declares what its own targets do.

- `just bootstrap` — set up from a clean clone.
- `just check` — full quality gate (format, lint, type check, tests incl. e2e),
  run as the **affected tier**: the projects this change can reach, keyed off an
  explicitly derived merge base. Must pass before any commit or PR.
- `just check all` — the **broader tier**: one full sweep over every project. CI
  runs it at the single lifecycle point recorded below; run it locally when a
  change (an upgrade, a shared config edit) reaches further than the affected set
  suggests.
- `just test` / `just lint` / `just format` — individual gate steps.
- `just test-e2e` — the e2e tier on its own, for iterating; `just check` runs it
  last, at the same tier, so e2e is gated on every change.
- `just upgrade` — upgrade dependencies, then re-run the gate as a full sweep.
- `just lint-llm` / `just lint-llm-diff` / `just lint-llm-validate` — the
  LLM-judge tier (llmlint), separate from `check` and non-deterministic; config in
  `llmlint.yml`. `lint-llm` runs on demand locally; `lint-llm-diff` is the
  blocking, diff-scoped PR check; `lint-llm-validate` is the deterministic,
  model-free gate (config + ignore directives + version bumps) CI runs first.
  `just setup-llmlint` installs the llmlint toolchain; `just session-setup`
  provisions the session's dev toolchain (ensures `just`, then runs setup-llmlint)
  and is what the `SessionStart` hook runs so a fresh web/cloud session is ready.

## Commits, releases, and merging

How changes land on the protected default branch. Set these on the GitHub repo
with `gh` (see the create-repo skill's `references/ci.md`); record the model here
so it is auditable and re-appliable.

- **Squash-merge only, via PR, with auto-merge.** The default branch is
  protected: merge commits and rebase-merging are disabled, so one PR is one
  squash commit whose subject is the PR title. Open a PR and queue it with
  `gh pr merge --auto --squash`; it merges itself once every required check is
  green. Merged head branches auto-delete. Admins may bypass in a break-glass.
- **All gating checks are required.** Branch protection requires every CI status
  check that gates correctness — including the full-e2e gate job (`just check`),
  the `llmlint` LLM-judge job (separate from `check`), and any others — plus
  linear history, conversation resolution, and no force-push / branch-deletion.
- **No broader sweep runs in CI.** The composed shape runs the affected tier on each pull request and sweeps nowhere; a push to `main` releases what its pull request proved and re-gates nothing. Run `just check all` after anything reaching further than the affected set suggests.
- **PRs follow the template.** `.github/pull_request_template.md` asks for a
  terse **What** (the behavior change) and **Why** (its driver and impact), with
  an optional **Additional info** section — describe the change and its driver,
  not a walkthrough of the diff. It also becomes the squash commit body.
- **Releases.** Semantic-release on every push to `main` (`.releaserc.json`, `.github/workflows/release.yml`): a merged PR title decides. `feat` is a minor, `fix` and `perf` a patch, and a breaking change a minor while pre-1.0; every other type releases nothing. Nobody hand-edits a version, hand-tags or dispatches a publish. The manifest's version is materialized in the release job and never committed; the tag and the GitHub Release (where the changelog lives) record it. `v0.0.0` seeds the first release at `0.1.0` rather than semantic-release's `1.0.0`. Semantic-release tags before it publishes, so a publish that failed past `--verify-token` needs its tag deleted before the next run; the publish skips a version the registry already serves.
- **`ci.yml` stays as the skill rendered it**, cache sidecar included, with no bespoke CI beside it. `.github/actionlint.yaml` excludes, for that file alone, the two step constructs actionlint cannot parse and says why. `release.yml`'s semantic-release replaces the skill's release-plz, which the cache script reads promotion receipts from, so `onetaskgraph-ui-nx-cache-use` has no receipts yet.
- **Secrets.** `gh-secrets.json` names them, values are the owner's to set. `NPM_TOKEN` publishes; `CLAUDE_CODE_OAUTH_TOKEN` is what the required `lint` job's llmlint step fails fast without.
- **Release targets.** `release-targets.toml` declares `npm`; a consumer waits on that name, and `scripts/release-probe.sh` answers what npm serves. `npm` never changes.

## Invariants (non-negotiable)

- The quality gate is strict: no warnings-only mode. A diagnostic is either an
  error or suppressed with a documented, tracked rationale.
- **Tests are realistic, not mocked, and complete, not minimal.** E2E drives the
  real artifact across real boundaries. Proof is proportionate to the change per
  the [create-repo base rules](https://github.com/nickderobertis/dero-skills/blob/main/skills/bootstrap/create-repo/assets/llmlint/base.llmlint.yml),
  the authoritative criterion including its justified structural-proof allowance
  (see "Tests are context engineering").
- Validate all external / IO inputs at trust boundaries.
- Keep the artifact portable across the supported platform matrix.
- **Security is gate-level.** Do not commit secrets, credentials, PII, or
  customer data (values live in a secret store, referenced by name); keep every
  grant — the agent allowlist, the CI token, service roles — least-privilege.

## Scripts and output are context

- Every script you add should be quiet on success — a single line or nothing.
- On failure, print the exact error and a concrete suggested next action.
- Treat all command output as context the next agent has to read: maximize
  signal, minimize noise.

## Tests are context engineering

This is an agent-driven repo: the test suite is the *only* QA loop — no human
clicks through features — so it is how you and the next agent see whether things
work. Realism and coverage are a rule, not a preference (see Invariants).

- **Never mock the layer under test.** An "e2e" that mocks the network, files,
  subprocess, or the entry point proves the mock, not the product. Drive the real
  artifact across real boundaries the way a user does (CLI as a subprocess
  asserting exit code/stdout/stderr; a real local server/DB; real temp files).
  Mock only a genuinely external third party you can't run, and say which.
- **A green mocked suite is worse than none** — false confidence the next agent
  builds on, breaking in production where no human watches.
- **Done means complete, not minimal:** for journeys owing e2e under
  the criterion linked in Invariants, cover happy path *and*
  failure/recovery — not one smoke test.
- **Coverage is a floor, not the target:** line coverage is satisfiable with
  mocks that prove nothing. Chase real journeys; let the number follow.
- **The suite is the source of truth for what's covered:** changes land with the
  proportional proof required by the criterion linked in Invariants.
  Name a journey here only when it is a non-obvious contract the suite alone
  wouldn't make clear — don't mirror the test list.
- **A cost figure is a budget, never a test assertion; a wall-clock bound never tells two behaviours apart** (wait on the event). Time-feature contracts, exact counts, absent operations and product-enforced limits stay test assertions.
  A budget is an outcome the product owner tracks, finer figures its reported breakdown ([when a requirement is a budget](https://github.com/nickderobertis/dero-skills/blob/main/skills/bootstrap/create-repo/references/tools/onebudgetspec.md#when-is-a-requirement-a-budget)).

## Keeping the allowlist current

- The agent command allowlist lives in `.claude/settings.json`; the tool
  enforces it, so this file does not restate "follow the allowlist."
- Your job is to keep it current: when a new routine command becomes part of the
  normal build/test/release workflow, add it to the allowlist instead of
  re-approving it every session. Keep it narrow — prefer allowlists over deny
  lists, and leave dangerous operations out unless they are genuinely required.

## Conventions

<Project-specific layout, naming, and testing conventions. Add a nested
`AGENTS.md` (for example, `tests/AGENTS.md`) where a subtree's rules differ.>

## After the main task: refine and hand off

After completing the user's requested task, act on the two standing goals above:
look for ways to make future work easier and propose follow-ups — but only ones
that are materially helpful, and note each one's likely impact:

- **Scripts** — a repeatable step you did by hand that should be automated.
- **`AGENTS.md`** — a constraint, gotcha, or decision worth recording here.
- **Skills** — guidance general enough to belong in a shared skill.
- **Other context** — tests, fixtures, or docs that would improve visibility.

Skip busywork. If nothing is materially helpful, say so and stop.

## Budget reports

Approved budget thresholds alone decide failures: the required `budgets` check goes
red only on an ordinary budget verdict, and the budget stays the requirement. CI
artifacts retain the base branch's recent measurements for informational comparison,
and each report states their provenance, retention and coverage. A stored measurement
is never a line to hold.

1. When a performance problem appears that a failing budget check does not already identify (for example a CI timeout), read the PR report first through `onevcs change comments` or the host PR view. If the failing check already identifies it, skip the duplicate read. Read earlier PR comments and job results when several changes may contribute.
2. Never time base versus branch on a shared host. Profile to investigate, and use CI comparisons through the repository's existing publication path.
3. When reading a report or seeing a failing budget check, fix the regression as part of the work. For an adverse change of at least one standard deviation shown in a report being read (a `max` budget rising, a `min` budget falling), make the change cheaper or make room in existing code, profiling to find where. Improvements show numbers without flags, in a row's history too, and are no reason to optimize further, and other figures need no work. Informational flags do not fail a check or start other work.
4. Stay inside existing budgets. Make room for new tests and code by speeding up existing work; never raise limits or timeouts.
5. Suspect the current change first when something degrades, before intermittent slowness or the outside world.
