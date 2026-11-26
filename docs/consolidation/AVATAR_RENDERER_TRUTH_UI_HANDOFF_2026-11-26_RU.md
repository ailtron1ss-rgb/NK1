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

## TDD и проверки

- На исходном SHA до исправлений тестовый проход запустил 612 app-script tests: 608 PASS и 4 FAIL. Все четыре отказа совпали с новыми регрессионными утверждениями: schema v2 отвергалась, rig/selection metadata отсутствовали, preview-only не классифицировался и primary не разрешался.
- Установка pinned app dependencies в GitHub Actions прошла. RED получен на точном исходном feature-commit `3bfda3f00d1535870695d89ec2af353635eac65d`.
- Финальный кодовый exact-head SHA: `8465c4dcbd1c2cf2dd9e112bcbc7db1d96b7f9e5`. На нём завершились **12/12 workflow SUCCESS**: embodiment switch contract, core regression, integrated software baseline, Live2D browser acceptance, Original 2D motor coupling, avatar cognitive-affect motor coupling, module dependency audit, clean prototype startup, WorkPass79 runtime regression, browser affect snapshot coherence, Original 2D asset contract и explicit-forget integrity.
- Профильный `NK1 embodiment switch contract`: **21/21 шаг SUCCESS**; `test:embodiment-switch` — 36/36; `test:body-systems` — 37/37; новый `avatar-stage-layout.test.mjs` — 3/3; app TypeScript typecheck — PASS. Hosted 3D asset preflight/hash check — PASS: `neuro-kurisu-hybrid-v5`, 2,035,768 bytes, SHA-256 `4cc4c34a62f72122b34c1d896d42bf10eddcba6f10f66563e4fc5e213a37e743`.
- Полный core regression и integrated software baseline на этом SHA завершились SUCCESS. Первый запуск clean startup smoke завершился transient `gateway exited before becoming ready (fetch failed)` после готовности organism runtime, research bridge и UI preview; повторный запуск того же job на том же SHA завершился SUCCESS. Повтор не скрыт и не выдан за отсутствие первой ошибки.
- Playwright Live2D browser acceptance: **SUCCESS**, Chromium, 30/30 canonical Live2D assets hydrated; desktop profile 1280×800 и mobile profile 390×844; WebGL и Pixi Live2D обнаружены в обоих профилях; page errors, console errors, failed requests и failed responses — 0. Сформированы скриншоты `live2d-quality-desktop.png` (1280×800) и `live2d-mobile.png` (390×844). Artifact ID `15114093994`, ZIP SHA-256 `93cf56842080bbf0108a8f358c6c7b33a1326197d77596b9ef614a2bec0b779a`.
- Важная граница browser evidence: intent получил `parameters-observed`, expression/motion — `started`, шесть параметров прочитаны; stale intent после cancellation отвергнут. Но в протоколе одновременно `complete=false` и `visualCompletionVerified=false`. Скриншоты доказывают реальное отображение модели в отдельном Live2D viewer, а не финальное same-tick brain-frame → app renderer readback → visual-presentation receipt; это не подтверждение готовности всего аватарного конвейера или нового полного app UI.
- Статические исходные изменения, browser viewer acceptance и CI не заменяют реальный Android/Termux device soak, touch walkthrough и измерение lipsync latency.

## Что НЕ закрыто и не должно считаться готовым

- Полный E2E каждого кадра Live2D/Original2D/3D: один organism tick → canonical frame → renderer readback → visual presentation receipt.
- Реальная визуальная приёмка на Android/мобильном WebGL и browser viewport; скриншоты и touch walkthrough.
- Производственное решение о 3D-модели: точный asset hash, provenance, redistribution/license approval и human review. Текущий 3D остаётся preview-only.
- 2.5D: подготовленные cutout-слои, pivots, overlap/occlusion masks, parallax rig, источник каждого файла и разрешение на использование.
- End-to-end lipsync: OS playback, аудиочасы, viseme timing, interruption/latency; CI не доказывает фактическую синхронность на телефоне.
- Общая готовность Avatar/Embodiment из мастер-плана остаётся отдельным gate; этот PR закрывает только контракт типизации рендереров и один интерфейсный слой, не весь поток W08/W09.

## Правило статуса

Реализовано в исходниках ≠ прошло CI ≠ визуально принято ≠ проверено на устройстве ≠ разрешено к публикации. Все эти состояния фиксировать отдельно. Не сливать старые PR #1164 и #1171 целиком; использовать только проверенные независимые фрагменты.
