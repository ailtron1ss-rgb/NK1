# WorkPass397 — защита от обхода оценки через общий API активации

**Ветка:** `feature/learning`  
**Область:** P23 / verified skill lifecycle  
**Статус:** реализация и регрессионный тест закоммичены; выполнение на реальном CI runner по-прежнему не подтверждено.

## Проблема

Закрытие старого `approveReflectiveVerifiedSkillCandidate` само по себе оставляло второй маршрут: внешний код мог вызвать общий `approveVerifiedSkillCandidate` для уже staged reflective revision. Общий метод сразу делегировал в store, поэтому кандидат с `revisionProvenance` мог обойти специализированное сопоставление независимых baseline/candidate оценок.

## Исправление

- Публичный общий API теперь отклоняет кандидатов, у которых есть `revisionProvenance`, и указывает на независимый promotion gate.
- Поддерживаемый `approveIndependentlyEvaluatedSkillCandidate` выполняет собственные проверки fingerprint/provenance, matched evaluation и signed shadow evidence, после чего вызывает отдельный приватный финализатор. Он не использует публичный совместимый API и поэтому не попадает под запрет повторно.
- Кандидаты без revision provenance сохраняют прежний общий путь, если их допускают проверка подписанных shadow receipts и настроенный verifier авторизации.

## Регрессия

`runtime/neuro-kurisu/tests/p23-hermes-production-promotion-gate.mjs` теперь дополнительно проверяет, что общий API не может активировать reflective revision и не вызывает store approval. Новый тест находится в уже подключённом к P26 Learning Validation файле, поэтому отдельный workflow не добавлялся.

## Границы доказательств

Исправление закрывает программные обходы двух public promotion API; это не заменяет реальную изоляцию независимого evaluator, verifier и safety scanner в production. Тест и typecheck должны быть выполнены на точном HEAD с доступными step logs. Метрики роста обучения в этом проходе не измерялись; субъективное сознание не является выводом тестов.
