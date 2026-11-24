# MAJOR — Pure 4/4 Stable (LTS 4.0.0)

## Result
Promoted pure channel: **4/4** on argmix4, nibble_run, clamp_span, rot_sum3.

## How
| Family | Structural pure form |
|--------|----------------------|
| rot_sum3 | ROL(ADD(ADD(T0,T1),T2)) |
| nibble_run | Σ EQ(HNIB(i), HNIB(i+1)) |
| clamp_span | MIN(nest_max(1..4), MAX(nest_min(1..4), T0)) |
| argmix4 | HVM compile_argmax4_pack (idx_max<<4 \| min&15) |

## Law
allow_templates=False, allow_systematic=False, allow_mine=False.
No ARGMIX_ORDER expression node required in search path — pure HVM structure.

## Next
MetaController invents new structural seeds for new families / domains.
