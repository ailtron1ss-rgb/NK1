# Neuro-Kurisu — текущее состояние WorkPass 22

**Дата:** 11 октября 2026 года  
**Root version:** `22.0.0-super-final8`  
**Canonical runtime:** `Neuro-Kurisu 35.44.0 / schema 223`  
**Статус выпуска:** implementation workpass; проект не объявлен release-ready.

## Результат этого прохода

- Нормализованный реестр: **68 уникальных задач — 48 DONE, 11 PARTIAL, 9 TODO**. Это не сумма исторических строк «Списка дел».
- Подключён opt-in локальный cross-encoder NLI через существующие `ProjectResearchSession` и `OrganismCore`; веса модели не встраиваются в архив.
- Добавлены консервативное разбиение составных утверждений, проверка и сохранение provenance/model score, fail-closed поведение при недоступности сервиса (включая запрет downgrade к лексическому positive credit и сохранение unknown после restart) и правило положительного credit только для неразрешённо-непротиворечивого claim с двумя независимыми model-scored lineage families.
- Тесты используют мокированный NLI-бэкенд и мокированную модель сервиса; **реальные веса, калибровка, качество модели на независимом holdout не подтверждены**.

## Изменения WorkPass 22

1. `ResearchSemanticEntailment.ts` добавляет HTTP-клиент к локальному NLI; требует HTTPS вне loopback, запрещает redirects, ограничивает время/объём ответа и возвращает unknown при ошибках.
2. `tools/research_nli_server.py` — отдельный, выключенный по умолчанию сервер на `cross-encoder/nli-deberta-v3-xsmall`; дополнительный Python requirements-файл не меняет обязательные зависимости canonical runtime.
3. `atomizeResearchClaim` осторожно извлекает части составного утверждения; частичная поддержка не превращается в support целого тезиса.
4. `ProjectResearchSession` сохраняет атомы/оценки/цитаты и валидирует model-assisted assessments при restore. `OrganismCore` запрещает positive progress credit для `mixed/refute/unknown`; при NLI support требует две независимые линии lineage.
5. Добавлены 18 семантических integration cases и 3 service contract tests; синхронизированы root/runtime версии, runbook, backlog, список дел и отчётность.

## Оставшиеся release blockers

- Реальный NLI inference с загруженными pretrained weights, калибровка и независимый размеченный adversarial/multilingual holdout.
- Более качественная автоматическая атомизация и source genealogy за пределами осторожных эвристик.
- Реальный live research provider run, temporal MemoryOS2 holdout и измерение uplift.
- Dependency-complete install, React/Vite production build, desktop/mobile browser E2E и реальный Live2D interaction.
- Clean-room backup/restore/upgrade/rollback, длительный soak, security/SBOM/provenance и final release-candidate sign-off.

Сводная взвешенная оценка implementation roadmap: **71.3%** (WorkPass21: 71.1%; изменение +0.2 п.п.). Это не процент интеллекта и не release readiness; UI build и production acceptance остаются открытыми.
