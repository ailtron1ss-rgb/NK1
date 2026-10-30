# Аспект 15 — модульный гардероб и сменные элементы тела NK1

Дата обновления: 2026-10-30  
Рабочая ветка: `work/nk1-wardrobe-modular-clothing-pass-2026-10-30`  
Базовая ветка: `workpass70-source`  
PR: [#412](https://github.com/ailtron1ss-rgb/NK1/pull/412) — Draft, не слит.

## Краткий статус

**Инженерная готовность: 60/100.** Это оценка реализованного кода и тестовых контрактов, а не готовности к production/release. Реальные художественные активы и визуальная проверка на устройствах пока не закрыты.

| Подсистема | Оценка | Состояние |
|---|---:|---|
| Каталог гардероба, слоты, правила совместимости | 85% | Реализованы доменная модель, зависимости/исключения, выбор и закрепление |
| Безопасность пакетов и provenance | 85% | Manifest, MIME/path/size/hash, проверка всего payload; права остаются предметом отдельной проверки |
| VRM/3D загрузчик одежды | 75% | Multi-slot GLB, скелетная привязка, bind-pose gate, rollback и очистка |
| Стабильная идентичность тела/рига | 80% | Одежда исключена из поиска базовых костей; сохранение привязано к body+rig |
| Переключение и выбор слотов | 80% | Один элемент на слот, замена слота без потери остальных, проверка выбора перед apply |
| Локальное сохранение | 70% | IndexedDB, версия схемы 1, лимит 128 MiB, повторная проверка байтов при restore |
| Отмена асинхронных загрузок | 85% | Устаревший запрос отменяется до изменения сцены; подготовленные ресурсы освобождаются |
| Live2D смена одежды | 10% | Есть capability inspection; реальные drawable/part переключения не подтверждены |
| 2.5D смена одежды | 10% | Есть adapter contract; production layers/masks/deformation art отсутствуют |
| Реальные 3D garment assets | 0% | Нет проверенного production набора одежды для целевого тела |
| Визуальный E2E и Android | 0% | Не подтверждены на реальном устройстве |
| Release ZIP | 0% | Изменения этой ветки не включены в canonical Release ZIP |

## Что добавлено в этом проходе

1. `validateWardrobeAssetSelection` — единый строгий gate для неизвестных ID, дубликатов, неправильного renderer и двух элементов одного слота.
2. `updateWardrobeAssetSelection` теперь очищает устаревшие/чужие ID при следующем выборе, не затрагивая валидные независимые слоты.
3. `defaultWardrobeAssetSelection` пропускает malformed ID/slot и не выбирает повторяющиеся ID.
4. VRM apply в `Avatar3DStage` проверяет весь список выбранных активов до запуска загрузчика. Некорректный выбор не доходит до изменения сцены.
5. Добавлены регрессии на renderer scope, unknown ID, duplicate ID, duplicate slot и сохранение независимых слотов.

## Текущий технический поток

```text
Local wardrobe bundle
  -> manifest structure gate
  -> exact body + rig compatibility
  -> rights self-attestation (not legal verification)
  -> full payload byte length + SHA-256 verification
  -> renderer-scoped selection validation
  -> VRM bone map + bind-pose validation
  -> async GLB preparation (cancellable)
  -> scene commit + exact asset acknowledgement
  -> dispose replaced resources
  -> IndexedDB save (body/rig keyed)
  -> re-verify on restore
```

Любая ошибка до commit должна оставить прежний внешний вид активным. Нельзя объявлять asset готовым по наличию названия, превью или записи в manifest.

## План до 100%

### P0 — завершить software foundation
- [x] Единый каталог, слоты, правила зависимостей/исключений.
- [x] Структурная и байтовая проверка wardrobe pack.
- [x] Multi-slot VRM apply, rollback и очистка ресурсов.
- [x] Body/rig-bound IndexedDB persistence.
- [x] Отмена устаревшей асинхронной загрузки.
- [x] Один активный предмет на слот и строгая проверка выбора.
- [ ] Проверить новый точный HEAD специализированным wardrobe CI и app typecheck.
- [ ] Проверить полный набор тестов на том же финальном HEAD.

### P1 — первый реальный VRM комплект
- [ ] Зафиксировать canonical Kurisu VRM body и неизменяемый body fingerprint.
- [ ] Зафиксировать rig contract, humanoid bone map и допустимые версии.
- [ ] Создать/получить права на реальные GLB: халат, повседневный верх, низ, обувь, волосы/аксессуары.
- [ ] Проверить веса, bind pose, материалы, прозрачность, occlusion и anchors.
- [ ] Добавить reproducible authoring/export validator: GLB parse, bone coverage, weights, material refs, external URI rejection, triangle/texture budgets, manifest/hash output.
- [ ] Проверить каждый предмет и собранные комплекты на pose suite.

### P2 — production storage и UX
- [ ] Browser E2E: IndexedDB create/read/update/delete, restart restore, quota exceeded, blocked upgrade, corrupted record.
- [ ] Migration tests для будущих schema versions.
- [ ] Android WebView/device restore и нехватка диска.
- [ ] UI: слоты, варианты, совместимость, ошибки и ручной reset; не скрывать недоступные элементы.
- [ ] Явное удаление pack/outfit и очистка orphaned records.

### P3 — 2.5D и Live2D
- [ ] Проверить конкретную Kurisu moc3/cmo3 модель и фактически доступные drawables/parts.
- [ ] Разработать 2.5D garment layers: underdraw, masks, pivots, warp/deform, occlusion и hair/hand overlap.
- [ ] Live2D adapter должен переключать только реально существующие drawable/part IDs; если модель не поддерживает смену, сообщать unsupported.
- [ ] Оба renderer подключить к общему switch/ack/rollback contract.
- [ ] Не подменять смену одежды выражением лица, сменой текстуры всего тела или UI-лейблом.

### P4 — визуальная и release-приёмка
- [ ] Desktop + Android visual E2E на конкретном release candidate SHA.
- [ ] Pose suite: idle, walk, run, sit, arms crossed, reach, turn, crouch; проверка clipping и деформации.
- [ ] Измерить FPS, время переключения, память GPU/CPU и отсутствие утечек после многократных замен.
- [ ] Проверить body identity, эмоции, motor state и motion continuity после смены одежды/тела.
- [ ] Независимо проверить license/provenance/attribution каждого ресурса.
- [ ] Обновить canonical Release ZIP только после прохождения gates; Release, а не main, остаётся главным deliverable.

## Definition of Done — 100%

Аспект закрывается только при наличии реальных rights-cleared garment assets, работающих переключателей для каждого заявленного renderer, совместимости с телом/скелетом, правильной деформации в pose suite, сохранения и восстановления, rollback, визуального E2E на desktop и Android, измерений производительности и включения проверенного состояния в canonical Release ZIP.

Unit tests и metadata-only pack сами по себе не означают 100%.

## Последний проверенный checkpoint до текущего прохода

- Кодовый HEAD: `52ea82e3bf60f0524a32ad5bb2d5212b4d38b6dc`.
- [Wardrobe validation run #41086075600](https://github.com/ailtron1ss-rgb/NK1/actions/runs/41086075600): 62 passed / 0 failed / 0 skipped.
- [NeuroCore regression run #41086075782](https://github.com/ailtron1ss-rgb/NK1/actions/runs/41086075782): success.
- Текущий проход добавил дополнительный selection gate и регрессии после этого checkpoint. Они не считаются CI-verified, пока новый запуск не завершится на соответствующем HEAD.

## Ссылки

- [PR #412](https://github.com/ailtron1ss-rgb/NK1/pull/412)
- [Рабочая ветка](https://github.com/ailtron1ss-rgb/NK1/tree/work/nk1-wardrobe-modular-clothing-pass-2026-10-30)
- [Исторический подробный план Aspect 08](ASPECT08_MODULAR_WARDROBE_PLAN_RU.md)


## Additional production-authoring pass — 2026-10-30

- Added `app/scripts/wardrobe-authoring-preflight.mjs`: local fail-closed validation of manifest, safe paths, file presence, exact byte length, SHA-256, MIME signatures and GLB v2 chunk structure.
- The GLB gate rejects external buffer/image URIs and malformed/truncated chunk layouts before assets are handed to the runtime.
- Added focused regression tests for exact payload acceptance, tampering, MIME mismatch, traversal, valid self-contained GLB and external GLB resources.
- Added `npm run wardrobe:preflight` and `npm run test:wardrobe:authoring`.
- Added `ASPECT15_GARMENT_AUTHORING_PIPELINE_RU.md` with a reproducible Blender-to-GLB process, frozen target-rig identity, weight/bind-pose requirements, pose acceptance suite, 2.5D hidden-underdraw requirements and truthful Live2D capability rules.

### Updated progress estimate

- Aspect 15 engineering estimate: **61/100** (previous repository estimate: 59/100).
- Software foundation and authoring reproducibility improved; this is not a production asset or device-readiness increase.
- Actual production garment art remains **0% verified**.
- Actual Live2D and 2.5D independent garment switching remains **0% verified**.
- New authoring-preflight test suite is added but has not yet been run on the current branch HEAD.
- No browser/device visual E2E, legal rights review or refreshed canonical Release ZIP is claimed.

### New acceptance sequence

1. Run focused wardrobe and authoring-preflight suites on the current branch HEAD.
2. Run app typecheck and production build.
3. Freeze the canonical target VRM and publish its exact body/rig fingerprint.
4. Author and export first lab-coat GLB plus one alternative top; pass preflight and actual pose review.
5. Add browser visual tests for slot replacement, rollback and repeated resource cleanup.
6. Add real IndexedDB quota/restart and Android restore E2E.
7. Author 2.5D layered garment assets and inspect the Cubism source before claiming Live2D garment capability.
8. Complete independent rights review, then refresh the canonical Release ZIP from the verified source SHA.
