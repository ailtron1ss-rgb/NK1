export interface MemoryTrace { id:string; importance:number; strength:number }

const clamp01=(v:number)=>Math.max(0,Math.min(1,Number.isFinite(v)?v:0));

export class DreamConsolidationLayer {
  consolidate(memory: MemoryTrace[]): MemoryTrace[] {
    return memory.map(m => {
      const importance=clamp01(m.importance);
      const strength=clamp01(m.strength);
      // Diminishing returns prevent repeated sleep/dream passes from saturating
      // every memory to 1.0 immediately.
      const gain=(1-strength)*importance*0.10;
      return { ...m, importance, strength: clamp01(strength + gain) };
    });
  }
}
