# PASS18 — Карта durable history boundaries

Этот документ — отдельная operational-карта PASS18, а не копия release notes.

## Durable boundaries

| Орган | Рабочее окно | Durable окно | Причина |
|---|---:|---:|---|
| P51 Grounded Causal Workspace | bounded evidence window | 64 evidence rows | сохранение свежих grounding-свидетельств без хранения полного сырого окна |
| P52 Counterfactual Development | 160 trajectory samples / 128 counterfactuals | 64 trajectory samples / bounded counterfactuals | trajectory — производная временная линия; counterfactual set остаётся отдельным bounded store |
| P61 Integrated Mind | 96 frames | 32 frames | current integration state + короткая recent trajectory достаточно для restart/diagnostics |
| P64 Integrated Dynamics | 128 frames | 32 frames | арбитрация использует recent mode context, а рабочая history остаётся live-only |
| P65 Epistemic Ledger | 256 claims / 512 recent IDs | pending predictions + recent claim tail / 256 IDs | незавершённые prediction claims не теряются при checkpoint |

## Важная гарантия

Persistence projection не изменяет `snapshot()` runtime-органов и не меняет их рабочие bounded windows. Compact-копия создаётся только на durable boundary.

## Regression evidence

PASS18 regression подтверждает 96 live cycles с полной P61/P64 history и одновременно компактным persisted state: P61=32, P64=32, P51 evidence=64, P52 trajectory=64. Restart сохраняет tick и prediction ledger.
