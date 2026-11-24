# Neuro-Kurisu 34.71.0 — BIG PASS 98

## Compound Skills + Device Agency

### Реализовано

- Расширена существующая `ProceduralSkillLibrary` до state version 3.
- Добавлены многошаговые `CompoundSkillRecord` и компиляция навыка из завершённого Project DAG.
- Проектные одноразовые параметры фильтруются при компиляции, чтобы URL/ID конкретной задачи не становились частью долговечного reusable skill.
- Введён evidence-gated promotion: успешность, verified executions и независимое подтверждение нужны для перехода в reusable status.
- Добавлен bounded context transfer с fast-path/cached lookup для phone-first исполнения.
- Добавлены безопасные встроенные device tools: status, camera capture и Termux TTS.
- `OrganismCore.executeReusableSkill()` исполняет compound skill только через существующий `ActionGateway`.
- Destructive tool steps блокируются.
- Meta-поля reusable skill execution не передаются в device/tool input.
- Каждый шаг reusable skill проходит через `OutcomeCognition`.
- Verified external observation записывается в evidence trust/world update и memory event stream.
- Compound execution также создаёт причинное событие в memory event stream.
- Добавлены `/api/metrics`, `/api/organism/avatar`, `/api/organism/skills` и `/api/organism/skills/execute` для наблюдаемости/локального управления.
- `/api/health` теперь существует в обоих вариантах `/health` и `/api/health` и явно сообщает `ready`.
- Добавлена миграционная проверка v2 → v3 skill state.

### Инженерный результат

Цель PASS 98 — превратить дорогой reasoning в подтверждённую многошаговую локальную процедуру, которая может быть переиспользована с гораздо меньшей стоимостью на среднем Android/Termux устройстве.

Это не доказывает general intelligence или consciousness.

### Проверки

- Typecheck: PASS
- BIG PASS 98: PASS
- Skill migration: PASS
- BIG PASS 97: PASS
- BIG PASS 96 integration: PASS
- Server smoke: PASS
- Full project audit: PASS
- Legacy audit: PASS
- Archive manifest: должен проходить после генерации manifest из текущего дерева.
