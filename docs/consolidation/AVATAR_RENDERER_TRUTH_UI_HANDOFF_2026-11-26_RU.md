# NK1 — avatar renderer truth и доступность интерфейса

Дата: 26 ноября 2026

## Рабочий контекст

- Каноническая исходная ветка: `workpass70-source`.
- База этого прохода: `7e601680c765d6dc94e51e4c8f5e729b48a6f56e`.
- Рабочая ветка: `aspect/avatar-renderer-truth-20261126`.
- PR: [#1203 — Make renderer identity and selection roles explicit](https://github.com/ailtron1ss-rgb/NK1/pull/1203).
- PR оставлен draft: это узкая интеграция, а не подтверждение полной готовности аватара к выпуску.

## Что изменено

1. `BodyRendererCapabilityManifest` получил schema v2: тип рига (`rigClass`) и роль выбора (`primary`, `fallback`, `preview-only`). Чтение schema v1 сохранено.
2. Валидатор теперь отклоняет неизвестные классы/роли, отсутствие обязательной метаинформации v2, попытку объявить preview production-ready, отсутствие ассета у primary/fallback и несовместимость rig/asset.
3. Реестр отличает производственно выбираемые тела от preview-кандидатов; при разрешении coarse mode приоритет получает явный primary, доступен отдельный `resolveSelectableByMode`.
4. Текущие ассеты размечены честно: Live2D Cubism — primary; Original SVG и Legacy PNG — fallback; Three.js VRM/GLB — preview-only и `productionReady=false`.
5. `avatarRendererPresentation` берёт пользовательские описания из реестра, а не дублирует предположения UI. Отображаются понятные русские подписи типа рига и причины preview-статуса.
6. Панель переключения вынесена из перекрывающего слоя аватара. Режимы имеют `aria-pressed`, названные toolbar/group, доступные названия и минимальную высоту касания `44px`; добавлена видимая строка типа выбранного тела и focus-ring.
7. Голосовые элементы управления получили мобильную высоту касания и доступное имя. Статусы недоступности Live2D, fallback Legacy, бодрствования и Termux-провайдера локализованы.
8. 2.5D намеренно не появляется как пользовательский режим: production artwork pack и его приёмка отсутствуют.
9. Добавлены regression tests для схемы/реестра и `avatar-stage-layout.test.mjs`; профильный `nk1-embodiment-switch` workflow теперь запускает UI-проверки и отслеживает нужные файлы.
10. Общая projection теперь сохраняет отдельный `tick: snapshot.tick`; transport `stateVersion` Live2D не переиспользуется как организмный tick.
11. Protocol v1 получил optional `frameTick` с обратной совместимостью: оба Live2D viewer-а проверяют/возвращают его в ACK; legacy сообщения без поля остаются прежней формы.
12. Добавлен единый `AvatarPresentationReceiptV1`: Live2D — `parameters-observed` / `accepted-unverified`; Original2D — `dom-committed` после подключённого SVG и ненулевой геометрии; 3D — `webgl-render-submitted` после `renderer.render`, при загруженной модели и ненулевом draw-call count.
13. Все receipts строго привязаны к canonical tick + renderer, устаревшие ACK отбрасываются, state очищается при смене режима/tick. UI показывает точную стадию и явно не подтверждает фактическую презентацию пикселей.
14. Browser acceptance теперь проверяет, что desktop, cancellation и mobile ACK возвращают ожидаемые canonical frameTick 1001/1002. Диагностическое WebGL readback поле переименовано в `webglReadbackAlphaPixels` с `webglReadbackMayBeEmpty=true`, чтобы не выдавать пустой preserveDrawingBuffer readback за пустой кадр.

## TDD и проверки

- На исходном SHA до исправлений тестовый проход запустил 612 app-script tests: 608 PASS и 4 FAIL. Все четыре отказа совпали с новыми регрессионными утверждениями: schema v2 отвергалась, rig/selection metadata отсутствовали, preview-only не классифицировался и primary не разрешался.
- Установка pinned app dependencies в GitHub Actions прошла. RED получен на точном исходном feature-commit `3bfda3f00d1535870695d89ec2af353635eac65d`.
- Финальный code + browser-test SHA: `17a51f91a5b789b9d03fd576c81801168606e5b5`. Текущий PR HEAD `eca0b7053a7fb9bc4c4b6595dda583a2e6723ea8` добавляет только обновлённый handoff-документ. На текущем PR HEAD **16/16 GitHub Actions workflows завершились SUCCESS**: embodiment switch contract, core regression, integrated software baseline, Live2D browser acceptance, Original 2D motor coupling, avatar cognitive-affect motor coupling, module dependency audit, Aspect 10 embodied interaction, Avatar Model Preflight, Original 2D asset contract, UserModel explicit-forget integrity, WorkPass79 runtime regression, WorkPass110, normalized VRM humanoid motor, browser affect snapshot coherence и clean prototype startup smoke.
- Профильный `NK1 embodiment switch contract`: **22/22 шага SUCCESS**; app script regression — PASS; app typecheck — PASS; app development bundle — PASS; runtime typecheck — PASS; receipt suite и UI suite — PASS; hosted 3D asset hash/preflight — PASS. `NeuroCore core regression validation`: **55/55 шагов SUCCESS**. Clean startup smoke на текущем PR HEAD: **13/13 шагов SUCCESS**. Integrated software baseline — SUCCESS; Original 2D motor-coupling workflow — SUCCESS.
- Playwright Live2D browser acceptance: **SUCCESS**, Chromium, 30/30 canonical Live2D assets hydrated; desktop 1280×800 и mobile viewport 390×844; WebGL и Pixi Live2D обнаружены; page errors, console errors, failed requests и failed responses — 0. В desktop/mobile ACK получены exact `frameTick=1001`, cancellation ACK — `frameTick=1002`; выражение и motion `started`, шесть параметров прочитаны, stale intent отвергнут. Скриншоты: `live2d-quality-desktop.png` и `live2d-mobile.png`. Artifact ID `15120019731`, ZIP SHA-256 `e292607c87b3649411ded7f1184045110b0fd019a83bb1d25960d29d18e4f35a`.
- Screenshot compositor pixel sample подтверждён: desktop centerBrightPixels 53,480, mobile 59,609. Отдельный WebGL buffer readback вернул 0 alpha pixels и теперь явно помечен `webglReadbackMayBeEmpty=true` — это ограничение `preserveDrawingBuffer=false`, а не утверждение о пустом screenshot. Артефакты визуально проверены.
- Граница evidence остаётся строгой: Live2D подтверждает parameter readback; Original2D подтверждает commit SVG DOM + геометрию; 3D подтверждает отправленный draw call для загруженной модели. Все receipts несут canonical tick и `visualCompletionVerified=false`. Это не доказывает GPU/display presentation, полноэкранный UI journey или физический телефон. Первый clean-startup attempt завершился transient gateway `fetch failed` после готовности runtime/bridge/UI; clean-startup rerun на текущем PR HEAD завершился SUCCESS.
- Android/Termux device soak, реальные touch-события на физическом устройстве, thermal/RAM/battery, OS TTS playback, lipsync drift/interrupt latency и human redistribution/license approval остаются открытыми.

## Что НЕ закрыто и не должно считаться готовым

- Полный pixel/display E2E каждого кадра Live2D/Original2D/3D остаётся открытым. Сейчас есть честные промежуточные receipts (параметры/DOM commit/WebGL draw submission), но нет доказательства физически показанного кадра или GPU presentation.
- Реальная визуальная приёмка на Android/мобильном WebGL и browser viewport; скриншоты и touch walkthrough.
- Производственное решение о 3D-модели: точный asset hash, provenance, redistribution/license approval и human review. Текущий 3D остаётся preview-only.
- 2.5D: подготовленные cutout-слои, pivots, overlap/occlusion masks, parallax rig, источник каждого файла и разрешение на использование.
- End-to-end lipsync: OS playback, аудиочасы, viseme timing, interruption/latency; CI не доказывает фактическую синхронность на телефоне.
- Общая готовность Avatar/Embodiment из мастер-плана остаётся отдельным gate; этот PR закрывает только контракт типизации рендереров и один интерфейсный слой, не весь поток W08/W09.

## Правило статуса

Реализовано в исходниках ≠ прошло CI ≠ визуально принято ≠ проверено на устройстве ≠ разрешено к публикации. Все эти состояния фиксировать отдельно. Не сливать старые PR #1164 и #1171 целиком; использовать только проверенные независимые фрагменты.


## Продолжение 27 ноября — нативный VRM gaze

В существующий VRM runtime добавлен отдельный канал управления глазами через официальный `VRMLookAt.target` из `@pixiv/three-vrm`:

- Для загруженного VRM берётся реальная raw-head кость через `humanoid.getRawBoneNode("head")`; к ней прикрепляется невизуальный `Object3D` target. Включается штатный `lookAt.autoUpdate`.
- `gazeX/gazeY` переводятся в ограниченную локальную цель с дистанцией 1.5 и максимальным угловым диапазоном примерно ±19.5° по горизонтали / ±14.3° по вертикали. Значение сглаживается экспоненциально, а не скачет по кадрам.
- При успешно установленной native target-цели флаг `gazeViaLookAt` отключает повторное применение этих же координат к yaw/pitch головы. Остальные повороты головы из affect/headYaw остаются. Для VRM без `lookAt` или raw head используется прежний head-gaze fallback; generic GLB и Live2D не затронуты.
- При замене модели и unmount ссылка `lookAt.target` очищается, чтобы VRM не удерживал объект от старой сцены.

Проверки добавлены в существующие suites:
- `vrm-runtime-adapter.test.mjs`: направление, конечность и пределы target offsets; отсутствие двойного head turn.
- `avatar-3d-stage.test.mjs`: наличие native target binding, autoUpdate, smoothing и переключения ownership.
- Workflow уже включает `vrmRuntimeAdapter.ts`, `Avatar3DStage.tsx` и оба затронутых тестовых набора в path filter / embodiment-switch suite.

Реализация: adapter commit `2c68125397ca81cc1b5cbd68e174497de7fdf62b`, runtime wiring commit `39871e49b8b8d034ca121908c6de95865adc9001`, integration test commit `6afb1f31cdac23b2bf118197013cab23022d8369`, follow-up syntax correction `92cce9c903ee779613a51b6853dbd25a333e3d7a`.

**Verification boundary:** функция и wiring добавлены в исходники, но GitHub Actions exact-head run/status для текущего SHA пока не возвращены подключённым GitHub workflow endpoint. Не помечать этот проход как CI-green до появления результатов на новом HEAD. Реальное движение глаз на конкретных VRM-файлах, визуальная проверка и Android/device soak остаются обязательными. Native eye target — поддерживаемая возможность VRM runtime, но не доказательство того, что любой загруженный VRM содержит полноценные eye bones/look-at applier.

Источник API: [@pixiv/three-vrm — VRMLookAt](https://pixiv.github.io/three-vrm/docs/classes/three-vrm-core.VRMLookAt.html) и [VRMHumanoid.getRawBoneNode](https://pixiv.github.io/three-vrm/docs/classes/three-vrm-core.VRMHumanoid.html).
