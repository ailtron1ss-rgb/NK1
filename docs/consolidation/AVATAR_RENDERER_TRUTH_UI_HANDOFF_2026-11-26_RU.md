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
- После исправлений проверки должны быть подтверждены на финальном exact-head SHA PR #1203. До завершения Actions не считать их зелёными.
- Статические исходные изменения и CI-контракт не заменяют браузерный screenshot review, реальный Android/Termux soak и измерение lipsync latency.

## Что НЕ закрыто и не должно считаться готовым

- Полный E2E каждого кадра Live2D/Original2D/3D: один organism tick → canonical frame → renderer readback → visual presentation receipt.
- Реальная визуальная приёмка на Android/мобильном WebGL и browser viewport; скриншоты и touch walkthrough.
- Производственное решение о 3D-модели: точный asset hash, provenance, redistribution/license approval и human review. Текущий 3D остаётся preview-only.
- 2.5D: подготовленные cutout-слои, pivots, overlap/occlusion masks, parallax rig, источник каждого файла и разрешение на использование.
- End-to-end lipsync: OS playback, аудиочасы, viseme timing, interruption/latency; CI не доказывает фактическую синхронность на телефоне.
- Общая готовность Avatar/Embodiment из мастер-плана остаётся отдельным gate; этот PR закрывает только контракт типизации рендереров и один интерфейсный слой, не весь поток W08/W09.

## Правило статуса

Реализовано в исходниках ≠ прошло CI ≠ визуально принято ≠ проверено на устройстве ≠ разрешено к публикации. Все эти состояния фиксировать отдельно. Не сливать старые PR #1164 и #1171 целиком; использовать только проверенные независимые фрагменты.
