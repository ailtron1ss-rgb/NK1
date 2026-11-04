# Исследовательский intake: что адаптировать в NK1

Этот реестр — план изучения, не утверждение о завершённой интеграции.

| Источник | Изучить | Что переносить концептуально | Что не переносить |
|---|---|---|---|
| [N.E.K.O.](https://github.com/Project-N-E-K-O/N.E.K.O) | Проверка/оспаривание фактов, lifecycle памяти, проактивное взаимодействие | Evidence workflow и companion UX, только через существующие MemoryOS2 и Agency | Вторую базу памяти, целое приложение или облачные маршруты без privacy review |
| [AIRI](https://github.com/moeru-ai/airi) | Виртуальное тело, renderer/game adapters, mobile deployment | Унифицированные адаптеры тела и игровые подключения через EmbodimentSubsystemRuntime | Вторую систему личности, отдельное memory owner, ассеты без лицензии |
| [Hermes Agent](https://github.com/NousResearch/hermes-agent) | Навыки, которые создаются и улучшаются в процессе использования | Сравнить skill-evaluation loop с P23 и улучшить процедуру испытаний | Автопромоушен без отдельного evaluator / holdout |
| [Letta](https://github.com/letta-ai/letta) | Долгоживущий agent state, контекст и переносимость | Бюджетирование контекста, экспорт/импорт, долговременная идентичность поверх владельца Self | Второе хранилище состояния агента |
| [Hindsight](https://github.com/vectorize-io/hindsight) | Разделение мира, опыта, наблюдения и мнения; temporal graph; Reflect | Сравнить типизацию epistemic records и запросы графа с MemoryOS2 | Дублирующий PostgreSQL/vector memory backend без абляции |
| [Mem0](https://github.com/mem0ai/mem0) | Извлечение атомарных фактов, объединение, профиль | Сравнить ingestion/dedup с памятью NK1 на одинаковых наборах | Параллельный writable memory store |
| [OpenClaw](https://github.com/openclaw/openclaw) | Каналы, tool adapters, operation/security | Connector lifecycle, rate limits, action policies | Неконтролируемую поверхность удалённого shell/browser доступа |
| [Voyager](https://github.com/MineDojo/Voyager), [paper](https://arxiv.org/abs/2305.16291) | Curriculum, библиотека компонуемых навыков и feedback от среды | Изолированный skill transfer benchmark в контролируемом игровом мире | Неограниченные реальные действия и ключи доступа |

## Benchmark intake

- [LongMemEval](https://github.com/xiaowu0162/LongMemEval): длинный разговорный контекст, temporal reasoning и memory recall.
- [LoCoMo](https://github.com/snap-research/locomo): долгосрочная разговорная память и multi-session вопросы.
- [MemoryAgentBench](https://github.com/ai-hyz/MemoryAgentBench): операции с агентной памятью и continual memory competence.
- [MemEval](https://github.com/ProsusAI/MemEval): набор сравнительных инструментов/метрик памяти.

Нельзя копировать датасеты или веса в NK1, пока не проверены лицензия, условия перераспространения, consent/privacy и совместимость. Для каждой интеграции нужны точная версия/commit, license report, benchmark baseline, ablation, rollback и исходные результаты.

## Математика и статистика

В NK1 уже есть `PairedSeedConfidence.ts` с ограниченным deterministic bootstrap. Completion Kit использует именно его для promotion confidence intervals и дополняет метриками Brier, ECE, forgetting, resource-adjusted gain и строгим seed pairing. Мы не добавляем вторую реализацию bootstrap.
