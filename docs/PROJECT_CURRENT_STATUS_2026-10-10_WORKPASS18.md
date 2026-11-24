# Текущий статус Neuro-Kurisu SUPER — WorkPass 18

**Дата:** 10 октября 2026 года  
**База:** WorkPass 17  
**Runtime:** Neuro-Kurisu 35.40.0 / schema 223  
**Состояние:** implementation-workpass; НЕ release-ready.

## Что реально изменено

- `ExternalProjectResearchTool` теперь выполняет настоящий HTTPS request через уже разрешённый публичный IP (DNS pinning), сохраняя TLS-проверку исходного hostname. Любой непубличный адрес в ответе DNS блокирует запрос.
- Перенаправления проходят повторную проверку HTTPS, allowlist и DNS для каждого hop. Ограничены число redirect, DNS timeout, request timeout, размер body и разрешённые текстовые MIME-типы.
- Запрос исследования обязателен, должен содержать минимум три distinct topical terms и получает SHA-256 fingerprint. Этот fingerprint влияет на cache identity и canonical firewall claim key.
- Лексический topicality gate не допускает нерелевантный контент как evidence; оценка доверия дополнительно уменьшается по коэффициенту relevance перед передачей в `EvidenceFirewall`.
- Сетевые отказы, неправильный URL, неразрешённый host, некорректный query, большие/бинарные ответы и низкая релевантность остаются явными отказами, не доказательством успеха.
- Исправлены async-вызовы transport regression suite: теперь каждый тест действительно ожидает Promise и его assertions, вместо преждевременного вывода PASS.

## Единая нормализованная задача-сводка

- Всего: **58** уникальных deliverables.
- DONE: **40**; PARTIAL: **9**; TODO: **9**.
- Взвешенная оценка реализации: **69.25%** (+0.20 п.п. к WorkPass 17 69.05%). Это оценка реализации, не release readiness.
- Направление D (agency/action/outcome/reafference) повышено с 64% до 65% по факту новой query-bound HTTPS capability. Никакой live provider completion не зачтён.

## Проверки

- Runtime TypeScript `tsc` — PASS.
- `npm run test:external-project-research-transport` — PASS, **13/13** сценариев (теперь все async тесты ожидаются полностью).
- `npm run test:project-research-gates` — PASS: transport, ProjectResearch DAG, external skill, EvidenceFirewall и persistence regression suites.
- Дополнительные firewall regressions: низкая topical relevance не проходит promotion; relevant evidence от независимых источников может пройти; смена query claim key сбрасывает прежние свидетельства — PASS.

## Что не закрыто

- Настоящий сетевой запрос в этой среде завершился `dns-resolution-failed` для `example.com`. Поэтому реальное подтверждение через два разрешённых внешних хоста, устойчивость live provider и receipt/promotion в производственной сети не заявляются.
- Текущий relevance gate лексический. Он определяет тематическое совпадение, но не доказывает, что документ логически подтверждает утверждение. Нужны проверяемая entailment-проверка и размеченные adversarial примеры.
- Полная React/Vite production build, desktop/mobile/Live2D browser E2E, реальный labelled MemoryOS2 holdout, clean-room restore/upgrade/rollback, multi-hour soak и финальный SBOM/provenance остаются релизными воротами.

Подробности: `docs/WORKPASS18_EXTERNAL_RESEARCH_TRANSPORT_2026-10-10.md`; полная история предыдущего прохода сохранена в `Список дел.md`.
