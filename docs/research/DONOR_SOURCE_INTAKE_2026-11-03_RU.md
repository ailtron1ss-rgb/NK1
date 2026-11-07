# NK1 — реестр исходников и план адаптации донорских механизмов

Дата инвентаризации: 2026-11-03  
Канонический исходный baseline: `workpass70-source` @ `eaf653d2229b8c032fe542ffb3215ff25ba69a93`

## 1. Что было получено и проверено

Получены четыре контейнера 7z. Архивы распакованы через libarchive; внутри обнаружено 22 ZIP-снимка, из которых 21 уникальный: Letta присутствует дважды с одинаковым SHA-256. Это инвентаризация файлов, а не подтверждение актуальности upstream-коммитов: ZIP-имена указывают на `main`/`master`, но сами архивы не содержат надёжной фиксации Git commit SHA.

| Контейнер | SHA-256 |
|---|---|
| `one.7z` | `2aa144432afd7a234b4aa3139cfa6019a97bab453dd235f623ccac2c00b83b41` |
| `two.7z` | `f6bce0f421c727c98c978328efe0dcb2bfa93ef77f8a7fcc1686c24b24958366` |
| `three.7z` | `598c8e11e176994214d2cdfcf9ec0bfe4b65e19e10e54c0190e4f5b859293f97` |
| `four.7z` | `e15b12e9617882026ab8077f7698c6a6c47df5f1e4690607d3dbcac2df4952a0` |

## 2. Донорские проекты

SHA-256 относится к вложенному ZIP целиком. Лицензия — первичный root-level license, если не оговорено иное. До копирования исходного кода всё равно требуется проверка лицензий конкретных подкаталогов и транзитивных зависимостей.

| Проект / snapshot | Файлов | SHA-256 ZIP | Лицензия / замечание |
|---|---:|---|---|
| Hexis-main | 1,718 | `ad53945ad6e02e0b6e2ae57a89c78b6f2fd86f14b978a512bb862559f455b252` | MIT |
| PocketFlow-main | 678 | `821528c2dc3b161d7776dba0752b6cefa3332ca3772b1cd6cb07c19826e4aa30` | MIT |
| Letta-main | 16 | `5d28f152aba633fcc26fe20125fad28f73c6773e6526fc65249656b2d0c61075` | Apache-2.0; duplicate archive in `three.7z` has identical hash |
| Lumina-main | 131 | `a820cb1b394018451c8ee5863ae0a1f74666bd10519007d6e37e69e42452d467` | Apache-2.0 |
| OWL-main | 193 | `428b6f9ebd0286ecbef58d57d6c9fbf0fd5b9829677e3ffcbfa58f41dddd3641` | Root LICENSE absent; `licenses/LICENSE` declares Apache-2.0; verify subpackages |
| Superpowers-main | 307 | `02dbd1df4d736aa8f6016c5e163ad613a1ffeea0d58def158e12aacd4a6a41d8` | MIT |
| Will-main | 661 | `9d0c30277f0981b67104b1e2a07d9c7f025fee60ae57bd470cca898cf0d457a4` | Apache-2.0 |
| Agent0-main | 1,594 | `e064f71f36505e85de047d2d714ecfe7c0659c0554da9d67e4002c8dc2802c48` | Apache-2.0 root; inspect bundled executor/training subprojects |
| AutoGPT-master | 10,417 | `aed501c3c9a81a7bf29a8dec8aa7db3183bfa0656716d4cd2430c2a7eec291cd` | Mixed: MIT outside `autogpt_platform`; PolyForm Shield inside `autogpt_platform`; do not copy platform code without legal review |
| agent-framework-main | 6,853 | `598514805cfb11f8c7cb3efce72517c210705791e7751c9db0504e67a2cde838` | MIT |
| autogen-main | 2,320 | `116a964fa7691fc673724961ac3b5c2860a7cf311aeb770dbaa6b3ed9866980d` | Root declares CC-BY-4.0; some subpackages carry separate MIT terms; path-level review required |
| chroma-main | 2,675 | `902ca85310fdee7aba311ba526955093c2b374eef9302fb3a648531e2019581d` | Apache-2.0 |
| dspy-main | 905 | `c41f31f38baff7b52898116be8a739ffedb6994994b4ee5ae94cfff75011973e` | MIT; inspect enterprise and model-metadata subtrees separately |
| faiss-main | 1,204 | `6017db0aa2aea52d0e5c8cc807f55e9a9c0e943c0393229289249fd3688f851e` | MIT |
| hermes-agent-main | 19,797 | `9aa1aecea207d81e8ee3100f4c3d1b7344d893b8594719b8a153fd09d0a4b8bb` | MIT |
| hyperon-experimental-main | 367 | `ffd30b33a6baf2db307e4f826254ebc30dd30373175011f30fbfe6b72ece1e8e` | MIT |
| langroid-main | 890 | `7dfa88f8857fb09fb160f6538d81985146fd09de0fa4c27ceccd6eaf86846717` | MIT |
| llama.cpp-master | 4,168 | `c60211456a8ab106e300fc590d973370f1b519474c49ec4219f8db4f0a7ddb8c` | MIT; model weights and backend runtimes have separate licenses |
| mem0-main | 2,214 | `88cfef6a9d27713c7649981ac2defc92c0dbcb5b69a442167e7c7bb512a93419` | Apache-2.0 |
| openai-agents-python-main | 1,967 | `8c88cd64087cbcd170796fb15ff1ebdea5a64d8710d206b7d5cfa369371faae5` | MIT |
| openclaw-main | 57,634 | `82880f15a9bf33285bab0c591dc43a562a2451564d0c195885b26c390fcfd3a6` | MIT root; bundled assets/platform integrations can have their own terms |

## 3. Что уже есть в NK1 — не дублировать

Проверено по дереву `workpass70-source`:

| Донор | Уже существующий NK1-слой | Решение |
|---|---|---|
| Hexis | `integration/hexis/HexisAdaptationFabric.ts`, `HexisCanonicalEvidenceBridge.ts`, `nk1-hexis-source-lineage.yml` | Не переносить Hexis целиком. Сравнить свежую версию memory architecture и learning-review workflow с текущим адаптером; брать только недостающие контракты |
| Will | `integration/will/WillIntegrationBridge.ts`, `WillHnswIndex.ts`, `WillMcpJsonRpc.ts`, `WillSdkFacade.ts` | Текущий архив расширяет когнитивный слой: attention allocator, adaptive heartbeat, episodic consolidation, sleep/circadian, self/persona update, async completion inbox. Уже начата NK1-native адаптация interoceptive precision в PR #720 |
| Letta | `integration/letta/LettaGovernanceAdaptationFabric.ts` | Сохранять NK1 как владельца состояния; использовать только переносимые memory/continuity/governance идеи |
| Mem0 | `integration/mem0/Mem0PlatformAdapter.ts` | Оставить опциональным memory provider/adapter, не превращать в единственный источник истины |
| Lumina | `integration/lumina/LuminaAdaptationFabric.ts` | Проверить source freshness и контракты, не создавать второй адаптер |
| Hermes | `learning/HermesVerifiedEvidenceBinding.ts` и P23 skill-promotion pipeline | Углублять evidence/skill governance и rollback, а не открывать агенту бесконтрольный tool execution |

## 4. Приоритеты новых адаптаций

### P0 — когнитивный цикл и внутренняя регуляция

1. **Will + NK1 interoception:** ограниченная точность внутренних каналов, ресурсная конкуренция, добровольное усилие фокуса, восстановление после нагрузки. PR #720 — первый изолированный механизм; далее проверить реальную проводку в основном cognitive cycle и провести paired holdout.
2. **Will heartbeat / completion inbox:** асинхронные завершения должны попадать в единый tick-boundary и применяться атомарно; тихие периоды должны снижать частоту фоновых событий, не останавливая внутреннее время и поддержание состояния.
3. **Hexis + CLS:** быстрый episodic buffer → replay/consolidation → медленные semantic beliefs; временные, причинные и противоречивые связи; provenance и обратимая ревизия.
4. **CognitiveNetworkBus / GWT:** конкуренция specialist-сигналов, ограниченный broadcast, inhibition и метрики ignition; не подменять этим всю архитектуру.

### P1 — саморазвитие и инструменты

5. **Hermes + DSPy/GEPA:** предлагать skill/prompt revisions из реальных траекторий, затем sandbox → validation → immutable holdout → independent evaluator → canary → promote/rollback. Оптимизатор не должен иметь права подтверждать собственный результат.
6. **Agent0 / OWL / AutoGen / Microsoft Agent Framework / OpenAI Agents / Langroid:** использовать только отдельные паттерны curriculum generation, specialist handoff и bounded workflow. Не размножать конкурирующие оркестраторы и дублирующие состояния.
7. **Hyperon:** исследовать как ограниченный symbolic/PLN слой для объяснимых отношений и вывода; сначала parity/latency/consistency benchmark, затем решение об интеграции.
8. **llama.cpp:** optional local inference adapter с измерением latency, memory, thermal и quality на целевых устройствах; не ставить обязательную GPU-зависимость.

### P2 — инфраструктура памяти и инструменты разработки

9. **Chroma / FAISS:** сравнивать с текущим hybrid retrieval и HNSW на одинаковом holdout. Не заменять retrieval только по benchmark чужого проекта.
10. **PocketFlow:** заимствовать минималистичные DAG/workflow-паттерны для изолированных задач, если они уменьшают число связей и циклические импорты.
11. **OpenClaw / AutoGPT:** извлекать только gateway, transport, credential boundary и audit-паттерны; AutoGPT platform имеет PolyForm Shield.
12. **Superpowers:** применять как инженерную методологию (spec → plan → TDD → independent verification), не добавлять в runtime зависимости.

## 5. Научная рамка

Архитектурные гипотезы следует разделять на три уровня:

- **Наблюдаемая функциональность:** интеграция информации, устойчивое рабочее состояние, метакогнитивный мониторинг, гибкие цели, обучение на последствиях, модель тела/аватара.
- **Проверяемые механизмы:** prediction error, precision weighting, replay/consolidation, calibration, counterfactual planning, agency arbitration, identity continuity.
- **Не доказано:** наличие субъективного опыта или феноменального сознания. Архитектурные индикаторы и поведенческие тесты не являются доказательством субъективности.

Научные точки входа для следующих проходов:
- Butlin et al., *Consciousness in Artificial Intelligence: Insights from the Science of Consciousness* (2023), arXiv:2308.08708 — функциональные индикаторы и ограничения атрибуции.
- Arani et al., *Learning Fast, Learning Slow* (2022), arXiv:2201.12604 — complementary learning systems и replay.
- Grimbly et al., *Interoceptive Attention as Dynamic Homeostatic Prioritization in a Foraging Agent* (2026), arXiv:2608.04232 — распределение precision между внутренними потребностями; авторы подчёркивают ограниченность модели и необходимость сравнительных экспериментов.

## 6. Следующие 4 прохода

| Проход | Конкретная цель | Обязательное доказательство |
|---|---|---|
| A — wiring | Провести interoceptive precision из PR #720 в фактическую cognitive cycle, не оставив изолированным модулем | Call-site trace + deterministic tests + exact-head CI |
| B — consolidation | Сопоставить Hexis latest с MemoryOS2/P23; добавить недостающий reviewable learning diff или доказать, что механизм уже закрыт | Provenance tests, correction/forget transaction tests, holdout |
| C — autonomy | Сопоставить Will heartbeat/async completion/agency settlement с NK1 RuntimeClockScheduler, CognitiveEventFabric и ActionGateway | Tick-boundary ordering, idempotency, pause/restart, soak |
| D — self-improvement | Связать Hermes skill lifecycle + DSPy/GEPA proposals с P23 independent evaluator and rollback | ≥5 paired seeds, immutable holdout, positive recall/utility delta, no regression |

## 7. Release integrity

GitHub latest Release на момент проверки:
- Tag: `Neuro`
- Name: `NeuroKurisu0.1`
- Published: 2026-10-19
- Asset: `Neuro_Kurisu_WORKPASS70_2026-10-19.zip`
- Size: 135,290,615 bytes
- Published asset SHA-256: `c5cf6a63661e28b30f976d03c8839a231341d73a09489b9066f062e29b224286`

Сам файл Release ZIP в текущем рабочем контейнере отсутствует. Поэтому здесь зафиксированы метаданные GitHub, но содержимое релиза не распаковано и не сверено. Никакие изменения из текущих PR не объявляются включёнными в релиз до проверки точного ZIP.

## 8. Правила дальнейшей интеграции

- Сначала определить, что уже реализовано, подключено, протестировано и опубликовано.
- Заимствовать механизм, а не целый framework; избегать второго источника истины.
- До добавления зависимости сравнить стоимость, лицензии, мобильность, размер и latency.
- Каждый донорский механизм должен иметь NK1-native interface, ownership, persistence/migration, observability и тесты.
- Самоизменение — только через sandbox, независимую оценку, неизменяемый holdout, canary и rollback.
- Не объединять независимые ветки до прохождения их собственных CI и проверки совместимости.
