# P36 — Autonomous Self-Development Mega Pack

## Практический эффект
P36 переводит саморазвитие из набора «можно предложить эксперимент» в отдельный управляемый цикл: организм оценивает дефицит, сам выбирает developmental focus, формирует гипотезу, запускает только безопасный локальный sandbox, сравнивает control/treatment и использует результат для изменения собственного поведенческого bias. Внешние и потенциально опасные действия P36 не выполняет.

## Что добавлено
- Development focus selection по world/self/perception/relationship/agency/resource signals.
- Self-development hypotheses с provenance, стоимостью и ожидаемым выигрышем.
- Safe sandbox experiments с control/treatment, replication heuristic и bounded learning budget.
- Curriculum с mastery по восьми областям.
- Observable `actionBias`, который действительно входит в ranking действий.
- Rollback accounting и связь с P30 continual rollback.
- P36 API и persistence в `facets.learning.p36`.

## Что P36 НЕ утверждает
- Автоматическая способность менять произвольный код.
- Автоматические внешние физические эксперименты.
- Доказанную свободную волю.
- Субъективное сознание.
- Полностью автономное научное исследование.

## Архитектурный принцип
Саморазвитие разделено на три зоны:
1. внутреннее наблюдение и гипотеза — автономны;
2. безопасный sandbox — автономен в bounded пределах;
3. внешнее действие — остаётся за Action Gateway и требует соответствующих разрешений.

## Связь с P33/P34
P36 может формировать self-development hypotheses, но не переписывает защищённое identity core автоматически. Существенные изменения личности должны проходить через P34 identity/consent workflow.

## Следующий шаг
P37 должен превратить sandbox-only development в полноценный автономный исследовательский цикл с генерацией и проверкой экспериментов, но только после появления более сильных semantic world representations и независимой device verification.
