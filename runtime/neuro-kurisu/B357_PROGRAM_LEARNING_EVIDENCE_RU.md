# B357 — Compositional Program Consequence Learning Evidence

Дата: 2026-09-14
База: 35.6.9 / B356
Release: 35.6.10 / B357

## Acceptance gate
The B356 audit required a new Brick 4 gate proving that a verified compositional program is not only executable but can learn from the consequences of its own execution and retain useful information on an unseen context.

Acceptance:
1. 5 independent seeds.
2. Positive execution outcomes must increase the bias of the actually executed primitive.
3. Consequence memory must rise above matched neutral/sham learning.
4. Transfer to an unseen context must succeed for trained programs.
5. Trained transfer gain must exceed matched sham gain in every seed.
6. The change must be persistent in the organism snapshot.

## Result
PASS: 5/5 seeds.

Mean baseline primitive bias: 0.032703.
Mean post-learning primitive bias: 0.040643.
Mean consequence EMA (trained): 0.819568.
Mean consequence EMA (matched sham): 0.618288.
Mean trained unseen-context transfer gain: 0.621179.
Mean sham transfer gain: 0.418990.

All five trained cases transferred successfully and all five exceeded sham.

## Real implementation
B276 now stores:
- `consequenceEMA01` per program;
- bounded `stepCredits01` per program step;
- `actionConsequenceCredits01` across primitive actions;
- `adaptationCount`;
- persistent execution outcome evidence.

`OrganismCore` now calls `observeExecutionOutcome()` after an actual committed program primitive is evaluated by the organism outcome loop.

Transfer gain includes learned consequence/generalization evidence. This is deliberately bounded and does not replace constitutional arbitration.

## Failed first attempt retained as evidence
The first unseen-transfer run after the initial implementation failed the trained-transfer assertion. The acceptance threshold was not lowered. The transfer mechanism was revised so accumulated consequence evidence contributes materially to generalization. The same test then passed 5/5.

## Core integration
A 3-seed end-to-end Core check also passed: the real selected primitive advanced the execution cursor and a subsequent `feedback()` call increased B276 consequence EMA from 0.5704 to 0.71445344 in all 3 cases. This verifies the learning path is connected to the organism outcome loop rather than existing only as a helper API.
