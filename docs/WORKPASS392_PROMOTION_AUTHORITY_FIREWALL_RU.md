# WorkPass392 — закрытие обхода независимой оценки при продвижении навыков

**Ветка:** `feature/learning`  
**Область:** P23 / Hermes reflective skill lifecycle  
**Статус:** изменения кода и регрессионный тест закоммичены; запуск теста на точном HEAD ещё должен быть подтверждён CI.

## Что было уязвимо

В обучении существовали два внешне похожих пути:

- `approveReflectiveVerifiedSkillCandidate(...)` принимал пары обычных отчётов baseline/candidate и проверял их арифметическую пригодность, затем связывал идентичность и бинарный исход с подписанными shadow receipts.
- `approveIndependentlyEvaluatedSkillCandidate(...)` требует envelope независимой оценки, отпечаток точного payload, provenance и согласование trial/task/seed/split/environment/manifest; перед активацией повторно проверяются receipts и одобрение.

Подпись shadow receipt подтверждает ограниченную область: идентичность запуска и бинарный исход. Она **не** подписывает показатели качества траектории, полноту шагов или покрытие навыка. Поэтому первая функция могла принять арифметически согласованные, но навязанные вызывающей стороной quality-метрики за основание для production promotion.

## Изменение

Старый report-only promotion API теперь работает по принципу fail-closed: он немедленно выдаёт явную ошибку и не вызывает verifier, store или операцию активации. Это сделано намеренно, а не как временная ошибка исполнения. Диагностический расчёт fitness остаётся доступным через `evaluateReflectiveSkillCandidate`, но он не получает полномочий на продвижение.

Рабочий production путь для независимой оценки — `approveIndependentlyEvaluatedSkillCandidate`. Он сверяет evaluation fingerprint с provenance staged-кандидата, связывает evaluation с точным payload и использует matched-evaluation gate до активации. Отдельное человеческое/доверенное одобрение и подписанные shadow receipts по-прежнему обязательны.

## Регрессия и CI

`tests/p23-hermes-production-promotion-gate.mjs` теперь строит набор, который проходит диагностический fitness gate (две validation задачи, две holdout задачи и улучшение кандидата), а затем убеждается, что legacy promotion API всё равно отказывает до проверки receipts и до обращения к approval/store.

P26 Learning Validation workflow включает этот тест и его точный путь в pull-request path filter. Так изменение теста само по себе запускает нужную проверку.

Команда на машине с Node.js 24 и установленными зависимостями:

```bash
cd runtime/neuro-kurisu
npm ci
node --experimental-strip-types tests/p23-hermes-production-promotion-gate.mjs
npm run typecheck
```

## Исследовательская основа и границы

В качестве архитектурного ориентира использован открытый [Hermes Agent Self-Evolution](https://github.com/NousResearch/hermes-agent-self-evolution): диагностировать реальные траектории, предлагать изменение, независимо оценивать кандидат и допускать его дальше только через guardrails и человеческое ревью. В NK1 переиспользуется этот принцип внутри уже существующего P23/Hermes lifecycle; исходный код Hermes в этом проходе не копировался и дополнительная runtime-зависимость не добавлялась.

Изменение закрывает путь повышения навыка через неподтверждённые метрики. Оно само по себе **не доказывает** рост качества обучения, перенос навыка между контекстами или субъективное сознание организма. До заявления об успешной проверке нужны реальные step-level результаты на точном HEAD; история NK1 содержит случаи, когда Actions завершался до назначения runner.
