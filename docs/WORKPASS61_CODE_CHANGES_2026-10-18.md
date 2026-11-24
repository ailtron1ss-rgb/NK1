# WorkPass61 — карта кодовых изменений

## 1. OutcomeCognitionFabric.ts

Добавлен `OutcomeProjectionEvidenceRevision` и ограниченный журнал ревизий. Источник ограничен `authoritative-provider-receipt`; receipt ID нормализуется и хешируется, исходный execution ID/tool проверяются. Ревизия строится детерминированно. Повтор той же identity с тем же fingerprint возвращает существующий результат; повтор с изменённым payload блокируется. Исходный record и base fingerprint не переписываются. Snapshot/restore сохраняет revisions.

## 2. CausalAccountabilityGraph.ts

Добавлен узел `evidence-revision` и отношение `supersedes`. Ревизия связана с существующим outcome в графе; новый tool-action или tool-outcome не создаётся. Повторы дедуплицируются; конфликтные данные закрываются отказом.

## 3. CognitiveEventFabric.ts

Добавлен sanitized reconciliation revision event, ссылающийся на исходную receipt-trace и предыдущую ревизию. Исходная action/outcome/evidence-тройка остаётся неизменной. `receiptRevisions` сохраняется как часть receipt projection index, переживает snapshot/restore, имеет bounded count и replay/conflict guard. Сырые provider receipt IDs и приватный body в событие не записываются.

## 4. OrganismCore.ts

В финализаторе reconciled provider-found receipt направляется через revision API, а не повторно вызывается strict `project()` с новым outcome fingerprint. При отсутствии основы сначала строится canonical base, затем отдельная ревизия. Путь синхронизирует OCF, causal graph, CEF, внешнее наблюдение и persist snapshot; side-effect executor не повторяется.

## 5. StateMigrations.ts и версия

Миграция ограниченно нормализует revision ledger, сохраняя совместимость со старыми persisted snapshots. Runtime — `35.81.0`, schema остаётся `225`, релизный статус не меняется на ready. Сгенерированы architecture/release/archive manifests.

## 6. Испытания кода

- `tests/workpass61-authoritative-receipt-revision.mjs`: базовая запись неизменна, revision replay/conflict, snapshot/restore/migration и append-only graph/event.
- `tests/workpass61-core-authoritative-reconciliation.mjs`: реальный `OrganismCore` finalizer, provider-found receipt, один side effect, persistence и replay.
- `npm run test:workpass61`: PASS (TypeScript + direct revision tests + OrganismCore integration + WorkPass60 checkpoint/reconciliation + WorkPass59 firewall regressions).

## 7. Не заявляется

Не подтверждено выполнение на реальном внешнем provider/device и восстановление после физического kill/restart процесса. Лайв receipt transport, browser E2E, memory uplift и release soak остаются открытыми.
