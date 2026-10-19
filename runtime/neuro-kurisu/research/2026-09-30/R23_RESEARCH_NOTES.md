# R23 research notes

## LongMemEval-V2

LongMemEval-V2 (arXiv:2605.12493, 2026) describes a long-term experience-memory evaluation with 451 manually curated questions covering static state recall, dynamic state tracking, workflow knowledge, environment gotchas, and premise awareness. The histories can be very long, including up to hundreds of trajectories. R23 uses these categories only as design inspiration for a compact internal battery; it does not claim benchmark equivalence.

## Forget to Improve

Forget to Improve (arXiv:2606.25115, 2026) frames on-device continual memory management around hard resource constraints and net memory value per byte, with value/harm/provenance considerations. R23 turns the corresponding engineering idea into a real MemoryOS2 byte-budget enforcement path and records per-eviction witnesses. The R23 witness metric is intentionally weaker than the paper's full experimental setup and is not presented as a replication.

## Recurrent / SSM direction

The R23 recurrent lane is deliberately a small bounded ablation surface. It exists to measure whether a recurrent state substrate adds useful temporal compression or persistence characteristics relative to the existing canonical system. It is not treated as a shortcut to consciousness or as an automatic replacement for the current neural substrate.
