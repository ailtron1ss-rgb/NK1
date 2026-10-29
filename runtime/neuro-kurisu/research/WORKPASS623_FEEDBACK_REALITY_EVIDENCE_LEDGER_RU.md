# WorkPass623 — устойчивые доказательства последствий действий

**Дата:** 29 октября 2026 г.  
**Рабочая ветка:** `work/feedback-outcome-ledger-hardening-2026-10-29`  
**Базовая линия:** `workpass70-source`

## Задача

Не допускать, чтобы повтор доставки события, перезапуск, конфликтующий payload или сообщение самого пользователя превращались в новое независимое доказательство реального последствия. Стабильный идентификатор — только ключ корреляции и идемпотентности; он не подтверждает истинность утверждения.

## Изменения в текущем проходе

### 1. RealityEvidenceLedger

- Сохранена обратная совместимость с версией снимка `version: 1`; поля `eventReceipts` и `quarantinedEventIds` необязательны, поэтому прежние снимки мигрируют постепенно.
- Для событий со стабильным `eventId` ведётся ограниченный индекс receipts, более широкий, чем активное окно доказательств. Повтор после вытеснения старой записи и после восстановления снимка не увеличивает `total` и не возвращает старое событие в активное окно.
- Один ID нельзя использовать с другим claim, классом, tick, confidence, source identity или parent links. Конфликт удаляет событие из активного окна, помещает ID в quarantine и запрещает его повторное использование.
- Повтор того же event допускает изменение только времени доставки. При той же остальной нагрузке confidence может быть снижена консервативной калибровкой, но не повышена под тем же ID.
- Snapshot restore проходит через отсоединение и проверку plain-data, валидацию типов/границ и повторное обнаружение конфликтующих ID. Persisted агрегаты независимости/внешних источников не считаются доказательством и пересчитываются из валидных активных строк.
- `external-observation` и `device-observation` — доказательства внешнего источника. `user-reported` отделён: он остаётся полезным контекстом, но не считается независимой проверкой мира.

### 2. Стабильная идентичность

Добавлен `EvidenceEventIdentity.ts`:

- `createStableEvidenceEventId` создаёт domain-separated SHA-256 key из канонизированного сериализуемого tuple и отказывает при ошибках/опасном input.
- `createRealityEvidenceEventId` создаёт идентификатор проекции, связанный с исходным событием, ролью проекции и discriminator.
- Ни одна функция идентичности не удостоверяет истинность данных и не должна подменять проверку источника.

### 3. Связь verifier → observer → canonical ledger

- `OutcomeVerificationService` теперь возвращает необязательный `evidenceEventId` только для структурно валидного внешнего postcondition с доказанным host-owned `toolId + executionId + decisionId + complete input + observationId`. Идентификатор — join key; реальный authority-check остаётся на точном объекте, выданном verifier в текущем процессе.
- `ExternalObserverFabric` принимает verifier-owned ID, создаёт для него детерминированный observation ID, дедуплицирует точный replay и отвергает повторное использование того же ID с другим payload. Источник должен совпадать с реестром ActionGateway; caller не может повысить доверие, подменив source class/channel/independence key.
- `EvidenceResearchSubsystemRuntime` записывает accepted observer outputs в `RealityEvidenceLedger`, применяя сохранённую при захвате надёжность источника. Пользовательский отчёт, симуляция и вывод самой модели получают отдельные классы реальности.
- `OrganismSystemFabric` прокидывает governance ledger как единственный canonical owner в research subsystem; второго конкурирующего журнала нет. `OrganismCore` передаёт полный input и тот же verifier-owned ID лишь при сохранённой привязке к decision/exec/observer.
- Публичный `ingestExternalObservation` повторно проверяет оригинальный verifier-owned объект и связанную пару action/decision, а не принимает событие на основании одной строки ID. Подделка/копирование корректного ID без этого объекта завершается fail-closed до записи наблюдения.
- `OutcomeCognitionFabric` явно хранит тот же `evidenceEventId` в `externalObservations`; ID валидируется и сравнивается при replay. Тот же observation ID с другой event identity отвергается. Restore проверяет вложенные observations и отбрасывает malformed/forged event IDs в сохранённых outcome projections.
- CI workflow path filters теперь включают Core, ActionGateway, owner/fabric, verifier, observer, OutcomeCognition, тесты и журнал, чтобы изменения на границе доверия не обходили специализированный gate.

### 4. Runtime-проекции

Шесть проекций в `OrganismRuntime` получают стабильный event ID, связанный с родительским событием: resource sample, shadow transition, embodied action, action consequence, neural-learning provenance и cognitive-cycle completeness. Это делает повторную проекцию одной причинной записи идемпотентной; несовпадающая нагрузка под тем же ключом приводит к карантину.

## Проверки

- `tests/workpass-feedback-reality-ledger-idempotency.mjs` проверяет детерминированные ID, hostile input, replay, conservative confidence down-calibration, запрет inflation, отделение пользовательского отчёта, corroboration/contradiction, bounded receipts и restore.
- `tests/workpass-feedback-outcome-chain.mjs` проверяет identity binding на полном tuple, отсутствие join ID при неполном lineage, передачу той же identity в Observer, общий owner ledger, отказ при payload conflict и replay после restore.
- Существующие regression gates: WorkPass294 correlation, WorkPass95 receipt integrity, WorkPass96 finalizer boundary и WorkPass94 verification-input binding.
- Полная команда: `npm run audit:workpass-feedback-outcomes`.

Статус каждого gate фиксируется по workflow run и exact commit SHA; наличие тестового файла само по себе не считается PASS.

## Границы результата

Этот проход закрывает внутренний путь identity/callback/ledger и регрессии на повтор/конфликт/restore, если новый gate проходит на актуальном SHA. Он не доказывает, что каждый provider receipt равен реальному физическому эффекту, не является испытанием на настоящем Android/устройстве и не подтверждает все инструменты в production. Для полного завершения нужны независимые provider/device E2E, fault-injection с timeout после внешнего side effect, проверка pending receipt, и доказательство что обучающий контур получает ровно один допустимый сигнал только от корректно верифицированного outcome.
