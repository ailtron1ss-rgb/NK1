# NK1 — host-owned motor renderer profile configuration

MotorFrame остаётся unconfigured, пока хост не передаст измеренные профили.

Задайте на сервере `NEURO_MOTOR_RIG_PROFILES_FILE=/absolute/path/motor-rig-profiles.v1.json`. Loader принимает файл до 512 KiB и 1–16 профилей. Каждый profile должен быть валидным, `calibrated`, с уникальной парой renderer/model и одинаковым canonical skeleton. Отсутствие файла сохраняет безопасный режим; неверный явно заданный файл завершает startup с ошибкой.

Профили не загружаются из браузера. Они не создают MotorGoal и не выводятся автоматически из имён костей. Evidence ID не является цифровой подписью. Реальная запись должна содержать точные joint IDs, binding, coordinate frame, units, limits, измеренные axes/sign/offset и provenance.

Live2D требует фактические Cubism Param IDs; DepthRig — реальные node IDs из экспортированной layered GLB; VRM — точный model fingerprint и измеренный humanoid mapping. Тестовые fixture-профили не принимаются.

Оболочка JSON для примера (пустой `joints` намеренно невалиден):

```json
{
  "schemaVersion": 1,
  "profiles": [{
    "schemaVersion": 1,
    "profileId": "nk1.kurisu.live2d.v1",
    "modelId": "kurisu-live2d-balanced-v1",
    "revision": 1,
    "renderer": "live2d",
    "coordinateFrame": { "handedness": "right", "upAxis": "y", "forwardAxis": "-z", "positionUnit": "normalized", "angleUnit": "radians" },
    "calibration": { "status": "calibrated", "evidenceId": "review-record", "calibratedAt": "2026-10-31T08:00:00.000Z", "verifierVersion": "nk1-rig-calibration-v1" },
    "joints": []
  }]
}
```

Локальный просмотр и разрешение на публичное распространение — независимые решения. До Release необходим отдельный human license/provenance review и exact model SHA evidence.

Проверки: `node --experimental-strip-types runtime/neuro-kurisu/tests/motor-rig-profile-bootstrap.mjs` и `node --experimental-strip-types runtime/neuro-kurisu/tests/organism-motor-runtime.mjs`.