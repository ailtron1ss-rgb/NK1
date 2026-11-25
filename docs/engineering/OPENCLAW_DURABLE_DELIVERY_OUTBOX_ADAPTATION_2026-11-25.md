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
- Lifecycle: pending -> leased -> delivered, cancelled or dead-letter.
- Leases recover after process interruption; claim increments a bounded attempt counter.
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
- An ambiguous ActionGateway result must be reconciled before the sender acknowledges or retries the outbox item.
- This is a durable obligation/transport lifecycle, not a new executor and not a claim that a production channel transport is connected.

## Verification
- Added focused contract tests for deduplication, lease ownership, expiry recovery, retry backoff, dead-letter retention, cancellation, restore integrity and bounded capacity.
- PR workflow runs the new contract, existing consent/OpenLoop regressions and runtime typecheck.
- No local checkout was available in this session; local execution is not claimed. CI evidence must be read from this exact PR head before calling the change verified.
