# Neuro-Kurisu — Core Architecture Pass R8

Дата: 2026-09-25
Фокус: устранение главного архитектурного долга `OrganismCore` без потери поведения.

## Результат

### До
- `OrganismCore.ts`: 10 146 строк.
- 358 import-строк.
- 255 прямых constructor-owners в самом Core.
- Большая часть доменных engines физически создавалась и хранилась в Core.
- Persistence/continuity B285 имела подтверждённый restart divergence.

### После
- `OrganismCore.ts`: 9 805 строк.
- 356 import-строк.
- 4 прямых constructor-owners.
- Остались только композиционные владельцы:
  - `OrganismSystemFabric`
  - `DevelopmentalNeuralRuntime`
  - `CognitiveRuntimeCluster`
  - `PersistenceRuntime`
- Доменные engines перенесены в существующие физические subsystem runtimes: self, agency, memory, embodiment, world, research, governance.
- Camera evidence перенесён в embodiment owner.
- `CognitiveKernelCoordinator` и `CognitiveSubsystemRegistry` перенесены в `CognitiveRuntimeCluster`.
- В `CognitiveRuntimeCluster` добавлен явный constructor context вместо доступа к Core.

Это снижает прямое constructor ownership Core на 251/255 (~98.4%).

## Что реально изменено

1. Массово устранено прямое ownership доменных модулей из `OrganismCore`.
2. Поведение существующих алгоритмов не переписывалось.
3. Persistence и restore пути переключены на новые владельцы через прямые runtime references.
4. Исправлен `B285NeuralLifeConsolidationCore`:
   - `activeScarContextKey` теперь является persisted state.
   - после B301 compaction восстанавливается каноническое durable state.
   - restart equality снова проходит.
5. `scripts/audit-core-ownership.mjs` усилен отдельным ownership-contract для extracted fields и ограничением Core до 4 прямых constructors.
6. Добавлены package scripts:
   - `audit:core-architecture`
   - `test:core-architecture-pass`
7. Обновлён archive manifest.

## Проверка

PASS:
- TYPECHECK
- CORE_OWNERSHIP: `directConstructors=4`
- CLEAN_ARCHITECTURE: `cycles=0`, `missing=0`, `legacyLeakage=0`
- SOURCE_HYGIENE: `errors=0`, `warnings=0`
- EXECUTABLE SYNTAX
- INTEGRITY
- RELEASE CONTRACT
- ARCHIVE MANIFEST
- Organism smoke
- B285 core life/consolidation + restart equality
- P2855 contextual action policy
- P2855 policy ablation
- P2855 organism policy integration

## Behavioral/performance check

В сравнении с исходным Core на том же окружении:
- smoke wall-time: примерно 13.43 s → 13.43 s;
- P2855 organism policy integration: примерно 3.12 s → 3.10 s;
- функциональные результаты P2855 совпали.

То есть структурная декомпозиция не потребовала принятия измеримой деградации этих проверочных путей.

## Важное ограничение

`OrganismCore` всё ещё около 9.8k строк. Главный ownership debt устранён, но следующий долг — не поля, а control-flow/method decomposition. Не следует сейчас снова плодить универсальные `*Cluster`-классы.

## Следующий проход

R9 — **Core Orchestration Decomposition**:

1. выделить lifecycle/init/restore/checkpoint orchestration;
2. выделить cognitive-cycle orchestration по этапам observation → prediction → decision → action → outcome → learning;
3. перевести Core из большого implementation body в тонкий execution coordinator;
4. сократить private method surface без изменения canonical state ownership;
5. после каждого выноса обязательны typecheck + smoke + restart + P2855 + performance A/B.

После R9 отдельно оценить `DevelopmentalNeuralRuntime` и `CognitiveRuntimeCluster` на предмет собственного чрезмерного ownership и, только при наличии доказательств, разделять их дальше.
