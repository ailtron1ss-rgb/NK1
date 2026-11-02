# NK1 — адаптер команд рендера аватара

**Статус:** контрактный адаптер между общей проекцией мозга и capabilities активной модели. Это не утверждение о подключённом vendor SDK или готовом 3D/Live2D asset.

## Контракт

- Источник выражений остаётся единым: `AvatarBrainAffectBridge` → `AvatarBrainProjection`.
- `AvatarRendererAdapter` переводит projection в пакет команд, но не вызывает Cubism/Three.js/VRM SDK и не владеет состоянием мозга.
- Команда создаётся только при точном совпадении ID с capabilities загруженной модели.
- Профиль проекции и фактически выбранный renderer должны совпадать; иначе пакет пустой.
- Числа проверяются на конечность и ограничиваются диапазонами параметров.
- Неизвестные параметры, blendshapes и выражения пропускаются, а не подменяются приблизительными аналогами.
- Для VRM выражение передаётся только по собственному model-authored expression ID, который реально присутствует в manifest загруженной модели. Стандартные имена VRM не угадываются.
- Интенсивность берётся из `AvatarBrainProjection.expressionWeight` и ограничена диапазоном 0..1, как требует VRM 1.0. Preset expressions optional; custom expressions перечисляются по фактическим именам из VRM asset.
- Отображение семантических выражений NK1 (curious/focused/amused/concerned/tired/determined) на concrete custom names оставлено за manifest/asset adapter: без явного совпадения ничего не отправляется.
- Lip-sync не синтезируется здесь: viseme timeline должен идти от подтверждённого speech/audio playback.

- `lipSyncGain` — только коэффициент допуска для downstream-анимации, а `mouthOpen` в текущем brain projection — affective канал, не фонемная разметка и не аудиосэмпл.
- `NativeSpeechEventChannel` сообщает о запросах/процессах Termux и помечает `playbackVerified: false`; эти события нельзя использовать для движения губ или подтверждения старта/конца речи.
- Реальный lip-sync подключается отдельным портом после получения playback-confirmed `SpeechLifecycleEventV1` и/или viseme timeline с временными метками. До этого адаптер не выдаёт viseme-команды.

## Профили

- **2D Live2D:** standard Cubism parameter IDs, включая глаза, зрачки, брови, рот и углы головы. Загруженный model manifest должен сообщить реально существующие IDs.
- **2.5D:** четыре независимых controls: `parallaxX`, `parallaxY`, `depthBreath01`, `faceRig01`. Контролы должны быть реализованы в активном layered renderer.
- **3D:** spatial controls `headPitch`, `headYaw`, `gazeDistance01`, `shoulderRelax01`, плюс только поддерживаемый именованный expression.

## Основание VRM 1.0

Официальная спецификация: [VRMC_vrm.expressions](https://github.com/vrm-c/vrm-specification/blob/master/specification/VRMC_vrm-1.0/expressions.md). Preset expressions optional; custom expressions могут иметь имена, назначенные автором модели. Value expression лежит в диапазоне 0..1; адаптер ограничивает значение и требует точное совпадение с manifest. Спецификация не определяет единый внешний вид эмоций, поэтому NK1 не подставляет предполагаемый preset вместо отсутствующего custom expression.

## Проверка

```sh
node --experimental-strip-types tests/avatar-renderer-adapter.mjs
```

Остаются обязательными SDK wiring, model capability discovery, browser visual E2E, Android device testing и лицензирование каждого артефакта.
