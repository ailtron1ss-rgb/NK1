# WorkPass 22 — реализация и фактический результат

**Дата:** 11 октября 2026 года  
**База:** WorkPass 21  
**Версии:** root `22.0.0-super-final8`; canonical runtime `35.44.0`; schema `223`  
**Статус:** implementation workpass; НЕ release-ready.

## Что изменено в рабочем коде

1. **Опциональный NLI подключён в существующий путь.** `ResearchSemanticEntailment.ts` вызывается из `ProjectResearchSession` и `OrganismCore`; параллельный runtime или вторая память не создавались. Backend включается только через `KURISU_RESEARCH_NLI_ENDPOINT`.
2. **Добавлен локальный open-source NLI service.** `tools/research_nli_server.py` использует `cross-encoder/nli-deberta-v3-xsmall` через Transformers/PyTorch. Весов в ZIP нет; зависимости вынесены в `research/requirements-nli.txt`. Сервис по умолчанию слушает loopback, ограничивает payload и длину текста, не пишет claims/snippets в лог, требует токен для non-loopback bind.
3. **Добавлена консервативная атомизация claims.** Предложения и явные clauses могут быть разделены, но короткие списки/альтернативы не переписываются искусственно. Если поддержана только часть составного утверждения, всё утверждение остаётся `unknown`.
4. **Закрыт downgrade при отказе NLI.** При явно настроенном, но недоступном backend оценка остаётся `unknown/model-assisted-entailment`; она не возвращается к лексическому support. Это состояние валидируется и сохраняется при восстановлении сессии.
5. **Укреплён кредит прогресса и обучения.** В режиме NLI `OrganismCore` выдаёт положительный project credit только при `support` и не менее чем двух независимых model-scored lineage families. `mixed/refute/unknown` не дают положительного credit и не дают положительный skill-learning outcome.
6. **Сохранение и восстановление provenance.** Model ID, необработанные score triplets, atom assessments, URL/hash и exact quote offsets сохраняются и проверяются при restore. Scores намеренно не объявляются вероятностями истинности.
7. **Синхронизированы релизные документы.** Обновлены changelog, README, runbook, список дел, backlog до выпуска, normalized inventory и scorecard; WorkPass21 backlog-файл восстановлен как историческая запись.

## Учёт объёма

SHA-256-сравнение содержимого WorkPass21 ZIP с текущим исходным деревом:

- **9 новых файлов**;
- **14 изменённых файлов**;
- **0 удалённых файлов**;
- **23 затронутых пути**.

Это реальный file delta относительно исходного архива, не число подзадач и не процент готовности.

## Что реально прошло

- `npm run audit:workpass22` — exit code 0.
- Release metadata: **34/34** проверок.
- Runtime TypeScript: `TYPECHECK=PASS mode=tsc`.
- Claim evidence: 20 случаев.
- Source lineage: 8 случаев.
- Semantic NLI unit suite: 20 случаев через mocked backend.
- NLI service contract: 3 теста с mocked model stack.
- Core→HTTP NLI integration: loopback fixture покрывает независимую поддержку, конфликт, полный отказ сервиса, отсутствие project credit и отсутствие положительного skill-learning outcome при `unknown`.
- Executor idempotency/replay: 5 сценариев.
- Research transport: 14 тестов; UI/API linkage: 124 routes, 48 Runtime Atlas surfaces, 5 required seams.
- Memory retrieval benchmark не продвинул экспериментальную конфигурацию: доверительный интервал пересекает регрессию; обнаружение leakage остаётся открытой задачей.

## Чего не утверждаем

Предобученные веса DeBERTa не были скачаны и реально не выполнялись в этой среде. Mock backend проверяет контракт и интеграцию, но не качество NLI. Не выполнены калибровка, размеченный adversarial/multilingual holdout и оценка ложных support/refute. Frontend production build/browser E2E, live provider research, clean-room rollback, soak, SBOM/provenance sign-off остаются открытыми.

## Текущий roadmap

- Нормализованный реестр: **68 уникальных deliverables — 48 DONE, 11 PARTIAL, 9 TODO**.
- Weighted implementation scorecard: **71,3%** против 71,1% в WorkPass 21 (+0,2 п.п.). Это оценка дорожной карты, не release readiness и не показатель интеллекта.
- Следующий приоритет: запуск реальной модели на фиксированном размеченном holdout без утечки данных; затем калибровка и error slicing. Параллельно — dependency-complete UI build и настоящие браузерные сценарии.

Модельный ориентир: [cross-encoder/nli-deberta-v3-xsmall](https://huggingface.co/cross-encoder/nli-deberta-v3-xsmall). LongMemEval-V2 остаётся базовым внешним ориентиром для отдельного испытания долгосрочной памяти: [официальный harness](https://github.com/xiaowu0162/LongMemEval-V2).
