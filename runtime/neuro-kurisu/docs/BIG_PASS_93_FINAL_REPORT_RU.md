# Neuro-Kurisu 34.66.0 — BIG PASS 93 / REAL SEMANTIC VISION + TEMPORAL EPISTEMIC GROUNDING

## Цель
Перевести sensorium от acquisition/evidence pipeline к реальному semantic-backend контракту и усилить его временной непрерывностью и эпистемической трассировкой. При этом сохранить phone-first поведение: дорогой vision backend остаётся opt-in.

## Реально внедрено
1. `PerceptualContinuityModel` — bounded scene episodes, scene continuity, object persistence и temporal grounding.
2. `PerceptualEpistemicGraph` — bounded evidence claims с modality/source/confidence/target provenance.
3. `P41SemanticPerceptionEngine` интегрирует continuity/epistemic state и выводит новые метрики.
4. Новый `GeminiVisionSemanticBackend` — реальный REST multimodal image backend через официально поддерживаемый Gemini Generate Content API; image bytes идут как inline image data, response нормализуется в P41 schema.
5. Backend ограничен `GEMINI_VISION_ENABLED=1`; без флага сеть и API costs для vision не включаются автоматически.
6. Для телефона ограничены image bytes (по умолчанию 8 MB), timeout (по умолчанию 12 s) и semantic prompt.
7. `/api/metrics` теперь показывает sensorium/vision backend status и полный P41 semantic summary.
8. Добавлены mock integration tests для Gemini backend; реальный network call в тестах не выполняется.
9. `server.mjs` default Gemini language model обновлён на `gemini-3.8-flash`, если `GEMINI_MODEL` не задан.

## Научная честность
- acquisition не считается semantic understanding;
- semantic=true выставляется только после результата подключённого backend;
- без backend создаётся unresolved/pending perception request;
- object/scene semantics не генерируются локальными эвристиками;
- наличие vision backend не является свидетельством consciousness.

## Termux / Gemini
В окружении Termux backend можно опционально включить: `GEMINI_VISION_ENABLED=1` и `GEMINI_API_KEY=...`. Для тяжёлого/дорогого режима рекомендуется оставлять adaptive capture gate и не вызывать camera постоянно.

Gemini официально поддерживает inline image input для multimodal image understanding; inline requests ограничены общим размером запроса около 20 MB, поэтому runtime использует более жёсткий локальный лимит 8 MB. citeturn857408search0turn857408search1

## Проверки
- TYPECHECK: PASS
- BIG PASS 93: PASS
- P41 semantic: PASS
- P41 temporal: PASS
- vision backend contract: PASS
- Gemini mock integration: PASS
- restart: PASS
- smoke: PASS
- P17 embodied multimodal: PASS
- P26 true learning: PASS
- P26 contextual world: PASS
- mobile 1000: PASS
- mobile 5000: PASS
- architecture: PASS
- release contract: PASS
- release source: PASS
- project state: PASS
- component conflicts: PASS
- source truth: PASS
- legacy reintegration: PASS
- source hygiene: PASS
- forensics: PASS
- integrity: PASS
- syntax: PASS
- core ownership: PASS
- server smoke: PASS
- archive manifest: PASS

`audit:all` не маркируется PASS автоматически, если единый aggregate запуск упирается во внешний time limit исторической suite.

## Следующий крупный шаг
BIG PASS 94 должен соединить semantic perception с Social Mind и person continuity: person candidates, relationship state, intent hypotheses, belief-about-belief и social learning. Vision result должен служить наблюдаемым evidence, а не автоматически считаться социальной истиной.
