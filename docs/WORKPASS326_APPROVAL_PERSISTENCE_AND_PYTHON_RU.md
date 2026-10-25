# WorkPass326 — восстановление согласования разрешений при занятости persistence и Python research runtime

**Дата:** 2026-10-25  
**Ветка:** `fix/cognitive-interrupt-severity-normalization-2026-10-25`  
**Draft PR:** [#135](https://github.com/ailtron1ss-rgb/NK1/pull/135)  
**Base:** `work/node24-project-pin-rebased-2026-10-25` (source baseline name remains `work/node24-project-pin-rebased-20261025`)

## Доказанный smoke-failure

Последний завершённый интеграционный прогон показал:
- server/version/UI snapshot, deterministic chat fallback и research bridge status — PASS;
- cognitive integration suite, runtime typecheck и app typecheck/build — PASS;
- два разрешения на research probes вернули HTTP 503 с `approval-storage-failed`;
- третий probe прошёл явное согласование, затем Python-модуль завершился на `ModuleNotFoundError: No module named 'torch'`.

В `OrganismCore` персистер action ledger явно отказывается от вложенного checkpoint, если `persistenceDepth > 0`, выбрасывая `action-ledger-persistence-busy`. `ActionGateway` ранее маскировал любую причину одинаковым `approval-storage-failed`, а HTTP API не различал временную занятость от постоянной ошибки записи. Независимо от этого, NeuroCore `pyproject.toml` требует `torch>=2.0`, но integration workflow не настраивал Python и не устанавливал эту зависимость.

## Исправления

### 1. Gateway сохраняет fail-closed семантику и объясняет transient busy

В `ActionGateway.ts` добавлено узкое распознавание единственного известного сигнала `action-ledger-persistence-busy`. Request/resolution/consumption по-прежнему откатываются в память при неудаче durable write; этот специфический случай выдаёт `approval-storage-busy`, а прочие причины остаются `approval-storage-failed`.

### 2. Ограниченный повтор только с внешнего HTTP boundary

Server routes для permissions `request`, `resolve` и `consume` повторяют операцию только при `approval-storage-busy`: начальная задержка 25 мс, удваивается до 250 мс, общий бюджет ограничен 8 сек (конфигурация `NEURO_APPROVAL_STORAGE_RETRY_MS`, предел 15 сек). При истечении окна клиент получает 503 с `retryable=true`.

Ретрай не применяется к постоянным сбоям хранения и не выдаёт разрешение автоматически. Одноразовый ticket остаётся привязан к tool, operation и точному input; потребление остаётся атомарным. Внутренний core не ретраит сам себя, чтобы не зависнуть, ожидая завершения собственной persistence batch.

### 3. Регрессионные тесты

В `tests/workpass53-action-approval-boundary.mjs` добавлены сценарии для каждого перехода:
- request: busy откатывает pending ticket; следующая durable попытка создаёт его;
- resolve: busy возвращает статус в pending; последующая попытка может одобрить;
- consume: busy оставляет ticket approved; последующая попытка может потребить его один раз.

Workflow теперь явно запускает `test:workpass53`, содержащий unit approval tests, Python bridge mock и real runtime/bridge E2E.

### 4. Явная CPU-зависимость исследовательской подсистемы

Добавлен `research/requirements-cpu.txt` с `torch>=2.0` из `research/neurocore-v143/pyproject.toml` и индексом CPU wheels. CI поднимает Python 3.12, ставит dependency manifest и выполняет `pip check` перед unified smoke. Path filters включают Python bridge, DeepCode/NeuroCore source, dependency manifest, ActionGateway и server.

## Проверка и ограничения

**Новый head ещё должен подтвердить эти изменения через CI.** Предыдущий прогон объективно доказал typecheck/build и когнитивные проверки, но не прошёл all-up integration smoke. Изменение причины ошибки и retry-поведение сейчас добавлены в код и тесты; успешный runtime/E2E результат нельзя заявлять до завершения нового runner.

Если CPU index не содержит совместимый wheel либо проявятся дополнительные недекларированные Python imports, исправлять их нужно в манифесте по конкретным логам, а не отключать probes или заменять их на mock в основном smoke.

## Дальнейшие release gates

Production browser/UI + real Live2D/TTS, Android/Termux audio, independent held-out retrieval/learning uplift, long-duration soak, license review and clean-machine release archive reproduction остаются открытыми. Этот проход закрывает реальные интеграционные причины smoke failure, но не завершает весь NK1 и не доказывает сознание.
