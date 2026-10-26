# Hexis → NK1: карта интеграции и владельцев состояния

Дата состояния: 2026-10-26. Этот документ описывает фактические адаптеры в ветке `hexis-h1-memory-evidence-lineage-2026-10-26`, а не предполагаемые возможности.

## Основной архитектурный принцип

Hexis используется как источник проверяемых паттернов памяти, доказательств, временной истории, review, идемпотентности и безопасного исполнения. Он не разворачивается как второй автономный агент и не становится вторым владельцем памяти. Каноническое состояние остаётся в существующих структурах NK1; адаптеры переводят внешние идеи в контракты NK1.

| Область NK1 | Hexis-паттерн | Реальное решение в NK1 | Проверка / граница |
|---|---|---|---|
| `runtime/neuro-kurisu/src/organism/integration/hexis/HexisAdaptationFabric.ts` | Общий адаптационный слой: belief revisions, valid-time, review, HMX, outbox, connector policy, execution plan | Единый адаптер с ограниченными коллекциями, snapshot/restore, digest и метриками | `tests/integration/hexis-adaptation.mjs`; repository wiring audit |
| `runtime/neuro-kurisu/src/organism/developmental/MemoryOS2.ts` | Единый источник evidence lineage | MemoryOS2 остаётся владельцем записей доказательств; Hexis belief — проекция, а не отдельная конкурирующая память | `tests/integration/hexis-memory-evidence-lineage.mjs`; duplicate evidence не должен обновлять уверенность |
| `runtime/neuro-kurisu/src/organism/memory/P65EpistemicLedger.ts` | Наблюдение, вывод, убеждение, предсказание, контрфактуал и проверка предсказания | Отдельный эпистемический слой с ограничением очереди, сохранением pending predictions и sanitization при восстановлении | `tests/hexis-p65-pending-prediction-retention.mjs`; предел 1 024 незавершённых предсказаний |
| `runtime/neuro-kurisu/src/organism/memory/SourceMonitor.ts` | Источник утверждения и lineage | Отслеживание источника и epistemic status, без объявления metadata доказательством подлинности | `tests/operation-omega-hexis-source-monitor.mjs` |
| `runtime/neuro-kurisu/src/organism/integration/hexis/HexisAdaptationFabric.ts` — temporal API | История утверждения по времени действия | Поздно пришедшее событие вставляется в valid-time-порядок; повтор — идемпотентен; конфликт в тот же момент отклоняется до мутации | `tests/integration/hexis-adaptation.mjs` — late arrival, interval chain, duplicate, conflict, restore |
| `runtime/neuro-kurisu/src/organism/integration/hexis/HexisAdaptationFabric.ts` — outbox | Устойчивый action/outbox с idempotency key | Отдельный ledger ключей защищает от повторной отправки после ротации 512 terminal rows; активные записи не удаляются ротацией | `tests/integration/hexis-adaptation.mjs` — 520 active rows, terminal rotation, replay, corrupted restore, mass reclaim |
| `runtime/neuro-kurisu/src/organism/learning/HexisSkillReviewInbox.ts` | Human review и решение по skill candidate | Ограниченная очередь review с digest-bound packets, idempotent submission и аудитом решения | `tests/operation-omega-hexis-review-inbox.mjs` |
| `runtime/neuro-kurisu/src/organism/learning/AuthenticatedSkillReviewDecision.ts` | Проверяемое одобрение оператора | Подпись Ed25519 связывает reviewer, rationale, время решения, packet digest и decision digest; digest без доверенного ключа не считается аутентификацией | `tests/operation-omega-hexis-review-inbox.mjs`; приватный ключ вне NK1 |
| `runtime/neuro-kurisu/src/organism/learning/VerifiedOutcomeArtifact.ts` и `VerifiedOutcomeLedger.ts` | Проверяемые outcome-артефакты | Подписанные результаты проходят проверку manifest, задачи, verifier, подписи и ledger; restored ledger не наследует process-local trust receipt | WorkPass105 / WorkPass108 / WorkPass110 gates |
| `runtime/neuro-kurisu/src/organism/learning/IndependentSkillCandidateEvaluator.ts` | Независимое выполнение + verifier + safety scan | Исполняемость отделена от подтверждённого успеха: отказ verifier не делает исполненный кандидат «неисполняемым», но запрещает засчитать успех и продвижение | `tests/workpass203-independent-candidate-evaluator.mjs`; WorkPass110 |
| `runtime/neuro-kurisu/src/organism/learning/HostOwnedIndependentEvaluationServices.ts` | Разделённые host-owned executor/verifier/safety authorities | Отдельные исполняемые файлы, проверка identity, закрытые scratch directories и отказ при подмене пути | `tests/workpass243-host-owned-independent-evaluation-services.mjs`; WorkPass110 |
| `.github/workflows/repository-wiring-audit.yml` и `runtime/neuro-kurisu/package.json` | Исполняемые контрактные gates | Тесты Hexis входят в автоматический аудит ссылок и runnable scripts, а не остаются отдельными непривязанными файлами | Repository wiring audit |
| `legacy/input-archives/hexis-selected-2026-10-24/` | Фиксированный upstream source archive | Reference-only архив выбранных исходников; runtime не запускает Hexis/PostgreSQL напрямую | `SOURCE_MANIFEST.md`; отдельный license review всё ещё обязателен |
| GitHub Release asset | Канонический поставляемый артефакт NK1 | ZIP должен обновляться отдельно после принятия изменений в нужную ветку | В этом проходе Release asset не заменён |

## Владение и запреты

- MemoryOS2 владеет канонической evidence lineage; P65 — эпистемическим ledger; HexisAdaptationFabric — адаптационными проекциями и операционными журналами, а не вторым мозгом.
- Обнаружение кандидата, решение reviewer и активация кандидата остаются разными этапами. Создание запроса не равно одобрению; одобрение не равно активации.
- Никакая `status`, подпись модели или hash payload не доказывает истинность самого утверждения. Источник, authenticity и correctness — разные свойства.
- При неполной/неоднозначной истории внешнее действие блокируется или переводится в явно диагностируемое состояние; неизвестная операция не считается успешно выполненной.
- Не выполнять массовую миграцию старых воспоминаний и не менять основной retrieval до независимого benchmark с положительным recall delta.

## Оставшиеся связи перед release

1. Закончить текущие exact-head gates и устранить все реальные красные регрессии, не маскируя их тестовыми исключениями.
2. Проверить production key custody и реальную identity-provider/operator UI для подписанных решений review.
3. Проверить что timestamp/temporal API действительно вызывается из единого runtime там, где NK1 пишет новые факты, а не только покрыт API-тестом.
4. Выполнить независимые retrieval holdout с несколькими seeds и измерить Recall@k, precision, забывание, cost и p95 latency.
5. Прогнать production build, миграции, browser/Live2D E2E и реальный mobile/Termux soak; только после этого переносить проверенные изменения в canonical Release ZIP.
