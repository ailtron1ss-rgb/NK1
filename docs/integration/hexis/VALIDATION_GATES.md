# Hexis / NK1 — validation gates

Последнее зафиксированное состояние: 2026-10-26. Статус относится к конкретным GitHub Actions run IDs и не распространяется автоматически на другие SHA.

## Пройденные gates

| Gate | Проверяемое поведение | Результат | Свидетельство |
|---|---|---|---|
| P65 prediction retention | 1 024 pending predictions переживают record → snapshot → restore; дополнительное предсказание отклоняется с диагностиками; история остаётся bounded | PASS | [Run 40301977562](https://github.com/ailtron1ss-rgb/NK1/actions/runs/40301977562), code head `9eb588aa8bc255f3dbbdc1b955bfa2a778e556a9` |
| Repository wiring audit | Ссылки workflow, executable scripts, Hexis evidence lineage, HMX integrity и live API wiring | PASS | [Run 40301977349](https://github.com/ailtron1ss-rgb/NK1/actions/runs/40301977349), code head `9eb588aa8bc255f3dbbdc1b955bfa2a778e556a9` |
| WorkPass110 continual learning | Signed shadow evidence, independent candidate evaluator, host-owned subprocess and path identity | PASS | [Run 40301977431](https://github.com/ailtron1ss-rgb/NK1/actions/runs/40301977431), code head `9eb588aa8bc255f3dbbdc1b955bfa2a778e556a9` |
| WorkPass108 verified promotion | Paired evidence identity and verified promotion gate | PASS | [Run 40301977432](https://github.com/ailtron1ss-rgb/NK1/actions/runs/40301977432), code head `9eb588aa8bc255f3dbbdc1b955bfa2a778e556a9` |
| Hexis adaptation integration | Belief deduplication, temporal history, HMX digest gate, outbox idempotency/rotation/restore, connector policy and execution placement | PASS as part of repository wiring step | Run 40301977349; workflow step “Verify Hexis evidence lineage, HMX integrity, and live API wiring” |

Documentation-only follow-up after the validated code head: commit `6ba85d881ced8a452d94437dba50157198e0a791`. Subsequent code commits must trigger and pass the relevant tests again.

## Gates still open / not proven

| Gate | Why it remains open | Required evidence |
|---|---|---|
| Full P26 learning validation | A running/cancelled/partial run is not a green suite | Completed successful exact-head [P26 Learning Validation](https://github.com/ailtron1ss-rgb/NK1/actions) |
| Retrieval efficacy | Earlier NK1 reports showed `recallDelta=0`; code robustness alone is not an accuracy gain | Independent immutable holdout, at least five paired seeds, Recall@k/precision and cost |
| Production build and migration | Repository wiring CI is not a production deployment | Clean-environment production build, real DB migration/rollback and smoke test |
| Real browser / Live2D E2E | Unit and Node tests do not prove presentation, lip-sync or interrupt timing in a browser/device | Browser E2E plus measured animation/audio drift and interrupt latency |
| Android / Termux soak | CI does not exercise target phone audio/device lifecycle | Real-phone long-running test with audio synchronization, restart recovery and bounded resource use |
| Reviewer identity / key custody | Ed25519 logic validates supplied keys; it does not provision or protect production private keys | External identity provider/operator workflow, protected private-key storage and key rotation procedure |
| Release ZIP refresh | GitHub connector can edit source files and inspect Releases but the Release asset itself has not been replaced in this pass | Build the canonical ZIP from the validated commit, verify checksum and GitHub Release asset afterward |
| License review | The pinned archive contains selected upstream source; integration does not remove notices or substitute for legal review | Review upstream licenses/notices per file family and document allowed redistributions |

## Acceptance rule

Do not declare NK1 ready because a test workflow passes. Readiness requires: no critical safety regression; no unreviewed skill activation; recoverable snapshots; independently measured positive learning/retrieval effect; production build and migration; real browser and phone tests; confirmed Release ZIP checksum; and rollback evidence.

Status semantics: PASS means the referenced run completed successfully on that SHA. IN PROGRESS/PENDING/CANCELLED is not PASS. “Test exists” is not “test ran”, and “test ran” is not “system production-ready”.
