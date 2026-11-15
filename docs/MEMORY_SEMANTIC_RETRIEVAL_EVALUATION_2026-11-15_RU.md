# Измерение semantic embeddings в памяти NK1

## Зачем нужен отдельный прогон

Старый benchmark сравнивает Okapi BM25 и обычный lexical/hybrid retrieval. Он не измеряет async путь `MemoryOS2.previewRetrieveWithEmbeddings()`, который использует когнитивный runtime при явном opt-in.

Новый benchmark сравнивает два read-only preview на одном каноническом snapshot:
- `MemoryOS2.previewRetrieve()` — lexical baseline;
- `MemoryOS2.previewRetrieveWithEmbeddings()` — semantic arm с локальным embedding provider.

## Метод

До оценки запросов семантический индекс целиком строится на изолированном клоне bounded corpus. Если индексация неполная или provider падает, эксперимент возвращает skipped и не сравнивает частично заполненный индекс. На holdout рассчитываются Recall@K, MRR, Precision@K, false abstention и unsupported retrieval; paired bootstrap пересэмплирует целые independence groups.

## Запуск с реальным локальным embedding provider

После подготовки snapshot, ручной разметки и финализации пакета WorkPass512:

```bash
NK_EMBEDDINGS_ENABLED=1 \
NK_EMBEDDINGS_PROVIDER=ollama \
NK_EMBEDDINGS_BASE_URL=http://127.0.0.1:11434 \
NK_EMBEDDINGS_MODEL=embeddinggemma \
npm --prefix runtime/neuro-kurisu run run:memory-semantic-retrieval-benchmark -- \
  --snapshot /private/path/MemoryOSState2.json \
  --labels /private/path/nk1-validated-dataset/labels.jsonl \
  --provenance /private/path/nk1-validated-dataset/dataset-provenance.json \
  --out /private/path/nk1-semantic-report.json \
  --seed 31 --bootstrap-samples 1000 --min-similarity 0.72
```

Команда по умолчанию обращается только к loopback Ollama. Для локального OpenAI-compatible сервера используй `NK_EMBEDDINGS_PROVIDER=openai-compatible`, `NK_EMBEDDINGS_BASE_URL=http://127.0.0.1:8080/v1` и реальное имя embedding-модели. Удалённый provider запрещён по умолчанию; для явно доверенного endpoint требуются одновременно `NK_EMBEDDINGS_ALLOW_REMOTE=1` и HTTPS.

Отчёт создаётся атомарно с правами владельца и не перезаписывает существующий файл. В него не попадают raw query и memory ID; absolute local paths также исключены. `--inspect-evidence true` включает только одноразово HMAC-обезличенные digest-строки. При ошибке provider или неполном индексе результат получает `skipped`; частичное сравнение не выполняется.

## Ограничения

Тесты используют синтетического fixture-provider только для проверки маршрута и честности отчёта. Они не оценивают настоящий embedding model и не подтверждают retrieval uplift.

Порог similarity является отдельной защитой, не классификатором истинности. Высокая cosine similarity всё ещё может вернуть семантически близкую, но не отвечающую на запрос запись. Для оценки качества нужна замороженная RU/EN разметка с независимыми answerable и unanswerable holdout-группами, реальным локальным provider, provenance, paired intervals, MRR non-inferiority и no-increase в unsupported retrieval.

Benchmark строго diagnostic-only: `promotion.allowed=false` даже при прохождении всех gates. Он не изменяет live state и не включает embeddings в runtime.
