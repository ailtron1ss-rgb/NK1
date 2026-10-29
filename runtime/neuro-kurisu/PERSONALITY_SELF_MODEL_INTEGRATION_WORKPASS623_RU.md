# WorkPass623 — личность и модель себя: усиление границ и интеграция

**Дата:** 29 октября 2026 года  
**Рабочая ветка:** `work/nk1-personality-selfmodel-integration-2026-10-29`  
**База:** `workpass70-source`  
**Статус:** изменения внесены в рабочую ветку; выполнение runtime-тестов и CI не подтверждено.

## 1. Цель прохода

Усилить существующий стек личности без создания параллельного ядра. Цели: защитить конституционные инварианты при восстановлении snapshot; отделить обычное наблюдение исхода от независимого доказательства; разрешать устойчивую адаптацию личности только на корректно привязанных evidence; обеспечить fail-closed поведение и диагностируемые причины отказа.

## 2. Изменения

### 2.1 CanonicalSelfAgencyAuthority

Выборочно перенесена более строгая реализация из `feature/personality` в рабочую линию `workpass70-source`. Snapshot теперь предварительно копируется/проверяется через `snapshotPlainData`; persisted data не может заменять канонический fingerprint, invariant table или protected identity assertion. Допускаются только известные adaptive-trait keys и конечные значения в [0,1]; счётчики, metrics и tick проверяются, повреждённое состояние переводится в `identity-block`.

### 2.2 P2702PersistentPersonalityDynamics

Ранее `restore` сливал произвольный snapshot со state и принимал persisted `invariantNames/invariantValues`, clamp-ил значения вместо проверки доверия и переносил произвольные ключи trust/action preference. Теперь:

- инварианты и их порядок берутся из `KURISU_ORGANISM_CANON`, а не из snapshot;
- изменяемые черты привязываются к известным каноническим именам, ограничиваются по диапазону и восстанавливаются с безопасными defaults при отсутствующих/невалидных значениях;
- массивы проверяются по ожидаемой длине; отношения, action preferences и счётчики ограничены;
- hostile/cyclic/accessor-backed snapshots должны безопасно приводить к defaults, без исполнения getter-ов.

### 2.3 Evidence-gated personality learning

`afterOutcome` больше не трактует числовой `verified01` как достаточное основание для устойчивого изменения личности. Для постоянного обновления требуются одновременно:

1. `verified01 >= 0.99`;
2. `evidence.verified === true`;
3. `evidence.independent === true`;
4. `source` равен `world-transition` или `external-verification`;
5. свидетельство должно быть точным объектом, созданным `OutcomeVerificationService` и связанным с тем же tool ID, полным input, execution ID и decision ID;
6. confidence внешней проверки должен быть не ниже 0.65.

При отсутствии или недостоверности evidence outcome считается наблюдением, а не разрешением на изменение личности: повышается/сохраняется неопределённость, обновляется диагностическая причина и счётчик отклонённых попыток, но не меняются adaptive traits, value weights, relationship trust и autobiographical strength. Добавлены отдельные `verifiedLearningUpdates`, `rejectedLearningUpdates` и `lastEvidenceGateReason`.

В `NeuralExperienceBranch.afterOutcome` добавлено необязательное поле evidence. Оно передаётся существующему P2702 learner; новый learner или второе хранилище не создавались. Старые вызовы остаются совместимыми и по умолчанию fail-closed. Это временно консервативное поведение: пока реальный путь действия не передаст независимый receipt, устойчивое обучение личности через этот интерфейс будет отклоняться.

Отдельно убрана ошибочная связь «индекс действия = индекс черты»: успешный `explore` больше не меняет случайный элемент массива адаптивных черт. Для изменения конкретной черты/ценности доказательство должно явно указать `traitFeedback` / `valueFeedback` с известным именем измерения, целевым значением и confidence. Сильный reward без attribution не должен подкручивать сразу все ценности. `relationshipTrust` больше не растёт на этапе выбора действия — только после доказанного результата для соответствующего отношения.

## 3. Изменённые файлы

1. `runtime/neuro-kurisu/src/organism/system/CanonicalSelfAgencyAuthority.ts`
2. `runtime/neuro-kurisu/tests/canonical-self-agency-authority.mjs`
3. `runtime/neuro-kurisu/src/organism/cognition/P2702PersistentPersonalityDynamics.ts`
4. `runtime/neuro-kurisu/src/organism/cognition/NeuralExperienceBranch.ts`
5. `runtime/neuro-kurisu/tests/p2702-persistent-personality-dynamics.mjs`
6. `CHANGELOG.md`
7. `runtime/neuro-kurisu/PERSONALITY_SELF_MODEL_INTEGRATION_WORKPASS623_RU.md`

## 4. Покрытие регрессий

- валидный независимо подтверждённый исход меняет адаптивное состояние;
- высокий reward и `verified01=1` без provenance не изменяет устойчивые черты и ценностные веса;
- `internal` evidence не может выдавать себя за внешний/мировой исход;
- snapshot не может перезаписать канонические invariant names/values;
- trait вне [0,1] не восстанавливается;
- getter в hostile snapshot не вызывается;
- wrapper без evidence остаётся совместимым, но не продвигает устойчивые изменения личности;
- исправлена устаревшая проверка версии snapshot в существующем P2702 test (`snap.version` / `32`).

## 5. Проверки, которые необходимо реально выполнить

Из каталога `runtime/neuro-kurisu`, под закреплённой версией Node:

```bash
node --experimental-strip-types tests/canonical-self-agency-authority.mjs
node --experimental-strip-types tests/p2702-persistent-personality-dynamics.mjs
node --experimental-strip-types tests/relationship-self-input-boundary.mjs
npm run typecheck
```

После этого обязательны runtime integration suites для self-model/personality, и CI для точного PR head SHA. В текущем окружении локальный `git clone` не сработал из-за отсутствия разрешения DNS на `github.com`, поэтому тесты здесь не запускались. Никакие тестовые PASS не заявляются.

## 6. Блокеры до promotion

1. Найти все реальные production call sites `NeuralExperienceBranch.afterOutcome` и подключить evidence только от настоящего action/outcome receipt и независимой проверки. Нельзя генерировать `evidenceRef` из одного `verified01` ради прохождения теста.
2. Проверить, что upstream verifier не может сам назначить `independent=true` без подтверждённого provenance.
3. Выполнить longitudinal ablation: одинаковые task sequences с personality/self-model pathway ON/OFF; измерить различия будущих решений, action calibration, stability, transfer и regressions на unseen holdout.
4. Проверить загрузку старых snapshots, restart/restore, rollback и миграцию схемы; обеспечить восстановление без silent identity reset.
5. Только после зелёного CI и подтверждения на exact SHA переносить изменения в каноническую ветку. Release ZIP не изменять до подтверждения точного исходного SHA и проверенного manifest.

## 7. Граница вывода

Этот проход усиливает инженерную целостность, восстановление и доказательность обновления модели себя. Он не доказывает субъективное сознание, человеческую идентичность или общую автономность. Реальная зрелость определяется длительным наблюдаемым поведением, переносом на новых задачах, устойчивостью после перезапуска и подтверждением внешних последствий.