# Внешнее исследование: полезные архитектуры и исходники для Neuro-Kurisu

Дата: 2026-09-13

## Soar

Soar особенно полезен для режима impasse -> subgoal. Когда система не может однозначно выбрать оператор, Soar создаёт substate для разрешения impasse и только после результата возвращается к верхнему уровню решения. Это напрямую подходит для нашего low-budget / low-confidence режима и лучше бинарного `run=true/false`.

Источник: https://soar.eecs.umich.edu/soar_manual/02_TheSoarArchitecture/

## ACT-R

ACT-R полезен как reference для modular cognitive architecture: procedural selection, declarative memory и goal mechanisms координируют совместную cognitive cycle. Мы не должны копировать ACT-R, но должны сохранять clear ownership между memory, goals, action selection и learned policy.

Источник: https://act-r.psy.cmu.edu/

## Norse

Norse демонстрирует практику обучения SNN через surrogate-gradient подходы, а также предоставляет готовые spiking modules на PyTorch. Для основного Termux runtime эта зависимость слишком тяжёлая, но её documentation/source полезны как контроль того, насколько наш surrogate/STDP/eligibility механизм соответствует современным SNN-подходам.

Источник: https://norse.github.io/norse/learning.html

## Brian2

Brian2 — зрелый simulator для spiking neural networks. Он полезен как внешний научный эталон и лаборатория для проверки отдельных neural hypotheses, но не как обязательная runtime dependency телефона.

Источник: https://github.com/brian-team/brian2

## Nengo

Nengo предназначен для построения и развертывания spiking и non-spiking neural networks, в том числе dynamic information processing, working memory, action selection и planning. Это хороший источник архитектурных идей для будущего более крупного neural substrate.

Источник: https://www.nengo.ai/

## Emergent / Leabra lineage

Emergent предоставляет toolkit для биологически основанных neural network simulations от biologically detailed spiking models до более абстрактных deep models. Особенно полезна сама идея сочетания local error-driven и associative learning и анализа динамики сетей.

Источник: https://github.com/emer/emergent

## DreamerV3

DreamerV3 строит learned world model из опыта и обучает actor-critic через imagined trajectories. Для Neuro-Kurisu важна именно архитектурная идея: imagination должна быть downstream от learned world model, а не просто текстовым counterfactual string builder.

Источник: https://github.com/danijar/dreamerv3

## Open-source AI-companion analogue

Публичные Neuro-sama-style проекты полезны не как модель мозга, а как reference по practical embodied companion stack: real-time input, local LLM, TTS, avatar, tools and event loops. Один из современных open-source examples использует WebGPU/WebAudio/Web Workers/WebAssembly/WebSocket и native acceleration в desktop mode.

Источник: https://github.com/LGMOA/Neuro-sama

## Что брать для Neuro-Kurisu

1. Soar: impasse/subgoal semantics.
2. ACT-R: ownership boundaries между памятью, целями и процедурным выбором.
3. Norse/Brian2/Nengo/Emergent: научные neural mechanisms и benchmarking.
4. DreamerV3: learned latent world model + imagination -> policy.
5. Companion projects: deployment/event-loop patterns, не cognitive claims.

## Что НЕ надо делать

Не добавлять Python/JAX/PyTorch/Brian2/Norse как обязательные runtime dependencies для телефонной ветки только ради названия «настоящего нейро». Это ухудшит portability/Termux footprint без автоматической гарантии лучшего learning.
