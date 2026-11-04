# NK1 Completion Kit v0.1.0

Добавочная надстройка для NeuroCore. Полный пакет с исходниками, скриптами, схемами, шаблонами и тестами поставляется отдельным архивом, прикреплённым к сообщению ChatGPT. В этой GitHub-ветке находятся reviewable architecture docs, baseline checkpoint, research ledger references, package manifest, schemas и начальные audit scripts; это не полный перенос архива.

## Локальная установка полного пакета

1. Скачайте `NeuroCore_Completion_Kit_v0.1.0.zip` из сообщения ChatGPT.
2. Распакуйте архив.
3. Скопируйте каталог `completion-kit` в `runtime/neuro-kurisu/` вашего checkout NK1.
4. Из `runtime/neuro-kurisu/completion-kit` выполните:

```bash
npm test
npm run audit
npm run imports
npm run test-surface
npm run tree
npm run report
npm run verify
```

Node.js >=22.12. Пакет не добавляет внешних npm dependencies.

## Что внутри полного ZIP

- Большое дерево целевой архитектуры и канонических владельцев.
- Строгая повторная проверка 11 стадий CEF / 20 parent edges.
- Статические architecture/import/test-surface audits.
- Метрики Brier, ECE, forgetting, paired-seed comparisons.
- Консервативный skill promotion gate с frozen holdout, минимум пятью парными seeds, bootstrap CI и проверкой худшего per-seed resource regression.
- SHA-256 dataset-manifest verifier с path traversal / symlink escape protection.
- Gate matrix, experiment templates, research intake и 24 regression tests.

## Архитектурные ограничения

Не создаёт вторую память, личность, цель или runtime owner. Не меняет production state P23 и не выполняет promotion. Не выдаёт статический аудит за доказательство когнитивного качества.

Канонические владельцы остаются в NK1: семь подсистем OrganismSystemFabric, MemoryOS2 / MemoryFabric, CognitiveEventFabric, UnifiedCognitiveCycle и P23. Перед каждым запуском обновляйте source HEAD и фиксируйте точный SHA.

## Тестовое ограничение

Локально тестовый набор Completion Kit прошёл 24/24. Promotion tests в локальном изолированном окружении использовали интерфейсно-совместимый fixture для существующего NK1 bootstrap utility. После установки в настоящий runtime необходимо повторить `npm test` против реального `src/organism/learning/PairedSeedConfidence.ts` и затем выполнить project CI на точном PR HEAD.

Физические E2E, независимый RU/EN memory uplift, обучение на unseen tasks, длительная инициатива, Android soak, power-loss recovery и human license review остаются отдельными незакрытыми воротами.
