# NK1 WorkPass371 — строгая граница входа CanonicalCognitiveKernel

**Дата:** 2026-10-26  
**Ветка:** workpass371-canonical-kernel-ingress  
**База:** WorkPass370 head `33beed482f995be5cd0ab5255c8b6c2f03bf6b79`  
**Статус:** код и регрессии опубликованы; exact-head CI ожидает проверки.

## Найденный разрыв

После WorkPass364 CEF сам отклоняет невалидные поля без coercion, но CanonicalCognitiveKernel читал root/phase поля напрямую и нормализовал source, external, confidence и payload до вызова CEF. Поэтому getter мог исполняться раньше безопасной границы, строка `false` превращалась в boolean `true`, а вложенный payload зависел от сериализации `stableJson`.

## Изменения

- Root входа `beginDecisionCycle` и `completeCycle`, а также `anchors`, копируются по собственным data descriptors до чтения.
- Каждая фаза проходит предварительную типизированную нормализацию до первого append; getter-backed поля отклоняются без вызова.
- `source` больше не преобразуется через `String`, `external` через `Boolean`, confidence не clamped; данные проверяются до подготовки causal event.
- Переиспользуется CEF `cloneCognitiveEventPayload()` с единым bounded plain-JSON contract: top-level accessors удаляются без исполнения (совместимость), вложенные accessors/cycles/non-JSON data отклоняются.

## Регрессии

- Getter root tick/fallbackTick, phase confidence и anchor action не исполняются.
- Строковый `external:'false'` для decision/completion отклоняется, не добавляя события.
- Вложенные payload getters не исполняются; ошибочные attempts сохраняют event/cycle snapshot.
- Последующий корректный decision+completion по-прежнему создаёт 11 событий и завершённый цикл.

## Границы

- CHANGELOG/checkpoint обновлены; `main` и published Release ZIP не менялись.
- Нужны exact-head TypeScript, canonical-kernel, smoke/restart и continual-learning CI.
