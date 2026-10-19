# Active Roadmap — 35.6.17 / B366

## Current status
B366 is a consolidation upgrade of the existing B365 unified neural core. No new B-module was introduced. The goal was to strengthen the causal bridge from learned neural state to stable action commitment without creating a second policy system.

## Verified B365 substrate
1. 96 recurrent LIF-like neurons across `interoception`, `exteroception`, `association`, `selfAction`.
2. Sparse recurrent graph with 1,188 initial synapses plus structural growth.
3. Membrane, threshold, adaptation, spikes, eligibility, neuromodulation and predictive heads are persistent state.
4. Outcome-dependent learning changes action readout, synapses and predictive heads.
5. Real integration in `SPINE_ONLY` decision flow and persistence.

## B366 implemented
1. `neuralConfidence01` combines recurrent coherence, predictive confidence, plasticity and self-coherence.
2. Learned neural action readout now uses bounded state-dependent gain.
3. Softmax temperature is bounded/adaptive (`.035…`) rather than globally fixed.
4. Full Core B365 contribution is stronger but still bounded; constitutional governance remains in control.
5. Added 6-seed action-commitment regression.

## Evidence after B366
- Unified neural causal: **6/6 PASS**, min lesion L1 **0.028597**, min lesion/sham **2.27×**.
- Outcome history transfer: **6/6 PASS**, min policy L1 **0.553636**.
- Homeostasis/structural plasticity: **6/6 PASS**, min L1 **0.022313**, structural updates **40/seed**.
- Full Core causal selection: **5/5 PASS**, min candidate-score L1 **0.038549**, with final-action changes in the observed lesion probes.
- New action commitment: **6/6 PASS**, trained max-action probability **0.823–0.934**, entropy **0.164–0.325**.

## What remains open
- Physical Android/Termux live evidence.
- Real camera/microphone causal learning.
- Stronger world-model → neural prediction → verified outcome bridge on unseen contexts.
- Longer-lived autonomous goal cycles with neural ownership rather than contribution-only influence.
- Functional consciousness experiments; phenomenal consciousness remains **UNKNOWN**.

## Next BIG UPDATE
Do not add another neural B-module. Build a causal **body/world closure gate** around the existing core:
`real/verified body frame → B365 state → imagined outcome → action → verified outcome → B365 prediction error → plasticity → unseen-context behavior`.
The gate must include ON/OFF/SHAM/LESION, persistence/restart, holdout, and Android evidence boundaries.


# B368 CURRENT — NEURAL TEMPORAL + FULL RUNTIME CLOSURE

B368 closes the previously identified B365 full-runtime ownership gap. The canonical 96-neuron B365 substrate now participates in ordinary full decisions, receives ordinary simulator/world outcomes, performs temporal credit assignment across a 12-tick trace, and exposes an explicit autonomous closed-loop runtime.

Required evidence gates now include:
- B368 temporal ON/OFF ablation;
- full-runtime B365 ON/OFF ablation;
- autonomous no-external-command run;
- restart/persistence;
- B365/B366/B367 regression;
- mobile-profile host benchmark;
- physical Android gate remains open until actual Termux/API evidence is available.

Next architecture priority: connect real Android sensor observations and independently verified actuator outcomes into this same causal spine without creating a parallel neural substrate.
