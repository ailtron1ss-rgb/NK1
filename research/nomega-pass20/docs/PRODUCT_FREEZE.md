# Product Freeze 79.0

## Frozen claims
1. **Closed domain 0–53**: smoke closed 36/36 is regression contract.
2. **Invent ladder** (do not re-label):
   - theory/templates → 4/4
   - systematic grammar enum → 4/4
   - IO-mine → ~3/4
   - pure grow (no templates/sys/mine) → **1/4** (rot_sum3 only)
3. **Green metrics** only invent-mode / systematic / pure-grow flags — never bench seed-prior as invent.
4. **No wild4** hand families as progress.
5. **UI** = CLI + console/metrics HTML. **Not** Live2D.

## Why freeze
Further micro-versions without pure-grow method change = treadmill.
Next unfreeze requires a **new search principle** that beats 1/4 pure grow, measured with allow_mine=False, allow_systematic=False, allow_templates=False.

## Ship surface
```
README.md
runtime/nullseed_cli.py {smoke,invent_fast,metrics,status}
runtime/nullseed_console.html
runtime/metrics_panel.html
docs/PRODUCT_FREEZE.md
docs/SYSTEM.md
docs/ARCHIVE_HARVEST.md
```
