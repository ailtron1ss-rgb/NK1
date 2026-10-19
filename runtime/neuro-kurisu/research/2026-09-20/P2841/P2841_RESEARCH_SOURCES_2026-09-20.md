# P2841 — Research Sources — 2026-09-20

## 1. World Models for Embodied Intelligence: From Plausible to Controllable to Actionable

arXiv: https://arxiv.org/abs/2609.16697

Опубликовано 15 сентября 2026. Работа подчёркивает, что ценность world model нужно оценивать не только визуальной правдоподобностью, а влиянием на planning, action, learning, evaluation, verification и recovery.

Применение в P2841: postcondition verification и grounded-world commit являются частью одного actionable loop, а не отдельным audit layer.

## 2. Interpreting Physics in Video World Models

Meta AI: https://ai.meta.com/research/publications/interpreting-physics-in-video-world-models/

arXiv: https://arxiv.org/abs/2602.07050

Опубликовано в 2026. Исследование показывает, что физические признаки в video world models могут возникать как распределённые population-like representations, а не как компактные явные physics variables.

Применение: не сводить будущий neural world substrate Kurisu к нескольким вручную выбранным state scalars; сохранять возможность distributed representations и проверять их через ablation.

## 3. V-JEPA 2

Meta AI: https://ai.meta.com/research/vjepa/

Publication: https://ai.meta.com/research/publications/v-jepa-2-self-supervised-video-models-enable-understanding-prediction-and-planning/

Основной принцип: self-supervised world representation -> action-conditioned prediction -> planning/replanning. Для телефонного проекта переносится как архитектурный принцип, а не как прямое внедрение 1.2B модели.

## 4. Active Perception for Embodied Disambiguation

arXiv: https://arxiv.org/abs/2608.13605

Опубликовано август 2026. Работа рассматривает активное изменение точки наблюдения как способ добыть отсутствующую информацию, вместо немедленного запроса уточнения или продолжения на недостаточных данных.

Применение: P2841 повышает active-perception demand при высоком shadow/reality divergence и низкой independent verification.

## 5. Embodied multimodal perception and real-time planning

Frontiers in Neurorobotics, 2026: https://www.frontiersin.org/journals/neurorobotics/articles/10.3389/fnbot.2026.1846108/full

Применение: сохранять тесную связь perception, uncertainty и real-time action selection, но не переносить тяжёлую вычислительную часть напрямую на medium-phone runtime.

## Исследовательский вывод

Самая полезная для P2841 тенденция — переход от "plausible simulation" к "actionable, verifiable world model". Это совпадает с направлением проекта: predicted consequences должны улучшать реальное действие, а реальные последствия должны корректировать модель.
