# Crosswalk первого полного аудита → BIG PASS 41

Дата: 2026-09-05
Текущий релиз: 34.10.0

Этот документ является контрольной картой между самым первым полным аудитом в чате и фактическим состоянием исходников. Он нужен, чтобы на следующих проходах не потерять исходные рекомендации и не считать декоративное наличие модуля их выполнением.

## Строгий статус 20 направлений

| № | Рекомендация первого аудита | Статус | Что фактически есть | Что ещё требуется |
|---:|---|---|---|---|
| 1 | Stabilization | ✅ | P40 health/circuit breaker, adaptive clocks, Android telemetry, Termux dependency | реальные device runs |
| 2 | OrganismCore decomposition | ◐ | CognitiveSubsystemFacade, API boundary | физическое разбиение монолита |
| 3 | Evidence Bus | ✅ | RuntimeEvidenceBus + lineage + persistence | более независимые external sources |
| 4 | Prediction Ledger | ✅ | prediction/outcome/error/baseline/debt | более длительные empirical benchmarks |
| 5 | True learning substrate | ◐ | P30 + P26/P27 + ensemble calibration | единая transferable learning substrate |
| 6 | Goal ecology | ◐ | P67/P68, goal arbitration, project linkage | длительные self-originated projects |
| 7 | Autonomous projects | ◐ | executor, milestones, evidence classes, project tools | task graph + real external execution |
| 8 | Reality research loop | ◐ | hypothesis/trial/evidence abstractions | независимые реальные эксперименты |
| 9 | Reality boundary | ✅ | simulator/internal/external distinction | больше независимого corroboration |
| 10 | Mobile cognitive OS | ✅ | CognitiveBudget + scheduling + adaptive perception | phone validation + thermal instrumentation |
| 11 | Model ecology | ✅/◐ | health, failure memory, ensemble calibration, circuit breaker | learned specialist ecology |
| 12 | Native Android host/lifecycle | ❌ | Termux host + API bridge | native lifecycle/FG service/boot |
| 13 | Real perception | ◐ | native sensor interfaces, coarse spectral/image features | real vision backend + multimodal grounding |
| 14 | Social cognition | ◐ | social prediction signals/basic relationship state | real multi-party/social benchmark |
| 15 | Predictive self-model | ◐ | SelfPredictionBenchmark, horizons 1/4/12 | calibrated long-run self prediction |
| 16 | Autobiographical identity | ◐ | temporal identity, autobiography, continuity | stronger causal grounding through lived history |
| 17 | Shadow organism | ◐ | alternative evaluator/shadow comparison | more independent state/model path |
| 18 | Model Olympics | ✅/◐ | P10/P26/P27/P30 ensemble + winner influence | truly learned world-model competition |
| 19 | Development/self-modification | ◐ | development/forks/self-improvement abstractions | verified structural self-modification |
| 20 | Consciousness research | ◐ | functional awareness metrics, protocol, evidence discipline | longitudinal independent evaluation |

## Первоначальные инженерные предупреждения

### A. Internal score != external property
Все consciousness/personhood/agency scores должны оставаться внутренними indicators, а не доказательствами субъективного опыта.

### B. Simulation != external truth
Simulator transitions не должны повышать trust как независимое внешнее подтверждение.

### C. Confidence != correctness
Prediction error считается относительно actual outcome, а не confidence.

### D. Project completion != validation
Успешное выполнение internal step не считается external confirmation.

### E. Новые P-модули не являются целью сами по себе
Приоритет отдан объединению и замыканию существующих loops.

## Метрика первого аудита

Строгая weighted оценка исходных рекомендаций на 34.10.0: **≈74%**.

Метрика намеренно не повышалась за счёт внутренних score или декларативных документов.
