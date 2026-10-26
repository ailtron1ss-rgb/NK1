# Hexis / NK1 — validation gates

Состояние на 2026-10-26. PASS относится только к конкретному run ID и SHA; зелёный тест не доказывает production readiness.

## Пройденные gates

| Gate | Проверяемое поведение | Результат | Точное свидетельство |
|---|---|---|---|
| P65 pending prediction retention | 1 024 pending claims, старый replay после окна 512 IDs, диагностируемое отклонение overflow, bounded recent tail, restore/snapshot | PASS | [Run 40303671251](https://github.com/ailtron1ss-rgb/NK1/actions/runs/40303671251), code SHA `677f83a1ea056525995af1dea1f77bcf91ce8c0d` |
| Operation Omega review/provenance | Ed25519 review decision; source provenance + SourceMonitor parent lineage; signing/review regression | PASS | [Run 40303671373](https://github.com/ailtron1ss-rgb/NK1/actions/runs/40303671373), same code SHA |
| Repository wiring + Hexis adaptation | Workflow paths, scripts/imports, canonical MemoryOS2 evidence lineage, temporal late arrival/replay/conflict, outbox replay/rotation/restore/capacity | PASS | [Run 40303671470](https://github.com/ailtron1ss-rgb/NK1/actions/runs/40303671470), same code SHA |
| WorkPass105 signed artifact ingestion | Manifest binding, signature verification and explicit same-process duplicate rejection | PASS | [Run 40303671193](https://github.com/ailtron1ss-rgb/NK1/actions/runs/40303671193), same code SHA |
| WorkPass108 verified promotion | Paired evidence identity, signed verifier artifacts and promotion gate | PASS | [Run 40303671182](https://github.com/ailtron1ss-rgb/NK1/actions/runs/40303671182), same code SHA |
| WorkPass110 continual learning | Signed shadow evidence, independent evaluator, host-owned subprocess/path-identity checks | PASS | [Run 40303671237](https://github.com/ailtron1ss-rgb/NK1/actions/runs/40303671237), same code SHA |
| P26 Learning Validation | Existing P26 learning validation suite | PASS | [Run 40303671180](https://github.com/ailtron1ss-rgb/NK1/actions/runs/40303671180), same code SHA |
| Additional runtime gates | Reservoir replay; reflective payload budget; verified experience lanes; autonomous P23 repair; cognitive contracts; external postconditions | PASS | [WorkPass102](https://github.com/ailtron1ss-rgb/NK1/actions/runs/40303671212), [WorkPass99](https://github.com/ailtron1ss-rgb/NK1/actions/runs/40303671245), [WorkPass291](https://github.com/ailtron1ss-rgb/NK1/actions/runs/40303671184), [WorkPass292](https://github.com/ailtron1ss-rgb/NK1/actions/runs/40303671200), [WorkPass293](https://github.com/ailtron1ss-rgb/NK1/actions/runs/40303671209), [WorkPass294](https://github.com/ailtron1ss-rgb/NK1/actions/runs/40303671325), [WorkPass287/288](https://github.com/ailtron1ss-rgb/NK1/actions/runs/40303671241) |

The integration combines H1 with Operation Omega in merge commit `5202d0a8e71723f00ac74fd2343c59682ebb991a`. The latest code-tested head above is `677f83a1ea056525995af1dea1f77bcf91ce8c0d`. Subsequent commit `ef1b457854a3ac48d4f3ebb09901882b67ff8e22` changes only the changelog; it does not modify runtime code.

## Gates still open / not proven

| Gate | Required evidence |
|---|---|
| Retrieval efficacy | Immutable independent holdout, at least five paired seeds, Recall@k/precision, forgetting, cost and p95 latency. The previous baseline reported `recallDelta=0`; no uplift is claimed. |
| Production build and migrations | Clean-environment build, real schema migration/rollback and startup smoke test. |
| Live2D / browser | Real browser E2E with measured lip-sync drift and interrupt latency. |
| Android / Termux | Real-phone long-running soak with audio synchronization, device lifecycle, restart recovery and bounded resources. |
| Production reviewer identity/key custody | External operator identity workflow, protected private keys and rotation/revocation procedure. |
| Licensing | Review the pinned upstream tree and applicable notices per file family and dependency. |
| Canonical Release ZIP | Build the ZIP from the validated integrated code, verify checksum and check the actual GitHub Release asset. No Release asset update has been made in this pass. |

## Acceptance rule

Do not declare NK1 ready merely because a workflow passes. Readiness requires no critical safety regressions, no bypass of review/promotion gates, recoverable snapshots, independently measured positive learning effect, production build/migrations, browser/phone E2E, Release ZIP checksum and rollback evidence.

PASS means that run completed successfully on that SHA. A pending/cancelled run is not a PASS; the existence of a test is not proof that it ran, and a green focused suite is not proof that the whole organism is production-ready.
