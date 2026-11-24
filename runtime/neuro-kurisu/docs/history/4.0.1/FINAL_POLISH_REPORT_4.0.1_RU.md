# Neuro-Kurisu Evolution 4.0.1 — Final Polish Report

## Статус

Это polishing-release поверх золотой контрольной точки 4.0.0. Цель — не добавить очередной cognition layer, а убрать источники дрейфа, дублирования и невоспроизводимости.

## Исправления

- Единый runtime ReleaseContract проверяется против VERSION.json, package.json и package-lock.json.
- Тесты больше не дублируют текущие номера версий: они читают canonical contract.
- State schema в runtime types/migrations больше не хранит независимое число.
- `typecheck` работает в двух режимах: настоящий `tsc`, если compiler доступен; иначе встроенный Node 22 strip-types syntax/runtime-resolution audit.
- Replay signature расширен goal/action/override/confidence и документирует newest-first trace window.
- Autobiographical episode/pattern memory теперь дедуплицируется по стабильным event IDs.
- Runtime UI получает release marker из `/api/health`, а не из захардкоженной строки.
- Старые отчёты 4.0.0 вынесены из текущей поверхности в `docs/history/4.0.0/`.
- `audit-integrity` больше не содержит список старых версий как данные проекта.
- Добавлена полная zero-to-run инструкция для Termux.

## Что проверяется

`verify:release-source`, `doctor`, `audit:syntax`, `audit:forensics`, `audit:full`, `typecheck`, organism smoke/autonomy/restart/P6/migration, server smoke, operational hardening и release audit.

## Научный статус

Все показатели остаются функциональными/causal. Ни один self-report, authorship score или lesion не считается доказательством субъективного опыта.
