# BIG PASS 204 — Cross-Domain Cognitive Closure

## Цель

Закрыть разрыв между существованием независимых memory/world/self/agency/learning подсистем и доказательством, что один реальный operational experience проходит через них последовательно и переживает persistence boundary.

## Внедрение

Добавлен `src/organism/system/CognitiveDomainClosure.ts`. Он является evidence/measurement layer и не заменяет существующие subsystem sources of truth. На каждой полной cognitive-сессии создаётся compact before/after mark для пяти доменов, фиксируются expected/changed domains, propagation links, continuity score и persistence readiness. Состояние проходит через `StateMigrations`, поэтому не теряется после restart.

## Проверка

`BIG_PASS_204_COGNITIVE_DOMAIN_CLOSURE=PASS`

18 циклов: 18 complete, 0 incomplete, completion rate 1.0, mean continuity 0.93, persistence-ready 18/18, restore PASS.

Последний цикл: memory/world/self/agency/learning изменились; learning→self и agency→learning подтверждены. `memory→world` в текущей проверке намеренно остаётся неполностью доказанным — наличие общего цикла ещё не считается причинным доказательством переноса памяти в world model. Это оставлено как отдельная evidence debt, а не замаскировано.

## Регрессии

Typecheck, BIG PASS 193 core, 197 continuous life, 200 core, 201 longitudinal transfer, 202 device evidence, 203 passport, architecture, integrity, hygiene, syntax, release contract, forensics и release-source проходят.

## Следующий шаг

Закрыть именно `memory→world` как проверяемую causal propagation link: связать конкретный memory record/event с конкретным world-model observation/transition и подтвердить это restart/replay тестом. После этого перейти к массовому function-level closure внутри пяти доменов.
