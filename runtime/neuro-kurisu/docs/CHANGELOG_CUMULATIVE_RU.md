# Neuro-Kurisu — Changelog

## 34.2.0 — Aspect 01: единая когнитивная проекция и целостность цикла
- Усилено восстановление `UnifiedCognitiveSubstrate`: явный allow-list полей, безопасная нормализация метрик/счётчиков/меток; неизвестные и унаследованные поля не принимаются.
- Добавлены строгая монотонность tick и защита от переполнения счётчика циклов; отклонённый tick не меняет состояние.
- Добавлен `workpass617-unified-substrate-restore-integrity.mjs`, зарегистрирован npm-скрипт и CI-шаг WorkPass287-288.
- Это hardening существующей bounded-проекции, а не новый владелец когнитивного состояния. Проверка считается пройденной только после успешного CI на точном HEAD.


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
