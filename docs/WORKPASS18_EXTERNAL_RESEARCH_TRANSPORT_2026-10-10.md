# WorkPass 18 — защищённый, query-bound внешний research transport

**Дата:** 10 октября 2026 года  
**База:** WorkPass 17  
**Runtime:** Neuro-Kurisu 35.40.0 / schema 223  
**Статус:** implementation-workpass; не release-ready.

## Реальная функциональность в коде

1. `ExternalProjectResearchTool` реализует HTTPS-запрос через `https.request` с DNS pinning. Сначала разрешаются все DNS-адреса; если хотя бы один адрес непубличный или специальный, запрос блокируется. Соединение закрепляется за проверенным IP, TLS hostname/certificate validation сохраняется.
2. Redirect обрабатывается вручную и ограниченно. Каждый новый адрес проходит проверку HTTPS, allowlist, hostname/port/credentials, повторное DNS-разрешение и public-IP gate. Запрос выполняется на проверенный IP, не позволяя HTTP-стеку выполнить второе непроверенное DNS-разрешение.
3. Ограничены DNS timeout, request timeout, redirect count, body bytes и тип содержимого. Ошибки HTTP/DNS/TLS, binary/oversized body и неподдерживаемый MIME возвращаются как явные ошибки, не как evidence.
4. Исследовательский query обязателен и должен содержать минимум три различных содержательных термина. Нормализованный query получает SHA-256, который связывает cache entry и claim key в каноническом `EvidenceFirewall`.
5. Добавлен lexical topical-relevance score по title/body и matched terms. Нерелевантная страница не получает `externalEvidence=true`; коэффициент relevance уменьшает confidence до передачи в `EvidenceFirewall`.
6. Async regression harness исправлен: каждая проверка теперь реально ожидает завершение Promise и assertions после `await`; тест больше не печатает PASS преждевременно.

## Подтверждённые проверки

- `npm run typecheck` — PASS (`tsc`).
- `npm run test:external-project-research-transport` — PASS, 13/13 async-сценариев.
- `npm run test:project-research-gates` — PASS: transport, research DAG, external skill, firewall и persistence.
- `npm run test:big-pass-175`, `:recovery`, `:scheduler` — PASS.
- `npm run test:memory-retrieval-benchmark` и `npm run test:memory-retrieval-experiment` — PASS, candidate остаётся `not-promoted`.
- Server imports: 10 проверено, 0 missing; UI/API linkage: 124 routes, 48 Atlas surfaces, 0 missing required seams.
- Server HTTP smoke — PASS; static asset audit — 0 errors.
- Metadata contract — 34/34; release metadata fixtures — 6/6; app script suite — 212/212; browser verdict suite — 51 тест; atomic report writer — 4/4.

## Честные ограничения

- Прямой внешний запрос к `https://example.com/` завершился `dns-resolution-failed` в этом окружении. Транспортные тесты используют injected resolver/request seams; они проверяют политику и обработку ошибок, но не доказывают доступность реального provider. Live research через два разрешённых домена и persisted firewall promotion receipt — TODO.
- Текущий relevance gate лексический: он проверяет тематическое совпадение, но не доказывает семантическое следование утверждения из источника. Нужны claim-support/entailment verifier и размеченные adversarial примеры.
- Полная React/Vite production build и desktop/mobile/Live2D browser E2E не выполнены: UI dependencies отсутствуют, npm registry DNS недоступен. Не заявляется production uplift MemoryOS2 без реального independent temporal holdout.
- Единая корневая `npm run audit:workpass18` превысила лимит 120 секунд в этом runner на последнем nested server-smoke этапе. Каждый входящий gate проверен отдельной командой и прошёл, включая server smoke; агрегированная команда не отмечается как PASS.
