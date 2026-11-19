# WorkPass 71 — строгая полнота когнитивного цикла NK1

Дата: 31.10.2026  
База: workpass70-source @ 13d153ff91cd585fbea362ec9aff4d8dc9b93af8

## Что изменено

Добавлена двухуровневая политика:

- **Core cycle (6 стадий):** observation → prediction → action → outcome → learning → self-update. Сохраняется как диагностический показатель совместимости.
- **Full cognitive cycle (11 стадий):** observation → prediction → appraisal → attention → memory → goal → plan → action → outcome → learning → self-update. Только этот уровень теперь отражается в `UnifiedCognitiveCycleResult.complete` и `completeCycles`.

Полный статус требует одновременно:
1. Один корректный event ID для каждой из 11 стадий.
2. Уникальные ID: одна запись не может маскироваться под несколько фаз.
3. Все события относятся к одному tick.
4. CognitiveEventFabric подтвердил весь граф причинных связей.
5. `fullIntegrity01 === 1`, то есть весь строгий граф проверен, а не просто набран достаточный средний балл.

## Изменения в коде

- `CycleCompletenessPolicy.ts` — единое место для шести- и одиннадцатистадийного правила.
- `CognitiveEventFabric.ts` — добавлены `coreComplete`, `fullComplete`, `coreIntegrity01`, `fullIntegrity01`, списки недостающих стадий/связей и отдельный полный coverage.
- `UnifiedCognitiveCycle.ts` — `complete` теперь строгий alias `fullComplete`; добавлены раздельные счётчики и средние покрытия.
- `OrganismRuntime.ts` — в агрегатор поступают два независимых verdict от EventFabric.
- `workpass287-unified-cycle-contract.mjs` и WorkPass71 suite — обновлены/добавлены регрессионные тесты.
- CI workflow WorkPass287/288 запускает строгий suite.

## Миграция persistence v1 → v2

Старые snapshots принимаются без ручного преобразования. Старый `completeCycles` мог учитывать только базовые шесть стадий и потому переносится в `coreCompleteCycles`.

Он **не** переносится в `fullCompleteCycles`. Для исторических v1-событий нет надёжного доказательства, что все пять дополнительных стадий и их рёбра реально присутствовали. Поэтому миграция fail-closed:

- `coreCompleteCycles` сохраняет доказанную старую историю;
- `fullCompleteCycles = 0` до появления новых строгих свидетельств;
- `completeCycles` становится alias `fullCompleteCycles`;
- старый `lastComplete` может стать `lastCoreComplete`, но никогда автоматически не становится `lastFullComplete`;
- историческая `meanStageCoverage01` переносится в `meanCoreStageCoverage01`; новая строгая полная coverage начинается с нуля.

Это может снизить отображаемый показатель полноты после обновления. Это намеренная защита от ложной ретроспективной сертификации, а не потеря episodic memory или личности.

## Проверки

Запуск из `runtime/neuro-kurisu`:

```bash
npm run test:workpass287:cognitive-cycle
npm run typecheck
```

Первый скрипт объединяет прежний WorkPass287 regression и WorkPass71 strict suite. Новый suite проверяет:
- 6/11 не считается полным;
- 11/11 без full EventFabric lineage не считается полным;
- duplicate IDs не засчитываются;
- отсутствие plan/родительских рёбер блокирует full verdict;
- v1 persistence мигрирует консервативно в v2;
- счётчики восстанавливаются в непротиворечивое состояние.

В отдельном CI также запускается WorkPass71 validation workflow с runtime typecheck. До получения точных результатов CI изменение считается committed candidate, но не production-validated.

## Границы результата

Этот этап исправляет **достоверность метрики когнитивной полноты**. Он не доказывает субъективное сознание, интеллект, рост recall, работу модели на телефоне или длительную автономность. Эти свойства требуют отдельных внешних экспериментов и реальных device evidence.
