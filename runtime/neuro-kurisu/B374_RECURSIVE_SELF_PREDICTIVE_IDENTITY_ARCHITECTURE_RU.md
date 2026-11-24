# B374 — Recursive Self-Predictive Identity Loop

## Статус
CURRENT / BIG UPDATE / B365 CANONICAL / EVIDENCE-GATED

## Архитектурная проблема B373
B373 уже дал эндогенную мотивацию и verified developmental traits, но self-model оставался в основном внешним к нейронной причинной траектории. Не хватало действия вида:

`current neural state → prediction of how an action changes self → action → verified self-transition → autobiographical trace → consolidation → future-self model → next policy`

## Что сделано

### 1. Predictive self-state
B365 теперь строит компактное 16-мерное self latent из канонического neural latent + allostatic/identity signals.

### 2. Action-conditioned future-self prediction
Для каждого действия рассчитывается собственный predicted-self state.

### 3. Identity-aware policy field
Каждое действие получает causal self-field из:
- continuity with stable self;
- alignment with future self;
- growth potential;
- identity conflict;
- world utility.

Поле добавляется непосредственно в B365 policy logits с ограниченным коэффициентом. B365 остаётся единственным neural decision owner.

### 4. Agency tracking
Система отдельно отслеживает способность правильно предсказывать собственное последующее состояние и адаптирует agency estimate.

### 5. Evidence-gated self-transition learning
Self-model изменяется только при:
- verified outcome >= 0.99;
- external evidence >= 0.65.

`verified01=1` без external evidence отклоняется.

### 6. Autobiographical neural trace
Каждый подтверждённый self-transition сохраняет:
- self-before;
- self-after;
- action;
- reward;
- prediction error;
- identity conflict;
- importance.

Буфер ограничен 64 эпизодами.

### 7. Self-biography consolidation
Каждые 32 neural cycles наиболее значимые verified autobiographical episodes консолидируются в stable-self, future-self и action-identity readout.

Это превращает autobiographical memory из storage-only механизма в causal developmental memory.

### 8. Restart persistence
Весь self-model и autobiographical state входят в B365 snapshot/restore.

## Causal evidence

### Recursive self-model test
- 240 verified transitions;
- 1,680 counterfactual action checks;
- 64 persistent autobiographical episodes;
- 9 self consolidations на 300-cycle performance run;
- agency ≈ 0.999;
- continuity ≈ 0.952;
- self prediction error ≈ 0.0011;
- ON/OFF final policy L1 ≈ 0.23;
- restart preservation PASS.

### Holdout
- training: 180 verified transitions;
- unseen/holdout: ещё 120 циклов;
- всего 2,100 counterfactual checks;
- holdout policy ON/OFF L1 ≈ 0.02186;
- OFF self-model verified transitions = 0;
- verified01 без external evidence → rejected.

## Regression
B365/B367/B368/B369/B371/B372/B373 regression tests повторно пройдены в отдельных запусках. Один длинный aggregate target ранее уходил в timeout; он не считается PASS. Точные отдельные результаты находятся в release verification.

## Performance
300 cycles:
- p50 ≈ 6.40 ms;
- p95 ≈ 43.02 ms;
- p99 ≈ 48.36 ms;
- heap ≈ 23.09 MiB.

Это host/CI runtime, не physical Android certification.

## Scientific context
В архитектуру включены только инженерно переносимые идеи из research context:
- autobiographical memory и temporal self;
- self as internal predictive model;
- continual embodied learning;
- specific/generalized memory consolidation;
- long-horizon self-evolving embodied systems.

Research context не трактуется как доказательство сознания или биологической эквивалентности.
