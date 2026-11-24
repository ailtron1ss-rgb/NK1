import type { MemoryOSState2 } from './MemoryOS2.ts';
export class DormantMemoryController{static apply(state:MemoryOSState2,limit=256){const kept=state.items.filter(m=>!m.dormant||m.identityRelevance>.5||m.goalRelevance>.6).slice(0,limit);return {...state,items:kept};}}
