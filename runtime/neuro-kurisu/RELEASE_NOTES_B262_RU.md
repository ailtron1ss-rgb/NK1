# Release Notes B262 — Multi-timescale World Dynamics

Дата: 2026-09-12

## Главный апдейт

Добавлен `B262MultiTimescaleWorldModel`.

Новые реальные механизмы:

- short/mid/long world-dynamics heads;
- delayed targets из накопленных эпизодов;
- multi-timescale replay;
- counterfactual action comparison;
- beam planning до глубины 4;
- uncertainty-aware planning cost;
- lesion benchmark;
- holdout transfer measurement;
- persistence/migration;
- OrganismCore integration.

## Критическое исправление архитектуры

B262 исправляет проблему B261, при которой разные horizon heads в основном обучались на одном immediate target.

Теперь replay использует actual state[t+4] и actual state[t+8] для mid/long learning.

## Проверка

B262 standalone:

- updates: 88
- delayed horizon updates: 22
- replay episodes: 16
- replay gain: 0.02626
- long lesion drop: 0.09007
- restore: PASS

B262 Core:

- live episodes: 20
- explicit replay: 8
- replay: PASS
- restart: PASS
- planning API: PASS
- counterfactual API: PASS

## Ограничения

Planner пока не доказал behavioural superiority: planning advantage в standalone benchmark отрицательный.

Action identifiability пока слабая.

Long-horizon world model ещё не является полноценным physically grounded simulator.
