# WorkPass51 — передача работ (2026-10-16)

## База и выпуск
- Base: `Neuro_Kurisu_WORKPASS50_2026-10-16.zip`
- Root: `35.0.0-super-workpass51`; runtime: `35.72.0`; persisted state schema: `225`.
- Release status: implementation-workpass; gates remain open. Weighted roadmap deliberately unchanged at `78.0%`.

## Реальные изменения кода

### 1. Исправлена атрибуция temporal credit
`CanonicalTemporalCreditAuthority.ts` now includes only untargeted outcomes or outcomes targeting the exact `decisionId`. An event targeted at decision A cannot inflate the n-step return of adjacent decision B. When the bounded 64-decision journal must evict an unresolved decision, it creates an explicit `expired` assignment with zero confidence/eligibility instead of silently dropping it. Core outcome application skips expired assignments.

### 2. Reafference fails closed without independence
`ReafferenceEvidenceCodec.ts` rejects positive `match` without `independentSupportSources >= 1` and reconciliation status `supported`/`corroborated`. A large score alone cannot manufacture independent support.

### 3. Verified external outcomes now enter canonical episodic memory
`OrganismCore.ts` stores only exact-decision, independently reconciled, eligible, non-replayed outcomes as episodic `verified-external-action-outcome` memories in the one `MemoryFabric`/MemoryOS2 write path. It keeps decision/execution/observation links, source lineage/independence, timestamps, linked goal and whether observed conditions confirmed or contradicted the expected postcondition. The same outcome updates P33 through a stable idempotent evidence ID. No second memory or personality owner was introduced. This code path is tested using the existing external observation contracts; real hardware/provider proof remains open.

### 4. MemoryOS2 retrieval is intent-aware
`MemoryOS2.ts` detects Russian/English query intent for episodic recall, procedures, identity/preferences, current goals, causal reasons and factual definitions. It adds a bounded type/context fit term to the existing fused score and does not replace lexical evidence. Controlled same-lexical fixtures pass. The wider benchmark still reports `recallDelta=0`, candidate not promoted.

## Focused evidence
- `npm run typecheck` — PASS.
- `npm run test:temporal-credit-targeting-workpass51` — PASS (decision reward leakage prevented, overflow expiry explicit).
- `npm run test:reafference-codec-workpass51` — PASS (zero independent sources and unresolved reconciliation rejected).
- `npm run test:reafference-integration-workpass51` — PASS (episodic memory provenance/persistence across restart).
- `npm run test:memory-query-intent-workpass51` — PASS (six controlled query-intent cases).
- `npm run test:memory-retrieval-benchmark` — PASS as a benchmark run; `recallDelta=0`; no promotion.

## Still open; not represented as done
- Production Vite build and interactive browser/Live2D E2E: not run because app dependencies are absent in this execution environment.
- Actual configured language provider long-idle test; physical provider/device action receipts and reconnect/ambiguous-result paths.
- Independent labelled retrieval holdout with positive uplift; current broad recall gain remains zero.
- Exact audio-buffer/phoneme lipsync and target-host local model inference.
- Clean-room install/rollback, full review of nested source archive licenses/provenance and long-duration soak.
- This pass does not prove subjective consciousness and does not certify release readiness.

## Source archives
The four originals `one.7z`, `two.7z`, `three.7z`, `four.7z` remain intact in the Library folder `/Нейро Курису/Исходники/`.
