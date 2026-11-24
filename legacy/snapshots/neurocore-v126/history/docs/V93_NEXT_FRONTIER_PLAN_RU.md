# NeuroCore V93 → V94 plan

## Immediate next work
1. Receive/import actual upstream source bytes from FLA, Preconditioned DeltaNet, Mamba, H-Net, DeltaProduct, ATLAS/Titans and other selected repos.
2. Run `scripts/probe_upstream_backends.py` against each locally available implementation.
3. Build matched backend tournament with equal hidden/state/parameter budgets and 5+ seeds.
4. Measure long-horizon recall, interference, forgetting/recovery, adaptation speed and resource cost.
5. Promote only mechanisms with evidence; rejected candidates stay outside current.

## Architectural target
`NeuroCore contract → backend adapter → one canonical state owner`. Upstream implementations must not create parallel persistent memory owners or recurrent state owners inside current.

## Research questions
- Can source-backed GDN-2/Raven/PGDN/PKDA improve the current substrate without stacking duplicate update rules?
- Can Mamba-3 or HGRN2 supply a complementary temporal pathway without becoming a second state owner?
- Can MoM/ATLAS/Titans ideas be represented as subspaces/learning policies under the existing canonical memory owner rather than duplicate memories?
- Can a learned selector choose among backend update modes based on task/state without adding a routing layer that outweighs the gained capacity?
