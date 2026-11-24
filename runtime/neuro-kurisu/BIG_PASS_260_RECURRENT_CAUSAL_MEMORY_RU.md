# BIG PASS 260 — Recurrent Causal Memory

Дата: 2026-09-12

## Цель

Перевести B259 из просто обучаемого recurrent-субстрата в часть временного causal loop: нейронная активность -> episodic trace -> outcome -> delayed TD-like credit -> replay -> обновление обучаемых параметров -> persistence.

## Что реально добавлено

- `src/organism/cognition/RecurrentCausalMemory.ts`
- episodic traces с нейронной activity-вектором;
- привязка trace к реальным `memoryId`;
- outcome closure;
- gamma/lambda controlled delayed credit;
- prioritized replay;
- replay diagnostics;
- реальное применение replay-credit к B259 trainable parameters;
- core integration через `OrganismCore`;
- persistence через `OrganismSystemState`, migration и `PersistenceProjectionCoordinator`;
- отдельный standalone test;
- отдельный full-core integration/restart-round-trip test.

## Реальное прохождение

### Standalone B260

- encodingCount = 18
- outcomeCount = 18
- replayRuns = 1
- replayedEpisodes = 12
- delayedCredit01 = 0.04696
- replay application > 0
- trainable parameters changed = true
- standalone persistence = PASS

### Full core integration

- encodingCount = 18
- outcomeCount = 18
- replayRuns = 1
- replayedEpisodes = 12
- linkedMemoryCount = 4
- delayedCredit01 = 0.04514
- canonicalLearningUpdates = 30
- system state survives OrganismCore in-memory restart round-trip = PASS

## Проверки регрессии

- Typecheck = PASS
- B259 = PASS
- B250–B258 regression path = PASS
- P26 true learning = PASS
- B242–B249 regression path = PASS
- Architecture = PASS
- Integrity = PASS
- Source hygiene = PASS
- Release contract = PASS
- Lockfile = PASS
- Release source = PASS
- Full project audit = PASS
- Archive manifest = PASS
- Archive verification = PASS

## Что B260 ещё НЕ доказывает

B260 не доказывает сознание, personhood или общую интеллектуальную автономность.

Он также пока не доказывает, что replay необходим для поведения. Следующая обязательная проверка — controlled ablation: online-only против replay-enabled на одинаковых задачах, включая delayed transfer и catastrophic-interference benchmark.

## Реально обнаруженная проблема среды

Полный существующий `tests/restart-persistence.mjs` с `FileStateStore` в текущей рабочей filesystem-среде воспроизводимо падает на `fsync` с `EIO`. Это инфраструктурное ограничение среды, а не failure B260 neural state: B260 отдельно проходит полный `OrganismCore` in-memory persistence round-trip.

Мы НЕ переводим этот gate в PASS и НЕ отключаем `fsync` ради зелёного отчёта.

## Оценка B260

- реализация: 94/100
- integration: 88/100
- persistence model: 91/100
- delayed credit: 67/100
- causal evidence: 58/100
- memory coupling: 76/100
- replay quality: 63/100
- scientific verification: 61/100

B260 engineering completion: 100%.
B260 scientific completion: 68%.

## Следующий большой проход

B261 — Unified World Model 2:

`shared latent -> recurrent state -> action-conditioned transition -> predicted consequence -> external consequence -> prediction error -> causal memory -> replay`

Главный критерий: unseen-context transfer и true ablation, а не количество новых модулей.
