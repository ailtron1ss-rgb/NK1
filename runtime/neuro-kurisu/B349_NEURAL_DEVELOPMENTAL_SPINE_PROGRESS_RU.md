# B349 — Neural Developmental Spine

## Зачем этот проход

Предыдущий аудит показал, что у проекта уже есть несколько настоящих нейронных механизмов, но они были слишком слабо сведены в один причинный путь. B349 не создаёт ещё одну изолированную «нейросеть». Он объединяет сигналы существующих B269/B289/B293/B294/B296 в один сохраняемый developmental-контур.

## Что теперь реально происходит

```text
B269 spike assembly + plasticity
        ↓
B289 recurrent integrated latent
        ↓
B293 self/world prediction + error
        ↓
B294 causal confidence
        ↓
B296 neural/personality/agency readout
        ↓
B349 causal neural state
        ↓
B297 executive neural source
        ↓
action
        ↓
real outcome / verification
        ↓
B349 temporal eligibility + weight/reliability update
        ↓
следующее решение
```

Простыми словами: система теперь не только «видит» нейронные сигналы, но и запоминает, какой neural-context предшествовал действию, получает реальный результат и использует его для будущего выбора.

## Что добавлено

- сохраняемый `B349State`;
- action-specific neural weights;
- temporal eligibility traces;
- action reliability;
- prediction-error aggregation;
- causal readiness;
- измерение neural contribution;
- outcome-gated learning;
- evidence/verification/independence/autonomy gates;
- snapshot/restore;
- Core integration;
- release manifest/integrity integration;
- отдельные unit и Core integration tests.

## Реальная проверка

### Изолированный developmental test

До обучения:

- `verify` bias ≈ `0.0574`.

После 79 outcome-updates с высоким подтверждённым успехом:

- `verify` bias ≈ `0.3841`;
- `verify` weight достиг `1.0` в текущем bounded формате;
- `learningUpdates = 79`;
- последняя neural contribution ≈ `0.719`.

Это доказывает, что outcome реально меняет состояние B349 и будущее действие-влияние.

### Core integration

Проведены 3 реальных `OrganismCore.observe(...)` цикла на mobile profile.

- B349 cycles = 3;
- neural contribution ≈ `0.498`;
- integration ≈ `0.336`;
- B349 state попал в общий snapshot;
- после создания нового Core из snapshot cycles восстановились `3`.

## Что намеренно НЕ заявляется

B349 не доказывает сознание. Он также не доказывает, что весь organism уже является автономной искусственной личностью.

Следующие необходимые доказательства:

1. длинный learning holdout;
2. outcome-driven behavioural divergence;
3. causal ablation с/без B349;
4. developmental lesion;
5. Android/Termux runtime benchmark;
6. проверка на unseen contexts;
7. снижение влияния B349 при плохой доказательности, а не только рост при успехе.

## Примечание для следующего прохода

B349 сейчас намеренно не получает полный ownership action selection. Он добавлен как causal neural spine и влияет на B297, чтобы не ломать уже существующий verified executive chain. Следующий крупный проход должен измерить, насколько изменение B349 действительно меняет конечный `selectedAction` после всех downstream governors.
