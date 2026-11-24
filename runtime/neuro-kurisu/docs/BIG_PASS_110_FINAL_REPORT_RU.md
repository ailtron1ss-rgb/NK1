# BIG PASS 110 — Autonomous Cognitive Development Cycle

## Цель
Перевести P36 из режима `hypothesis/preview/evidence` к воспроизводимому циклу самостоятельного развития: обнаружение пробела → гипотеза → задача → внешняя проверка → доказательный gate → узкое изменение поведения.

## Главное изменение
Sandbox остаётся `preview-only` и не имеет права продвигать mastery, action bias или acceptedChanges. Только внешняя независимая holdout-evidence может перевести гипотезу в `holdout-verified` / `replicated`.

## Новый цикл
`autonomous-gap|goal-pressure|user-directed → development hypothesis → task-ready → real action → external evaluator → delayed/holdout evidence → bootstrap CI → promotion`.

## Интеграция
Активный цикл мягко влияет только на выбор релевантного действия через bounded `developmentTaskBias()`. Это не reward и не доказательство успеха. Core сохраняет цикл и evidence через restart/persistence.

## Защиты
- synthetic sandbox не может вызвать policy promotion;
- promotion idempotent;
- минимум два контекста и две положительные задержки;
- минимум четыре holdout для replicated;
- нижняя граница 95% bootstrap CI должна быть > 0;
- дополнительное evidence после promotion не увеличивает `acceptedChanges`;
- active cycle ограничен и сохраняется bounded ledger.

## Проверка
Functional Pass 109/110, migration, Core integration, typecheck и targeted regression suite — PASS. Длинные operational/mobile тесты проверяются отдельными bounded прогонами.

## Что это НЕ доказывает
Даже полностью пройденный gate доказывает корректность механизма и, при наличии реальных данных, может дать evidence of behavioral learning. Он не является доказательством сознания, субъективного опыта или свободной воли.
