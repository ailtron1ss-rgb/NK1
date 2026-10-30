# NK1 — канонизация 2.5D depth-rig и план сведения Aspect 04 (WorkPass 638)

Дата: 2026-10-30  
Рабочая ветка: `work/nk1-2p5d-depth-rig-2026-10-30`  
Основной runtime PR: #408  
Канонический моторный substrate: PR #410

## Решение

Для следующей интеграционной линии NK1 использовать **одну каноническую схему — `DepthRigManifest` из PR #408**. Не объединять две схемы через второй runtime или runtime-адаптер «на всякий случай». PR #409 сохранить как отдельный исследовательский/миграционный источник до переноса полезных требований и закрытия архитектурного расхождения.

Это решение основано не на названии PR, а на фактической степени интеграции:

- #408 содержит исполняемый Three.js adapter, проверку реальной иерархии импортированной GLB/VRM-сцены, fail-closed применение transforms и подключение в `Avatar3DStage`.
- #408 также имеет face resolver, speech viseme channels, secondary motion, capability gate и явный адаптер от PR #410 `MotorFrame`.
- #409 содержит более общий renderer-neutral affine layer adapter и полезные требования к нормализованным pivots, rest transforms, depth ordering, semantic gesture mapping и явной joint-to-node calibration.
- #409 пока не подключён к `Avatar3DStage` и не доказывает исполнение позы в живом renderer. Его схема не совместима с #408 по единицам, структуре узла, pose contract и renderer binding.

## Сравнение контрактов

| Область | PR #408 — canonical runtime | PR #409 — переносимые идеи |
|---|---|---|
| Пространство | `units: "scene"`, XYZ, Euler XYZ, 3D scale | `normalized-y-down`, 2D affine/rest transforms |
| Узел | parent, role, position, pivot, rotation, depth, parallax | parent, role, depthOrder, normalized pivot, rest, slot |
| Pose | массив полных bounded transforms | карта additive deltas |
| Проверка | версия/units, IDs, parent graph/cycles, диапазоны, visibility | root cardinality, finite rest, normalized pivots, hierarchy |
| Renderer | конкретный Three.js Object3D adapter | структурный renderer-neutral affine adapter |
| Runtime wiring | `Avatar3DStage` импортированной GLB/VRM сцены | отдельного stage wiring пока нет |
| MotorFrame | явный channel binding, измеренный `angleRad`, fail-closed | explicit joint-to-node calibration; текущая реализация использует target angle |
| Face/speech | отдельный face morph resolver и viseme mapping | не является основной областью |

## Что переносить из #409 без второго runtime

1. **Artist-authored rest pose и calibration.** Добавлять к каноническому manifest только после определения единиц и проверки обратной совместимости; не переинтерпретировать существующие XYZ manifests.
2. **Нормализованные pivots.** Хранить как исходные authoring metadata либо конвертировать при импорте только при наличии явных размеров artwork/texture. Не угадывать масштаб.
3. **Depth-order и occlusion metadata.** Использовать как authoring данные и валидировать против фактических scene nodes; не вводить второй pose graph.
4. **Семантические жесты.** Переводить в существующие semantic intent channels до resolver; не создавать второй источник эмоций/действий.
5. **Joint-to-node calibration.** Оставить явной таблицей binding, связанной с версией rig и skeleton; никаких fuzzy name matches.

## Обязательные правила интеграции

- PR #410 остаётся единственным motor controller / kinematics owner. Renderer не создаёт собственный контроллер и не подменяет измеренное состояние будущей целью.
- PR #408 остаётся единственным depth-rig pose/scene adapter для текущего Three.js пути.
- `AvatarStage` должен передавать только реальный, revision-bound MotorFrame из runtime. Нельзя синтезировать фиктивный кадр из semantic props или UI-состояния.
- Live2D параметрический ACK с #415 сейчас частичный: `complete: false`; он не является полным apply receipt и не подтверждает expression, motion или отрисованный кадр.
- Cross-renderer commit возможен только после concrete adapter apply receipt и независимого readback/verification для одной и той же revision.
- Отсутствующий layered artwork нельзя маскировать процедурной геометрией или плоским PNG. Production 2.5D требует скрытой прорисовки, масок окклюзии, pivots и авторских depth layers.

## Следующие инженерные этапы

1. Зафиксировать единственный schema owner и не добавлять новые параллельные схемы.
2. Проверить происхождение и жизненный цикл MotorFrame в runtime #410; затем протянуть его через родительский `AvatarStage` без синтетических кадров.
3. Довести VRM/GLB adapter до применения canonical motor pose к реальным bones и независимого readback; IK считается исполненным только после наблюдаемой позы.
4. Подключить #408 depth-rig manifest к реальному импортированному слоистому asset; текущие проверки на fixture не заменяют artist-authored model.
5. Для Live2D реализовать полный versioned adapter receipt/readback по подтверждённым CDI3 IDs; не объявлять текущий partial ACK завершённым.
6. Провести browser/device E2E и только затем разрешать транзакционный switch в #415.

## Статус доказательств

- #408: 23 focused depth-rig tests подтверждены отдельным CI run; широкие workflow подтверждены на ранее проверенном code HEAD, не автоматически на любом более позднем docs-only HEAD.
- #409: шесть workflow были зелёными на предыдущем проверенном HEAD; перед использованием кода нужно перепроверить текущий head и точный CI.
- #410: моторный substrate и его dedicated suites подтверждены предыдущими проверками; live runtime-to-renderer execution всё ещё не доказан.
- #415: coordinator contract tests не означают наличие concrete Live2D/2.5D/VRM adapters или реального round-trip.
- Ни один из этих PR не обновляет canonical Release ZIP. Последний Release ZIP остаётся deliverable baseline; его обновление требует отдельной сборки, проверки содержимого и подтверждения GitHub Release asset.

## Критерий готовности сведения

Сведение считается завершённым не при совпадении типов, а когда один canonical manifest управляет реальным authored asset, один MotorFrame проходит из runtime до renderer, renderer выдаёт наблюдаемый readback, а переход Live2D ↔ 2.5D ↔ VRM сохраняет revision-bound semantic state и корректно откатывается при несовпадении.
