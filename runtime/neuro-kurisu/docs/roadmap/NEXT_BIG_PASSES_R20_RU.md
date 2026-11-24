# R20 — следующий большой проход

## 1. Memory Anchors

Build a conflict-anchor benchmark from existing MemoryOS2/P30 trajectories.
Compare:
- uniform replay;
- recency replay;
- learned-value replay;
- conflict-anchor replay;
- learned-value + conflict-anchor replay.

Acceptance: at least one bounded improvement in retention/transfer without increasing mobile RSS materially.

## 2. Operation semantic coverage

Move from trace-level proof to 200–400 critical operation passports:
input → owner → state mutation → downstream consumer → evidence → replay.

## 3. Provenance matrix

Test source classes:
device / external / user / agent / derived / simulation
against:
- same fact;
- implicit conflict;
- stale query premise;
- downstream action.

## 4. Bounded active-inference experiment

Use world prediction error to adjust test-time policy posterior as a bounded residual over the canonical action arbiter. Require ablation and holdout; never create a second policy writer.

## 5. Neural substrate

Prototype a tiny recurrent/SSM-like state module behind an explicit adapter. Compare:
- static latent;
- recurrent latent;
- recurrent + action-conditioned transition.

No new dependency until the experiment demonstrates measurable quality-per-millisecond/MB improvement.

## 6. Real Android endurance

1000+ cycles with force-kill/restart, memory pressure, thermal drift, idle/wake, network loss and storage pressure. P2867 remains unresolved until this protocol is run on the real device class.
