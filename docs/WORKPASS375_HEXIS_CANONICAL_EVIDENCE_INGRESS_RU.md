# WorkPass375 — Hexis evidence ingress → canonical MemoryOS2

**Дата:** 2026-10-26  
**Ветка:** \`workpass375-hexis-evidence-to-memoryos2\`  
**База:** \`hexis-h1-memory-evidence-lineage-2026-10-26\`  
**Статус:** код и CI wiring добавлены; exact-head проверки должны подтвердить текущую ревизию.

## Почему этот разрыв важен

WorkPass374 добавлял безопасный парсер Hexis evidence envelope, а WorkPass H1 уже связывает Hexis belief policy с канонической evidence lineage в MemoryOS2. Но чистый парсер сам по себе не защищает реальный write boundary: другие вызывающие стороны всё ещё могли передать строковую confidence, нечисловые timestamps, accessor-backed поля или identity, которая обрезается до сохранения. Поэтому этот проход встраивает адаптер в существующий \`MemoryOS2.recordEvidence()\`, не создавая второй memory owner и не меняя Core confidence policy.

## Реализация

- \`MemoryOS2.recordEvidence()\` сначала получает isolated snapshot собственных data descriptors и отклоняет accessor/proxy-backed вход без вызова getters.
- До изменения source lineage строго проверяются provenance class, source text, authority \`[0,1]\`, safe timestamps, freshness, независимый ключ (не более 96 символов; без C0/C1 control characters).
- Для Hexis validation формируется стабильный evidence ID из канонического memory ID и independence key; адаптер нормализует дату и замораживает результат. Только после принятия адаптером MemoryOS2 обновляет canonical lineage, bloom/exact replay guard, footprint и reconsolidation metrics.
- Уже известная линия возвращает duplicate no-op **до любой записи**: не меняются evidence trail, reconsolidation counter или confidence.
- Уровень MemoryOS2 остаётся единственным writable owner. Само добавление provenance не меняет confidence; существующий H1 Core меняет belief projection только после новой canonical evidence receipt и \`audit.applied\`.
- \`test:cognitive-hexis-evidence-adapter\` теперь включён в \`test:hexis-memory-evidence-lineage\`; существующий Hexis integration audit запускает этот путь, lineage/restart regressions, HMX adaptation и live API smoke.
- Repository wiring workflow теперь учитывает branch H1 как PR base и новые adapter-файл/тест в push/PR path filters, а также запускается для ветки WorkPass375.

## Регрессионные свойства

1. Valid envelope проходит adapter и записывается в MemoryOS2.
2. Повтор с той же lineage — явный no-op, в том числе после snapshot/restore и при более высокой новой authority.
3. Нечисловая/out-of-range authority, строковые/Infinity timestamps, чрезмерная или управляющая identity, управляющие source chars и неизвестный provenance class отклоняются до mutation.
4. Getter и hostile Proxy на untrusted evidence input не исполняются.
5. Добавление evidence не изменяет confidence; belief policy продолжает владеть этим решением.
6. Отвергнутый ввод не меняет evidence trail и reconsolidation counter.

## Ограничения и валидация

Этот проход не импортирует Hexis runtime/database, не повышает статус внешнего факта до проверенного факта и не объявляет рост recall/retrieval без отдельного holdout-бенчмарка. Hosted CI на текущем exact HEAD — источник истины для typecheck и regression PASS; до его завершения никакой PASS не заявляется. \`main\` и опубликованный Release ZIP остаются без изменений.
