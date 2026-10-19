# V105 — Synergy Trunk / Temporal Credit Expansion

## Реальные изменения

- Убран второй источник конфигурации `temporal_credit`: канонический владелец теперь `CurrentConfig`.
- `ThreeFactorFastWeight` обновлён до STATE_VERSION 2.
- Исправлено batch-смешивание: update строится как среднее per-sample outer products, а не outer(mean(error), mean(hidden)).
- Добавлены настоящие fixed multi-timescale cascade traces.
- Добавлен `event_bank`: bounded parameter-free fast-weight slots с similarity routing и отдельными eligibility/fast-weight состояниями событий.
- Добавлены research-only erase modes: `key`, `qed`, `address`, `qed_address`. По умолчанию остаётся `key`.
- Добавлены диагностические показатели cascade/event-bank/erase control.
- Release metadata синхронизирован на V105 / 1.05.0.
- Архив будет собран без `__pycache__`, `.pyc` и временных файлов.

## Что не продвинуто в default

Temporal cascade, event-bank и QED/EDA erase остаются candidate/research-only. Они не считаются доказанно лучшими для общего NeuroCore до полноценного benchmark/ablation.
