# Neuro-Kurisu — текущее состояние WorkPass 24

**Дата:** 11 октября 2026 года  
**Root version:** `24.0.0-super-final11`  
**Canonical runtime:** `Neuro-Kurisu 35.47.0 / schema 223`  
**Статус выпуска:** implementation workpass; проект не объявлен release-ready.

## Счётчик выполненного

- **75 уникальных deliverables:** 54 DONE, 11 PARTIAL, 10 TODO.
- В WorkPass 24 добавлены **2 новых deliverables**, оба закрыты реальным кодом и целевыми регрессиями; ещё 1 критический пункт — запуск настоящей предобученной модели — остаётся TODO из-за недоступности registry DNS и отсутствия локальных весов.
- WorkPass 24 затронул операционную готовность локального NLI и сквозное сохранение точной model revision в claim provenance; повторно закрытые lineage/idempotency механизмы не пересчитываются.

## Фактические изменения WorkPass 24

1. **Жизнеспособность отдельно от готовности.** `tools/research_nli_server.py` предоставляет `/livez` и `/healthz` для HTTP процесса и `/readyz`, который отвечает 503, пока модель не загружена. Деплой не должен принимать живой процесс за готовый inference.
2. **Ограничение повторной загрузки.** Ошибки отсутствующих зависимостей и модельных артефактов получают безопасный код и bounded cooldown. С `--lazy-model-load` можно открыть health endpoints до завершения warmup; default startup остаётся fail-fast.
3. **Точный provenance модели.** ID и revision переходят из локального NLI response в claim/atom/quote и aggregate `modelVersions`. Смена модели или revision в пределах одного claim assessment переводит его в `unknown`.
4. **Защита восстановления.** `ProjectResearchSession.restore` отбрасывает сохранённую NLI-оценку, если model ID/revision в цитате расходится с родительской оценкой. Старые записи без revision остаются совместимыми, но не получают выдуманную аттестацию версии.
5. **Интеграционный статус.** Добавлены regressions на readiness/cooldown и tampered revision. Research Core gates и MemoryOS2 benchmark проходят; benchmark сохраняет `not-promoted`, поскольку CI допускает регрессию.

## Что не заявляется завершённым

- Настоящая DeBERTa модель не была запущена: pip/model registry DNS недоступен в этом окружении. Тесты NLI используют mock backend, поэтому качество, калибровка и latency не измерены.
- React/Vite production build и браузерные E2E остаются открытыми, поскольку зависимости UI отсутствуют и registry DNS блокирует установку.
- Независимый temporal holdout MemoryOS2 и реальный uplift retrieval не доказаны; экспериментальная конфигурация не promoted.
- Clean-room restore/rollback, внешний provider acceptance, многочасовой soak и финальный SBOM/provenance sign-off остаются open gates.

## Acceptance evidence

- Semantic NLI integration: **23 cases PASS** (mocked backend).
- NLI service: **10 tests PASS**; evaluator: **4 tests PASS**.
- `BIG_PASS_179_PROJECT_RESEARCH_GATES`: PASS.
- `BIG_PASS_126_MEMORY_RETRIEVAL_BENCHMARK`: PASS as a test harness; promotion remains `not-promoted` (95% CI includes a possible regression).
- Root `audit:workpass24` is defined to execute release metadata, app script/browser smoke, runtime and benchmark gates; full aggregate run must be re-executed in a dependency-complete environment. Current environment cannot certify Vite production build or real model inference.

## Счётчик прогресса

Взвешенная карта реализации: **71.85%** (было 71.65%, +0.20 п.п.). Это внутренняя оценка исполнения дорожной карты, не процент готовности релиза и не мера интеллекта. Release status остаётся `implementation-workpass; NOT release-ready`.
