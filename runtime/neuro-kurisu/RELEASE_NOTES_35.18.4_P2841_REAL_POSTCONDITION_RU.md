# Neuro/Kurisu 35.18.4 — P2841 Reality Postcondition & Grounded World

Дата: 2026-09-20

## Цель

Продолжить P2840 и закрыть следующий разрыв: исполнение внешнего действия должно приводить не только к записи receipt/evidence, но к консервативно проверяемому postcondition, которое возвращается в canonical grounded world и влияет на следующий cognitive cycle.

## Реальные изменения кода

- `ExternalPostconditionVerifier` — второй этап проверки внешнего результата. Отделяет независимое наблюдение от command receipt и derived local state transition.
- `GroundedWorldState.integrateExternalOutcome()` — внешний consequence теперь может непосредственно стать canonical grounded-world event/fact с provenance.
- `OrganismCore.recordGroundedExternalOutcome()` — публичная точка записи внешнего postcondition в persisted grounded world.
- `RealityGroundingController.causalHoldoutReadiness()` — использует уже сохраняемую историю grounding для оценки готовности к долгосрочной promotion.
- `RealityGroundingController.refineLatest()` — синхронизирует evidence после вторичной postcondition-проверки.
- `RealityLearningGate.refineLatest()` — синхронизирует фактически применённые memory/identity promotion scales.
- `OrganismRuntime` — внешний outcome теперь проходит postcondition verifier и при подтверждении коммитится в grounded world; низкая причинная история дополнительно ограничивает долговременную memory/identity promotion.
- Active perception trigger учитывает не только prediction/shadow divergence, но и дефицит независимой verification.
- State schema повышен `209 -> 210`; старые snapshots проходят migration test.

## Архитектурный инвариант

`prediction -> pure shadow -> external action -> postcondition verification -> reality arbitration -> grounded-world evidence -> learning`

При наличии authoritative external evidence predictive shadow не может самостоятельно изменить canonical world timeline.

## Две разные силы evidence

`command receipt != intended external effect`.

Для TTS/actuation receipt остаётся доказательством принятия команды, но не независимым доказательством того, что внешний мир изменился.

Для observation action свежая независимая sensor sample может считаться independently observed postcondition.

## Long-horizon holdout

Первые единичные внешние события не должны автоматически получать максимальную identity/memory promotion. `causalHoldoutReadiness` растёт с числом повторных наблюдений, verified/independent evidence и стабильностью prediction error.

## Новые тесты

- `test:p2841:postcondition`
- `test:p2841:runtime`
- `test:p2841:migration`
- `test:p2841`

## Измерения

Независимо проверенный observation в P2841 получил:

- verified = `1.00`
- independent = `1.00`
- evidence ≈ `0.902`

Actuation receipt без независимого effect proof:

- verified = `0.00`
- evidence ≈ `0.371`

Полный runtime тест подтвердил:

- external source = `external`
- grounded-world revision увеличен
- `external-observed:*` факт появился в canonical grounded world
- shadow divergence записан рядом с provenance

## Ограничения

Локальная среда не является физическим Android устройством, поэтому P2841 не заявляет независимую физическую причинность TTS/камеры/других actuator effects без hardware certification.
