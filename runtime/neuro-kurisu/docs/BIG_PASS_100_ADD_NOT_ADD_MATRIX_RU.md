# BIG PASS 100 — Матрица решений

## Добавлено
- Failure fingerprint: одинаковые по структуре сбои сводятся к устойчивому компактному идентификатору.
- Failure diagnosis: bounded классификация причины без притворства, что причина известна наверняка.
- Repair ledger: журнал попыток ремонта с инструментом, контекстом, уверенностью и holdout-флагом.
- Learned repair candidates: ранее проверенные варианты получают приоритет перед статическим fallback-порядком.
- Holdout promotion gate: замена основного инструмента требует повторного verified evidence и отдельного контекста.
- Skill lineageVersion: каждое существенное изменение навыка получает новую версию линии происхождения.
- Persistence/migration v5→v6.
- Тестовый контур PASS 100.

## Намеренно НЕ добавлено
- Генерация произвольного исполняемого кода во время ремонта: слишком большой риск и нет необходимости на этом этапе.
- Второй общий planner: создал бы конкурирующий источник решений и лишнюю стоимость.
- Автоматическое изменение canonical values/personality: не относится к ремонту навыка и нарушало бы evidence-gating.
- Продвижение fallback после одного успеха: создаёт confirmation bias.
- Неограниченный repair search: опасен для памяти/CPU телефона и может породить runaway behavior.
- Сознание как отдельный декоративный модуль: механизм не доказан и не должен имитироваться метрикой.

## Что осталось на следующие проходы
1. Repair variants с явной версией и rollback/branch lineage.
2. Holdout-наборы для разных классов задач, а не только runtime-контекст.
3. Связать repair evidence с CausalExperienceStream/UnifiedLearningSubstrate без дублирования.
4. Meta-skills: диагностика → проверка гипотезы → ремонт → валидация → rollback.
5. Улучшить memory consolidation и semantic vision — они остаются существенно слабее runtime substrate.
6. Long-horizon Android profiling/GC boundary: 5000-cycle benchmark пока не подтверждён.
