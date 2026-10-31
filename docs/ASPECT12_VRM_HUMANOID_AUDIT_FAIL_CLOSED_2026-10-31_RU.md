# Aspect 12 — fail-closed humanoid rig discovery

**Дата:** 31 октября 2026  
**Рабочая ветка:** `work/nk1-aspect12-humanoid-rig-audit-validated-2026-10-31`  
**Область:** импорт локальных VRM/GLB в Avatar3DStage

## Проблема

Предыдущая эвристика искала знакомые имена вроде `Hips`, `Spine`, `LeftUpperArm` и `RightFoot` среди всех переданных scene nodes. При этом сама функция аудита не требовала, чтобы совпавшие узлы действительно были костями. В результате набор обычных `Group/Object3D/Mesh` мог получить положительный `fullBodyHumanoid`, если имена и искусственно связанная иерархия совпадали с шаблоном.

Это опасное смешение двух разных фактов:

1. В сцене существуют узлы с узнаваемыми именами.
2. В сцене существует пригодный к артикуляции скелет с однозначно сопоставленными костями и связной иерархией.

Первый факт не доказывает второй.

## Изменения

### 1. Только явные Bone-узлы

- Для сопоставления ролей допускаются только объекты с `isBone === true`.
- Обычные scene nodes с совпадающими именами не становятся ролями скелета.
- Поле `nonBoneMatches` перечисляет роли, для которых обнаружено только неподходящее совпадение.
- Если совпавшие имена есть, но ни одного явного Bone-узла нет, capability-флаги остаются отрицательными и добавляется поясняющее предупреждение.
- Повтор одной и той же ссылки на объект дедуплицируется; два разных Bone-узла с одинаковой ролью остаются неоднозначностью.

### 2. Связность скелета

Положительные признаки требуют не только имён, но и подтверждённой ancestry-связи:

- `hips → spine`;
- torso/chest/neck/head — если промежуточные кости присутствуют, проверяется их порядок; если chest или neck отсутствуют, применяется явно ограниченный fallback;
- обе руки — плечо (если оно найдено) → верхняя рука → нижняя рука → кисть;
- обе ноги — hips → бедро → голень → стопа.

Проверяются циклы в parent-графе единым обходом с состояниями узлов (`O(n)`), а не повторным проходом от каждой кости. Вход ограничен 50 000 узлами до дальнейшего анализа. Цикл или разрыв обязательной цепочки отключает `locomotionSkeleton` и `fullBodyHumanoid`. Наличие optional-узла само по себе не считается ошибкой, но если он присутствует, его положение также проверяется.

### 3. Пальцы

`fingerArticulation` теперь означает больше, чем наличие 30 имён. Для каждого из пяти пальцев на каждой руке должны существовать proximal, intermediate и distal, а путь от кисти к кончику должен быть связным. Частичная карта остаётся частичной и не обозначается как полноценная артикуляция пальцев.

### 4. Семантика capability-отчёта

- `head` означает наличие явной кости головы; шея остаётся отдельным optional-звеном.
- `torso` — наличие hips и spine.
- `bilateralArms`, `bilateralHands`, `bilateralLegs`, `bilateralFeet` отражают только обнаруженные роли.
- `locomotionSkeleton` требует torso, обе ноги, обе стопы и валидную hierarchy.
- `fullBodyHumanoid` требует все обязательные роли, отсутствие неоднозначностей и связность body hierarchy.
- `fingerArticulation` проверяется отдельно и не является условием `fullBodyHumanoid`.

## Регрессии

Добавлены сценарии:

1. Связный двусторонний скелет даёт ожидаемые capabilities.
2. Отсутствующая стопа и неоднозначная верхняя рука не проходят.
3. Scene nodes с теми же именами, но `isBone: false`, не отображаются в роли.
4. Совпадающий non-bone узел не делает одну реальную кость неоднозначной.
5. Разорванная рука и неправильная связь таза с ногой обнаруживаются.
6. Циклическая parent-иерархия отклоняется.
7. Отсутствующие chest/neck обрабатываются через ограниченный fallback без выдумывания костей.
8. Все 30 пальцев подтверждаются только с полными связными цепочками.
9. Повтор объекта не создаёт ложную неоднозначность; не-массивный ввод отклоняется.
10. Глубокая ациклическая цепочка обрабатывается одним обходом; превышение лимита узлов отклоняется до сканирования.

Команда: `npm --prefix app run test:vrm-humanoid-rig-audit`.


## 5. Нормативная VRM humanoid node map

Bone-only эвристика остаётся fallback для generic GLB, но не является корректным способом аудита VRM. В VRM роль humanoid bone задаётся через ссылку на **glTF node index**. Такой узел не обязан быть объектом `THREE.Bone` или входить в skin joints. Поэтому был добавлен отдельный путь семантического сопоставления:

- VRM 1.0: `extensions.VRMC_vrm.humanoid.humanBones` — объект role → `{ node }`, при `specVersion: "1.0"`.
- VRM 0.x: `extensions.VRM.humanoid.humanBones` — legacy-массив записей `{ bone, node }`.
- Индексы связываются с фактическими объектами загруженной сцены через `GLTFLoader.parser.associations` (`association.nodes`).
- Parent graph переносится на временные wrappers, чтобы audit работал с единым набором ссылок и не зависел от типа исходного Three.js объекта.
- В явном VRM-режиме сохраняются также безымянные промежуточные scene nodes: они могут законно располагаться между двумя humanoid node roles.
- При наличии VRM extension name heuristic выключен. Повреждённое расширение или неразрешённые обязательные индексы не могут «исправиться» за счёт случайных названий костей.
- Для VRM 0.x `chest` и `neck` обязательны; для VRM 1.0 они остаются optional согласно соответствующей таблице required bones.
- Дублирующийся node index, повтор роли, отрицательный/вышедший за диапазон индекс, неподдерживаемая версия и одновременное присутствие двух VRM extensions отвергаются fail-closed.
- Неизвестные для локального capability type роли сохраняются как diagnostics и не маппятся на произвольные joints.

Интеграция находится в `Avatar3DStage` и выполняется после успешного GLTFLoader parse. Она не меняет движение и не включает IK: только улучшает достоверность отчёта о реальной структуре импортированной VRM модели.

## 6. Дополнительные VRM regressions

Добавлены 8 сценариев node-map suite:

1. VRM 1.0 принимает авторитетные glTF node indices и валидные non-Bone humanoid nodes.
2. VRM 0.x применяет собственный список обязательных ролей, включая chest и neck.
3. Отсутствующие chest/neck в VRM 0.x не маскируются generic fallback.
4. Один glTF node index нельзя назначить двум humanoid roles.
5. Проверяются malformed extension, неподдерживаемая версия, отрицательный/out-of-range index, повторяющиеся legacy roles и конфликт двух VRM extensions.
6. Невалидное VRM metadata не включает name heuristic fallback.
7. Индексы, отсутствующие в active loaded scene, выдаются как unresolved diagnostics.
8. Безымянная промежуточная parent node сохраняется и не разрывает валидную ancestry.

Общий test script `npm --prefix app run test:vrm-humanoid-rig-audit` теперь включает generic audit и explicit VRM map suites. Stage regression отдельно подтверждает, что Avatar3DStage передаёт `parser.json.extensions` и `parser.associations` в adapter и отключает name fallback для VRM.

### Границы

Использование `GLTFLoader.parser.associations` подтверждено реализацией Three.js GLTFLoader: при создании node loader записывает исходный glTF index в association `nodes`, а после загрузки scene сохраняет associations для объектов этой scene. При этом association остаётся loader-level связью, а не самостоятельной проверкой runtime. Этот код не добавляет сам VRM expression runtime, spring bones, humanoid retargeting, IK/motor actuation, calibration или visual/device E2E.

Официальные источники спецификаций: [VRMC_vrm 1.0](https://github.com/vrm-c/vrm-specification/tree/master/specification/VRMC_vrm-1.0), [VRM 0.x](https://github.com/vrm-c/vrm-specification/tree/master/specification/0.0), [Three.js GLTFLoader](https://github.com/mrdoob/three.js/blob/dev/examples/jsm/loaders/GLTFLoader.js).

## Чего изменение НЕ делает

Generic GLB path — discovery/audit слой на основе имен и parent-графа; VRM path additionally validates the normative extension node map and node hierarchy. Neither path is a production VRM runtime: the implementation does not calibrate joint axes or bind pose, retarget clips, execute IK/MotorFrame, or verify the rendered frame. Для этих стадий остаются отдельные runtime-, калибровочные-, device- и visual-E2E gates.

Ни `main`, ни canonical GitHub Release ZIP не менялись.
