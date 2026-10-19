# BIG PASS 160 — Semantic Coverage & Behavioural Verification

## Что изменено
- Добавлен единый evidence-first типовой слой `SemanticCoverageEngine`.
- Добавлен AST inventory всех функций в `src` и тестовом/исследовательском корпусе для поиска ссылок.
- Добавлена классификация риска автоматического запуска.
- Добавлен machine-readable `SEMANTIC_COVERAGE_AUDIT.json` и подробный `SEMANTIC_COVERAGE_AUDIT_RU.md`.
- Добавлен реальный runtime-проход `observe → cognitive state change → flush → restart`.
- Добавлен zero-argument sweep методов `OrganismCore` с таймаутом; опасные destructive методы намеренно не запускаются.
- Добавлена регистрация direct/integration/persistence/regression evidence.

## Статусы
`VERIFIED` требует прямого выполнения + интеграционного/регрессионного эффекта + persistence/replay evidence.
`INTEGRATION_ONLY` означает, что функция действительно выполнялась, но доказательств недостаточно для полного статуса.
`UNSAFE_TO_AUTO_RUN` означает, что автоматический вызов может быть разрушительным или иметь внешний side effect.
`UNVERIFIED` означает отсутствие достаточных поведенческих доказательств.

## Главный принцип
Код не считается внедрённым по факту наличия класса, метода или теста с PASS. Граница готовности — наблюдаемый эффект и сохранение этого эффекта там, где это необходимо.
