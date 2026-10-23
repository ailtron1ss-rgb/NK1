# WorkPass338 — learning scheduler contract hardening

**Date:** 2026-10-23  
**Branch:** `feature/learning`  
**Scope:** trusted shadow learning scheduler input contract; learning CI runtime alignment.

## Failure mode

`P23TrustedShadowLearningScheduler.runOnce(runtimeTick)` originally returned `this.inFlight` before validating the new caller's `runtimeTick`. During an active run, a second caller supplying `NaN`, a negative number or a non-integer did not receive the contract error; it silently inherited the other caller's promise. It did not create duplicate execution, but it hid invalid upstream state.

## Change

- Validate the supplied tick before single-flight deduplication.
- Preserve the existing behavior where well-formed overlapping calls return the exact same promise.
- Add a regression that checks both sides of the contract and asserts only one mocked process launch.
- Upgrade the P26 learning-validation workflow's Node pin from 22.12.0 to Node.js 24; the repository package engine already allows Node 24.

## Research relationship

- [Hermes Agent Self-Evolution](https://github.com/NousResearch/hermes-agent-self-evolution): trace-informed revision, constrained candidate evaluation, and separate review/promotion boundaries. NK1 already maps these principles in `P23LearningEngine.generateAndStageReflectiveSkillRevision`; this pass does not vendor its implementation.
- [CleanRL](https://github.com/vwxyzjn/cleanrl): reproducible seeds and explicit benchmark comparisons. NK1 keeps its existing seed accounting and uses this pass to strengthen the scheduler's concurrent-call contract.
- No upstream code, model weights, dataset, or third-party dependency was copied or installed by this change.

## Verification status

- **IMPLEMENTED:** validation-order fix, regression, Node.js 24 workflow pin, changelog and research-intake update.
- **STATICALLY INSPECTED:** exact insertion anchors, existing call path, and test fixture shape.
- **UNVERIFIED:** the regression, runtime typecheck and workflow have not run in this pass. The latest exact-head Actions records observed before the change failed before any job runner/step began. Do not treat those runs as evidence of a code regression or as a passing check.
- **NOT CLAIMED:** measurable learning uplift, a complete autonomous self-improvement cycle in production, or consciousness.

## Next acceptance gate

Run the owning `p23-runtime-trusted-shadow-scheduler` regression and the P26 validation workflow on the new commit. Then continue the learning branch through an actual signed observation → independent candidate evaluation → explicit promotion-approval request → restart/restore replay test, retaining the separation between shadow evidence and activation.
