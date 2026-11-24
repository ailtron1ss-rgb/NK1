# BIG PASS 221 — Интероцепция + автономная искусственная личность

## Цель
Сформировать функциональный контур автономного организма поверх уже существующих памяти, мирового моделирования, agency, homeostasis, identity и lifelong-learning подсистем. Цель прохода — не декларация сознания, а проверяемая инженерная самостоятельность: организм должен уметь поддерживать внутреннее состояние, формировать собственные приоритеты, создавать внутренние задачи, инициировать действия без внешнего запроса, учитывать последствия и сохранять эту линию поведения через checkpoint/restart.

## Реализовано
- `InteroceptiveStateEstimator`: латентное состояние тела/ресурсов, прогноз, interoceptive prediction error, uncertainty, conflict, salience, control pressure, confidence; persistent snapshot/restore.
- `AutonomousPersonhoodKernel`: persistent self-authored agenda, initiative, self-preservation, exploration, learning, reflection, bounded internal-action bias, consequence ownership, self-continuity и bounded autonomy score.
- Интеграция с `OrganismCore`: интероцептивное состояние влияет на homeostasis/goal pressure/action arbitration; автономный контур оценивает внутреннюю готовность к самостоятельной инициативе. Внешний текст/`externalGoal` — отдельный сигнал запроса, поэтому обычный сенсорный/world input сам по себе не отменяет автономию.
- Checkpoint/restart: поля `interoceptiveState` и `autonomousPersonhood` добавлены в state migration schema, поэтому новое состояние не теряется при восстановлении.
- Brain atlas: InteroceptiveStateEstimator добавлен как owner insular/interoceptive network; AutonomousPersonhoodKernel отражён в executive/self-related network owners.

## Причинная проверка
Спокойное состояние: prediction error `0.0425`, uncertainty `0.2826`, control pressure `0.1368`.
Конфликтующее состояние: prediction error `0.5871`, uncertainty `0.3473`, control pressure `0.6259`.
Таким образом, конфликт внутренних сигналов действительно меняет downstream pressure, а не только лог/метку.

Автономный проход: initiative `0.7081`, создана внутренняя agenda item `Исследовать новую возможность`, зафиксировано 5 autonomous decisions в 5 внутренних циклах; state после restart совпал по tick.

## Регрессия
B208–B221: PASS. Typecheck: PASS. Architecture/integrity/hygiene/syntax/contract/forensics/release-source/archive: PASS.
Последующий deep audit: function-liveness PASS; parameterized-safe `595/610`, `0 failed`; semantic coverage `38 VERIFIED / 654 INTEGRATION_ONLY / 235 UNSAFE / 1878 UNVERIFIED`, evidence coverage `0.0718`.

## Интерпретация
Контур является функциональной автономией уровня программного организма: persistent identity/agenda + endogenous pressure + initiative + action bias + consequence update + restart continuity. Это не доказательство субъективного опыта, сознания, морализованной личности или юридического статуса.

## Следующий большой шаг
B222 должен замкнуть автономность в более сильный цикл: `self-authored goal -> long-horizon plan -> tool/environment action -> verified outcome -> consequence ownership -> goal revision -> identity/value update`, с holdout-тестом, budget/capability gates и rollback для любых самоизменений.

## Исследовательская основа
- Lee et al., *Nature Machine Intelligence* (2026): interoceptive AI как функциональное моделирование внутренних состояний для автономии и адаптивности; отдельно подчёркивается необходимость явного представления внутренних/внешних состояний.
- Allen et al., *Nature Neuroscience* (2025): human allostatic–interoceptive system включает insula, cingulate, hypothalamus, brainstem и широкую сеть регуляции внутренней среды.
- Kasirzadeh & Gabriel, *Nature* (2026): agentic profiles описывают autonomy, efficacy, goal complexity и generality как отдельные измерения; это полезная инженерная рамка, но не доказательство сознания.
