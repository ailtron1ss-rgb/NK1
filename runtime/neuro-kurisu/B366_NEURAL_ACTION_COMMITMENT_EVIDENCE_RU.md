# B366 — Neural Action Commitment Evidence / 2026-09-15

## Цель
Устранить слабый link B365: neural core менял action-score distribution, но policy оставалась почти равномерной и neural state недостаточно превращался в устойчивый action commitment.

## Изменение
B365 теперь использует bounded state-dependent neural commitment:
- `neuralConfidence01` = bounded combination of recurrent coherence, predictive confidence, plasticity and self-coherence;
- learned action readout получает ограниченный `readoutGain`;
- softmax temperature адаптируется внутри безопасного мобильного диапазона `.035…`.
- это не новый policy writer и не новый action space: нейронный readout остаётся теми же 7 действиями.
- в `OrganismCore` causal B365 contribution усилен с ±0.24/1.2 до ±0.36/2.4, не меняя ownership contract: constitutional governance остаётся внешним ограничителем.

## Evidence
### Existing B365 causal suite
- `test:big-pass-365:unified-neuro-core`: PASS 6/6; minimum lesion L1 = **0.028597**, minimum lesion/sham ratio = **2.27**.
- `test:big-pass-365:learning-transfer`: PASS 6/6; minimum opposite-history policy L1 = **0.553636**.
- `test:big-pass-365:homeostasis-structure`: PASS 6/6; minimum interoceptive policy L1 = **0.022313**, structural updates = **40/seed**.
- full `OrganismCore` causal test: PASS 5/5; minimum candidate-score L1 = **0.038549**; lesion changed final selected action in the observed seeds rather than only score values.

### New B366 test
`test:big-pass-366:neural-action-commitment`:
- 6/6 PASS;
- trained probes reach action maxima ≈ **0.823–0.934**;
- measured entropy ≈ **0.164–0.325** in the trained commitment probe;
- neural confidence ≈ **0.364–0.498**;
- policy context separation is positive in every seed.

## Interpretation
Это доказывает усиление functional neural policy commitment, а не сознание. Phenomenal consciousness remains `UNKNOWN`.

## Cost / mobile consideration
The change is arithmetic-only over the existing 7 logits and does not add another neural graph. It therefore preserves the main B365 memory/CPU structure; performance must still be measured on real Android.
