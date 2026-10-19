# WorkPass76 — repository surface audit and unfinished-work register

**Date:** 2026-10-19  
**Branch under audit:** `workpass70-source`  
**Scope:** recursive Git tree at `9e144be2eaf87ab15731f765bb50c6507ae2255d`, plus targeted inspection of server, memory, tests, package manifest and CI workflow.  
**Important:** counts below are a structural inventory, not a quality score. The branch advanced while this audit was being written; re-check current head before using any SHA as current.

## Structural inventory (OBSERVED)

| Measure | Count | Interpretation |
|---|---:|---|
| Git tree entries | 10,198 | Files plus directories; tree response was not truncated |
| Files | 9,341 | Includes source, docs, tests, data, historical snapshots and assets |
| Directories | 857 | Includes nested source/research/history trees |
| `runtime/` files | 4,267 | Main runtime plus its research and historical evidence |
| `legacy/` files | 3,369 | Preserved historical source; not safe to bulk-delete |
| `research/` files | 800 | Candidate work and experiments; not automatically production |
| `docs/` files | 561 | Top-level documentation subtree; many older artifacts are historical |
| Runtime `src/` files | 587 | Current implementation surface, still requires dependency graph |
| Runtime `tests/` files | 1,201 | Test-shaped files, not proof that every test runs in CI |
| Runtime `docs/` files | 1,090 | Historical reports are a major source of navigation noise |

Largest file extensions in the full tree: Markdown (2,895), Python (1,762), MJS (1,502), TypeScript (1,494), JSON (692), SQL (371), text (133), TSX (124). This confirms that the repository is a multi-generation archive as well as an application; a one-shot cleanup or architecture rewrite would risk losing source provenance and reproducibility.

### Surface-level conclusions

- **OBSERVED:** one active workflow file, `.github/workflows/workpass71-validation.yml`, runs the core cross-cutting validation. New tests must be wired into it or an explicitly documented package runner; merely adding a test file is not enough.
- **OBSERVED:** `runtime/neuro-kurisu/package.json` is unusually large (256,719 bytes at audit time) and contains many historical test scripts. Script reachability and test runtime should be inventoried before simplifying it.
- **IMPLEMENTED:** `AGENTS.md` already specifies canonical memory ownership, evidence policy, and anti-duplication rules. This pass adds a single root-level project charter so a new chat can find the mission and resume protocol immediately.
- **UNRESOLVED:** full import/reference graph, package-script reachability, license/provenance coverage, generated/binary asset ownership, and duplicate candidates still need machine-generated inventories. File-name similarity alone is not a deletion signal.

## WorkPass76 code finding

### Language invocation temporal-dead-zone defect

**Root cause:** `invokeLanguage()` awaited `generateLanguage()`, then passed `finishedAt` into `LocalLanguageBackendPolicy.observe()` before the `const finishedAt = Date.now()` declaration. In JavaScript this accesses a lexical binding in its temporal dead zone and throws `ReferenceError` after generation returns. A successful provider response could therefore fail before response accounting/return.

**Fix committed:** moved the completion timestamp initialization immediately after generation and before policy observation.

**Regression committed:** `runtime/neuro-kurisu/tests/language-invoke-order-regression.mjs` checks the timestamp ordering and verifies backend attribution prefers the actual `response.backend`.

**CI wiring committed:** the core workflow now runs the new regression after the local backend-selection test.

**Current evidence boundary:** this is a source-level regression, not a substitute for a real HTTP request against a running server. A fresh workflow run after these commits must pass before this patch is labelled CI-verified. Live provider inference remains unproven.

## Outstanding work register

### P0 — must close before treating the runtime as reliable

- [ ] Verify the latest CI run on the current branch head; inspect failed steps/logs rather than inferring from a prior green run.
- [ ] Run the server route end-to-end with a deterministic fake provider and assert HTTP response, backend attribution, latency accounting and policy observation. Keep live model testing opt-in.
- [ ] Resolve the previously identified retrieval/residency regression: ordinary retrieval must not warm/materialize cold records merely to calculate a semantic signal that does not influence ranking. Snapshot and compare residency/maintenance state around retrieval.
- [ ] Audit semantic preview vs production retrieval boundaries: semantic vector generation should be explicit/ bounded and not be mistaken for canonical memory activation or recall uplift.
- [ ] Verify that provider failures, fallback responses, cancellation, response-size limits and backend identity remain correct on the actual server path.

### P1 — cognitive validity and persistence

- [ ] Build a temporal autobiographical benchmark: fact A is stored, fact B supersedes it, current query returns B, historical query at time A returns A, and invalidated A is not represented as current.
- [ ] Run independent RU/EN memory holdouts with same-corpus baseline, shuffled/insertion-order controls, leakage checks, per-case outputs and confidence intervals. Previous recorded `recallDelta=0` blocks an uplift claim.
- [ ] Measure transfer to unseen tasks after verified experience, with no-memory/no-learning controls, interference, reversal and selective-forgetting tests.
- [ ] Reconcile a single action through ACK loss, timeout, process restart, read-after-write and independent postcondition evidence; prove duplicate delivery is idempotent and spoofed booleans do not earn credit.
- [ ] Exercise persistence with malformed snapshots, truncated writes, migration, backup restoration and interrupted shutdown.

### P2 — integration, target hardware and maintainability

- [ ] Add a no-secret/no-network default-CI smoke test for an opt-in local `llama.cpp` server; measure p50/p95 latency, timeout, cancellation, bounded output and actual provider attribution.
- [ ] Run production application build and real browser/Live2D/TTS E2E, including speech interruption, iframe remount, visibility changes and actual audio timing.
- [ ] Measure runtime and app on Dell G3 (Intel i5 / GTX 1650); separately measure mobile constraints on Poco M7 Pro 5G / 8 GB RAM when available.
- [ ] Perform 24–72 hour soak and repeated restart/recovery tests with resource traces.
- [ ] Generate dependency/import graphs for runtime source and tests, then a package-script reachability report.
- [ ] Generate public asset reference/provenance and license inventories; preserve attribution and reversible rollback.
- [ ] Identify genuinely unreachable duplicate candidates only after static references, dynamic loading, test use, scripts, docs and restore paths have been checked.

## Suggested next sequence

1. Wait for and inspect CI for the WorkPass76 language-order fix.
2. Add a real server request test with an injected deterministic provider; avoid making default CI depend on a model download.
3. Fix the retrieval/residency issue with a behavioral regression.
4. Add temporal fact revision and selective forgetting tests against the canonical `MemoryOS2` owner.
5. Trace one restart-safe action outcome through the canonical verification service.
6. Generate the first import/script/license inventory and use it to choose safe consolidation candidates.

## Evidence labels

- **IMPLEMENTED:** a source change exists.
- **PROVEN:** behavior has passed the appropriate test/integration gate.
- **OBSERVED:** measured in a named run/environment.
- **FUNCTIONAL INDICATOR:** a proxy, not proof of the intended capability.
- **HYPOTHESIS:** plausible but not verified.
- **UNKNOWN / UNRESOLVED:** no adequate evidence yet.
- **FAILED:** a specified test/acceptance gate failed.

This register is intentionally explicit: many open tasks remain. Do not call the whole organism complete merely because a local regression suite is green.


## WorkPass76 follow-through — CI coverage closure (2026-10-19)

**Branch head at the start of this follow-through:** `23f9b534d8a2f314983f9d42c803edac045e72fc`. Do not treat this as the head after the workflow update below.

- **IMPLEMENTED:** the cold retrieval residency regression already existed at `runtime/neuro-kurisu/tests/cold-retrieval-residency-regression.mjs`. It exercises the canonical `MemoryOS2` owner and asserts that a relevant cold record is still retrievable without materializing legacy hash vectors, changing residency tiers, incrementing the legacy semantic-hit counter, or changing corpus size.
- **Gap found:** the test file was not called by `.github/workflows/workpass71-validation.yml`; therefore the regression could silently stop protecting production behavior even though the file existed.
- **Fix committed:** added `node --experimental-strip-types tests/cold-retrieval-residency-regression.mjs` to the core CI regression block. This is a behavioral test and runs without a model download, API key, or external service.
- **Workflow-update commit:** `268c12719036877678970ecaf69f94fe7166846d`.
- **CI status at recording time:** runs `39319686397` (commit `23f9b534`) and `39319636214` (commit `57215aeda`) were still in progress when checked; neither result is inferred from the previous green run. The workflow update should trigger a new run. Record its exact result in the next update.

### Reconciled queue

- [x] Inspect latest branch head and recent commits rather than relying on stale WorkPass75 SHA.
- [x] Verify earlier WorkPass75 backend selection run `39318445086` completed successfully.
- [x] Wire cold-retrieval residency behavior into CI.
- [ ] Confirm a green workflow on the current post-update head, including the newly wired regression.
- [ ] Add an executable HTTP-level server test with deterministic local fake provider; assert response body, actual backend attribution, timing and failure accounting.
- [ ] Add temporal fact revision tests (old fact remains historically queryable but is not current after revision).
- [ ] Complete import/script/license/asset ownership inventories; current tree counts are structural only.
- [ ] Run restart-safe action evidence trace and verify spoofed/copy/late proof cannot update policy credit.
- [ ] Run live `llama.cpp` smoke on Dell G3; record model identity, cold/warm latency, timeout/cancellation and bounded output.
- [ ] Run browser/audio/Live2D E2E and long soak on declared target hardware.

The next session should start from the live branch head and current Actions state, not from any SHA above.

## WorkPass76 follow-through — temporal gates and coverage audit (2026-10-19)

- **PROVEN (CI):** run [39320023335](https://github.com/ailtron1ss-rgb/NK1/actions/runs/39320023335) passed on `b8f144348bb756639c02234f5eb2fd3869607b22`. This includes runtime typecheck, language routing/order regressions, and the newly wired temporal fact revision, read-only temporal inspector, and bounded revision-history tests.
- **IMPLEMENTED:** added `tools/audit-runtime-test-coverage.mjs`, which inventories runnable test files, extracts direct test references from the active workflow and package scripts, reports unreferenced candidates without treating them as deletion instructions, and fails if referenced files are missing or required regressions are removed from CI.
- **OBSERVED / FAILED (audit script v1):** the first audit run [39320097798](https://github.com/ailtron1ss-rgb/NK1/actions/runs/39320097798) failed because its required-test matcher expected repository-root-prefixed paths, while the workflow's shell block correctly references paths relative to `runtime/neuro-kurisu`. The underlying tests were present and the workflow itself had run them. This was an audit-script defect, not a runtime regression.
- **IMPLEMENTED:** fixed the audit matcher to accept both root-relative and runtime-relative workflow paths in commit `47e57880d58398f08011cb68bd2fd2e1d6e6e3d1`.
- **UNRESOLVED until observed:** the rerun for the fixed audit script is [39320207064](https://github.com/ailtron1ss-rgb/NK1/actions/runs/39320207064); inspect its final conclusion and audit summary before calling the coverage audit green.

### Current state at this update

- [x] Language invocation order regression and backend attribution source guard are in CI.
- [x] Cold retrieval does not materialize the legacy hash vector or change cold residency; behavioral regression passes CI.
- [x] Temporal revision/history and temporal inspector read-only regressions pass CI.
- [x] Coverage audit is implemented and wired; its corrected run is pending.
- [ ] Add HTTP-level server request with deterministic fake local provider.
- [ ] Add opt-in live `llama.cpp` inference smoke and run on Dell G3.
- [ ] Run independent retrieval-quality and learning-transfer/anti-forgetting experiments.
- [ ] Run restart-safe external action verification and learning-credit trace.
- [ ] Finish dependency/import/license/asset inventory and browser/audio/Live2D + soak measurements.

No quality uplift, actual local model quality, autonomous agency, or subjective consciousness is established by these regressions.


## Coverage audit result — corrected run observed

- **PROVEN (CI):** corrected coverage audit passed in [run 39320207064](https://github.com/ailtron1ss-rgb/NK1/actions/runs/39320207064) on code/workflow commit `47e57880d58398f08011cb68bd2fd2e1d6e6e3d1`.
- **OBSERVED:** 1,200 runnable test-shaped files; 1,124 directly referenced from package scripts or the active workflow; 76 unreferenced candidates; 1,647 package scripts; 1,308 explicit test-path references; zero broken references; required regression list present.
- **Interpretation:** the 76 files are investigation candidates, not proven dead tests. Some may be invoked dynamically, through aggregate runners, or intentionally preserved as historical experiments. Do not delete them based on this report.
- **OBSERVED:** duplicate direct references were reported for some tests. This can mean a test is intentionally run in more than one aggregate/script; inspect runtime cost and intent before deduplicating.
- **CI status boundary:** the audit and temporal regressions are green on the relevant code/workflow commits. The latest branch head must still be checked at session start; documentation-only commits after the tested code do not change the tested runtime, but they are not themselves a new runtime measurement.

The next useful improvement is to enrich the static audit with script-to-script reachability and dynamic-runner inspection, then inspect the 76 unreferenced candidates against imports, generated test manifests, docs and historical provenance. Keep the output as an auditable report; do not automatically remove files.
