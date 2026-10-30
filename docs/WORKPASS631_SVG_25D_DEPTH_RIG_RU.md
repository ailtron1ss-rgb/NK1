# [NK1][WorkPass631] Editable SVG 2.5D depth-layer parallax

**Дата:** 30 октября 2026 г.  
**Рабочая ветка:** feature/embodiment-model-hardening-2026-10-29  
**PR:** [#392](https://github.com/ailtron1ss-rgb/NK1/pull/392)  
**Статус:** SVG depth compositor, pure math adapter, tests and CI gate added; exact-head CI required. No new image assets generated or bundled.

## Почему это отдельный результат

Ранее режим NK1 Original был редактируемым SVG-персонажем с позами, одеждой, цветом глаз/волос, эмоцией и speech mouth shape. Но он всё ещё перемещался практически как единый 2D-рисунок: голова могла наклоняться, однако относительная глубина частей персонажа не менялась.

В репозитории уже существуют независимые SVG-группы для заднего силуэта волос, корпуса/рук, головы/лица и передней чёлки. WorkPass631 использует именно эти существующие векторные элементы и не делает вид, будто полнофигурные sprite PNG можно автоматически превратить в настоящие anatomical layers.

## Архитектура

Новый pure adapter: app/src/components/avatar/avatar25dDepth.ts.

deriveAvatar25DDepthOffsets(gazeX, gazeY, motionScale) нормализует вход gaze, ограничивает его диапазон, учитывает коэффициент плавности/выразительности и выдаёт отдельный offset для:
- rearHair — задний слой слегка смещается в противоположном направлении;
- torso — корпус/руки двигаются с небольшим коэффициентом глубины;
- head — основная плоскость головы и лица получает более выраженный parallax;
- frontFringe — передняя чёлка получает собственный небольшой относительный сдвиг.

svgTranslate сериализует конечные значения в координатах SVG viewBox (420 × 560), с округлением до 0.001. Никаких CSS-пикселей, сетевых запросов или новых картинок для этих смещений не требуется.

## Подключение к организму

KurisuOriginalStage использует тот же gazeX/gazeY, который приходит из текущего действия/взгляда организма через AvatarStage. Разные слои получают разные коэффициенты, поэтому при изменении состояния появляется дифференциальное движение:
- взгляд вправо/влево сдвигает голову и переднюю чёлку сильнее, чем корпус;
- задние волосы немного смещаются противоположно плоскости лица;
- корпус и руки сохраняют общую устойчивость, чтобы персонаж не выглядел «плавающим».

Одежда, poseOverride, волосы/глаза/accent palettes, emotion mapping, blinking and mouth timeline остаются на прежнем компоненте и не копируются во второй avatar renderer.

## Accessibility и поведение

Depth layers используют плавный переход transform. При prefers-reduced-motion CSS отключает parallax transforms и transitions для этих слоёв; существующие анимации также остаются под текущим reduced-motion guard.

## Regression

Новый тест: app/scripts/avatar-25d-depth.test.mjs  
Команда: npm --prefix app run test:avatar-25d-depth  
CI step: Validate editable SVG 2.5D depth rig.

Проверяются:
- различные знаковые offset-ы для четырёх depth layers;
- clamp gaze и motionScale;
- детерминированная сериализация SVG translate;
- фактическое подключение слоёв к gaze сигналу в KurisuOriginalStage;
- reduced-motion CSS;
- сохранение существующего SVG artwork вместо подмены bitmap.

## Границы: что это и чем не является

Это первая работоспособная 2.5D-подобная depth/parallax сцена на доступном SVG art. Это не полноценный Cubism/Spine/deformable mesh rig:
- слои по-прежнему нарисованы в одном SVG asset tree, а не поставляются как независимые PSD/PNG с alpha masks;
- нет реалистичной деформации шеи/плеч, bone weights, eye/face occlusion masks, physics волос/одежды или свободных 3D-поворотов;
- нет авторского multi-view изображения, необходимого для сильного вращения головы;
- для production 2.5D всё ещё нужен оригинальный layered art pack с согласованными pivot/occlusion masks и rig calibration.

Поэтому текущий компонент честно остаётся именованным NK1 Original/2.5D depth preview, а не подменяет собой production Live2D или VRM 3D. Новый рендерер не добавлен и Release ZIP не изменён.
