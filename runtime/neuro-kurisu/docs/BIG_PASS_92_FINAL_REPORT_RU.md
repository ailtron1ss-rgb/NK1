# Neuro-Kurisu 34.65.0 — BIG PASS 92 / REAL SENSORIUM

## Цель
Продвинуть сенсорный контур от «камера умеет сделать файл» к наблюдаемому acquisition→evidence→semantic-request→backend-result pipeline без ложного заявления о наличии semantic vision. Одновременно сохранить phone-first ограничения.

## Что реально внедрено
1. `CameraEvidenceProcessor` — дешёвая проверка camera capture: SHA-256, размер, JPEG dimensions, byte entropy, novelty и capture quality.
2. `CameraEvidenceState` — bounded persistent record capture history, semantic-backend availability, semantic-frame count и unresolved requests.
3. `VisionSemanticBackend` — строгий opt-in контракт для настоящего локального/внешнего vision backend; отсутствие backend не маскируется под понимание изображения.
4. Runtime `captureCamera()` теперь автоматически создаёт camera evidence, регистрирует vision event и может передать временный кадр backend; временный файл удаляется после анализа, если пользователь не запросил retention.
5. P41 semantic perception теперь явно получает `semantic:false` после acquisition и создаёт pending vision request; pending закрывается только после реального semantic backend result.
6. `captureCameraForCognition()` — resource/EVC-aware acquisition gate, чтобы не делать дорогие camera captures в quiet/low-resource состояниях.
7. `/api/organism/vision/capture-if-useful` и `/api/organism/sensorium/status`.
8. Camera sensorium включён в `/api/metrics`.
9. Добавлен integration test с fake semantic backend, включая temporary-file cleanup и pending-request resolution.

## Что НЕ заявляется
Camera evidence и P41 native features не являются полноценным visual understanding. Semantic objects/scene/relations считаются model-output только если их вернул явно подключённый backend. Это сохраняет научную честность и предотвращает «semantic vision=true by wrapper».

## Android relevance
Termux acquisition остаётся реальным устройственным действием. На современных Android background/camera/microphone доступ имеет дополнительные ограничения; обычный Node/Termux process не следует считать гарантированным непрерывным foreground organism. Official Android documentation требует корректно объявлять foreground-service types и учитывает ограничения фонового запуска/while-in-use permissions.

## Проверки после PASS 92
- TYPECHECK: PASS
- BIG PASS 92 sensorium: PASS
- BIG PASS 91 regression: PASS
- P37 semantic sensorium: PASS
- P17 embodied multimodal agent: PASS
- mobile 1000: PASS
- mobile 5000: PASS
- architecture/contract/project-state/component-conflicts: PASS в отдельных финальных запусках
- source-truth/legacy/hygiene/integrity/syntax/core-ownership/server smoke: PASS в отдельных финальных запусках

`audit:all` не помечается PASS автоматически, если единый запуск не завершён из-за внешнего time limit.

## Статус полного composite gate
`audit:pass92` прошёл все критические функциональные и integrity этапы до длинного syntax stage, где единый процесс был остановлен внешним time limit среды. Это не считается полным composite PASS. Syntax, core-ownership и server smoke были затем выполнены отдельно и прошли.

## Следующий приоритет
BIG PASS 93 должен строить Social Mind поверх уже общего causal/learning/sensorium substrate, а не создавать очередной отдельный social wrapper. Параллельно стоит добавить реальную local/remote vision implementation только как отдельный backend, который проходит latency/resource/evidence gates.

## Внешняя верификация Android
См. Android Developers: foreground service restrictions/types и background optimization.

## Архивный контроль
Финальный archive manifest: 1288 файлов; missing=0; hashMismatches=0; extra=0.
