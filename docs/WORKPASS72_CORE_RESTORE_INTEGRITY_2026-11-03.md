# WorkPass72 — Core restore integrity and self-improvement boundary (2026-11-03)

**Branch:** `workpass72-core-integrity` (off canonical `workpass70-source`).
**Base SHA:** `57103c645336a22c0a38401c790f6290be2fda94`.
**Scope:** defensive snapshot-restore integrity across the cognitive core, plus a
fail-closed protected-artifact guard on the self-improvement contour.

## Failure modes fixed

Five canonical owners accepted untrusted persisted snapshots through a bare
`{...defaults, ...raw}` merge or `structuredClone(raw)`. A corrupt, hostile or
partially written snapshot could therefore inject `NaN`, out-of-range values,
unknown enum members, inherited properties or throwing accessors straight into
live cognitive state — and in two cases crash the restore path outright.

| Owner | Defect | Fix |
|---|---|---|
| `core/TemporalResolutionGovernor.ts` | `restore()` merged the raw snapshot verbatim. `idleCyclesSincePulse:NaN`, `lastLevel:'bogus'`, `fullEvery:-5`, `savedPulseFraction01:42`, `lastAt:-99` all entered state and broke idle cadence. A hostile throwing getter crashed restore. `decide()` with a non-finite `baseFullEvery` produced `fullEvery:NaN`. | Strict per-field validation against the level/reason enums, non-negative safe-integer counters, unit-interval fractions, own-data-property copying with descriptor inspection, prototype traps fail closed, unknown versions reset. `decide()` now ignores non-finite `baseFullEvery`. |
| `cognition/SelfModelV2.ts` (`SelfModelEngine`) | `restore()` merged raw state, then indexed `selfConsistentAction11` — a hostile getter or `null` map threw `GETTER` / `Cannot read properties of null`. Invalid actions, unbounded error arrays and `Infinity` gate timestamps were copied through. | Full descriptor-safe rebuild of every field, drop-and-clamp of malformed values, unknown actions rejected, list/counter bounds, hostile snapshots reset to defaults. |
| `world/WorldModel.ts` | `restore()` `structuredClone`d belief and transitions verbatim. `observeContext(undefined)` threw `Cannot read properties of undefined (reading 'facts')`; `observeTransition` cloned hostile input unchecked. | Descriptor-safe sanitizer for contexts and transitions, malformed entries dropped, non-finite units coerced to finite values so `beliefSignature()` never emits `NaN`/`Infinity`, malformed observations rejected without wiping the last good belief. |
| `memory/MultiTimescaleMemory.ts` | `restore(rows)` called `add(row)` on each row; a malformed row (`kind` unknown, non-array `evidence`, `NaN` salience, hostile accessor) crashed or corrupted the store. | Per-row `sanitizeMemoryRecord` validation; structurally invalid rows are dropped, valid rows still restore, non-array input resets to empty. |
| `system/CanonicalSelfAgencyAuthority.ts` | `admitSelfModification` gated only on measured gain/risk/identity — it never checked *which artifacts* the change touched, so a self-edit could target its own verifiers or holdout data. | New `verification/ProtectedArtifactRegistry.ts` classifies repository paths and blocks any change set touching verifiers, holdout data, evaluation harnesses, evidence ledgers, the registry itself or verification CI. Wired into the gate; a perfect evidence score cannot override a protected-path violation. |

## New module

`runtime/neuro-kurisu/src/organism/verification/ProtectedArtifactRegistry.ts`

- `canonicalizeRepoPath()` — normalizes separators, resolves `.`/`..`, rejects
  root escapes, control characters, non-strings and oversized input (`null`).
- `classifyProtectedArtifact()` — returns the matched class or `not-protected`;
  unparseable paths fail closed as protected; `includes` matching is
  case-insensitive.
- `guardSelfModification()` — gates a whole change set; any protected path
  blocks it; malformed/oversized/non-array input fails closed.
- Self-referential by design: the registry file, the whole `src/organism/
  verification/` subsystem, every `.github/workflows/` file and the
  `tests/workpass72-*` suite are protected, so a self-edit cannot weaken its own
  checker.

### Rules audited against the live tree

The first draft referenced names that do not exist in the repository. A sweep of
all 2,159 files under `src/`, `tests/` and `.github/workflows/` drove a rewrite:

- `IndependentEvaluator` matched nothing → replaced with the real owners
  (`OutcomeVerificationService`, `SkillRevisionGate`, `LearningTrustBoundary`,
  `ConstitutionalArbiter`, `CriticalFunctionPassport`,
  `CanonicalSelfAgencyAuthority`, `Independent*` evaluators).
- `includes: 'holdout'` missed the capitalized
  `B303HoldoutGeneralizationLedger.ts` → matching is now case-insensitive.
- The guard's own regression suite was not protected → added.
- 123 files now classify as protected; the sample of `src/` matches was manually
  reviewed and contains only genuine verifiers, holdout owners and evidence
  ledgers (no false positives on ordinary modules such as `MemoryOS2`).

### Integration boundary (honest status)

`OrganismCore` calls `admitSelfModification` at the live self-rewrite decision
point (`OrganismCore.ts:4667`). The runtime has **no source-patching pipeline** —
`SandboxedSelfRewriteEngine.propose` is a purely numeric gate with no file
targets — so today the guard enforces the invariant when a change set is
declared and fails closed on malformed declarations. Wiring a real change-set
producer would mean inventing a patch pipeline, which the project rules forbid;
the guard therefore sits at the correct maximal boundary rather than in a
placeholder module.


## Evidence

- `npm run typecheck` → `TYPECHECK=PASS mode=node-strip-syntax-only files=658`.
- New regressions (fail before the fix, pass after — verified by stashing
  `runtime/neuro-kurisu/src`):
  - `tests/workpass72-temporal-resolution-restore-integrity.mjs`
  - `tests/workpass72-self-model-restore-integrity.mjs`
  - `tests/workpass72-world-memory-restore-integrity.mjs`
  - `tests/workpass72-protected-artifact-guard.mjs`
- Owning regressions re-run green: `big-pass-75-temporal-resolution`,
  `canonical-self-agency-authority`, `p32-causal-self-model`, `p10-world-model`,
  `self-model-evidence-write-gate-workpass315`.
- Broad sweep of the 56 tests that reference the changed modules: 43 pass; the
  13 failures are **pre-existing** on the pristine base SHA (verified by stashing
  all source changes and re-running — identical failures, caused by unrelated
  `AdaptivePolicyEngine`/`MemoryStateStore`/worker-fixture issues).
- CI: `.github/workflows/nk1-core-restore-integrity.yml`.

## Status labels

- **IMPLEMENTED + CONNECTED:** all five fixes are wired into the live restore
  path and the `admitSelfModification` gate.
- **TESTED:** unit-level behavioural regressions (above).
- **NOT independently validated:** no external holdout, device E2E or soak run.
  The protected-artifact registry is a policy guard, not a sandbox; it constrains
  declared change sets, not arbitrary filesystem writes.

## Blockers / next

- 13 pre-existing test failures outside this pass's scope (`AdaptivePolicyEngine`
  temporal credit, `MemoryStateStore` construction, worker-thread fixtures) —
  should be triaged as their own pass.
- The registry's rule list is a starting canonical set; holdout/verifier paths
  beyond the named prefixes still need an explicit inventory before promotion.
- Release ZIP and license review gate remain unchanged and blocking.
