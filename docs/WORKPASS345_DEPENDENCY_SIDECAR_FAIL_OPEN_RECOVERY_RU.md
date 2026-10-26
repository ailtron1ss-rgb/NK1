# WorkPass345 — fail-open recovery for invalid dependency sidecar

Дата: 2026-10-26  
Ветка: `fix/mega-cognitive-progress-tracking-2026-10-26-r3`  
Code/test commit: `216d79086bfac2dd5f25e2c995fe6b5a44b61476`  
Статус: **PASS на точном code/test HEAD `216d79086bfac2dd5f25e2c995fe6b5a44b61476`**. Unified project integration suite [run #40279847281](https://github.com/ailtron1ss-rgb/NK1/actions/runs/40279847281) завершился успешно; он включает restart-регрессию для неподдерживаемой схемы графа.

## Проблема и исправление

`OrganismRuntime.init()` вызывал `CognitiveDependencyGraph.restore()` до защищённого участка. Несовместимый `version` или ошибка чтения производного sidecar могли выбросить исключение и остановить запуск организма целиком. Это излишне строго для восстанавливаемого derived state: канонический Core не должен зависеть от доступности необязательной routing-проекции.

Загрузка и нормализация графа теперь внутри отдельного try/catch. При ошибке runtime сбрасывает только `CognitiveDependencyGraph` к безопасному состоянию по умолчанию, пишет `runtime.cognitive-dependency.restore-failed` и продолжает обычный init. Успешный restore по-прежнему выполняет WorkPass344 re-anchor future tick к каноническому Core tick.

## Регрессия

- Wiring contract проверяет, что runtime содержит fail-open restore и предупреждающее событие.
- Реальный restart smoke после проверки WorkPass344 меняет schema version файла `cognitive-dependencies.json` на неподдерживаемую, запускает новый runtime и проверяет, что init завершается, а следующий автономный цикл продвигает graph на канонический Core tick.
- Полный интеграционный workflow запущен с active branch после фикса push-allowlist; run [#40279847281](https://github.com/ailtron1ss-rgb/NK1/actions/runs/40279847281) завершился успешно на code/test SHA `216d79086bfac2dd5f25e2c995fe6b5a44b61476`.

## Граница доказательств

WorkPass344 был проверен полноценным Unified project integration suite на точном checkout `a5aafc5274f44974aadf52e155213e12200cc4da`: [run #40279636593](https://github.com/ailtron1ss-rgb/NK1/actions/runs/40279636593) завершился успешно. Этот run содержит WP344, но не последующее изменение WP345. До завершения run #40279847281 WorkPass345 остаётся непроверенным; engineering scores не повышаются.
