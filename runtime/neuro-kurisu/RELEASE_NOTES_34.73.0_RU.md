# RELEASE NOTES 34.73.0 — BIG PASS 99 Skill Compiler + Adaptive Execution

Версия: 34.73.0 · state schema 111 · skill library schema 5 · BIG PASS 99

Этот релиз расширяет существующую ProceduralSkillLibrary до evidence-gated skill compiler/adaptive executor. Новая версия не добавляет отдельный planner и не объявляет навыки доказательством общего интеллекта или сознания.

## Основные изменения

- уникальный identity compound-skill больше не зависит только от последовательности tool/action и не коллидирует между проектами;
- compiled policy: лимит попыток, оценка resource budget, обязательная verification и минимальный evidence threshold;
- required input keys и expected output keys;
- fallback tools с fail-closed verification;
- bounded adaptation/mutation memory и verified fallback promotion;
- skill library schema 5 с backward-compatible restore старых схем;
- Core.executeReusableSkill использует policy, input bindings, fallbacks, resource budget и postcondition verification;
- добавлен BIG PASS 99 regression на collision, migration, binding, fallback и adaptation.

## Ограничения

Это всё ещё процедурный исполнительный слой. Он не равен обученной общей policy, не создаёт человеческого уровня general intelligence и не является доказательством сознания.
