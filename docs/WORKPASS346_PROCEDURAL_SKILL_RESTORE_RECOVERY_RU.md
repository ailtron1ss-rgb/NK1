# WorkPass346 — fail-open recovery for malformed procedural skill state

Дата: 2026-10-26  
Ветка: `fix/mega-cognitive-progress-tracking-2026-10-26-r3`  
Code/test HEAD: `330dc7632839822225cfff0620fe9cdd390acdc4`  
Статус: **код и регрессия записаны; точная Unified Integration Suite выполняется** — [run #40280652324](https://github.com/ailtron1ss-rgb/NK1/actions/runs/40280652324).

## Обнаруженный путь отказа

`OrganismRuntime.init()` восстанавливал `procedural-skills.json` без try/catch. Библиотека навыков нормализует persisted records, но некорректная запись внутри массива (например, `skills: [null]`) может выбросить исключение во время нормализации и остановить запуск всего организма. Ошибка чтения sidecar (например, если повреждены primary и backup) также могла сорвать init.

## Изменение

Загрузка и `ProceduralSkillLibrary.restore()` теперь заключены в отдельную границу восстановления. При ошибке библиотека сбрасывается в безопасное пустое состояние, runtime пишет ограниченное предупреждение `runtime.procedural-skills.restore-failed` и продолжает инициализацию. Каноническое состояние Core и его основная память не сбрасываются. Проблема остаётся наблюдаемой через operational journal, а не скрывается как успех восстановления навыков.

## Регрессия

- Source-contract test проверяет изолированную границу try/catch и событие warning.
- Runtime restart smoke самостоятельно записывает детерминированный повреждённый fixture (`version: 8, skills: [null]`) — не зависит от того, существовал ли файл до теста.
- Runtime должен успешно инициализироваться, вернуть пустую библиотеку навыков после fallback и выполнить следующий автономный цикл на каноническом Core tick.

## Статус проверки

Ветка уже настроена запускать Unified project integration suite на push; текущая точная проверка code/test HEAD `330dc7632839822225cfff0620fe9cdd390acdc4` — run [#40280652324](https://github.com/ailtron1ss-rgb/NK1/actions/runs/40280652324). До завершения этого run WP346 остаётся pending. WorkPass343–344 ранее прошли на `a5aafc5274f44974aadf52e155213e12200cc4da` ([run #40279636593](https://github.com/ailtron1ss-rgb/NK1/actions/runs/40279636593)), а WorkPass345 — на `216d79086bfac2dd5f25e2c995fe6b5a44b61476` ([run #40279847281](https://github.com/ailtron1ss-rgb/NK1/actions/runs/40279847281)).
