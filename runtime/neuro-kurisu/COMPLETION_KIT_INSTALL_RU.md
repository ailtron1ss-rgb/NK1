# NK1 Completion Kit v0.1.0

Добавочная надстройка для проекта NeuroCore. Полный исходный пакет лежит в архиве `completion-kit-bundle-v0.1.0.tar.xz`.

## Установка
Из каталога `runtime/neuro-kurisu`:

```bash
tar -xJf completion-kit-bundle-v0.1.0.tar.xz
cd completion-kit
npm test
npm run audit
npm run imports
npm run test-surface
npm run tree
npm run report
```

Node.js >=22.12. Пакет без новых внешних npm dependencies.

## Что внутри
- Большое дерево целевой архитектуры и канонических владельцев.
- Строгая проверка 11 стадий CEF / 20 parent edges.
- Статические architecture/import/test-surface audits.
- Метрики Brier, ECE, forgetting, paired-seed comparisons.
- Консервативный skill promotion gate с frozen holdout, минимум пятью парными seeds, CI и проверкой худшего per-seed resource regression.
- SHA-256 manifest verifier с path traversal / symlink escape protection.
- Gate matrix, experiment templates, research intake, 24 regression tests.

## Важно
Не создаёт вторую память, личность, цель или runtime owner. Не меняет состояние P23 и не продвигает skills. Не выдаёт статический аудит за доказательство когнитивного качества.

Базовый SHA на момент упаковки: `d8902d765ef218a32125567f24345fea77f1c902` в `workpass70-source`. Перед запуском обновите актуальную голову ветки.

В локальном тестовом окружении 24/24 теста прошли. Promotion tests использовали интерфейсно-совместимый fixture для канонического NK1 bootstrap utility; после распаковки внутри репозитория обязательно повторить `npm test` против настоящего `src/organism/learning/PairedSeedConfidence.ts`.
