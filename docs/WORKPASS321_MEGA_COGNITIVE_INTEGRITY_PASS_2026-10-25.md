# WorkPass321 — mega-pass cognitive integrity repair

**Date:** 2026-10-25  
**Working branch:** `fix/mega-cognitive-integrity-audit-rebased-2026-10-25`  
**Baseline:** `66e8791f78306d2f34e0cc45a562eac3ac4f1bd8` (`fix/runtime-typecheck-dependency-contracts-2026-10-25`)  
**Scope:** close concrete learning-state and external-evidence integrity gaps found during the current code-first pass.

## Current architecture and CI baseline

The published release asset is still the WorkPass70 hotfix ZIP from 2026-10-19. The source line has continued changing through 2026-10-25. This pass is built against the fresher runtime typecheck/build/smoke workflow baseline, not the older ZIP; no claim is made that the release asset has been rebuilt.

The previous exact-head run on the earlier parent commit recorded three failures:

- P26 learning input integrity (`40227670956`): finite targets and rates were not rejected by the code at that older revision. The newer parent branch subsequently added explicit state/action/target/rate checks and atomic batch preflight; this pass retains those checks and closes the remaining corrupted-restore gap.
- WorkPass243 host-owned independent evaluation (`40227670966`): the final path-replacement test was masked because the same executable fixture remained deliberately group/world-writable from the preceding negative test. The newer parent baseline now restores file permissions between the two cases; that independent test fix is retained.
- WorkPass294 external postcondition lineage (`40227670947`): the gateway verifier forwarding did not express its execution/decision ticket linkage in the expected contract. This pass makes the action execution ticket explicit and forwards the optional decision ticket without changing the fail-closed verifier semantics.

Three cognitive cycle / intrinsic motivation / motivation-to-goal contract checks passed on the previous source head. These do not substitute for full runtime validation.

## Changes made in this pass

### 1. Policy snapshot restoration

- Restored policy weights/biases remain bounded and non-finite values are replaced rather than propagated.
- Training metrics `tdAbsMean01`, `trainRewardMean01`, `explorationRate01` and `lastLoss01` are checked for finiteness and clamped to `[0,1]`; malformed values recover to their documented defaults.
- The update count is preserved only if it is a safe, non-negative integer. A fractional, negative, unsafe or non-numeric counter becomes zero.
- The last-training timestamp is repaired when malformed and is clamped to a safe non-negative range.
- The persisted schema version is normalized to version 1 rather than accepting arbitrary input.
- A persisted freeze is restored only from literal boolean `true`. The setter now follows the same rule, so JavaScript callers passing a truthy string such as `"false"` cannot accidentally freeze the learner.

The P26 regression already checks corrupted weight/bias arrays, NaN/infinity diagnostics, invalid counters, atomic batch rejection and valid training. This pass adds an explicit test for the public freeze setter's malformed-string boundary.

### 2. External outcome lineage

- The gateway's verifier call now binds the execution ticket through an explicit local identifier.
- The prior decision ticket is forwarded only when it is a string.
- This remains a binding contract, not a grant of trust: the verification service still requires exact tool identity, complete input, execution ID and decision ID; the verifier-minted object must remain the same process-local object before it can authorize learning.

### 3. Regression-test isolation retained from the latest base

The current base had already fixed the independent-evaluator fixture's permission leakage. The executable is reset to private executable mode after the intentional writable-file rejection, so the later directory-identity replacement test reaches the directory identity guard and not the earlier permission guard.

## Validation state

- **Implementation:** committed to the rebased working branch; this branch is isolated from `main`.
- **Exact-head tests:** pending fresh GitHub Actions on PR #140; do not treat the older failed job as the status of this new revision.
- **Typecheck/build/smoke:** the parent added app typecheck, production bundle build, runtime smoke and HTTP-startup checks to the dedicated dependency workflow. Those gates should be required before promotion; the current code edits have not yet been declared green by them.

## Remaining release gates

This pass does not establish:

- successful clean-machine installation with all optional providers, credentials and database migrations;
- full production frontend/runtime startup on all supported deployment targets;
- complete browser, Live2D, voice/audio and mobile/Termux end-to-end operation;
- independently measured long-horizon learning and retrieval gains;
- that the host-owned evaluator's configured executor is a real OS/container sandbox (the adapter documents that its launcher must provide isolation);
- full source/license/provenance audit of every incorporated upstream;
- a newly built and published release ZIP newer than WorkPass70.

Do not promote learned candidates or label NK1 production-ready until the new CI and clean-install/release gates pass.
