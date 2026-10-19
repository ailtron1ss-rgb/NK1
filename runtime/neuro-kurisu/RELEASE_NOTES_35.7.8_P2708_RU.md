# Neuro/Kurisu 35.7.8 — P2708 Deep Learning Coupling

## Крупный апгрейд

P2708 объединяет несколько уже существующих связок в один экспериментальный causal learning path:

`causal credit + information gain + experimental value + multi-timescale traces + astro-like gate + self-normalization + continual benchmark`

### Основные изменения

- Добавлен `P2708DeepLearningCoupler`.
- NeuralExperienceBranch state schema поднят `18 → 19`.
- Добавлены delay profiles `short/balanced/long/ultra`.
- Information gain и autonomous experiment value теперь могут участвовать в bounded teaching signal для local online credit.
- Добавлена локальная self-normalizing recurrent plasticity.
- Добавлены factorial/continual tests.
- Добавлен мобильный 250-cycle closure test.
- Обновлены manifests, release contract, package metadata и research archive.

## Проверка

- TYPECHECK: PASS
- P2702 personality: PASS
- P2703 global workspace: PASS
- P2705 homeostasis: PASS
- P2706 online credit: PASS
- P2707 cascade: PASS
- P2707 factorial: PASS
- P2708 deep coupling: PASS
- P2708 continual factorial: PASS
- P2708 long-horizon mobile: PASS
- RELEASE_CONTRACT: PASS
- SOURCE_HYGIENE: PASS
- SYNTAX_JSON: PASS
- FORENSICS: PASS
- ARCHIVE_MANIFEST: PASS

## Ограничение результата

Синтетический continual benchmark P2708 пока не показывает уменьшения forgetting относительно control: experimental `0.0344` против control `0.0250`. Это сохранено как отрицательный результат и не маскируется под улучшение.
