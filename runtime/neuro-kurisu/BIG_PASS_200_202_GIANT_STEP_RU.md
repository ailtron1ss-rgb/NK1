# NEURO-KURISU — BIG PASS 200–202 GIANT STEP

Дата: 2026-09-11
Релиз приложения: 35.6.1
Core: 70.0.0-master-prompt-progress-engine

## Цель прохода

Связать уже существующие механизмы identity / autobiographical continuity / causal self / workspace / metacognition / grounding / interoception / agency / social binding / continuity / development в единый проверяемый слой subject dynamics; одновременно усилить longitudinal transfer evidence и provenance физического Android evidence.

## B200 — Central Subject Dynamics

Добавлен `src/organism/cognition/CentralSubjectDynamics.ts`.
Он не является новым независимым «мозгом»: это агрегатор текущих сигналов уже существующих подсистем.
Он рассчитывает:
- integration,
- coherence,
- coupling,
- stability,
- continuity,
- agency,
- phase,
- regressions.

Интеграция с `OrganismCore`:
- observation path получает реальный frame из P64/P76/P80/P84/P50/P51/P66/P61 и социальных/перцептивных сигналов;
- frame сохраняется в canonical cognition facet;
- bounded phase-dependent influence участвует в action arbitration;
- outcomes обновляют B200 stability;
- persistence/restore проверены.

Standalone certification: 240 samples, 10 outcomes, 2 perturbations, status `verified`.
Core integration: 64 реальных циклов, persistence PASS; текущая phase `fragmented`, то есть зрелость субъектного слоя в Core не завышена.

## B201 — Longitudinal Subject Transfer Battery

Добавлен `src/organism/learning/LongitudinalSubjectTransferBattery.ts`.
Проверяет:
- многосессионную стабильность;
- restart retention;
- task-family transfer;
- evidence density;
- regression control.

Тест: 18 sessions, 2 restarts, 29 transfer trials, mean retention 0.773, mean transfer 0.707, 0 regressions, status `verified`.

Важно: battery certifies functional longitudinal transfer only; не утверждает наличие феноменального сознания.

## B202 — Device Evidence Provenance

Добавлен `src/organism/body/DeviceEvidenceLedger.ts`.
Встроен в `OrganismCore` persistence и доступен через:
- `deviceHardwareCertification()`;
- `deviceEvidenceSnapshot()`;
- `deviceEvidenceDiagnostics()`.

`REAL_DEVICE_VERIFIED` разрешён только после live Termux Android evidence. В текущей хостовой среде тест честно возвращает `UNAVAILABLE`; host fallback не повышается до physical-device proof.

## Исправления по ходу прохода

1. Убран длинный source line, который нарушал forensics hygiene.
2. Исправлена типизация B200 под реальные поля P74.
3. Убрана лишняя type-only зависимость B202.
4. B201 test threshold не ослаблялся: увеличено число независимых transfer trials до достаточного количества evidence.
5. Device evidence persistence проверяется через настоящий Core checkpoint.

## Regression evidence

PASS:
- typecheck;
- B200 standalone;
- B200 Core;
- B201 longitudinal transfer;
- B202 device evidence;
- B199 causal battery;
- B198 Android hardware gate;
- B197 continuous life (1000 cycles);
- B196 developmental maturity + Core;
- B195 social brain + learning-core;
- B191 allostasis/neuromod + 1000-horizon;
- B187 global workspace;
- B185 hippocampal memory;
- P16/P17/P19/P20/P22/P25/P26;
- restart / memory dedupe / concurrency / replay;
- operational 500-cycle long-horizon;
- architecture / integrity / forensics / hygiene / syntax / contract / release-source;
- function liveness / parameterized probes / semantic coverage.

Operational 500-cycle result:
`LONG_HORIZON_OPERATIONAL_500=PASS ratio=1.038 firstMs=69.08 lastMs=71.73 p95=98.05 heapFirst=49.72 heapLast=218.18`

## Function reality after pass

Function liveness:
- sourceFiles 870
- declarations 2768
- withBody 2739
- exported 109
- zeroReference 161
- oneOrLessReference 500

Parameterized probes:
- sourceFiles 286
- attempted 568
- passed 553
- failed 0
- inputSynthesisNeeded 3
- lifecycleNeeded 12

Semantic coverage:
- sourceFiles 288
- totalFunctions 2684
- VERIFIED 38
- INTEGRATION_ONLY 623
- UNSAFE_TO_AUTO_RUN 232
- UNVERIFIED 1791
- verifiedRate 1.42%
- evidenceCoverage 7.22%

Рост общего числа функций из-за новых диагностических/батчевых поверхностей не считается прогрессом сам по себе.

## Архитектура

- sourceFiles: 857
- canonicalFiles: 286
- missing: 0
- cycles: 0
- legacyLeakage: 0
- integrity errors: 0
- integrity warnings: 0
- forensics duplicates: 0

## Что теперь реально сильнее

1. Subject-level signals больше не существуют только разрозненно: появился единый динамический frame, привязанный к реальному Core.
2. Longitudinal continuity теперь проверяется отдельно от «просто большого количества циклов».
3. Physical Android evidence имеет provenance boundary, который не позволяет host simulation стать доказательством физического устройства.
4. Старые validated substrates прошли regressions после интеграции.

## Что всё ещё НЕ доказано

- феноменальное сознание;
- субъективное переживание;
- полноценная human-level brain equivalence;
- physical-device certification на реальном Poco/Termux из этой среды;
- full-depth learned cortical substrate;
- causal proof всех semantic functions.

## Следующий Giant Step

B203 — Longitudinal Developmental Transfer 2.0 + identity trajectory under controlled perturbations.
B204 — Central Subject Dynamics v2: explicit counterfactual action ownership + recovery trajectories.
B205 — Android real-device certification on Termux.
B206 — brain-wide causal intervention matrix with repeated independent runs.
B207 — systematic closure of high-value UNVERIFIED functions, начиная с public/Core surface и lifecycle-sensitive functions.
