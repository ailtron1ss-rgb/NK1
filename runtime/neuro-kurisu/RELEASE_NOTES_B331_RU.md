# Release Notes B331

## Causal Calibration & B330 Recheck

### Исправлено
- разделены predicted selected utility и realized selected reward;
- устранено постфактум завышение counterfactual margin;
- recovery strategy schema обновлена до v4;
- добавлена persistence matched calibration.

### Добавлено
- calibration ledger по `context + action`;
- MAE / signed bias / calibration score;
- строгий promotion gate на calibrated matched evidence;
- regression gate B331;
- обновлён master audit и roadmap.

### Verified
- B331 good calibration: PASS;
- B331 bad calibration: PASS;
- unrelated action isolation: PASS;
- restore: PASS;
- B326–B330 regression: PASS;
- TypeScript typecheck: PASS;
- integrity/syntax/release contract/release-source: PASS.

### Ограничение
Live Core пока получает только один matched trial на recovery boot. Promotion поэтому остаётся заблокированным при недостатке repeated evidence.
