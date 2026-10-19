# B288 — Аналогичные проекты и полезные исходники

Дата: 2026-09-12

## Brian2

Полезная идея: явное разделение neuron equations, synapses и learning rules. Это следует постепенно перенести в Neuro-Kurisu, чтобы B269/B280/B288 не держали всё в одном state object.

Source: https://github.com/brian-team/brian2

## Nengo

Полезная идея: learning rules как независимые reusable components (PES, FORCE/RLS, Voja) и composition из recurrent neural components.

Source: https://github.com/nengo/nengo
Examples: https://github.com/nengo/nengo.github.io/blob/main/examples.md

## Norse

Полезная идея: composable recurrent spiking modules и явные temporal neuron/synapse state objects поверх PyTorch.

Source: https://github.com/norse/norse

## Leabra / Emergent

Наиболее полезный архитектурный аналог для текущего направления: local + error-driven + associative learning, inhibitory competition и kWTA sparse distributed representations. Leabra/Emergent также интересны тем, что поддерживают более сложные brain-like networks и запуск через Cogent Core на Android/iOS/web.

Source: https://github.com/emer/leabra
Source: https://github.com/emer/emergent

## DreamerV3

Полезна separation of world model, recurrent latent dynamics и actor/critic imagination. Не копируем код, а используем идею multi-timescale predictive model → imagined rollout → policy learning.

Source: https://github.com/danijar/dreamerv3

## Generative Agents

Полезна связка memory stream → reflection → planning → social behavior. Для Neuro-Kurisu основной урок — reflection должна изменять будущие decisions, а не быть только текстовым журналом.

Project: https://github.com/joonspk-research/generative_agents

## Итог для Neuro-Kurisu

Не добавлять зависимости ради копирования чужой архитектуры. Брать проверенные механические идеи и переносить их в bounded, auditable, mobile-friendly собственную реализацию.
