# OME26 Hyper-Plastic Network — усиление и интеграционный дизайн

**Цель:** превратить первоначальный low-rank hypernetwork-прототип в воспроизводимый экспериментальный контур, который использует реальное состояние NK1, принимает решения с учётом существующего когнитивного бюджета и допускает адаптер к маршрутизации только при подлинном, подписанном независимом evidence и реальной поддержке backend.

## Что уже есть

В NK1 уже имеются:
- `B292CognitiveStateBus` как единый нормализованный слепок когнитивного состояния;
- `CognitiveBudgetManager` с estimate/canSpend/spend и ограниченным ledger;
- `VerifiedOutcomeLedger` + `VerifiedOutcomeArtifact` для подписанных Ed25519 исходов и process-local аутентифицированных receipt;
- `P36VerifiedOutcomeLedgerEvaluator` для host-pinned paired holdout результатов;
- `OpenAICompatibleLocalChatProvider` для локального llama.cpp OpenAI-compatible chat endpoint;
- `LocalLanguageBackendPolicy` для выбора backend и circuit-breaker.

Первичный OME26 прототип уже генерирует LoRA factors, имеет offline fitting, shape/budget clamps, checkpoint fingerprint и синтетический report gate. Но этот gate всё ещё принимает свободные массивы метрик от caller, а текущий llama.cpp provider пока не объявляет поддержку LoRA. Эти границы нельзя скрывать.

## Цели

1. Использовать настоящие подписанные OME26 evaluation records, привязанные к точной модели, адаптеру, manifest, verifier и split.
2. Разделить train / calibration (validation) / holdout, требовать не менее пяти полных paired seeds и вычислять seed-level confidence bound.
3. Считать только signed evidence, уже прошедшее `ingestSignedOutcomeArtifact`; plain JSON, восстановленный snapshot и caller booleans не могут выдать promotion permit.
4. Подписывать latency и safety counters вместе с outcome; отсутствие метрик блокирует promotion.
5. Заставить hypernetwork training/proposal использовать оставшийся бюджет `CognitiveBudgetManager`, не создавать второй budget owner.
6. Сохранить B292 как единственный источник когнитивных признаков; валидация состояния fail-closed.
7. Подтвердить capabilities локального backend реальным provider-контрактом. Текущий OpenAI-compatible chat provider объявляет LoRA unsupported; baseline remains active.
8. Добавить воспроизводимые тесты и отдельный Actions workflow, не менять Release ZIP и не auto-merge.

## Не-цели

- Не обновлять базовые веса активной LLM.
- Не притворяться, что OpenAI-compatible chat completion API уже загружает LoRA.
- Не включать автономный promotion в production.
- Не создавать новые базы, секреты или удалённые сервисы.
- Не считать синтетические fixture-метрики модельным uplift.

## Рассмотренные подходы

- **A — оставить report API и только добавить новые clamps.** Минимальный diff, но raw caller metrics остаются источником истины. Отклонён как недостаточный.
- **B — использовать signed outcome ledger как единственный source of truth.** Небольшой, но более сильный trust boundary; можно связать модель/адаптер и resource results с существующей криптографией и split-aware evaluator. Выбран.
- **C — немедленно активировать адаптер в llama.cpp.** Не подходит: текущий provider использует OpenAI-compatible chat completions и не заявляет adapter capability; без реального loader/capability contract это будет фиктивная интеграция.

## Выбранная архитектура

- Hypernetwork remains an isolated research module producing immutable candidates.
- Новый OME26 evaluator derives paired seed metrics from the existing authenticated `VerifiedOutcomeLedger`. Signed record identity pins model and adapter method IDs; split-specific manifest fingerprints prevent calibration/holdout reuse.
- The promotion permit is an in-process object capability minted only after authenticated evidence, complete paired coverage, confidence, latency, and zero-safety-regression checks.
- An OME26 runtime bridge reads B292 + existing budget, spends a bounded `research` operation before generating a candidate and never activates a candidate itself.
- Local chat providers expose explicit adapter capabilities. The current llama.cpp adapter reports `supportsLowRankAdapters: false`, so live requests keep the baseline.
- Promotion and real adapter load remain separate gates. A supported provider must explicitly report layer targets and exact base-model fingerprint.

## Инженерные решения по умолчанию

- Calibration split: `validation`; final evidence split: `holdout`.
- Minimum independent paired seeds: 5; require complete task coverage for both methods for every accepted seed.
- Signed metrics: `durationMs` and `safetyRegressionCount` required by OME26; optional memory/token metrics remain diagnostic until measured consistently.
- Base model and adapter identities use SHA-256.
- Latency promotion threshold: mean and per-seed overhead <=20%.
- Safety regression threshold: exactly zero.
- Any missing, stale, contradictory, or untrusted evidence returns baseline-only.
