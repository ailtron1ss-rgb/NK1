# WorkPass377 — полная проверка runtime для ветки Hexis-H1

**Дата:** 2026-10-26  
**Ветка изменений:** workpass375-hexis-canonical-ingress-latest  
**Предыдущий exact HEAD:** 6890b8cbdc17b403de2aa4eae834dffda9b9c886  
**Статус:** исправлен фильтр CI; новый exact-head запуск должен подтвердить маршрутизацию.

## Дефект

WorkPass71 запускает app/runtime typecheck, development build и широкий набор rebuild/cognitive регрессий. Его фильтр pull_request включал main, workpass70-source, workpass203-independent-candidate-evaluator, integration-workspace и rebuild, но не hexis-h1-memory-evidence-lineage-2026-10-26. Поэтому PR WorkPass375 на H1 source stack не получал этот полный набор проверок по самому факту изменения runtime source.

## Исправление

- Добавить WorkPass375 source branch в push-фильтр WorkPass71.
- Добавить Hexis-H1 source-stack branch в pull_request base filter.
- Сохранить существующие path filters: workflow по-прежнему запускается только при изменениях исходников, тестов, package/lockfiles или связанных проверочных контрактов.
- Не менять реализацию приложения, зависимости или релизные файлы.

## Доказательства и критерии завершения

- Repository Wiring Audit прошёл на exact head 6890b8cbdc17b403de2aa4eae834dffda9b9c886 и включил шаг Hexis evidence lineage, HMX integrity и live API wiring.
- WorkPass71 после этого изменения должен отдельно подтвердить runtime typecheck и rebuild/regression suite на новом SHA.
- До успешного exact-head запуска типизация и полный rebuild остаются UNVERIFIED для данного delta.
- main и опубликованный Release ZIP не меняются.

