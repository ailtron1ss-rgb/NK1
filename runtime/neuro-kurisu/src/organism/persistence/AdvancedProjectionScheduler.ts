export type ProjectionGroup = 'critical'|'memory'|'identity'|'reality'|'developmental'|'slow';

export interface ProjectionScheduleState {
  version: 1;
  lastFullTick: number;
  materialized: Record<ProjectionGroup, number>;
}

export const defaultProjectionScheduleState = (): ProjectionScheduleState => ({
  version: 1,
  lastFullTick: -1,
  materialized: { critical: -1, memory: -1, identity: -1, reality: -1, developmental: -1, slow: -1 },
});

/**
 * Controls how often expensive advanced projections are re-materialized.
 * The runtime remains the source of truth; this is only a bounded persistence
 * projection cache. Forced flushes always materialize every group.
 */
export class AdvancedProjectionScheduler {
  private state = defaultProjectionScheduleState();
  restore(raw?: Partial<ProjectionScheduleState>|null){
    const d=defaultProjectionScheduleState();
    const r=raw??{};
    this.state={...d,...r,materialized:{...d.materialized,...(r.materialized??{})}};
  }
  shouldMaterialize(group:ProjectionGroup,tick:number,force=false,pressure01=0):boolean{
    if(force)return true;
    const last=this.state.materialized[group];
    const age=last<0?Number.POSITIVE_INFINITY:Math.max(0,tick-last);
    const base=group==='critical'?1:group==='memory'?2:group==='reality'?4:group==='identity'?8:group==='developmental'?6:12;
    const pressure=Math.max(0,Math.min(1,Number.isFinite(pressure01)?pressure01:0));
    const multiplier=pressure>=.9?.5:pressure>=.75?.75:1;
    const period=Math.max(1,Math.round(base*multiplier));
    return age>=period;
  }
  mark(group:ProjectionGroup,tick:number){this.state.materialized[group]=Math.max(this.state.materialized[group],tick);}
  begin(tick:number){this.state.lastFullTick=tick;}
  snapshot(){return structuredClone(this.state);}
  metrics(tick:number){
    const ages=Object.values(this.state.materialized).map(v=>v<0?tick+1:Math.max(0,tick-v));
    const freshness01=ages.length?Math.max(0,1-Math.min(...ages)/16):1;
    return {lastFullTick:this.state.lastFullTick,freshness01,ages};
  }
}
