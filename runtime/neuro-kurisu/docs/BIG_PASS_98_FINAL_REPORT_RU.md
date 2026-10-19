# BIG PASS 98 — Compound Skills + Device Agency

Версия: **34.72.0** · schema 111

## Цель

Преобразовать существующую procedural skill infrastructure в реально переиспользуемые многошаговые процедуры, соединённые с Project DAG, ActionGateway, OutcomeCognition, evidence/provenance и безопасными device tools. Главное ограничение: не создавать второй planner/skill owner и не выдавать procedural reuse за general intelligence или consciousness.

## Реализовано

1. `ProceduralSkillLibrary` → state version 3, compound skills, bounded context transfer, independent-evidence promotion, portable step inputs.
2. `AutonomousProjectExecutor` получил verified tool-step completion, из завершённого DAG можно компилировать compound skill.
3. `OrganismCore.executeReusableSkill()` исполняет reusable skill только через ActionGateway, блокирует destructive tools, удаляет execution metadata из tool input, проектирует каждый шаг через OutcomeCognition и пишет causal memory events.
4. Добавлены безопасные Android/Termux tools: device status, camera capture (opt-in), TTS.
5. Server surfaces: `/api/health`, `/api/metrics`, `/api/organism/avatar`, `/api/organism/skills`, `/api/organism/skills/execute`. Health теперь явно различает port-open и runtime-ready.
6. Fixed API metrics sensorium composition and added compound-skill statistics.
7. Добавлена migration v2 → v3.
8. Добавлены regression tests for compound execution, migration and server surface.

## Качественные ограничения

- Reusable skill не получает project-specific URL/ID как долговечную procedural memory.
- Собственное действие организма не считается доказательством намерения пользователя.
- Independent evidence может быть подтверждено live tool path только через external observation; ручной research API не должен интерпретироваться как автономное внешнее подтверждение.
- Destructive steps не исполняются как reusable skills.
- Наличие vision/camera tool не означает semantic understanding без backend evidence.

## Compound binding hardening

- verified output bindings между шагами;
- fail-closed при unverified step;
- expected-output validation.

Performance

Выявленный lookup hotspot был оптимизирован через context caching/exact-match path. Mobile 1000-cycle и targeted compound tests проходят. Отдельный 5000-cycle прогон в этой среде не является обязательным release gate; его следует выполнять на самом POCO/Termux железе как device certification.

## Проверки PASS 98

- typecheck
- compound skill integration
- skill migration
- BIG PASS 97 regression
- BIG PASS 96 integration
- server smoke
- mobile 1000
- full project audit
- legacy audit
- archive manifest

Vendor Live2D JSON tab warnings остаются намеренно: это asset-файлы, их переформатирование не даёт функционального выигрыша.


## Compound binding hardening — 34.72.0

- `CompoundSkillStep.inputBindings`: ограниченная передача данных из предыдущего verified result; формат `$step:<stepId>.<outputKey>`.
- `expectedOutputKeys`: обязательная проверка контрактных outputs перед продолжением.
- `verified=false` для обычного шага завершает execution fail-closed; reusable skill не сообщает `ok=true` при обязательном unverified outcome.
- отсутствующий binding останавливает skill до запуска следующего tool.
- skill state schema поднята с 3 до 4 с backward-compatible restore.
