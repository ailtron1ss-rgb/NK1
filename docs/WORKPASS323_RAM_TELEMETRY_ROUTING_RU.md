# WorkPass323 — RAM telemetry into cognitive resource allocation

**Дата:** 2026-10-25  
**Ветка:** `fix/cognitive-interrupt-severity-normalization-2026-10-25`  
**Draft PR:** [#135](https://github.com/ailtron1ss-rgb/NK1/pull/135)  
**Целевая ветка:** `work/node24-project-pin-rebased-20261025`

## Defect

В `runtime/neuro-kurisu/src/organism/core/OrganismRuntime.ts` вычисление `CognitiveResourceEconomy.allocate()` подавало:

```ts
ramPressure01: clamp01((1-body.cognitiveCapacity01)*.65 + (1-body.cognitiveCapacity01)*.35)
```

Выражение равно `1 - cognitiveCapacity01` и не использует имеющийся датчик `body.telemetry.ramPressure01`. В результате allocator мог видеть низкое RAM-давление, хотя реальная телеметрия сообщала высокую занятость памяти. При этом `cognitiveLoad01` уже отдельным параметром выражает обратную когнитивную ёмкость, поэтому повторно передавать её под видом RAM — смешение разных сигналов.

## Code change

- Вычисляется отдельный нормализованный `measuredRamPressure01 = clamp01(body.telemetry.ramPressure01)`.
- Этот сигнал непосредственно поступает в `CognitiveResourceEconomy.allocate()`.
- Evidence event `cognitive-resource-economy` сообщает оба входа: `cognitiveCapacity01` и `ramPressure01`. Это делает распределение бюджета объяснимым по исходным сигналам.

## Regression added

В `runtime/neuro-kurisu/tests/cognitive-dependency-runtime-wiring.mjs` тест временно подменяет начальный sample на:
- `bodyEnergy01=0.8`;
- `cognitiveCapacity01=0.85`;
- `thermalStrain01=0.2`;
- `telemetry.ramPressure01=0.88`.

Затем он проверяет, что evidence сохранил RAM=0.88, а реальное состояние allocator соответствует формуле scarcity с измеренным RAM, а не с обратной capacity. Это regression на runtime-путь, а не только source-text assertion.

## Connected work in the same PR

- Критические sensor labels активируют interrupt даже когда их weighted scalar score ниже generic порога.
- Критические sensor labels стоят выше обычной prediction-error метки, поэтому сочетанный сигнал не вытесняет защитный тип.
- Routing policy и persistence restore fail closed для критических labels, включая регистровые варианты и противоречивый `active=false`.
- Композитный cognitive gate запускает новые regression cases и существующий restore-integrity тест.
- Новый source branch включён в push branch filters двух релевантных workflow.

## Validation / limitations

Локальный clean install и выполнение тестов недоступны из текущей среды; remote CI требует подтверждения точного runner и завершённых шагов. Код и regression committed, но это не является свидетельством PASS. Просмотреть актуальные run/job/step logs в [PR #135](https://github.com/ailtron1ss-rgb/NK1/pull/135), поскольку workflow run может относиться к более раннему SHA.

## Acceptance gates still open

Full runtime typecheck/build, live browser/Live2D/TTS, Android/Termux audio, independent held-out retrieval/learning uplift, long-duration soak, license review and reproducible clean-machine release. Это targeted reliability improvement, не заявление о завершённом проекте или доказанной цифровой субъектности.
