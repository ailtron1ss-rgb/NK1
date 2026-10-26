# WorkPass332 — family-wise learning evaluation and progress tracking

**Date:** 2026-10-26  
**Working branch:** `fix/mega-cognitive-progress-tracking-2026-10-26-r3`  
**Base/source line:** `fix/cognitive-interrupt-severity-normalization-2026-10-25`  
**Base SHA at start:** `f23c9aa4f5030987c2741808e930e7e100da077b`  
**State:** implemented in the working branch; exact-head CI pending.

## 1. Code changed

### SkillLearnBench evaluation path

`runtime/neuro-kurisu/src/organism/learning/SkillLearnBenchAdapter.ts`

- Trial input/report can carry a task-family label sourced from the canonical manifest/evaluator.
- Aggregate-by-task output retains the family and rejects inconsistent family assignment for multiple trials of the same task.
- Candidate report validation normalizes task/trial identity and rejects family drift within a task or between paired baseline/candidate reports.
- Candidate gate keeps the existing default floors (global task success 0.80; at least two distinct validation tasks and two distinct holdout tasks) and adds separate family checks:
  - required-family list validation;
  - minimum verified validation success per family (defaults to global task-success floor);
  - explicit family validation and holdout coverage;
  - per-family validation composite/gain and held-out composite/success change;
  - hard denial when required evidence is missing, a family validation success falls below its floor, or a family regresses beyond the declared tolerance.
- The result object now exposes a `familyResults` array and `taskFamilyCoverage01` so a dashboard can report the exact weak family instead of a single aggregate score.

The adapter cannot itself prove that a label was signed by a trusted manifest. It checks presence and consistency; production provenance still depends on the manifest-owned evaluator and existing signed P23 outcome ledger/promotion contract. This distinction is deliberate.

### Regression

`runtime/neuro-kurisu/tests/p29-hermes-reflective-candidate-gate.mjs`

The new counterexample contains nine improving memory tasks and one tool-use plus one transfer task. Tool-use and transfer report strong skill/trajectory shape but still fail independent verification. The aggregate success rate clears 0.80 and the overall composite improves; the family gate must nevertheless reject the candidate. Additional cases check missing family labels, baseline/candidate family mismatches, and duplicate required families.

### Durable progress ledger

Added:

- `docs/PROJECT_PROGRESS_TRACKER_2026-10-26_RU.json`
- `docs/PROJECT_PROGRESS_TRACKER_2026-10-26_RU.md`
- `tools/project-progress-ledger.mjs`
- `tools/project-progress-ledger.test.mjs`

The JSON defines 12 engineering lanes with weights that must total 100%. The reporter computes four distinct weighted percentages: implementation, automated validation, external/field evidence, and release readiness. The validator rejects duplicated lane IDs, invalid scores, changing aggregate weights and malformed CI check metadata. Root npm scripts expose the report and tests, and the unified integration workflow runs them.

The percentages are a transparent engineering estimate, not a measurement of intelligence or consciousness. Unit tests and synthetic benchmarks contribute to validation coverage, not automatically to field-evidence scores.

## 2. Current CI and confidence

The base snapshot had narrow WorkPass292 CI green, WorkPass294 still running, and P26 Learning Validation / the unified integration suite queued. Those statuses were recorded before these changes. They do not validate WorkPass332.

Required next evidence on this branch:

1. P26 Learning Validation: runtime typecheck and the extended SkillLearnBench/Hermes candidate-gate test.
2. Unified project integration suite: progress ledger test/reporter, pinned toolchain, installer/doctor, app typecheck/build and cognitive runtime integration.
3. Existing P23 signed-family-promotion and WorkPass110 continual-learning workflows on the same head.

Until those runs finish successfully, the code is **implemented but not yet CI-verified**.

## 3. Progress snapshot model

The initial panel weights 12 areas: cognitive cycle, world model/routing, memory/continuity, motivation/goals, action/postconditions, continual learning/replay, skill evolution/promotion, self/user ethical models, avatar, voice/audio, app/install/CI, and external evidence/licensing/release.

The four dimensions stay separate:

- **Implementation:** the subsystem and its wiring exist.
- **Automated validation:** tests/contracts cover its intended failure modes (not whether current HEAD has passed).
- **External evidence:** independently measured performance on realistic held-out tasks.
- **Release readiness:** clean install, deployed provider/device path, UI/voice, soak, provenance/licensing and a reproducible release archive.

The dashboard script computes weighted totals from the checked-in ledger rather than a hand-maintained aggregate. Each subsequent pass should update individual lane scores only where there is new evidence and should update the CI snapshot after checking exact-head runs.

## 4. Not done in this pass

- No production claim of generalization or field task success.
- No main-branch update or merge.
- No release ZIP download, rebuild or publication.
- No claim that live provider credentials, Android voice, browser/Live2D end-to-end, long-duration soak or license review are complete.
- No new external npm dependency was introduced by the progress tooling.

## 5. Completion status

- Family metadata and gate implementation: **implemented**, CI pending.
- Adversarial per-family regression: **authored**, CI pending.
- Weighted 12-lane progress ledger and built-in test: **implemented**, CI pending.
- Full release/clean-machine production readiness: **not complete**.
