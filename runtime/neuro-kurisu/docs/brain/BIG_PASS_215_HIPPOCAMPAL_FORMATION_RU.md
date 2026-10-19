# BIG PASS 215 — Гиппокампальная формация

Дата: 2026-09-11
Релиз: 35.6.1

## Что восстановлено

Добавлен `HippocampalFormationCircuit` как функциональный контур, а не анатомический макет:

`DG-like sparse separation → CA3-like associative completion → CA1-like prediction/comparison → subiculum-like output`.

Контур подключён к существующему `HippocampalMemorySubstrate`, сохраняется через `MemorySubsystemRuntime`, участвует в memory-features центрального организма и запускает offline replay вместе с уже существующей консолидацией.

## Причинная проверка

Тест `tests/big-pass-215-hippocampal-formation.mjs` проверяет:

- базовое восстановление эпизода;
- абляцию DG-like узла — разделение упало `0.66195 → 0.08038`;
- абляцию CA3-like узла — completion упало `0.81345 → 0.44740`;
- bounded uncertainty/prediction error;
- replay state;
- snapshot/restore с сохранением 12 replay runs.

Это вычислительная гипотеза, а не утверждение биологической эквивалентности.

## Почему этот проход полезнее простой аналогии

Контур добавляет полезные для искусственного организма свойства: разреженное кодирование, cue-based completion, отдельную ошибку предсказания, uncertainty signal, replay prioritization и отказоустойчивую персистентность. Это соответствует современному направлению исследований sparse/event-driven computation и при этом остаётся инженерным модулем проекта.

## Научное основание

Работы по hippocampal/parahippocampal circuitry связывают DG/CA3 с pattern separation/completion, а современные данные показывают связь hippocampal ripples с обработкой предсказуемости/неопределённости. При этом replay не следует жёстко считать исключительно гиппокампальным: для procedural memory в 2026 показан независимый стриатальный replay. Поэтому в проекте replay рассматривается как распределённый механизм организма, а не как монополия гиппокампа.

Источники: Nature Reviews Neuroscience, Scientific Reports, Nature Neuroscience 2026.

## Ограничения

Не измерялись физические ватт-часы на телефоне; sparse-кодирование пока подтверждено программно, а не аппаратными измерениями. Также не заявляется биологическая идентичность DG/CA3/CA1.
