# B288 — Внешние нейронные проекты и полезные архитектурные идеи

Дата: 2026-09-12

## Brian2

Brian2 — гибкий симулятор spiking neural networks с явными neuron/synapse моделями. Для Neuro-Kurisu полезна идея отделить neuron state, synapse state и plasticity rule как разные сущности, а не хранить всё в одном агрегате.

Source: https://github.com/brian-team/brian2

## Nengo

Nengo предоставляет готовые подходы к online learning (PES, FORCE/RLS, Voja и др.) и примеры по NEF/SPA. Для Neuro-Kurisu особенно полезен паттерн отдельных reusable learning rules, которые можно менять независимо от representation.

Source: https://github.com/nengo/nengo
Examples: https://github.com/nengo/nengo.github.io/blob/main/examples.md

## Norse

Norse расширяет PyTorch spiking-компонентами и содержит recurrent SNN units, neuron models и temporal-state primitives. Полезный паттерн — отделять модель клетки/состояния от общей training infrastructure и поддерживать composable recurrent components.

Source: https://github.com/norse/norse

## Leabra / Emergent

Leabra особенно близка нашей цели по компромиссу между биологической правдоподобностью и вычислительной практичностью: local + error-driven + associative learning, inhibitory competition и kWTA sparse distributed representations. Также проект поддерживает запуск через Cogent Core на Android/iOS/web, что напрямую интересно для мобильного Neuro-Kurisu.

Source: https://github.com/emer/leabra
Source: https://github.com/emer/emergent

## DreamerV3

Dreamer использует recurrent world-model state, imagination rollouts и отдельные actor/critic learning paths. Для Neuro-Kurisu это полезная модель того, как отделять prediction/world dynamics от policy learning, одновременно связывая их через imagined trajectories.

Source code reference: https://github.com/danijar/dreamerv3

## Generative Agents

Архитектура Generative Agents показала полезную комбинацию memory stream, reflection и planning для social behavior. Это хорошо согласуется с нашей линией B285–B288, но Neuro-Kurisu должна постепенно переносить важные зависимости из символических ledger-структур в обучаемую neural substrate.

Paper/project search entry: https://github.com/joonspk-research/generative_agents

## Что НЕ нужно копировать

Не нужно механически импортировать большие внешние frameworks в мобильное ядро. Сейчас лучше заимствовать проверенные архитектурные идеи и тестовые методологии, а реализацию держать локальной и bounded.

## Приоритеты заимствования

1. Explicit synapse/neuron separation — Brian2.
2. Modular learning-rule adapters — Nengo.
3. Reusable recurrent spiking units — Norse.
4. E/I + kWTA + associative/error-driven balance — Leabra.
5. Recurrent world model + imagination — Dreamer.
6. Memory/reflection/planning social loop — Generative Agents.
