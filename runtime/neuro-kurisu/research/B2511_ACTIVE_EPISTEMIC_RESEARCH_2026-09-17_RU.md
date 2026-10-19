# Research synthesis — B2511

## Почему направление выбрано

Свежий обзор world models для Physical AI подчёркивает закрытый контур perception → prediction → planning/control и отдельно выделяет uncertainty, intervention testing, latency, verification и recovery как важные проблемы.

Источник: Kirchner, Purschke, Knoll, 2026, *A survey of world models for physical AI with uncertainty representation and control*.
https://link.springer.com/article/10.1007/s44163-026-02122-1

Свежая работа 2026 года по active inference рассматривает выбор действий через expected information gain + value и связывает information gain с тем, насколько действие различает конкурирующие модели мира.

Источник: Friston et al., 2026, *Active inference and artificial reasoning*, Nature Communications.
https://www.nature.com/articles/s41467-026-77209-5

Работа 2026 года *World Models for Embodied Intelligence: From Plausible to Controllable to Actionable* предлагает оценивать world models не по визуальной правдоподобности, а по тому, улучшают ли их предсказания action, learning, verification, recovery и data selection.
https://arxiv.org/abs/2609.16697

Обзор 2026 года по interoceptive AI подчёркивает explicit internal-state variables и объединение homeostatic, allostatic и enactive механизмов для адаптивной автономии.
https://www.nature.com/articles/s42256-026-01296-8

## Архитектурный вывод для Neuro-Kurisu

B2511 должен быть не отдельным curiosity score, а bounded decision influence layer:

`uncertainty + model disagreement + predicted information + internal cost + risk`
→ `epistemic action value`
→ `verify/explore/act`
→ `observed information gain`
→ `learn action-specific information value`
→ `future decision`.

Это оставляет возможность измерять полезность системы экспериментально и не подменяет causal verification красивой внутренней метрикой.
