# Roadmap gaps after WorkPass63 (2026-10-18)

This file tracks remaining gates; it is not release approval.

| Gate | Status | Why still open | Closure evidence |
|---|---|---|---|
| Real provider/device ACK gap | OPEN | New test uses a real temporary filesystem target and separately persisted fake adapter receipt, not a remote provider/device | Safe reversible real target: success/error/timeout-after-acceptance/SIGKILL/reconnect/reconcile/read-after-write/replay with exactly one external change and same executionId |
| Action learning provenance | PARTIAL | Ambiguous keyed failures are now held pending and skill fallback/repair is suppressed; full real observation/temporal credit/restart chain is not demonstrated | Exact IDs across decision/execution/provider receipt/independent observation/memory command with one idempotent credit |
| App install/build/browser | OPEN | npm install stopped on registry DNS `EAI_AGAIN`; app dependencies absent | Clean install from committed lockfile, typecheck, production build and actual desktop/mobile journeys |
| Memory quality | OPEN | Candidate retrieval delta remains 0 and candidate is not promoted | Frozen independent RU/EN holdout with correctness/Recall@k/MRR/nDCG/temporal accuracy/false-recall/abstention/latency/resources; repeatable uplift |
| Live initiative/interest | PARTIAL | Engine/persistence exists; no long live-provider social-response soak | Restart-safe, unique initiative IDs, no repeated theme/spam, bounded interest command on actual user response |
| Live2D speech/body | PARTIAL | State/gaze/motion logic exists, but true audio-clock/viseme target device not verified | Actual playback sample with p95 offset target <=100 ms, interrupt/cancel and no motion in silence |
| Toolmaker safety | PARTIAL | Candidate/supervisor code exists; this pass did not run a real promoted/offline-improved modification | Candidate sandbox → reproducible eval → source/license/diff → owner approval → signed promotion or rejection → rollback |
| Target local inference | OPEN | Hardware is not available in this environment | GTX 1650 4 GB profile: cold start, tokens/s, p50/p95, peak VRAM/RAM, context/concurrency, task quality and honest no-cloud fallback |
| Release/rollback/licenses/soak | OPEN | No clean-room release runner or 24–72h process in this environment | Restore/rollback drill, SBOM + nested file/model/dataset license review and monitored soak |

WorkPass63 scoped pass is 7/7 complete; weighted roadmap deliberately remains **80.1%**. Local filesystem recovery is useful evidence, but not equivalent to live external transport.
