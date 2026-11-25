# NK1 Special Mechanisms — GitHub Modernization Workpass

**Date:** 2026-11-25  
**Repository:** `ailtron1ss-rgb/NK1`  
**Canonical integration baseline:** `workpass70-source@87c9ed9034e09ca9fb83fd676ac52bb46434c4fe`  
**Status:** implementation has been selectively ported into aspect-specific Draft PRs; no PR in this workpass has been merged or released.

## Why the local package was not applied wholesale

The local modernization package was assembled against archive SHA `615ffda7958273fed97aa809d374d8812eabed0a`, 983 commits behind the current GitHub source baseline. The archive remains an immutable source artifact. Each subsystem was inspected against current GitHub files; changes were ported only when the current code still lacked the intended behavior. Existing work from merged PRs was reused rather than copied.

## Integrated aspect branches and exact-head evidence

| Aspect | Current PR | What is in the branch | Exact-head evidence / status |
|---|---|---|---|
| Runtime checkpoint envelope | [#1170](https://github.com/ailtron1ss-rgb/NK1/pull/1170) | Canonical Core envelope for five owners; all-owner sidecar failure/retry matrix; malformed-present envelope fails closed; migration preserves explicit malformed values; JSON-equivalent restore comparison. | [Cognitive Core Consolidation](https://github.com/ailtron1ss-rgb/NK1/actions/runs/45559461133) PASS; [Cognitive Health Runtime Supervision](https://github.com/ailtron1ss-rgb/NK1/actions/runs/45559461268) PASS; exact-head aggregate previously 78/78 PASS. Draft. |
| Plugin ingress quarantine | [#1169](https://github.com/ailtron1ss-rgb/NK1/pull/1169) | Host-authorized, one-use, process-local source capability; caller-built lookalike metadata is quarantined before cognition. | [Plugin ingress](https://github.com/ailtron1ss-rgb/NK1/actions/runs/45560033253), [Cognitive Core](https://github.com/ailtron1ss-rgb/NK1/actions/runs/45560042522), [Cognitive Health](https://github.com/ailtron1ss-rgb/NK1/actions/runs/45560043021) PASS. One general startup-smoke run reported local gateway `fetch failed`; focused ingress and cognition paths passed. Draft. |
| Continuity journal and watchdog | [#1174](https://github.com/ailtron1ss-rgb/NK1/pull/1174) | Bounded crash-safe JSONL ledger; flush batch isolation; torn-tail/exact-offset repair; durable checkpoint timestamp only after the canonical Core save succeeds. | [Dedicated continuity durability workflow](https://github.com/ailtron1ss-rgb/NK1/actions/runs/45561251847) PASS, including Ledger, Watchdog/Core failure injection, restart, kill/resume and persistence suites. A separate Constitution Evolution run expected 403 but received 409; its server/test is outside this PR diff. Draft. |
| Read-only subsystem observability | [#1176](https://github.com/ailtron1ss-rgb/NK1/pull/1176) | 34 snapshot ports across 7 domains; safe status/timing metadata; invalid/throw aggregation; two-second cache; active scheduler separated from read-only scheduler snapshot; no cognitive tick or schedule mutation. | [Dedicated probe workflow](https://github.com/ailtron1ss-rgb/NK1/actions/runs/45564296665) PASS, including BigPass 48 and 59 regressions. Node strip-syntax check passed; semantic `tsc` is a separate gate. Draft. |
| Skill shadow evidence freshness | [#1177](https://github.com/ailtron1ss-rgb/NK1/pull/1177) | Signed evidence freshness on record and promotion; bounded future clock skew for all purposes; persisted active skills do not expire solely by age; approval CLI uses the same injected request clock. | [Dedicated freshness workflow](https://github.com/ailtron1ss-rgb/NK1/actions/runs/45563017738) PASS: signature, candidate lifecycle, CLI approval request and freshness tests. Draft. |
| Undo-First public Core boundary | [#1178](https://github.com/ailtron1ss-rgb/NK1/pull/1178) | Typed `OrganismCore.executeUndoForKey`; Runtime wrapper no longer reaches into private Core internals; existing single Runtime adapter registration is preserved. | [Undo-First Intelligence workflow](https://github.com/ailtron1ss-rgb/NK1/actions/runs/45564188694) PASS: 11 gateway cases, filesystem integration, hash/readback, path/symlink guards, durable artifact and restart replay. Draft. |

The SelfAuthorship / ActionGateway decision-bound receipt work continues on the existing canonical [#1157](https://github.com/ailtron1ss-rgb/NK1/pull/1157). A stacked duplicate [#1166](https://github.com/ailtron1ss-rgb/NK1/pull/1166) exists and was not copied into another branch. The broader verified-agency/outcome work remains in [#1168](https://github.com/ailtron1ss-rgb/NK1/pull/1168); it should not be collapsed into the receipt PR without its own contract and replay checks.

## What was already in the canonical source and was not duplicated

- Undo-First ActionGateway and the create-only FileStateStore adapter were already merged through [#1071](https://github.com/ailtron1ss-rgb/NK1/pull/1071). The Runtime registers the adapter once through `OrganismCore.registerActionTool`; Core-level re-registration would create duplicate tool IDs and was deliberately avoided.
- Temporal-credit horizon/anchor work from [#477](https://github.com/ailtron1ss-rgb/NK1/pull/477) was already merged. It was not re-applied.
- Existing ChronoTruth, Open Loop Radar, Cognitive Immune and Undo-First tests/adapters were inspected before extending their contracts; this pass does not claim all of those mechanisms are newly implemented.
- The 32 OmeStro special mechanisms remain a concept inventory, not 32 complete runtime modules. Readable snapshots are diagnostic evidence, not proof that a subsystem ran correctly on a live cognitive tick.

## Current architectural map

The cross-cutting execution contract remains:

`ingress → identity/provenance → admission/quarantine → decision → action receipt → external postcondition → temporal outcome/credit → canonical persistence → restart recovery → post-recovery validation`.

The current changes close selected links in that chain, but the whole chain is not yet one atomic, decision-bound contract. In particular:

1. **Checkpoint authority:** #1170 makes five runtime owners recoverable from one Core generation. A full RuntimeCheckpointManifest across Core, World, ActionGateway archive and P25 sidecar is still a separate integration task.
2. **Decision/outcome identity:** #1157 remains the working receipt/recovery aspect. CEF, SelfAuthorship and ActionGateway still need final independent review of one immutable decision/outcome contract and exact crash/replay semantics.
3. **External postcondition and credit:** postcondition proof must be causally tied to the selected action and later temporal credit; do not award success merely because an action was accepted or a local receipt was written.
4. **Ingress security:** #1169 establishes a host-issued provenance capability for the plugin path. Other external input channels still need equivalent, channel-specific admission coverage.
5. **Subsystem observability:** #1176 probes snapshots only. It does not prove invocation, correctness, causality, or autonomy.
6. **Embodiment:** real microphone capture, actual ASR/TTS playback receipt and the avatar renderer still require device-level tests, not simulated adapter checks.

## Verification boundaries

- Dedicated workflow PASS links above are exact-head evidence for their respective aspect branches at the time of this record.
- Several workflows use Node's `--experimental-strip-types` syntax validation because TypeScript compiler is unavailable in that focused environment. This is not semantic `tsc`.
- No real Android/Termux power-loss, p50/p95 latency, heap, microphone, playback, or avatar timing soak is claimed here.
- Independent review remains outstanding for all Draft PRs.
- No `workpass70-source`, `main`, release tag, GitHub Release ZIP, or immutable archive was changed by this workpass.

## Next engineering gates

1. Review and validate the Draft aspect PRs on their exact heads; integrate only through normal evidence-backed merge gates.
2. Complete a single decision-bound ActionGateway/SelfAuthorship/CEF outcome contract with replay after a lost acknowledgement.
3. Add temporal postcondition verification and causal credit attribution against externally observed results.
4. Design and test the full RuntimeCheckpointManifest across every durable owner, including ActionGateway archive and P25 sidecar.
5. Run semantic TypeScript validation and real Android/Termux restart/power-loss/device-soak measurements before raising readiness claims.
