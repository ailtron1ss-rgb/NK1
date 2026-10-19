# P2700 — Unified Learning Loop

## Модуль
`src/organism/learning/UnifiedLearningSubstrate.ts` + `src/organism/core/OrganismCore.ts`

## Что реализовано
- Канонический жизненный цикл обучения: `experience → memory → replay → learning → policy → verification → consolidation`.
- Цикл имеет собственный persisted state, счётчики закрытых/проверенных циклов и измеряемые learning/policy/transfer/retention deltas.
- `OrganismCore` открывает цикл на реальном outcome, продвигает его по фактически выполняемым этапам и закрывает после обучения/проверки.
- Состояние совместимо с предыдущими релизами: восстановление старого `UnifiedLearningState` дополняет новые поля значениями по умолчанию.
- Добавлен runtime event `p2700-unified-learning-loop` для трассировки реального замыкания цикла.

## Проверка
`npm run audit:p2700` должен пройти typecheck + P2700 test + полный P2699 regression chain.

P2700 не заявляет биологическое сознание. Это инженерное замыкание общего learning-loop поверх уже существующих learner-модулей.
