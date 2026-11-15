# Измерение semantic embeddings в памяти NK1

## Зачем нужен отдельный прогон

Старый benchmark сравнивает Okapi BM25 и обычный lexical/hybrid retrieval. Он не измеряет async путь `MemoryOS2.previewRetrieveWithEmbeddings()`, который использует когнитивный runtime при явном opt-in.

Новый benchmark сравнивает два read-only preview на одном каноническом snapshot:
- `MemoryOS2.previewRetrieve()` — lexical baseline;
- `MemoryOS2.previewRetrieveWithEmbeddings()` — semantic arm с локальным embedding provider.

## Метод

До оценки запросов семантический индекс целиком строится на изолированном клоне bounded corpus. Если индексация неполная или provider падает, эксперимент возвращает skipped и не сравнивает частично заполненный индекс. На holdout рассчитываются Recall@K, MRR, Precision@K, false abstention и unsupported retrieval; paired bootstrap пересэмплирует целые independence groups.

## Ограничения

Тесты используют синтетического fixture-provider только для проверки маршрута и честности отчёта. Они не оценивают настоящий embedding model и не подтверждают retrieval uplift.

Порог similarity является отдельной защитой, не классификатором истинности. Высокая cosine similarity всё ещё может вернуть семантически близкую, но не отвечающую на запрос запись. Для оценки качества нужна замороженная RU/EN разметка с независимыми answerable и unanswerable holdout-группами, реальным локальным provider, provenance, paired intervals, MRR non-inferiority и no-increase в unsupported retrieval.

Benchmark строго diagnostic-only: `promotion.allowed=false` даже при прохождении всех gates. Он не изменяет live state и не включает embeddings в runtime.
