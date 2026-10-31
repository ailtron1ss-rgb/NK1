# WorkPass72 — Inspect AI: независимый оценщик доказательств NK1

**Основа:** `workpass70-source` на исходной вершине `5116c62ece761ca7a62cd70b1f0527e069a3591b` (31.10.2026).  
**Разработка:** изолированная ветка `nk1-inspect-eval`.  
**Тип:** локальный read-only integration adapter; не core runtime, не skill promotion authority.

## Почему выбран этот проход

В NK1 уже есть `CognitiveEventFabric`, строгий WorkPass71 verdict для 11 стадий, append-only action receipt projection, external observation projection, WorkPass294 correlation gates и P36 signed verified-outcome ledger. Повторное создание ещё одного receipt ledger или verifier дублировало бы владельцев данных.

Inspect AI используется как независимый harness: получает privacy-reduced JSONL, повторно проверяет полную причинную структуру и выдаёт отдельные reproducible logs/metrics. Никаких моделей, удалённых API, изменения MemoryOS2 или P23 в этой задаче нет.

## Что добавлено

1. TypeScript exporter из `CognitiveEventFabricSnapshot` в `nk1.inspect-evidence/v1`.
2. Повторный verdict в изолированном `CognitiveEventFabric`, с отказом при неоднозначных stage IDs.
3. Allowlist-проекция payloads; raw memory and conversation payloads не попадают в export.
4. Отдельный аудит action → outcome → evidence receipts, external observations и receipt revisions.
5. Node CLI с лимитами размера, одноразовым output path и SHA-256 output.
6. Python stdlib validator с собственным пересчётом 11 стадий, 20 causal edges, receipt identities, parent links и external postcondition corroboration.
7. Inspect AI 0.3.286 task с no-op solver и четырьмя scalar scorers. `model=None`; модель не вызывается.
8. Тесты корректной записи, пропущенного causal edge, дублированного ID, ложного declared verdict, неподтверждённого external claim и нарушения projection hash.

## Контракт и запреты

- Один sample соответствует одному tick; export не притворяется полным историческим журналом.
- 11 стадий и все причинные связи обязательны для full cycle.
- External postcondition требует отдельного event от `external-evidence`, matching hash pair, `independenceKey`, связи с точным execution receipt.
- Пустой список receipts не означает, что действия проверены; отдельный `evidence_presence` остаётся нулём.
- Inspect results не повышают навыки и не записываются в память.
- Сериализованная WeakMap attestation не является восстановленной process-local trust authority.

## Проверки

См. команды в `research/inspect-ai-nk1-evaluator/README_RU.md`. На момент подготовки документа локальные тесты ожидают запуска на CI/машине с Node 24 и Python 3.11+; нельзя считать тесты пройденными только по наличию скриптов. Интеграция Inspect требует установки закреплённой зависимости `inspect-ai==0.3.286`; в NK1 app/runtime зависимости она не добавляется.

## Следующий этап

После прохождения тестов подключить exporter к host-owned evidence snapshot endpoint; построить immutable multi-tick evidence pack; добавить Inspect task suites для автономной инициативы, памяти и recovery, используя независимые эталонные результаты. Затем рассмотреть CI artifact publishing (без raw snapshots) и лишь после этого использовать результаты как одну из независимых входных оценок, не как единственную promotion authority.
