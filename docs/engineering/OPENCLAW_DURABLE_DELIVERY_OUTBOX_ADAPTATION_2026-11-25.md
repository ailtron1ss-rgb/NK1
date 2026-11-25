# NK1 — OpenClaw durable delivery outbox adaptation

Date: 2026-11-25
Repository: ailtron1ss-rgb/NK1
Base branch: workpass70-source
Base SHA: 9008a8982a5173304456bee2c604bd0bc8665964
Donor archive: three.7z (OpenClaw, llama.cpp, Mem0, OpenAI Agents SDK, Letta snapshots)
Status: Draft PR #1182; no merge, main change, or Release mutation.

## Adaptation

The OpenClaw durable outbox lifecycle is adapted as a TypeScript sidecar using NK1's existing JsonStateStore and serialized OrganismRuntime. No OpenClaw agent runner or messaging implementation is copied.

The outbox stores bounded delivery metadata, stable deduplication keys, opaque payload references, expiry, attempt counters, and lease/reconciliation state. It does not store raw chat messages, prompts, credentials, or file contents.

## Integrated proactive-chat path

1. AutonomousSocialInitiativeEngine remains the only owner of initiative generation, content, consent, and quiet-hours policy.
2. OrganismRuntime.autonomousDialogueReady() writes a stable social-initiative obligation to DurableDeliveryOutbox before returning the existing API response shape.
3. The trusted server deliveryAdmission callback re-checks the exact Core initiative ID and mayDeliverUserVisible at claim time. This host admits only social-initiative; other outbox kinds remain closed.
4. DurableDeliveryOutbox is the single owner of delivery leases and attempt lifecycle. No competing retry/lease state is added to the social engine.
5. The browser persists its stable ui-initiative-ID transcript before calling the existing ACK API. It records positive ACK IDs in a bounded local marker and retries lost ACK responses from the persisted transcript on later idle polls.
6. An active lease suppresses another poll. After expiry, the same stable initiative ID can be re-exposed to the idempotent browser transcript; the transcript deduplicates the turn and its ACK resolves the ambiguous outbox record as delivered.
7. Repeated ACKs are idempotent. If Core committed but a later persistence step or HTTP response failed, a repeat ACK repairs the Core/OpenLoop sidecar and settles the outbox row.

## Failure and safety boundaries

- An expired lease becomes reconciliation-required, never directly pending.
- Only the browser ACK for the stable initiative ID resolves this UI recipient's ambiguous lease as delivered.
- Consent and quiet-hours are checked by the canonical social owner and again by host admission. Revoked consent suppresses future exposure.
- Browser storage failure prevents ACK. The unacknowledged initiative remains eligible for same-ID replay after its lease expires; a repeat transcript write does not create a duplicate chat turn.
- The outbox does not execute tools, contact third parties, send desktop notifications, or start voice delivery. This is a browser/API recipient integration only.
- Generic task/reminder/notification delivery remains host-gated and fail-closed until a real consumer explicitly owns it.

## Donor boundaries

- llama.cpp: NK1 already has OpenAI-compatible local chat and embedding paths. Its reranking endpoint remains a possible future optional shadow experiment, not part of this delivery change.
- Mem0: NK1 already has a Mem0 adapter and canonical MemoryOS2 retrieval; no second memory owner is introduced.
- OpenAI Agents SDK: NK1 already has ActionGateway, CognitiveEventFabric, continuity/receipt, and recovery seams; no second runner is introduced.
- Letta: the supplied archive was a small landing/docs snapshot, not a usable runtime source tree.

## Verification

The PR workflow runs the generic outbox contract, a real OrganismRuntime proactive handoff contract, browser transcript-before-ACK/lost-ACK retry tests, existing proactive-consent and OpenLoop regressions, and runtime typecheck.

No local NK1 checkout was available in this session; local test execution is not claimed. GitHub Actions on the exact final PR head is the verification source. Draft status is retained pending exact-head checks.
