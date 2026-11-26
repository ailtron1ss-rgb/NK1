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

## Ownership boundary

- `AutonomousSocialInitiativeEngine` and PR #1181 are the sole owners of proactive social initiative claims, leases, retry timing, consent/quiet-hours policy and browser ACK.
- This generic outbox does not enqueue, lease, acknowledge or reconcile `social-initiative` records. New `social-initiative` and `initiative-message` writes are rejected; legacy social rows remain readable but inert for snapshot compatibility.
- The generic queue is reserved for task-completion, reminder, notification and custom obligations.
- `OrganismRuntime` has no default generic delivery sender or admission policy. Without a host-injected `deliveryAdmission`, generic claims fail closed.
- `ActionGateway` remains the only side-effect execution authority; this outbox does not start transports or contact recipients.

## Failure and safety boundaries

- Every failure reported after a generic delivery lease is acquired becomes `reconciliation-required`; an error string or timeout does not prove that the recipient did not accept the side effect.
- Only authoritative host reconciliation may settle the row as confirmed-delivered, confirmed-not-delivered or cancelled.
- Confirmed-not-delivered alone can authorize bounded backoff and a new attempt. If the obligation has expired by reconciliation time, it is cancelled; if the attempt ceiling is reached, it becomes dead-letter.
- Unknown outcomes remain quarantined. Lease expiry follows the same rule.
- Raw message bodies, prompts, credentials and file contents are not stored in the outbox.

## Donor boundaries

- llama.cpp: NK1 already has OpenAI-compatible local chat and embedding paths. Its reranking endpoint remains a possible future optional shadow experiment, not part of this delivery change.
- Mem0: NK1 already has a Mem0 adapter and canonical MemoryOS2 retrieval; no second memory owner is introduced.
- OpenAI Agents SDK: NK1 already has ActionGateway, CognitiveEventFabric, continuity/receipt, and recovery seams; no second runner is introduced.
- Letta: the supplied archive was a small landing/docs snapshot, not a usable runtime source tree.

## Verification

The PR workflow is scoped to the generic outbox contract, existing language invocation-order and proactive-consent regressions, OpenLoop runtime integration, and runtime typecheck. Social initiative lease/ACK and browser transcript tests belong to PR #1181 and are not duplicated here.

No local NK1 checkout was available in this session; local test execution is not claimed. GitHub Actions on the exact final PR head is the verification source. Draft status is retained pending exact-head checks.

## Ambiguous failure semantics — implemented contract

A transport timeout, connection reset after request transmission, or lost response is not proof that the recipient did not perform the side effect. Therefore the word "failure" is not a sufficient retry disposition.

Required state transition:
- A definitive pre-send rejection or authoritative recipient result "not accepted" may enter bounded backoff and pending.
- An outcome that is unknown after the request may have crossed the side-effect boundary must enter reconciliation-required.
- Reconciliation may settle as confirmed-delivered, confirmed-not-delivered, or cancelled. Unknown remains quarantined; confirmed-not-delivered alone can authorize another attempt.
- A stable idempotency key must be reused across retries. The outbox does not claim exactly-once execution at the transport layer; it provides durable at-least-once attempts plus recipient idempotency/reconciliation.

This requirement is based on established distributed-systems guidance:
- AWS Builders' Library, "Timeouts, retries, and backoff with jitter": side-effecting APIs are not safe to retry without idempotency; a timeout does not establish that the side effect did not happen.
  https://aws.amazon.com/builders-library/timeouts-retries-and-backoff-with-jitter/
- Temporal, "Error handling": an Activity can complete and the worker can crash before reporting completion; retries may repeat execution, so activities should be idempotent and use stable idempotency keys.
  https://docs.temporal.io/develop/typescript/best-practices/error-handling
- Temporal, "Activity Definition": activities can execute multiple times, and partial side effects can repeat; downstream idempotency keys are required for effectful operations.
  https://docs.temporal.io/activity-definition

The focused contract now covers the full transition: a post-lease transport timeout becomes reconciliation-required; ordinary claiming stays suppressed; only confirmed-not-delivered reconciliation schedules bounded backoff. It also checks that an expired obligation with an ambiguous send is not cancelled until the host has confirmed non-delivery, and that legacy social rows remain outside the generic queue.


## Additional open-source implementation review

A developer-index search surfaced two useful implementation references with the same failure boundary:

- [Hermes issue #84257 — webhook idempotency and process-local delivery outcome](https://github.com/NousResearch/hermes-agent/issues/84257): a target may accept work before the sender observes a timeout/exception. Releasing the deduplication key on every failure can duplicate execution; retaining it for uncertain outcomes avoids that, while only an explicit pre-admission rejection can safely release it.
- [Mastra case-store outbox implementation](https://github.com/mastra-ai/mastra/blob/97ebf48fc194c5d7bcc315b5499270d1fbfb0f82/templates/template-customer-refund-agent/src/mastra/lib/case-store-outbox.ts): its uncertain external outcome is projected as an escalated/uncertain delivery state rather than treated as a routine retry.

NK1's outbox deliberately uses a stricter explicit reconciliation state instead of process-local dedupe or an unqualified retry. The design should remain small: the host adapter reports whether the side-effect boundary was definitely not crossed, definitely accepted, or unknown; the outbox persists that disposition and does not infer it from the error string alone.
