# NK1 WorkPass350 — целостность завершения когнитивного цикла

**Дата:** 2026-10-26  
**Рабочая ветка:** `workpass350-kernel-completion-integrity`  
**База:** `workpass339-intrinsic-drive-goal-bridge-2026-10-25`  
**Статус:** код и регрессии закоммичены; exact-head runtime-проверка не подтверждена.

## Обнаруженный дефект

`CanonicalCognitiveKernel.completeCycle()` добавлял `outcome`, `learning` и `self-update` прежде, чем проверял, может ли монотонный `UnifiedCognitiveCycle` принять этот тик. Если обратная связь для тика T приходила уже после того, как закрыли более новый тик, три события могли остаться в `CognitiveEventFabric`, хотя `UnifiedCognitiveCycle.evaluate()` не вызывался. Метод возвращал `cycleResult: null` и `completionRecorded: false` — причинная история уже менялась, а счётчик циклов нет.

Второй разрыв был в атомарности решения: проверки входных форматов не предотвращали частичную запись, если в восстановленном журнале конфликтовал стабильный ID позднего этапа (например, `plan`), а более ранние этапы этого тика ещё отсутствовали.

## Что исправлено

1. **Полная предварительная подготовка этапов.** Kernel сначала нормализует payload каждого этапа в отсоединённый JSON-совместимый объект, затем вычисляет fingerprints и сверяет все стабильные ID до первой мутации. Циклические/non-serializable payloads и конфликты любого этапа отклоняются до добавления новых событий.
2. **Упорядоченное завершение.** Если `tick < UnifiedCognitiveCycle.lastTick`, код больше не добавляет свежую обратную связь без возможности учесть её в монотонном реестре. Запоздавшее завершение принимается как replay только если все три события уже существуют и совпадают с ожидаемыми по каноническому fingerprint.
3. **Идемпотентность прошлых завершений.** Повтор точно завершённого более раннего тика возвращает уже записанные события и вычисляемое по сохранённой причинной линии состояние завершения; новые события и счётчики не добавляются.
4. **Чёткая граница восстановления.** В `CognitiveEventFabric` добавлен `getById()`, возвращающий отсоединённую копию события. Kernel использует его для read-only preflight; поиск ограничен текущим retention window event fabric.
5. **Регрессии в существующем тесте.** Добавлены сценарии: точный replay tick 1 после закрытия более позднего tick 3; отклонение незавершённого старого tick 2 без создания любых трёх completion-событий; конфликт позднего этапа `plan` без частичной записи observation/prediction и других ранних этапов; циклический payload, который должен завершить preflight ошибкой до записи первого события.

## Изменённые файлы

- `runtime/neuro-kurisu/src/organism/core/CanonicalCognitiveKernel.ts` — [8fb73f7](https://github.com/ailtron1ss-rgb/NK1/commit/8fb73f7f5b5b773d3b7a36986d3fa4a74e929432), [5416cb3](https://github.com/ailtron1ss-rgb/NK1/commit/5416cb3d187d19abd544d9051cddbca363bcee92) и [4c25463](https://github.com/ailtron1ss-rgb/NK1/commit/4c254635d31a09f1b44a245f3243490041809753): preflight этапов, защита от позднего завершения и JSON-нормализация payloads.
- `runtime/neuro-kurisu/src/organism/system/CognitiveEventFabric.ts` — [597327a](https://github.com/ailtron1ss-rgb/NK1/commit/597327abacbc07139bae98b1a704f9b0c1d6bde5) и [521ecb9](https://github.com/ailtron1ss-rgb/NK1/commit/521ecb97e32fd2f83f9f7087b33de2c36375366a): lookup стабильного ID и detached copy.
- `runtime/neuro-kurisu/tests/canonical-cognitive-kernel.mjs` — [31f6abf](https://github.com/ailtron1ss-rgb/NK1/commit/31f6abfec622498afc9f469e2beae7be8936ce5c) и [16e479a](https://github.com/ailtron1ss-rgb/NK1/commit/16e479a8ea0749e79a3c7a96201fdb4edf9a135f): интеграционные регрессии, включая circular payload.
- `CHANGELOG.md` — запись WorkPass350 и уточнение JSON preflight на [858c64a](https://github.com/ailtron1ss-rgb/NK1/commit/858c64a975b7bbc90321175ea1417c7d3b913635).

## CI и команды проверки

Рабочий workflow `.github/workflows/workpass331-unified-cognitive-kernel.yml` уже включает `CanonicalCognitiveKernel.ts`, `CognitiveEventFabric.ts` и `canonical-cognitive-kernel.mjs` в path filters как для push, так и для pull request. Он выполняет full runtime typecheck, canonical kernel test, интеграцию endogenous goals, Core lifecycle, smoke, autonomy, background initiative и restart persistence. Workflow не требовал добавления новой зависимости или нового тестового framework.

Локальный runtime в данном проходе не был запущен, поэтому результаты тестов не заявляются как PASS. Следующие проверки должны пройти на exact HEAD:

```bash
cd runtime/neuro-kurisu
npm run typecheck
node --experimental-strip-types tests/canonical-cognitive-kernel.mjs
node --experimental-strip-types tests/canonical-cognitive-kernel-runtime-wiring.mjs
npm run test:smoke
npm run test:restart
```

Нужно проверить реальный результат GitHub Actions и не считать queued run успешным.

## Ограничения

- Этот fix защищает журнал и монотонный реестр от рассогласования; он не вводит очередь произвольно запоздавших действий. Незавершённое старое действие теперь явно отклоняется, а не подделывает закрытый цикл. Если runtime должен поддерживать параллельные действия с произвольным порядком обратной связи, следующая архитектурная задача — durable pending-completion queue с упорядоченным drain и restart recovery.
- Дубликаты старых событий можно подтвердить лишь пока события доступны в ограниченном retention window. Если evidence уже вытеснено, код закрывается безопасным отказом вместо предположения о replay.
- Не заявляются рост общей обучаемости или интеллекта, production approval, физический Android/Termux E2E или успешный release build.
- Изменения находятся в рабочей ветке и Draft PR; `main` и опубликованный Release ZIP не изменялись.

## Критерий закрытия

Считать проход проверенным можно после успешного exact-head WorkPass331 workflow, ручного подтверждения stale-feedback регрессии, и проверки, что restart сохраняет согласованность `CognitiveEventFabric` и `UnifiedCognitiveCycle`. Если CI найдёт проблему, исправить её до снятия Draft и до любой релизной публикации.
