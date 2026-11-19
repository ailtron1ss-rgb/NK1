# WorkPass461 — совместимость с Node.js 24

**Дата:** 2026-10-27  
**Статус:** исправление и целевой тест добавлены; итоговый CI по текущему HEAD ожидается.

Node.js 24 в режиме `--experimental-strip-types` удаляет стираемые типы, но не преобразует TypeScript parameter properties в обычные присваивания. Поэтому импорт модулей с `constructor(private readonly field: Type)` завершается синтаксической ошибкой до запуска проверок.

В `TrustedSkillShadowRunRegistry.ts` поля `filePath` и `lockPath` объявлены явно; конструктор присваивает `this.filePath`. Целевой тест импортирует настоящий модуль и проверяет, что в strip-only режиме сохраняется отказ на пустом пути. Тест подключён к `test:rebuild-recovered`, который входит в WorkPass71 CI.

В ходе расширенного прогона обнаружен такой же pattern-property в `VersionedSkillCandidateStore.ts`; он также заменён явными полями.

Критерий приёмки — успешное выполнение целевого теста, P23/P108 путей, runtime typecheck и полного регрессионного workflow на точном HEAD. Этот fix не является доказательством улучшения памяти или обучения.

`main` и опубликованный Release ZIP не изменялись.
