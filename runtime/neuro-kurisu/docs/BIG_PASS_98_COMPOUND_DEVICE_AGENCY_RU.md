# BIG PASS 98 — Compound Skills + Device Agency

Версия: **34.71.0** · state schema 111 · BIG PASS 98

Цель прохода: превратить подтверждённые проектные последовательности в переносимые многошаговые навыки, сохранив phone-first ограничения и не подменяя evidence самоотчётом.

## Что добавлено

- CompoundSkillRecord поверх существующего ProceduralSkillLibrary, без второго владельца навыков.
- Portable step inputs: проектные URL/ID и прочие одноразовые параметры не копируются в reusable skill.
- Evidence-aware promotion: минимум 3 выполнения, 2 verified и 2 independent evidence, достаточная успешность и confidence.
- Context-sensitive transfer с кэшем контекстов и быстрым exact-match путём.
- `OrganismCore.executeReusableSkill()` через существующий ActionGateway.
- Встроенные безопасные device tools: status, camera capture, Termux TTS.
- Каждый шаг reusable skill теперь проходит OutcomeCognition; external observation может создать evidence/provenance и world update.
- Финальное compound-skill событие записывается в memory event stream.
- Release metrics/API показывают compound skill statistics.

## Безопасность и честность

Destructive tools блокируются внутри reusable skills. Caller metadata (`contextKey`, `context`, `independentEvidence`) не передаётся в tool input. В live path independent evidence учитывается только при наличии реально наблюдаемого externalObservation. Сам факт собственного действия организма не считается доказательством намерения пользователя.

## Для среднего Android/Termux

Навыки позволяют дорогому reasoning постепенно компилировать многошаговую процедуру, которую позднее можно воспроизводить дешёвым локальным runtime. Это уменьшает необходимость повторного deep reasoning, но не является доказательством general intelligence или сознания.


## Compound binding hardening (34.72.0)

Многошаговые навыки поддерживают ограниченные bindings формата `$step:<stepId>.<outputKey>`.

Правила:
1. binding читается только из результата уже успешно выполненного предыдущего шага;
2. отсутствующий output или binding немедленно останавливает skill;
3. `verified=false` для обязательного шага делает весь execution unsuccessful;
4. `expectedOutputKeys` предотвращает передачу неполного результата следующему шагу;
5. runtime metadata (`contextKey`, `context`, `independentEvidence`) не становится procedural input;
6. destructive tools остаются заблокированными.
