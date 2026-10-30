# Aspect 03 — журнал изменений, 30.10.2026

Ветка: `aspect03-world-perception-truthful-grounding-2026-10-30`  
База: `workpass70-source`

Каждая запись соответствует отдельному GitHub commit с сообщением `[NK1][восприятие] ...`.

| Изменение | Зачем |
|---|---|
| P41: per-modality evidence на объектах | Не терять, откуда пришло наблюдение |
| Core → P41: передача evidenceKind | Не повышать вывод до observed на границе runtime |
| WorldContextNormalizer: явные unknown flags | Не превращать placeholder в измерение |
| GroundedWorldState: identity-based merge | Сохранять несколько одинаковых объектов как отдельные сущности |
| GroundedWorldState: timestamp ordering | Не перезаписывать более новый статус старым наблюдением |
| PerceptualEvidenceCompiler: отдельные модальные записи | Не схлопывать разные источники по тексту claim |
| P41: scene evidence | Сохранять происхождение распознанной сцены |
| EvidenceCompiler: scene provenance | Не помечать scene вывод как observed |
| GroundedWorldState: visibility knowledge | Не делать вывод о видимости по одному присутствию |
| Regression test: identity and provenance | Закрепить поведение двумя объектами одинакового типа |
| Workflow: grounding integrity | Не потерять регрессионную проверку в CI |
| Stable source/track identity matching | Сопоставлять ID без изменения регистра и исходной идентичности |
| Observation count and freshness | Не раздувать количество наблюдений и не использовать устаревшие receipts как свежие |
| P41: event provenance per modality | Не повышать событие из world/model output до observed |
| EvidenceCompiler: event provenance | Сохранять происхождение событий в evidence ledger |
| GroundedWorldState: event lineage | Сохранять evidence kind при построении мира |
| Gemini: detect MIME by file signature | Корректно передавать PNG/WebP/JPEG |
| Gemini: reject uncalibrated image coordinates | Не трактовать координаты кадра как 3D world coordinates |
| Camera MIME and spatial test | Проверить MIME и отсутствие ложных 3D-координат |
| Workflow: camera integrity gate | Запускать новый тест в GitHub Actions |
| Grounded evidence freshness | Старые claims остаются historical и не влияют на текущую уверенность |
| Event and stale-evidence regression | Проверить provenance событий и stale boundary |
| Same-cycle scene provenance precedence | Не понижать результат vision данными unresolved из той же сцены и того же цикла |
| Same-cycle regression | Закрепить приоритет свежего vision evidence |
| WorldContext schema: calibrated position | Передавать x/y/z только с объявленным coordinateFrameId |
| Normalizer spatial gate | Отклонять неполные и unframed координаты, не ограничивать реальные world units диапазоном [0,1] |
| Core → P41 spatial ingress | Сохранять координаты и frame для моторного/пространственного планирования |
| GroundedWorldState spatial round-trip | Не терять position/frame при консолидации и повторной выдаче WorldContext |
| Spatial regression | Проверять frame-bound coordinates и запрет image-plane → 3D promotion |
| TemporalObjectTracker | Поддержать per-camera tracks для валидных normalized 2D boxes |
| Bidirectional ambiguity gate | Не сливать два detection в один track при неоднозначном выборе |
| Independent bbox confidence | Не использовать confidence объекта как confidence локализации |
| Runtime camera integration | Передавать tracker result в канонический P41 при каждом capture |
| Capture receipt identity | Использовать execution ID, а не image hash, как уникальный capture frame |
| Duplicate detection guard | Не создавать две сущности из почти идентичных box в одном кадре |
| Tracker regression suite | Проверять ID continuity, порядок detections, камеры, expiry, stale frames и provider IDs |
| Two-stage confidence gate | Слабые рамки только продолжают треки, сильные могут создавать новые |
| Bounded motion prediction | Предсказывать смещение bbox из сглаженной скорости между кадрами |
| P41 integration regression | Проверять сохранение двух одинаковых объектов и IDs в каноническом P41

## Текущий статус

- Изменения записаны в отдельной рабочей ветке и Draft PR #423; base — `workpass70-source`.
- Specialized `world-perception-integrity` workflow завершился SUCCESS на HEAD `1ebc8ed0daf6840ae13fbcfa6006ac50da61a1c2`.
- Подтверждены runtime ingress, все P41 regression checks, object identity/provenance, camera MIME/spatial truthfulness, calibrated spatial-frame round-trip и runtime typecheck.
- На том же HEAD прошли `cognitive-contracts`, `source-lineage-contract`, `verified-promotion`, `metrics`, `verified-experience-lanes`, `correlated-postcondition` и `local-language-resilience`.
- Большой `targeted-and-regression` job на момент обновления ещё выполняется; его финальный результат не приписывается этому проходу.
- Локальный запуск тестов в контейнере не заявляется: прямой GitHub clone недоступен из-за DNS; проверяемые результаты получены через GitHub Actions.
- Android/Termux camera soak и независимая разметка остаются отдельными acceptance gates; новый 2D tracker является runtime feature, но production IDF1/HOTA и long-occlusion re-identification ещё не подтверждены.
