# NK1 — OpenClaw durable delivery outbox adaptation

Date: 2026-11-25
Target: ailtron1ss-rgb/NK1
Base: workpass70-source @ 9008a8982a5173304456bee2c604bd0bc8665964
Donor: OpenClaw source archive supplied as three.7z (inspected locally)
Status: isolated implementation candidate; Draft PR only; no merge or Release mutation.

## Adapted mechanism
The donor's durable outbox lifecycle is adapted as a TypeScript sidecar using NK1's existing JsonStateStore and OrganismRuntime serial queue. No OpenClaw implementation files are copied and no second agent runner is introduced.

## Contract
- A row stores only an opaque payloadRef, stable dedupeKey, sourceTaskId/initiativeId/decisionId, consent-scope revision, expiry and retry/lease metadata. Raw prompts, credentials, message bodies and file contents are not stored in the outbox.
- Lifecycle: pending -> leased -> delivered, cancelled or dead-letter. If a lease expires or the obligation expires while leased, the record moves to `reconciliation-required`; it is not automatically re-queued.
- Leases recover after process interruption into a persisted quarantine state. Claim increments a bounded attempt counter; an expired lease alone is not proof that the external operation did not happen.
- Retry uses bounded exponential backoff; exhausted attempts remain visible in dead-letter.
- Acknowledgement requires the current lease owner and is one-shot.
- Recipient idempotency uses the stable dedupeKey; transport delivery is at-least-once, never described as exactly-once.
- Expiry and cancellation are explicit. A leased item cannot be cancelled without reconciliation because the external effect may already have occurred.
- Restore rejects malformed versions, accessors, duplicate IDs/dedupe keys, invalid leases and inconsistent delivery receipts.
- Capacity is bounded; only terminal history can be pruned to make room.

## NK1 integration boundary
- Canonical social initiative owner and OpenLoopRadar remain unchanged.
- Existing consent and quiet-hours policy remains host/social-owner responsibility.
- Runtime does not start a sender and gains no network permissions. prepareNextDeliveryObligation() returns a leased item only when a host-injected deliveryAdmission callback explicitly accepts it; absent callback means no claim.
- The host sender must re-check current consent/quiet-hours and execute the actual outbound operation through the existing ActionGateway with the outbox dedupeKey as its provider idempotency token.
- An ambiguous ActionGateway result must be reconciled before the sender acknowledges or retries the outbox item. `resolveReconciliation()` only accepts an explicit host outcome (`confirmed-delivered`, `confirmed-not-delivered`, or `cancelled`); unknown remains quarantined. A retry is only possible after confirmed-not-delivered, observes bounded backoff, and respects the attempt ceiling. Confirmed delivery settles the row without a duplicate send.
- This is a durable obligation/transport lifecycle, not a new executor and not a claim that a production channel transport is connected.


## Exclusive ownership boundary (2026-11-25)

The generic outbox deliberately supports only `task-completion`, `reminder`, `notification`, and `custom` obligations. It explicitly rejects `initiative-message`.

User-visible proactive social initiative delivery remains exclusively owned by the existing `AutonomousSocialInitiativeEngine` lifecycle in [PR #1181](https://github.com/ailtron1ss-rgb/NK1/pull/1181): its stable initiative identity, claim lease, bounded retry, consent/quiet-hours re-check, and browser durable-chat-before-ACK gate form one domain-specific state machine.

Do not enqueue the same social initiative into this generic outbox. Doing so would create two competing lease/attempt clocks and ambiguous ACK ownership for one logical user-visible message. If a future architecture consolidates the two paths, it must use one canonical lease owner and one authoritative acknowledgement boundary; that consolidation is outside this PR.

Regression coverage explicitly asserts that enqueueing `initiative-message` fails with `delivery-outbox-kind-invalid`. The generic outbox still carries optional `initiativeId` metadata only as correlation metadata for a generic obligation; it does not make the social initiative engine's ready-message stream eligible for this queue.

## Verification
- Added focused contract tests for deduplication, lease ownership, expiry recovery, retry backoff, dead-letter retention, cancellation, restore integrity and bounded capacity.
- PR workflow runs the new contract, existing consent/OpenLoop regressions and runtime typecheck.
- No local checkout was available in this session; local execution is not claimed. CI evidence must be read from this exact PR head before calling the change verified.


## Exact-head CI and architecture correction — 2026-11-25

Current inspected PR head: `46c5b4aceda81585ebdd07c80d09a7abf0c3e176`, base `workpass70-source@9008a8982a5173304456bee2c604bd0bc8665964`; compare is **26 commits ahead / 0 behind**, seven intended paths.

- [NK1 Module Dependency Audit — run 45610617629](https://github.com/ailtron1ss-rgb/NK1/actions/runs/45610617629): **SUCCESS**. Exact output: `DEPENDENCY_BUDGET=PASS checks=65 violations=0`; `CLEAN_ARCHITECTURE=PASS sourceFiles=2701 canonicalFiles=747 dependencyEdges=5732 runtimeEdges=4916 typeOnlyEdges=816 missing=0 cycles=0 legacyLeakage=0 boundaryViolations=0 dependencyBudgetViolations=0`.
- The same current-head run completed semantic TypeScript validation: `TYPECHECK=PASS mode=tsc compiler=PATH`.
- [NK1 Transitive Module Import Audit — run 45610616775](https://github.com/ailtron1ss-rgb/NK1/actions/runs/45610616775): **SUCCESS**.
- Earlier architecture audit on an intermediate head failed because `OrganismRuntime.ts` had runtime outdegree 46 against max 45. The separate direct Outbox import was removed: the implementation now lives in `organism/persistence/DurableDeliveryOutbox.ts`, and class/types are re-exported by the already-imported `persistence/FileStateStore.ts` facade. No dependency budget was raised. The exact current-head architecture run proves the corrected graph is within budget.
- An earlier focused run failed because the `.mjs` test used a TypeScript non-null assertion. The assertion has been replaced by valid JavaScript and an explicit `assert.ok`; current exact-head focused run [45610617751](https://github.com/ailtron1ss-rgb/NK1/actions/runs/45610617751) is still **pending** with no job assigned, so the outbox contract, consent regression and OpenLoop runtime regression are not yet claimed as passing.
- The broad PR check matrix is still processing (73 exact-head workflows in the last snapshot). Only explicitly listed completed runs above are counted as passed.

