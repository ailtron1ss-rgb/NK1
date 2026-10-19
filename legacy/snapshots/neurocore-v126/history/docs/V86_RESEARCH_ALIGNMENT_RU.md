# V86 Research Alignment

## Replay selection

Experience replay research treats sample selection as a first-class continual-learning design choice, especially under limited memory. V86 therefore measures not only replay count but coverage, diversity and repeated-use concentration.

Sources:
- https://arxiv.org/abs/2208.02660
- https://arxiv.org/pdf/2210.06579
- https://arxiv.org/abs/1811.11682

## Design decision

No labels, task IDs or external domain annotations are used by the selector. Signature buckets are computed from observation/target geometry only.

## What is borrowed

- bounded memory-aware selection;
- explicit anti-starvation pressure;
- experience replay as a continual-learning mechanism.

## What is not copied

No external architecture is transplanted. V86 remains inside the single canonical memory owner and reuses the existing unified trunk.
