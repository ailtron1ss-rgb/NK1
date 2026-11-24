# B369 — Neural Episodic Replay / Sleep-like Consolidation

## Why this exists
B365 already had online plasticity, temporal credit and predictive closure. The missing causal capability was consolidation of verified experience after the immediate cycle: experience had to be able to return to the neural substrate and alter future policy without replaying the external world.

## Architectural rule
B369 does **not** create a second neural brain. B365 remains the canonical 96-neuron substrate.

The new path is internal to B365:

`verified outcome -> replay trace -> priority selection -> neural readout/synaptic replay -> consolidated forecast/value -> future policy`

## Replay trace contents
Each learned outcome can persist:
- tick
- action
- reward
- prediction error
- novelty
- verification level
- latent neural state
- realized utility
- replay priority

Priority is determined from observed causal quantities, not from module existence.

## Consolidation mechanism
Replay selects the highest-priority recent traces. Each trace updates:
- action readout
- forecast readout
- action forecast utility/confidence
- a bounded sample of active eligible synapses
- plasticity state

The bounded synapse budget is deliberate for Android/Termux feasibility. Replay is deterministic for reproducibility and avoids a hidden O(experiences × all-synapses) mobile cost.

## Evidence requirements
B369 is accepted only when:
1. replay updates > 0;
2. replay impact > threshold;
3. replay ON/OFF changes a later policy probe;
4. replay state survives restart;
5. normal runtime consolidation invokes replay;
6. existing B365/B366/B367 tests remain green.

## What this proves
This is stronger than a memory file containing old experiences. The stored experience changes the neural parameters themselves and therefore changes later action probabilities.

## What this does NOT prove
It does not prove biological memory equivalence, consciousness, or phenomenal experience. Phenomenal consciousness remains UNKNOWN.
