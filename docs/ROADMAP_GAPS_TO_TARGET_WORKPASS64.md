# Roadmap gaps after WorkPass64 (2026-10-18)

This pass addresses archival preservation of epistemically unresolved action outcomes. It does not approve a release or close the real external transport gate.

| Gate | Status | Remaining evidence |
|---|---|---|
| Action receipt/archive lifecycle | CODE FIXED; LIVE GATE OPEN | Hot-ledger eviction is fail-closed for unresolved states; append-only revision and archive recovery visibility have regressions. Still test on production files, migration snapshots and a real provider under process kill. |
| Real provider/device ACK gap | OPEN | One real safe reversible target must demonstrate acceptance-before-ACK timeout, SIGKILL, reconnect, read-only receipt lookup, independent read-after-write, same executionId and exactly one external mutation. |
| App install/build/browser | OPEN | Clean install from committed lockfiles, app typecheck, production build and actual desktop/mobile journeys for approval/no-ticket/decline/expiry/changed input/replay/reload/reconnect/errors. |
| Full causal learning provenance | PARTIAL | Test exact decision/execution/receipt/observation IDs, source independence, idempotent causal projection and temporal/skill/interest command after delayed receipt and restart against real provider evidence. |
| Memory quality | OPEN | Frozen labelled RU/EN holdout against BM25/hybrid baseline with correctness, Recall@k/MRR/nDCG, temporal accuracy, contradictions, false-recall, abstention, latency and resource metrics. Current uplift is zero; do not promote candidate. |
| Initiative and social feedback | PARTIAL | Long run with genuine user responses, stable initiative ID, interest reward through an idempotent command, restart and cooldown/no-spam guarantees. |
| Live2D voice/body | PARTIAL | Actual audio playback clock and viseme sample, target p95 mouth/audio offset <=100 ms, cancellation, no motion in silence, real model parameter mapping. |
| Toolmaker and self-improvement | PARTIAL | Candidate sandbox, reproducible baseline/eval, source/license/diff manifest, explicit approval, signed promotion/rejection and rollback. |
| Target local model | OPEN | GTX 1650 4GB profile: model/quantization, cold start, context, throughput, p50/p95, peak VRAM/RAM, concurrency and task quality. |
| Release/rollback/license/soak | OPEN | Clean-room install and state/memory/receipt restore; fault-injected rollback; SBOM and nested source/model/dataset license review; minimum 24h soak (72h recommended). |

WorkPass64 scoped implementation: **4/4 DONE**. Normalized inventory: **96 items, 78 DONE / 10 PARTIAL / 8 TODO**. Official weighted roadmap remains **80.1%** because real-provider, app/browser, independent memory quality and release operations are still open.
