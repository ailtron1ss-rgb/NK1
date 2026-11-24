# LEGACY MERGE CATALOG — 34.47.0

| Legacy surface | Decision | Reason |
|---|---|---|
| Kurisu.model3.json | INTEGRATE | canonical model definition |
| Kurisu.moc3 | INTEGRATE | canonical model binary |
| 4096 texture | INTEGRATE/QUALITY | highest-quality canonical asset |
| 2048 derived texture | ADAPT/INTEGRATE-MOBILE | same UV semantics, lower mobile memory footprint |
| physics3/cdi3 | INTEGRATE | runtime model metadata |
| 8 expressions | INTEGRATE | directly referenced by model |
| 5 motion files | INTEGRATE | Idle/TapHead/TapBody/Special assets |
| Live2DAvatar.tsx | REFERENCE | useful interaction and fallback pattern; old imports not safe |
| Avatar2D.tsx | REFERENCE | decorative/expression ideas, not canonical runtime |
| BrainMonitorPanel.tsx | REFERENCE/ADAPT | useful observability patterns |
| MemoryInspector | ADAPT | converted to read-only canonical API |
| old React/Vite app | EXCLUDE-RUNTIME | competing UI/runtime architecture |
| old NeuroCore/UnifiedOrganism cores | EXCLUDE-RUNTIME | competing state owners |
| old memory engines | EXCLUDE-RUNTIME | duplicate source-of-truth risk |
| old Termux wrappers | REFERENCE | use only for operational lessons |
| old research documents | REFERENCE | preserve evidence/history, not runtime |
