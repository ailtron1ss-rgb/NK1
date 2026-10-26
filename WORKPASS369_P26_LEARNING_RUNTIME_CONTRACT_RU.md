# NK1 WorkPass369 — реальный контракт P26 learning / replay

**Дата:** 2026-10-26
**Ветка:** workpass369-p26-learning-runtime-contract
**База:** WorkPass368 exact head `b0ac6efd90530822173094b685546bc6c5ff4933`
**Статус:** изменения опубликованы; exact-head CI ожидается, PASS пока не объявляется.

## Найденный дефект

`runtime/neuro-kurisu/package.json` уже объявлял `test:learning-replay`, который использует `recordVerifiedHoldout()` и `trainInterleaved()`, но `P26TrueLearningEngine` этих контрактов не реализовывал. Основной WorkPass331 smoke не запускал полную цепочку P26-реплея, поэтому этот runtime/test drift оставался незамеченным.

Одновременно `generalizationEvidence01` можно было увеличить количеством обновлений политики или внутрибатчевым holdout-срезом. Это смешивало экспозицию обучения и независимое свидетельство обобщения.

## Изменения кода

- Реализован `trainInterleaved()`: строгая полная предварительная проверка всех current/replay rows до любых изменений весов, ограниченный конфликт-скрининг, TD/reward target mode, счётчики blocked/eligible/replay и rollback параметров/метрик при внутренней ошибке.
- Реализован `recordVerifiedHoldout()`: проверка собственных data descriptors без вызова getter, валидаторов идентичности/protocol/verifier/sample set, буквальных boolean flags, scores [0,1], timestamp, duplicate guard и persistence.
- Переработана схема learning metrics: `trainingExposure01` отражает объём updates; `generalizationEvidence01` формируется только из принятых registered evidence IDs. Training/replay и diagnostic `recordHoldout()` сами не увеличивают оценку обобщения.
- `restore()` безопаснее читает сохранённые метрики/counters и нормализует списки обработанных trace/evidence IDs.

Важно: `recordVerifiedHoldout()` — типизированная граница admission API; поля `verified/independent` должны выставляться доверенным независимым verifier-контуром. Само наличие этих полей не криптографически доказывает честность verifier; для production-трастинга нужно дальше связать admission с подписанным P23 evidence artifact.

## Дополнительное исправление по результатам policy sweep

Первый полный policy sweep показал `interleave-1`, seed 17: новая задача падала до `0.52`, старая сохранялась на `0.94`. Причина — каждый слот завершался replay-обновлением прошлого опыта после текущего примера, поэтому градиент последней задачи систематически перекрывался. Переставлен порядок: replay выполняется до current sample; ограниченный конфликтный скрининг равномерно охватывает всю текущую выборку. Порог новой задачи `>0.60` не ослаблялся. Добавлен прямой тест фактического порядка target-обновлений; повторный `test:learning-replay` нужен для подтверждения улучшения на всех стратегиях/seeds.

## Регрессии и CI

- Добавлен `tests/p26-interleaved-contract.mjs`: отделение training exposure от generalization evidence, rejection unverified/dependent holdout, duplicate guard после restore, atomic preflight и rollback.
- Новая проверка включена в `test:learning-replay`.
- Добавлен workflow `.github/workflows/workpass369-p26-learning-runtime-contract.yml`: Node 24, runtime typecheck, полный learning-replay, input-integrity, recovery benchmark и continual matrix.
- Exact-head CI должен завершиться прежде чем этот проход станет PASS.

## Границы

`main` и опубликованный Release ZIP не менялись. Это укрепляет программные контракты P26, но ещё не является доказательством measured improvement на внешних задачах или полной готовности продукта к релизу.
