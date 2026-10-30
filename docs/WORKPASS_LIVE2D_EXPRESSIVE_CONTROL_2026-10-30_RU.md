# NK1 Aspect 01 — Live2D expressive body control (2026-10-30)

## Scope

This workpass improves the existing Cubism avatar only. It does not claim to create a full skeletal body, free IK, or new authored motion clips. The target is to use the actual parameters already present in the canonical Kurisu rig to add continuous expressive control while preserving the existing motion/physics pipeline.

## Baseline

- Source baseline: `workpass70-source` at `ad564d1879028f00549be41ec5172a2f72e25897`.
- Latest GitHub Release remains `Neuro` / `NeuroKurisu0.1`, published 2026-10-19, with `Neuro_Kurisu_WORKPASS70_2026-10-19.zip` (135,290,615 bytes). This workpass does not claim to update that release.
- Canonical model: `runtime/neuro-kurisu/public/live2d/Kurisu/Kurisu.model3.json`.
- Existing registered motion inventory: Idle x1, TapHead x1, TapBody x1, Special x2.
- The CDI3 parameter inventory includes head/body angles, eye open/smile/ball, brows, mouth, cheek, breath, arm physics, hair physics, tie/shirt/coat/collar/shoes physics.
- Current application contract already transports expression/intensity, mouth visemes, gaze, head tilt, gesture and a bounded motion group/index/token.

## Changes in this pass

1. Added continuous facial parameter composition to both the app-served and runtime Live2D viewers:
   - brow vertical position and angle;
   - left/right eye-smile;
   - cheek/blush intensity;
   - expression-specific profiles for happy, sad, angry, surprised, flustered, embarrassed, thinking, focused, tender, sarcastic, smug, looking-away and tired.
2. Added low-amplitude torso follow-through through existing body-angle parameters, driven by gaze and head tilt.
3. Added continuous breathing through the existing `ParamBreath` parameter, with bounded amplitude modulated by arousal/expression intensity.
4. Kept the existing Cubism update ordering: NK1 overrides are applied at `beforeModelUpdate`, after authored motion and physics have evaluated.
5. Extended avatar motor intent regression assertions to ensure both viewer entry points retain the new channels.

## Design constraints

- This is additive modulation, not a replacement for authored Cubism motion or physics.
- Every output is clamped to a conservative range; unknown expressions fall back to neutral.
- No unsupported motion group or clip is invented.
- The face/body controls use parameters confirmed in the shipped CDI3 inventory.
- The two viewer entry points are kept in sync to prevent app/runtime drift.

## Remaining work

### P0
- Run `npm run test:avatar-motor-intent` and typecheck/build on this exact branch head.
- Browser E2E: verify actual model responds to brow/eye/cheek/body/breath channels and does not fight expressions or physics.
- Test low-memory/mobile profile and sustained 15+ minute operation.
- Measure visual stability and confirm no parameter flicker or unnatural resting expression.

### P1
- Add continuous upper-arm/forearm/hand intent only after inspecting the model's parameter ranges and the authored physics output; avoid writing directly over physics channels.
- Add expression transition hysteresis and blend timing, rather than repeatedly re-triggering expression assets.
- Add a calibrated gaze target model and blink scheduling with reduced-motion support.
- Expand authored motion inventory only with licensed, provenance-tracked clips.

### Explicit non-goals for this pass
- No claim of arbitrary hand/finger control: Live2D rig parameters are not a humanoid skeleton.
- No claim of real acoustic phoneme lip-sync: the current browser speech timeline remains a grapheme/boundary approximation.
- No claim of production-ready clothing swapping: the current model has authored outfit geometry, not a general garment attachment system.
- No Release ZIP refresh until source checks, archive provenance and license review pass.

## Progress estimate

- Existing Live2D foundation: 65/100.
- Continuous face/body channel coverage after this code pass: estimated 50/100.
- Aspect 01 overall: estimated 68/100 before device E2E; code-level gains do not substitute for visual acceptance.


## Дополнение: плавное смешивание мимики

После прохождения исходного CI добавлен ограниченный low-pass переход для каналов бровей, угла бровей, улыбки глаз и румянца. Он сглаживает смену эмоциональных состояний без подмены авторских Cubism motion/physics. Коэффициент смешивания фиксирован (`0.18` на вызов `beforeModelUpdate`); визуальная настройка под частоту кадров и Android ещё требует проверки.


### Дополнение: семантическое направление взгляда

Планировщик моторики теперь формирует gazeX/gazeY вместе с действием организма: исследование направляет внимание вправо, рефлексия — влево/вверх, объяснение — к условной области демонстрации, поддержка — мягче вниз. Валентность и возбуждение дают небольшую ограниченную поправку; координаты всегда ограничены диапазоном [-0.4, 0.4]. AvatarStage передаёт эти значения из единого motorPlan, а не поддерживает отдельную конкурирующую таблицу взглядов. Это семантическая цель, не трекинг реального объекта и не глазная IK; плавность перехода и визуальная калибровка остаются задачей следующей проверки на модели/устройстве.


### Дополнение: воспроизводимый взгляд и микродвижения

Смысловая цель взгляда теперь сглаживается отдельно от микросаккад, а микросаккады и интервалы моргания получают значения из детерминированной последовательности, привязанной к `stateVersion` и счётчикам цикла. Это устраняет `Math.random()` из обоих viewer runtime и упрощает воспроизведение одинаковых сценариев. Коэффициенты и амплитуды остаются инженерными начальными значениями: визуальная калибровка на реальном Cubism canvas и Android ещё не выполнена.
