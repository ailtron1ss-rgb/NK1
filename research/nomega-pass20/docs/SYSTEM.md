# System map 78.0

```
┌─────────────────────────────────────────────┐
│  Termux / Browser                           │
│  nullseed_cli  ←→  metrics.json             │
│         ↓                                   │
│  nullseed_console.html  (orb + tables)      │
└──────────────────┬──────────────────────────┘
                   │
┌──────────────────▼──────────────────────────┐
│  nullseed_spine (smoke / invent_fast)       │
│  capability_harness · problem_forge         │
│  bottom_up (theory|sys|mine|grow flags)     │
│  hierarchical_vm (ISA + ROL/MUL/…)          │
└─────────────────────────────────────────────┘

OUT OF SYSTEM: neuro_kurisu Live2D / character cognition
```

## Synergy
- CLI writes metrics → console reads → user sees ladder
- Invent flags share one BottomUpSynth — no duplicate engines
- Smoke stays default so phone never starts full invent by accident
