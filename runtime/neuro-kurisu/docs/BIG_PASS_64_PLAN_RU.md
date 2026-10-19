# BIG PASS 64 — План: External Observer Fabric

## Цель
Замкнуть реальный цикл между действием организма и независимым наблюдением его последствий без создания нового физического subsystem owner.

## Архитектурный принцип
`ActionGateway` выдаёт `executionId`. `ExternalObserverFabric`, физически принадлежащий `EvidenceResearchSubsystemRuntime`, хранит bounded observations и assessments. `OutcomeCognitionFabric` связывает execution → outcome → verification → observation → learning. `GroundedWorldState` получает только переданный контекст наблюдаемого мира. `CognitivePressureField` учитывает незакрытую внешнюю неопределённость и противоречия.

## Выполнено в этом проходе
1. Введён canonical `ExternalObserverFabric` с bounded state, дедупликацией, источниками, каналами и консервативной оценкой postcondition.
2. Добавлен сквозной `executionId` в action audit/execution и outcome-causal chain.
3. Добавлено разрешение внешнего наблюдения в `OutcomeCognitionFabric` и `CausalAccountabilityGraph`.
4. Добавлена производная causal autobiography — аудит причинной истории действий, без заявления о наличии субъективного сознания.
5. Добавлены read-only адаптеры filesystem/process/HTTP; HTTP не вынесен напрямую в серверный endpoint.
6. Наблюдения сохраняются через `EvidenceResearchSubsystemRuntime` и `PersistenceProjectionCoordinator`.
7. Внешняя неопределённость и противоречия входят в cognitive pressure и могут повышать приоритет проверки.
8. Добавлен защищённый API ingestion через существующий API authorization boundary.
9. Добавлены runtime, adapter и migration regression tests.

## Следующая работа
1. Подключить реальные Android/device observers к тому же контракту без нового owner.
2. Создать устойчивую corroboration-логику между независимыми источниками через существующий EvidenceTrustEngine.
3. Замкнуть verified observations в более богатые изменения world-state и обучающие обновления там, где семантика данных позволяет это доказать.
4. Провести реальную длительную Android-квалификацию и закрыть текущий открытый 1000-cycle device gate.
5. После этого оценить следующий крупный системный слой: persistent self/world representation и learned predictive representations, а не очередную россыпь P-модулей.
