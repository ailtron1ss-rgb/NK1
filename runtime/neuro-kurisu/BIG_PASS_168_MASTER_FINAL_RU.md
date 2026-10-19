# Neuro-Kurisu 35.6.1 — BIG PASS 168 MASTER FINAL

## Цель pass
Перевести проект от набора отдельных когнитивных механизмов к проверяемой причинной жизненной линии субъекта и закрыть крупные пункты исходного анализа без дублирования уже реализованных систем.

## Сделано
- `CausalLifeGraph`: bounded causal autobiographical projection over existing experience/emotion/memory/decision/action/outcome/learning/self-change entities.
- `FeelingEpisode`: functional self-access layer over existing appraisal/interoception; это не утверждение phenomenal consciousness.
- Реальная интеграция в `OrganismCore.observe()` и `feedback()`.
- Persistence/restore через canonical system state.
- `explainRef()` и `causalPath()` для обратной причинной трассировки.
- Реальная привязка self-change к `ValueRevision.id`, когда revision существует.
- Adversarial identity gate против необоснованного сильного influence от слабого evidence.
- Полная повторная проверка ключевых brain regressions.
- First-analysis recheck и anti-repeat completion matrix.

## Реальные тесты этого pass
- TYPECHECK = PASS
- BIG_PASS_168_GRAPH = PASS
- BIG_PASS_168_CORE = PASS (restart=true)
- BIG_PASS_168_ADVERSARIAL = PASS
- core zero-arg surface = 70/70 PASS
- parameterized safe probe = 466 PASS / 0 FAIL
- smoke = PASS
- restart = PASS
- memory dedupe = PASS
- concurrency = PASS
- P24 = PASS
- P26 = PASS
- P28 = PASS
- P29 = PASS
- P30 = PASS
- P31 consciousness = PASS
- P31 lesion = PASS
- P32 causal self = PASS
- P33 personhood = PASS
- P34 personhood/integration/migration = PASS
- architecture = PASS
- integrity = PASS
- forensics = PASS
- hygiene = PASS
- release-source = PASS
- lock = PASS

## Function verification surface
- total declarations: 2433
- VERIFIED: 18
- INTEGRATION_ONLY: 570
- UNSAFE_TO_AUTO_RUN: 214
- UNVERIFIED: 1631
- parameterized safe executions: 466 PASS / 0 FAIL

## Что ещё не доказано
- полный lifecycle-aware verification всей поверхности функций;
- стабильное memory → value → identity преобразование на реальной длинной жизни;
- полноценный externally grounded learned world model;
- реальная непрерывная multimodal embodiment на Android;
- настоящий календарный 30/90-day study;
- Android native supervisor production layer;
- phenomenal consciousness.

## Важное ограничение aggregate runner
Тяжёлые aggregate audit wrappers могут превышать лимит времени orchestration среды. Такой timeout не считается PASS. Критические gates запускаются независимо и фиксируются отдельно.
