# Neuro-Kurisu — implementation report, WorkPass 23

**Дата:** 11 октября 2026 г.  
**Источник:** `Neuro_Kurisu_SUPER_WILL_LUMINA_HEXIS_LETTA_CONSCIO_INTEGRATED_WORKPASS22_2026-10-11.zip`  
**Root:** `23.0.0-super-final10` · **runtime:** `35.46.0` · **schema:** 223  
**Release status:** implementation workpass; not release-ready.

## Реальные изменения

1. **Безопасная загрузка NLI-модели.** Локальный cross-encoder закреплён за immutable revision; mutable aliases запрещены, `trust_remote_code=False`, веса разрешены только через safetensors, labels проверяются до запуска.
2. **Batch inference в каноническом claim-path.** До 24 premise/hypothesis пар оцениваются одним запросом и одной tokenizer/model операцией. Существующий `OrganismCore → ProjectResearchSession → MemoryOS2` путь сохранён; второй владелец памяти не создаётся.
3. **Исправлена обратная совместимость NLI.** Старый сервис только с `/v1/nli` получает bounded single-pair fallback исключительно при `404/405` на `/batch`. `503`, timeout и malformed responses остаются fail-closed и не вызывают request fan-out.
4. **Backpressure и ограничения ресурсов.** NLI service ограничивает параллельные запросы, body/batch sizes и CPU threads; при перегрузке быстро отдаёт `503` с `Retry-After`.
5. **Оценщик на размеченном наборе.** Добавлен `tools/evaluate_research_nli.py`: exact dataset SHA-256, accuracy/macro-F1, метрики по классам, confusion matrix, cross-entropy, Brier и ECE. Текст premises/hypotheses не записывается в отчёт; output атомарный с правами `0600`; remote endpoint требует явного opt-in.
6. **Усилена целостность memory benchmark.** Помимо точных дубликатов, benchmark выявляет близкие train/holdout запросы с высоким overlap 3-token shingles. Малые правки формулировок больше не обходят split-leakage gate. В диагностике сохраняется только счётчик, не сами запросы.
7. **Версии/документация согласованы.** Runtime — `35.46.0`, root — `23.0.0-super-final10`; обновлены README, runbook, changelog, статусный inventory, scorecard и backlog.

## Что сделано в цифрах

- **73 уникальных deliverables:** 52 DONE, 11 PARTIAL, 10 TODO.
- **185 детализированных задач backlog:** 8 DONE, 89 PARTIAL, 84 TODO, 4 BLOCKED. Эти числа относятся к детализированному backlog и не складываются с нормализованным inventory.
- **Diff с WorkPass22:** 8 добавленных путей, 17 изменённых, 0 удалённых. Внутренний файл diff-manifest исключён из собственного списка во избежание самоссылки; он включён в архив.
- Итоговый source archive рассчитан на **12,716 файлов** при исключении `node_modules`, `.git`, Python caches и временного verify state.
- Взвешенный implementation roadmap: **71.65% (отображается как 71.7%)**, на 0.15 п.п. выше предыдущего snapshot 71.5%. Это внутренняя оценка плана работ, не готовность релиза и не измерение интеллекта.

## Что действительно прошло

- `npm run audit:workpass23` завершился с exit code 0.
- Release metadata contract: **34/34**.
- Runtime TypeScript: PASS.
- Claim evidence: **20 cases**; source lineage: **8**; semantic NLI integration: **20 mocked cases**.
- NLI service contract: **9/9**; evaluator CLI/privacy/metrics: **4/4**.
- Project idempotency: **5 scenarios**; external research transport: **14 scenarios**; Core lifecycle/recovery; MemoryOS2 benchmark; server imports, UI/API linkage и assets проходят в корневом gate.
- Benchmark явно показал `not-promoted`: recall delta `0.125`, paired bootstrap interval `[-0.25, 0.5]`, reason `recall-uplift-not-confidence-supported`. Проба точной и near-duplicate утечки намеренно добавляется тестом; счётчики этих probe не означают, что исходный fixture содержит утечку.

## Открытые ограничения

- **Не запускалась настоящая pretrained NLI-модель.** Установка `transformers`/`safetensors` остановилась на `EAI_AGAIN`/DNS; веса не закешированы. Тесты NLI проверяют протоколы и интеграцию на mocks, не фактическое качество/скорость модели.
- **Production UI build не пройден:** `npm --prefix app run build` вернул `spawn vite ENOENT`; до этого установка app dependencies не завершилась из-за недоступности registry. Реальную браузерную E2E проверку это окружение не выполняло.
- **MemoryOS2 не продвигается:** нет независимого temporal holdout с внешними labels; синтетический benchmark слишком мал и его confidence interval допускает регрессию. Нет утверждения об измеренном uplift.
- Также остаются live HTTPS research run, полный action→independent receipt→reafference chain, clean-room restore/rollback, multi-hour soak, browser E2E, SBOM/provenance и release sign-off.

## Следующие приоритеты

1. На network-enabled target загрузить строго закреплённые NLI weights и запустить fixed adversarial/domain holdout без настройки по тестовой выборке.
2. Получить отдельный длинносессионный temporal holdout MemoryOS2, сравнить с lexical/BM25 baseline; исправлять retrieval по этим данным, не повышая roadmap score за синтетические кейсы.
3. Восстановить зависимости app, пройти Vite production build и browser E2E для chat→memory→restart, research→claim→conflict и Live2D/fallback.
4. Завершить clean-room backup/restore/rollback, remote receipt/reconnect и bounded soak; затем принимать решение об RC.
