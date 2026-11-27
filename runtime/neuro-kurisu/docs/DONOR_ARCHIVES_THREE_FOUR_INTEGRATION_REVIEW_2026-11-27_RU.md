# Донорские архивы three.7z и four.7z — результаты разбора и интеграции

Дата проверки: 2026-11-27  
Проект: `ailtron1ss-rgb/NK1`  
Каноническая исходная точка: `workpass70-source @ 3857e805b8224e7630ba1c7ef50e4bc930565b58`

## 1. Проверка исходников

Оба архива присутствуют в библиотеке и были материализованы только для чтения:

| Архив | Размер | SHA-256 |
|---|---:|---|
| `four.7z` | 29,875,347 bytes | `e15b12e9617882026ab8077f7698c6a6c47df5f1e4690607d3dbcac2df4952a0` |
| `three.7z` | 259,719,500 bytes | `598c8e11e176994214d2cdfcf9ec0bfe4b65e19e10e54c0190e4f5b859293f97` |

Оба SHA-256 совпадают с ранее зарегистрированными значениями в `docs/research/DONOR_SOURCE_INTAKE_2026-11-03_RU.md`. Внутри найдено 12 ZIP-вложений, 11 уникальных проектов: Letta присутствует дважды, оба ZIP имеют один SHA-256. Все 12 ZIP прошли проверку CRC без ошибок. Суммарно в 11 уникальных ZIP — 69,687 записей (включая каталоги) и 970,754,839 байт распакованного содержимого. Исходные архивы не изменялись.

## 2. Донорская коллекция

| Проект | ZIP entries | SHA-256 вложенного ZIP | Лицензионный сигнал |
|---|---:|---|---|
| Hexis | 1,718 | `ad53945ad6e02e0b6e2ae57a89c78b6f2fd86f14b978a512bb862559f455b252` | MIT |
| PocketFlow | 678 | `821528c2dc3b161d7776dba0752b6cefa3332ca3772b1cd6cb07c19826e4aa30` | MIT |
| Letta | 16 | `5d28f152aba633fcc26fe20125fad28f73c6773e6526fc65249656b2d0c61075` | Apache-2.0; snapshot contains README-level material only |
| Lumina | 131 | `a820cb1b394018451c8ee5863ae0a1f74666bd10519007d6e37e69e42452d467` | Apache-2.0 |
| OWL | 193 | `428b6f9ebd0286ecbef58d57d6c9fbf0fd5b9829677e3ffcbfa58f41dddd3641` | Root LICENSE absent; nested `licenses/LICENSE` says Apache-2.0; subtrees need review |
| Superpowers | 307 | `02dbd1df4d736aa8f6016c5e163ad613a1ffeea0d58def158e12aacd4a6a41d8` | MIT |
| Will | 661 | `9d0c30277f0981b67104b1e2a07d9c7f025fee60ae57bd470cca898cf0d457a4` | Apache-2.0 |
| llama.cpp | 4,168 | `c60211456a8ab106e300fc590d973370f1b519474c49ec4219f8db4f0a7ddb8c` | MIT; model weights and runtime backends have separate terms |
| Mem0 | 2,214 | `88cfef6a9d27713c7649981ac2defc92c0dbcb5b69a442167e7c7bb512a93419` | Apache-2.0 |
| OpenAI Agents SDK | 1,967 | `8c88cd64087cbcd170796fb15ff1ebdea5a64d8710d206b7d5cfa369371faae5` | MIT |
| OpenClaw | 57,634 | `82880f15a9bf33285bab0c591dc43a562a2451564d0c195885b26c390fcfd3a6` | Root MIT; bundled components/platform assets may have separate terms |

License strings are inventory signals, not legal clearance. No donor source was executed, installed as a dependency, or wholesale copied into NK1. ZIP snapshots do not contain reliable upstream Git commit pins; archive hashes establish integrity, not upstream revision identity.

## 3. Сопоставление с текущим NK1

| Донор | Что уже есть в NK1 | Решение по этому проходу |
|---|---|---|
| Hexis | `HexisAdaptationFabric`, canonical evidence bridge, HMX canonical memory bridge, import redaction, provenance/review/retention/outbox contracts | Не дублировать; продолжать точечное сравнение недостающих temporal/learning-review contracts |
| Will | `WillIntegrationBridge`, vector index, MCP JSON-RPC, SDK facade, agency/outcome/PMA/transport/ACK/replay and attention-budget tests | Основные донорские механизмы уже представлены NK1-native адаптером; не подменять canonical runtime вторым Will runtime |
| Letta | `LettaGovernanceAdaptationFabric` | Архив — только небольшой README-срез; новых исполняемых модулей нет |
| Lumina | `LuminaAdaptationFabric` plus capability/idempotency/security tests | Сохранять текущий адаптер и владельцев NK1 |
| Mem0 | `Mem0PlatformAdapter`, OSS/platform adapters, runtime wiring and contract tests | Оставить опциональным provider; canonical NK1 memory remains authoritative |
| llama.cpp | `OpenAICompatibleLocalChatProvider`, `NeuroPlasticInferenceAdapter`, P40 model ecology and local backend policy | Уже есть локальный inference path; архив дополнительно подтверждает server features, но не требует импортировать C++ runtime or weights |
| OpenClaw | N.E.K.O. external Markdown memory adapter and plugin gateway/policy boundary | Обнаружен конкретный пробел: `skills/<name>/SKILL.md` не входил в поддерживаемые Markdown memory paths; добавляется review-gated import |
| OpenAI Agents SDK | NK1 already has host-owned ActionGateway, guarded intent/action path, specialist deliberation and session/trace ownership | Не добавлять второй Runner/session/tool authority; использовать отдельные совместимые паттерны только при доказанном разрыве |
| OWL | NK1 specialist roles / governed bounded orchestration already cover the general workforce pattern | Не вводить второй autonomous agent workforce/runtime; exact parity is not claimed |
| PocketFlow | NK1 cognitive stage spine, subsystem ports, runtime planning and graph boundaries | A second generic flow runtime would duplicate ownership; no dependency added |
| Superpowers | Existing `docs/superpowers/{plans,specs}` and TDD / review / verification process | Process-only donor; runtime integration would be inappropriate |

## 4. Реально добавляемая функциональность

OpenClaw packages skills as directories containing `SKILL.md` with YAML frontmatter and instruction text. NK1 previously accepted OpenClaw `USER.md`, `SOUL.md`, `MEMORY.md` and dated memory Markdown, but did not recognize the skill path.

The targeted port extends the existing `NekoExternalMarkdownMemoryAdapter`:

- recognizes `skills/<slug>/SKILL.md`, including nested repository/workspace paths;
- classifies its content as semantic external knowledge with target `facts`;
- always quarantines a skill candidate using `skill-content-requires-manual-review`, even when text contains no injection marker;
- preview performs no canonical memory writes;
- commit without explicit override rejects it;
- explicit review override still stores it as `unknown`, `external`, and `unverified-import` through the canonical MemoryFabric/MemoryOS2 owner;
- imported instructions do not become tool permissions, executable skill manifests, or host policies.

This is deliberately a knowledge-ingestion bridge, not an OpenClaw runtime/plugin port.

## 5. Покрытие и честный процент

- Donor project inventory: 11/11 unique projects inspected (100% inventory coverage).
- Nested ZIP integrity: 12/12 CRC checks passed.
- Existing NK1 adapter overlap: direct donor-specific adapters were confirmed for Hexis, Will, Letta, Lumina, Mem0 and llama.cpp; OpenClaw already had a compatible external-memory path. Other donors map to existing NK1-owned architecture or process patterns rather than requiring an external runtime.
- New functional gap identified: OpenClaw `SKILL.md` import path — one concrete new feature is being implemented and tested.

A byte-based “90% integration” would be misleading: the collection expands to roughly 971 MB, much of it upstream docs, examples, model/build assets and code with different runtime/license assumptions. The correct denominator is distinct reusable capabilities, not archive bytes. The pass therefore reports 100% inventory coverage and explicit per-donor disposition; it does not claim 90% of source files or 90% of runtime code was copied. Additional candidates remain subject to their own exact behavior, benchmark, dependency, and license gates.

## 6. Verification status

The first PR revision added only the OpenClaw SKILL.md behavioral contract and CI step. Exact-head GitHub Actions run `46028347292` confirmed the expected RED: dependency installation succeeded, the new OpenClaw contract failed because the adapter did not yet recognize the path, and runtime typecheck passed. The implementation revision must turn that test green and rerun the existing importer, memory lifecycle, restore-hardening and runtime typecheck checks.

Source branch and archives remain untouched; changes are isolated in the review PR until CI and review are complete.
