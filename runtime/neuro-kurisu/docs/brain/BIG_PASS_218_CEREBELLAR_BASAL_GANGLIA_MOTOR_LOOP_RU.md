# BIG PASS 218 — CEREBELLAR × BASAL GANGLIA MOTOR LEARNING LOOP

## Цель
Замкнуть быстрый predictive motor-control контур с reinforcement/outcome learning в единый persistent механизм, полезный не только как аналог мозжечка, но и как инженерный слой стабильного sensorimotor learning.

## Реальное изменение
Добавлен `CerebellarBasalGangliaMotorLoop`.

Контур объединяет:
- forward prediction error и correction из `CerebellarPredictiveController`;
- gate/reinforcement из `BasalGangliaSelectionCircuit`;
- reward/surprise/energy/cognitive capacity;
- быстрый motor gain;
- медленную skill state (`skill01`, `meanError01`, `rewardEMA01`, `credit01`);
- event/sparse update: маленькие изменения пропускаются;
- persistent snapshot/restore;
- reversible lesion mode для causal proof.

Это computational abstraction, не утверждение анатомического соответствия.

## Научная мотивация
Обзор 2025 года в Nature Reviews Neuroscience рассматривает мозжечок как специализированную систему predictive motor control и обсуждает feedforward/internal-model механизмы. Свежий мета-анализ 2026 года показывает согласованную cortico-basal-ganglia-cerebellar активацию при раннем моторном обучении. Работы 2026 года дополнительно подчёркивают роль cerebellar prediction/error correction и взаимодействия с distributed networks.

Engineering branch добавляет event-driven/sparse execution как отдельный benefit: современные neuromorphic работы показывают, что event-driven sparse processing и dual fast/slow memory pathways могут уменьшать вычислительную избыточность и сохранять long-timescale context.

## Тест
`tests/big-pass-218-cerebellar-motor-loop.mjs`

Проверено:
- 24 последовательных outcome updates;
- skill learning;
- motor gain improvement against fresh baseline;
- lesion blocks plasticity;
- snapshot/restore.

Результат: PASS.

## Safety of claims
Измеренный gain относится к computational score, не к физической батарее, CPU или температуре Android-устройства. Device-level savings остаются отдельной экспериментальной задачей.
