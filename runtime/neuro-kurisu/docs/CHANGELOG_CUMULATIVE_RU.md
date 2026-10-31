# Neuro-Kurisu — Changelog

## 2026-10-31 — Aspect 01: runtime integrity and eleven-phase enforcement
- `UnifiedCognitiveCycle` теперь различает legacy-шестистадийный контракт и расширенный одиннадцатифазный: появление любой расширенной фазы включает требование полного набора; полнота проверяет уникальные event IDs для каждой обязательной стадии.
- Restore цикла использует только собственные перечислимые поля, нормализует счётчики/метрики/список отсутствующих фаз и отклоняет неизвестную версию до замены текущего состояния.
- `UnifiedCognitiveSubstrate` переведён с небезопасного object spread на явную проекцию allow-list; вложенные поля, счётчики, метрики и строки проверяются, неизвестные поля и prototype inheritance не переносятся.
- Интеграция substrate требует строго возрастающий safe-integer tick и проверяет входные группы до изменения состояния; replay/invalid input не должны мутировать проекцию.
- Добавлен `test:aspect01:cognitive-runtime-integrity` (legacy compatibility, 11-phase completeness, duplicate IDs, prototype pollution, invalid restore, tick replay, non-mutation) и подключён к WorkPass287-288 CI.
- Текущий PR HEAD прошёл 21 GitHub Actions workflow; это подтверждает CI на данном коммите, но не заменяет device soak, holdout и production E2E. Release не обновлялся.

## 34.1.0 — Portable Subject Boundary + evidence/benchmark hardening
- Introduced `neuro-kurisu.subject-transfer.v1`.
- Added persistent `subjectIdentity` and SHA-256 subject fingerprints.
- Portable Subject projection excludes embodiment and host capability state.
- Added tamper, identity-mismatch and clean-host adoption tests.
- Added `subject:export` CLI and subject-boundary release gate.
- Long-horizon regression now reports p50/p95/p99 and heap-growth signals separately from functional PASS.
- Removed one confirmed duplicate hot-path snapshot block.


## 34.0.0 — Canonical consolidation + API/runtime hardening
- Moved active P-phase documentation into history and established a small active documentation set.
- Regenerated architecture/release manifests from `VERSION.json`.
- Added `/health` and `/api/organism/status-lite`.
- Added remote API authentication boundary using `NEURO_API_TOKEN` when bound to a non-loopback host.
- Added route-uniqueness audit and server-level security smoke test.
- Preserved restart, memory, identity, concurrency, replay and long-horizon regression coverage.

## Scientific boundary
The project remains an L0 synthetic research system. Functional consciousness indicators are not claims of phenomenal consciousness or qualia.
## 2026-09-04 — BIG PASS 10

Добавлен adaptive advanced projection scheduler, который снижает стоимость persisted advanced snapshots за счёт разной cadence для critical/memory/reality/identity/developmental/slow ветвей. Добавлены scheduler efficiency tests и analysis-alignment audit; persistence/restart/memory regression gates подтверждены, а long-horizon scaling сохранён как честный WARNING.


## 34.31.0 — BIG PASS 60
- Unified world-learning integration inside `WorldSubsystemRuntime`.
- Added passive transition learning separated from action-conditioned learning.
- Centralized integrated P27/WorldModel2/residual prediction and rollout.
- Added model-agreement reliability/uncertainty signal and Core contradiction pressure when models disagree.
- Corrected context comparison so tick-only changes do not create false world transitions.
- Added Core, fabric and subsystem benchmarks/regressions.
- State schema remains 92; no new mandatory persisted branch.

## 2026-10-31 — Aspect 01: bind cognitive lineage to the requested runtime tick
- `CognitiveEventFabric.verifyOperationalCycle` теперь принимает необязательный `expectedTick` и отклоняет корректно связанный event-граф, если он относится к другому tick или replayed cycle.
- Production `OrganismRuntime` передаёт фактический tick при проверке одиннадцати фаз; несовпадение больше не может получить causal-integrity credit.
- Добавлен runtime integration regression: три реальных autonomous steps, проверка всех 11 phase IDs и parent edges, negative test для соседнего tick и restart round-trip persisted cycle state.
- Проверка подключена к WorkPass287-288 CI; Release ZIP не обновлялся.
