# Neuro-Kurisu — WorkPass 20 implementation status (2026-10-11)

## Реальные изменения кода

- **Claim-level evidence интегрирован в canonical runtime.** `ResearchClaimAssessment.ts` создаёт `support / refute / mixed / unknown` на ограниченном exact-text-anchor уровне, хранит точную цитату/offsets/URL/document key/content hash/publisher key/fetch time, не выдаёт calibrated probability и явно помечает scope как `textual-anchor-only`. Это не NLI и не доказательство истинности мира.
- **Исправлен ActionGateway research seam.** Внешний результат теперь сохраняет `independenceKey`, `sourceHost`, `fetchedAt` и explicit `claim`; проектный executor получает данные, которые раньше терялись на адаптере, а session isolation включает хеш конкретного утверждения.
- **Claim-level conflict соединён с canonical MemoryOS2.** Достаточное разнообразие источников даёт только hypothesis notes. Если источники дают смешанные прямые support/refute anchors, предыдущие заметки по утверждению переводятся в quarantine даже тогда, когда document firewall видит разные страницы и не выставил собственный conflict. Цитаты и provenance остаются у доказательных записей; гипотезы не повышаются до фактов.
- **Исправлено повторное выполнение project outcome.** `AutonomousProjectExecutor` использует version 5, correlation по `executionId` и `stepId`, а также bounded persisted ledger последних 512 outcome IDs. Повторный receipt и устаревший receipt не могут завершить следующий шаг, даже когда соседние шаги используют один и тот же tool. Старые snapshots проходят нормализацию при restore.
- **Версия и release metadata синхронизированы.** Root version `20.0.0-super-final6`, runtime `35.42.0`, runtime manifest и lockfile aligned; добавлен root `audit:workpass20`, обновлены статус-инвентарь, scorecard и `Список дел.md`.

## Приёмка реализации

- `npm --prefix runtime/neuro-kurisu run typecheck` — PASS (semantic TypeScript compiler mode).
- `npm --prefix runtime/neuro-kurisu run audit:workpass20` — PASS: 20 claim-anchor cases, 5 idempotency/replay scenarios, 14 transport scenarios, research/firewall/persistence tests, project lifecycle and recovery.
- Root `npm run audit:workpass20` — запускает release metadata contract, UI source tests, browser-smoke contracts, runtime gates, memory retrieval benchmark, server import/UI/API linkage и asset checks.
- Production UI build остаётся **не подтверждённым**: environment не имеет установленных `vite` и `vite/client`. Нельзя считать это успешной сборкой.

## Что изменилось в normalized status

- Статус-инвентарь: **65 задач**, из них 46 DONE, 10 PARTIAL, 9 TODO.
- Взвешенный внутренний implementation scorecard: **70.75%** (предыдущая оценка 69,90%). Это оценка покрытия roadmap, не release readiness и не показатель интеллекта.

## Оставшиеся критические ограничения

1. Exact text anchor не ловит произвольные paraphrase/entailment; нужен реальный semantic NLI/claim verification и adversarial labelled corpus.
2. Claim extraction из произвольного вопроса ещё не автоматизирован: caller должен передать явное атомарное утверждение.
3. Syndication/source lineage (один пресс-релиз, перепечатки, зеркала) не определяется полностью одними hostname/доменами.
4. Нужен независимый temporal MemoryOS2 holdout; прирост памяти этим проходом не заявляется.
5. Нужны clean-room app dependency install, production build, браузерный E2E, Live2D browser testing, restore/rollback drill, soak и полный RC/SBOM/provenance sign-off.

## Следующий проход — реальный приоритет

1. Подключить полноценный semantic entailment/NLI provider за текущим claim-evidence интерфейсом; fallback остаётся `unknown`, если модель недоступна.
2. Встроить atomic claim extraction и source-lineage/syndication reduction, не создавая отдельного memory owner.
3. Улучшать action reafference/no-double-credit через существующие ledgers и довести сквозную UI/action trace.
4. Закрыть app build/browser E2E как release blockers.
