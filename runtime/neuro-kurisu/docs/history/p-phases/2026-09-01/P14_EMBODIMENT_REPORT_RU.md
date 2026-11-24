# Neuro-Kurisu P14 — Embodied Perception

## Цель

P14 превращает Android/Termux substrate из набора ресурсных метрик в часть perception-action loop организма.

## Реализовано

- event-driven PerceptionEngine;
- change detection для motion/proximity/light/network/battery/thermal;
- external event injection;
- perception routing в attention/homeostasis/memory/workspace;
- on-demand camera bridge без сохранения снимка по умолчанию;
- кэширование Termux capabilities на 60 секунд;
- body telemetry продолжает влиять на cognitive budget/homeostasis;
- perception state и routing state сохраняются в organism state;
- API `/api/organism/perception`, `/api/organism/event`, `/api/organism/vision/capture`;
- UI panel Perception/Sensors и кнопка Camera;
- schema migration 16 -> 17.

## Архитектурный цикл

`Android substrate -> perception -> salience/routing -> cognitive field/GWS -> world/agency -> action -> outcome -> memory/learning`.

## Научная граница

Это функциональная модель perception/embodiment, а не биологическая симуляция человека. Реальные Android sensors повышают экологическую валидность, но не доказывают субъективный опыт.

## Следующий шаг

P15 — Sleep/Skills/Lifelong Learning: multi-timescale replay, procedural skill promotion, dream simulation и долгосрочное возобновление собственных проектов.
