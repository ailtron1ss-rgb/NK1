# WorkPass63 — code changes (2026-10-18)

## 1. ActionGateway outcome truth

`src/organism/system/ActionGateway.ts` now treats two ambiguous adapter response shapes consistently: (a) a generic exception from a keyed mutating operation, and (b) a returned `ok:false` response without explicit `effectStatus: not-applied`. Both preserve the prewritten durable pending receipt and return `idempotency-recovery-required`; they do not run the normal terminal finalizer or automatically invoke execute again. Adapters can use `ToolExecutionNoEffectError` / `effectStatus: not-applied` only when the operation is known not to have crossed the side-effect boundary. Partial outcomes are separately classed and left unresolved.

The read-only recovery queue includes completed executor-entered outcomes that still lack verified external postconditions. It is diagnostic only and does not expose input, idempotency key/hash, request fingerprint or provider payload.

## 2. Skill-level learning/replay firewall

`OrganismCore.executeReusableSkill` pauses the compound run for unverified, contradicted, partial and receipt-recovery states. It does not invoke a fallback tool because the primary side effect may already have happened; it does not classify a contradicted observation as a skill repair and does not emit skill-repair/learning credit from an unresolved effect. Explicit `failed-no-effect` remains eligible for a candidate repair because the target is known not to have changed.

## 3. Reconciliation finalization

`OrganismCore.finalizeToolOutcome` branches on whether a canonical outcome projection already exists for the original `executionId`. If yes, authoritative provider evidence uses the existing append-only evidence revision with immutable historical receipt. If no, the action remained pending before the authoritative receipt, so a single canonical action/outcome/evidence trio is created from that first established result; the implementation does not fabricate a revision of a nonexistent failure. WorkPass61's core test was updated to cover this ambiguity-first flow. The direct revision unit suite still validates replay/conflict on already-finalized outcome revisions.

## 4. New recovery E2E with a real local side effect

`tests/workpass63-filesystem-side-effect-recovery.mjs` starts independent Node processes against a real temporary directory. The adapter writes `real-target-state.json` using temp-file + fsync + atomic rename and then stores a separate fsynced provider receipt. The first process throws a generic transport error after target mutation/receipt persistence. A new process restores the durable organism state and exposes a redacted recovery queue, then performs read-only provider receipt lookup; the verifier independently reads the target file. Assertions cover one mutation, one adapter execution, same `executionId`, a completed verified receipt and safe replay. **This is local filesystem E2E, not a live remote provider/device test.**

`tests/workpass63-action-uncertainty-skill-firewall.mjs` verifies exception ambiguity, negative-response ambiguity, explicit no-effect terminalization, a contradicted postcondition, blocked fallback, no skill-repair write and recovery-queue inclusion.

## Commands

```sh
npm --prefix runtime/neuro-kurisu run test:workpass63
npm --prefix runtime/neuro-kurisu run test:workpass61:receipt-revision
```

The runtime TypeScript check and these suites were run directly in this environment. Production app dependencies were not installed: npm registry DNS returned `EAI_AGAIN`, so no Vite/browser/Live2D build claim is made.
