# Modular Brain Architecture v24

## Hub pipeline
`BrainHub.processInput(msg)` →
1. NeuroEngine (if module on)
2. MiCRo experts language/logic/social/knowledge
3. ACE memory layers
→ prompt blocks in `contextPacket`

## Modules (`brain/ModuleManager.ts`)
Toggle in **Settings → Плагины → Модульный мозг**

| id | role |
|----|------|
| neuro | traits/frames/emotions |
| ace_memory | persona/episodic/working/micro |
| micro_experts | MiCRo routing hints |
| self_improve | NFH proposals |
| power_governor | battery |
| token_meter | cloud budget |
| live2d / voice / proactive | I/O |

## Self-improvement
- `NfhSelfImprove.runCycle()` — generator notes + evaluator score; safe consolidate only
- `modular/SelfImproveLoop` — trait patch proposals, **user approve**, snapshot rollback

## Not claimed
- Auto-editing TypeScript source on device
- Downloadable WASM plugins (can be added later)
- Real BioTensors SNN / TFLite LSTM

## Files
- `src/brain/BrainHub.ts`, `ModuleManager.ts`, `AceMemory.ts`, `MicroExperts.ts`, `NfhSelfImprove.ts`
- `src/modular/SelfImproveLoop.ts`, `builtinModules.ts` (parallel helpers)
- `src/components/ModularBrainPanel.tsx`
