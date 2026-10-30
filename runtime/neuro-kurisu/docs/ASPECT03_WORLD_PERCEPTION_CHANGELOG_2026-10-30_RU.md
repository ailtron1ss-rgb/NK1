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

## Текущий статус

- Изменения записаны в отдельной рабочей ветке.
- Новые regression tests добавлены в dedicated world-perception workflow.
- Окончательная валидация ожидает GitHub Actions на PR head.
- Локальные тесты в текущем контейнере не были запущены: прямой GitHub clone недоступен из-за DNS; нельзя выдавать их за пройденные.
- Android/Termux camera soak и независимая разметка остаются отдельными acceptance gates.
