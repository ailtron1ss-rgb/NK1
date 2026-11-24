# P2841 — Experimental Design

## Experiment A — Receipt vs effect

Сравнить observation action, actuator receipt и independently verified effect.

Метрики: evidence, learning scale, identity scale, world-model promotion.

Ожидаемый результат: receipt-only не должен равняться verified external effect.

## Experiment B — Repeated causal holdout

Для одного action run 1, 2, 4, 6, 12, 24 повторений с независимой verification.

Метрики: holdout readiness, mean absolute prediction error, identity promotion.

## Experiment C — Shadow divergence

Сгенерировать matched external outcomes с controlled divergence от shadow prediction.

Метрики: active-perception demand, replay priority, prediction recalibration.

## Experiment D — Grounded-world persistence

Внешнее событие -> checkpoint -> restart -> replay -> следующий observation.

Метрики: provenance continuity, world revision continuity, evidence retention.

## Experiment E — Mobile cost

Сравнить всегда-наблюдение против adaptive active-perception на medium phone.

Метрики: RSS, CPU, latency, battery cost, verified-information-per-joule.


## Observed P2841 results

- Receipt-only actuation: verified=0.00, evidence≈0.3714.
- Independently observed device outcome: verified=1.00, independent=1.00, evidence≈0.902.
- Long-horizon holdout: 1 matched verified trial -> readiness≈0.162; 6 matched verified trials -> readiness≈0.974.
- Grounded-world restart: external-observed fact and event survive runtime stop/init with stable world revision.
- Mobile V8-cap smoke: PASS; measured peak RSS during isolated run ≈389,692 KiB (~380.6 MiB), so V8 heap cap must not be confused with a physical device RSS budget.
