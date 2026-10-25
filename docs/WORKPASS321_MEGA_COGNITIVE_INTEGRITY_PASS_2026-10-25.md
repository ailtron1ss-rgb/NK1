# WorkPass321 — mega-pass cognitive integrity and failed-CI repair

**Date:** 2026-10-25  
**Working branch:** `fix/mega-cognitive-integrity-audit-2026-10-25`  
**Base:** `fix/runtime-typecheck-dependency-contracts-2026-10-25`  
**Scope:** fix concrete failures found on the current source line without weakening type checking or promotion/evidence gates.

## Verified starting state

The current published ZIP is still the WorkPass70 hotfix archive from 2026-10-19; engineering branches have newer code through 2026-10-25. This pass therefore applies to the current code branch, not a rebuilt release archive.

The WorkPass320 CI run confirmed runtime TypeScript typechecking passes after installing the canonical locked toolchain. Three further regressions failed on exact branch head `e670430562a6b5594d7c8e8ef5ab80fdc91d76b2`:

- P26 learning input integrity: `40227670956`, failure in `test:p26:learning-input-integrity`.
- WorkPass243 independent evaluation service: `40227670966`, the last root-directory replacement assertion was masked by the earlier deliberate executable-permission denial.
- WorkPass294 external-postcondition lineage: `40227670947`, a static integration check found the gateway's verifier call did not express the execution-ticket forwarding contract in the required form.

The focused WorkPass287/288 cognitive-cycle, intrinsic-motivation and endogenous-goal checks passed on that branch.

## Changes in this pass

### Learning substrate

- Sanitizes persisted policy metrics on restore: update counters must be safe non-negative integers; losses, reward means, TD metrics and exploration rates must be finite and bounded; training timestamps must be finite and non-negative.
- Restores the frozen flag only from literal boolean `true`; malformed strings cannot accidentally turn freezing on.
- Keeps explicit finite checks at `train` and `trainFeatures` boundaries before prediction, training mutation, or the frozen fast path.
- Preserves preflight validation of every sample in a batch before any sample is trained, avoiding partial learning from an invalid later sample.

### Action/evidence lineage

- Makes the execution ID forwarded to the verifier a named immutable local and forwards an optional prior decision ID explicitly. The semantic contract is unchanged: verification remains bound to the exact tool, input, execution and decision.

### Independent evaluation tests

- Restores the executor fixture's executable permissions after deliberately testing that group/world-writable executables are rejected. Later path-replacement assertions can now reach the separate scratch-root identity guard instead of failing on the already-modified executable.

## Validation and honesty boundary

The code commits have been pushed to this working branch. The follow-up CI run on this exact head is the required proof; previous failing and passing runs are evidence for the root causes, not proof that these edits are already green.

Still not established by this pass:

- all optional provider credentials and model endpoints configured;
- production build, install-on-clean-machine and all schema migrations;
- full browser, Live2D, voice/audio and mobile/Termux end-to-end operation;
- independently measured gains in long-horizon learning/retrieval;
- host isolation being provided by a production sandbox launcher;
- final license/provenance audit for all imported code;
- rebuild and publication of a release ZIP newer than WorkPass70.

Do not promote a candidate skill or publish a release based on a passing unit test alone. Keep the current main branch and published archive unchanged until full release gates are green.
