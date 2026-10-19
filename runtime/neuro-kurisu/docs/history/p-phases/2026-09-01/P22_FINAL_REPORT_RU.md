# P22 Final Report — Phone Reliability & Truthfulness

## Статус
P22 реализован и проверен на host-side runtime. Релиз: `7.2.0`, core `19.0.0-p22-phone-reliability-truthfulness`, state schema `25`.

## Что реально изменено

### Runtime policy
Добавлен `src/organism/system/PhoneRuntimePolicy.ts`.

Он является единым местом для решения:
- режима `eco | active | research`;
- базового autonomous cadence;
- реакции на battery, thermal, RAM, CPU;
- реакции на рост thermal, а не только на абсолютное значение;
- cooldown после серии активных циклов;
- минимального cognitive budget перед запуском очередного автономного шага.

### Persistence
World-state больше не записывается после каждого autonomous cycle. Он помечается dirty и сохраняется по времени/числу dirty cycles.

`flush()` по-прежнему принудительно сохраняет и core state, и world state.

API metrics теперь различает core/world persistence statistics.

### LLM truthfulness/cost
Обычный `/api/organism/chat` использует один language-model вызов.

Дополнительный cognitive-proposal проход теперь включается явно через `deliberate=true`. Автономные циклы могут вызвать proposal только при повышенной prediction error.

В UI это отображается буквально как `deliberate reasoning (extra LLM pass)`, а не как скрытый режим.

### Model default
Default Gemini backend обновлён с `gemini-2.0-flash` на `gemini-3.6-flash`.

### Documentation
Обновлены README, changelog, version ledger, Device Gate и Runbook. Добавлен полный P22 документ с дальнейшим трёхитерационным roadmap.

## Проверки

PASS:
- typecheck
- P22 phone policy test
- P22 chat routing test
- P17 embodied multimodal regression
- P21 resilience
- P21 migration 24→25
- restart persistence
- organism smoke
- server smoke
- architecture audit
- source hygiene
- full project audit
- release contract
- archive manifest
- legacy snapshot integrity
- P15.5, P16, P17, P18, P19, P20 regression families

## Ограничения, которые P22 сознательно не маскирует

1. Реальный 24/72/168h тест на физическом POCO ещё не выполнен в этой среде.
2. Локальная LLM остаётся потенциально главным потребителем RAM/CPU/thermal.
3. Semantic vision и semantic audio остаются неполными и не объявлены реализованными.
4. Shadow organism, dream compilation и world model остаются объектами следующей итерации.

## Следующие две большие итерации

### P23 — True Learning & Counterfactual Development
Real replay, before/after learning evaluation, independent shadow state, skill promotion after offline validation, blind evaluator, self-ablation, cognitive checksum и Evidence Debt Market.

### P24 — World Model, Multimodal Embodiment & Long-Lived Identity
Learned temporal world model, semantic vision/audio, shared multimodal latent state, phone-as-body model, temporal memory compression, behavioral genome, boredom-driven exploration и empirical model-switch verification.

## Принцип проекта после P22
Новый модуль не принимается в canonical runtime только потому, что он красиво назван или концептуально интересен. Для него нужна baseline-vs-module проверка и измерение цены по latency, CPU, RAM, storage и energy.

## Post-P22 forensic finding resolved in P23

При повторной проверке P22 обнаружен server-side regression: `POST /api/organism/chat` повторно вызывал `generateLanguage()` после `runtime.step()`. P22 runtime test это не видел, потому что проверял только `OrganismRuntime`. В P23 server path исправлен и закреплён отдельным source-contract test.
