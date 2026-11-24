# Neuro Kurisu 35.18.5 / P2842

## Тема
Causal Calibration + Active Perception

## Реальные изменения
- Exact pre-action prediction ticket теперь передаётся в canonical WorldCausalCalibration.
- В calibration records сохраняются verified/independent/evidence значения.
- Повторные matched-context trials формируют readiness; одно событие не может дать полное продвижение.
- Runtime создаёт coarse causal context key по location/goal/energy bucket.
- Active perception теперь измеряет наблюдаемую information gain после полного action/outcome цикла.
- Calibration state сохраняется через существующий persistence pipeline.
- State schema повышена с 210 до 211.

## Проверка
P2842 calibration, runtime, persistence и migration tests должны быть зелёными.
P2841/P2840 и базовые runtime smoke должны сохраниться без регрессии.

## Ограничение
Это не является доказательством сознания. Это инженерное усиление causal grounding, calibration и active perception.
