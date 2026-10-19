# Прогресс мозговой ветки — BIG PASS 209

## Закрытые большие шаги
- B-M1: canonical Artificial Brain Atlas
- B-M2: thalamocortical state-dependent gating
- B-M3: basal-ganglia action selection + dopamine-gated plasticity
- B-M4: cerebellar predictive calibration
- O-209: sparse/compute-aware cognition for constrained runtime

## Реальный прирост
1. Предсказательная ошибка действия после повторного обучения снизилась с 0.5000 до 0.2119 в controlled test.
2. При scarcity governor снизил compute budget до 0.3948 и candidate ceiling до 5 против 0.8411/11 в high-demand режиме.
3. Оценённое сокращение работы на scarcity ≈0.3615.
4. Cerebellar state и compute-governor state переживают Core restart.

## Верификация 209
- TypeScript, brain audit, function passport gate, architecture, integrity, hygiene, syntax, release contract, forensics и release-source проходят.
- `test:mobile:profile` проходит.
- Длинный `long-horizon-250` не считается release-proof из-за timeout в объединённом финальном окружении.

## Критические оставшиеся разрывы
- explicit granule/Purkinje/climbing-fibre analogue remains abstract
- sensorimotor timing loop needs real embodiment evidence
- mobile energy savings need device-level measurement, not host estimate
- basal-ganglia ↔ cerebellum ↔ thalamus closed-loop causal experiment still open

## Правило ветки
Новый brain component допускается только при наличии:
`owner → integration → lesion/ablation → persistence → regression → mobile/resource evidence`.
