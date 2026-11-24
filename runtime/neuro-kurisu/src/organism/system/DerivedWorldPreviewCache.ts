import type { WorldModel2 } from '../developmental/WorldModel2.ts';

export interface DerivedWorldPreviewCacheState {
  version: 1;
  lastTick: number;
  lastWorldContextVersion: number;
  lastUncertainty01: number;
  refreshes: number;
  hits: number;
  misses: number;
  lastFutureAt: number;
  lastWorldAt: number;
  worldPreview: Record<string, ReturnType<WorldModel2['predict']>> | null;
  futurePreview: { path:Array<{action:string;reward:number;uncertainty:number;confidence:number}>; expectedReward:number; uncertainty:number; horizon:number } | null;
}

export interface PreviewDecisionInput {
  tick: number;
  worldContextVersion: number;
  uncertainty01: number;
  externalInput: boolean;
  deep: boolean;
  refreshEveryTicks?: number;
}

const DEFAULT_ACTIONS = ['respond','explore','verify','rest','reflect','wait','defer'] as const;

export const defaultDerivedWorldPreviewCache = (): DerivedWorldPreviewCacheState => ({
  version: 1,
  lastTick: -1,
  lastWorldContextVersion: -1,
  lastUncertainty01: -1,
  refreshes: 0,
  hits: 0,
  misses: 0,
  lastFutureAt: 0,
  lastWorldAt: 0,
  worldPreview: null,
  futurePreview: null,
});

/**
 * Keeps workspace-only world previews off the hot path when there is no new
 * world evidence. Decision scoring is not routed through this cache, so it
 * cannot silently change action semantics.
 */
export class DerivedWorldPreviewCache {
  private state = defaultDerivedWorldPreviewCache();

  restore(raw?: Partial<DerivedWorldPreviewCacheState> | null) {
    const d = defaultDerivedWorldPreviewCache();
    this.state = {
      ...d,
      ...(raw ?? {}),
      worldPreview: raw?.worldPreview ?? null,
      futurePreview: raw?.futurePreview ?? null,
    };
  }

  snapshot() { return structuredClone(this.state); }

  shouldRefresh(input: PreviewDecisionInput): boolean {
    if (!this.state.worldPreview || !this.state.futurePreview) return true;
    if (input.externalInput || input.deep) return true;
    if (input.worldContextVersion !== this.state.lastWorldContextVersion) return true;
    if (Math.abs(input.uncertainty01 - this.state.lastUncertainty01) > 0.14) return true;
    const every = Math.max(1, Math.floor(input.refreshEveryTicks ?? 4));
    return input.tick - this.state.lastTick >= every;
  }

  getOrRefresh(
    model: WorldModel2,
    futureSimulator: { simulate:(model:WorldModel2,actions:string[],baseReward:number)=>DerivedWorldPreviewCacheState['futurePreview'] },
    input: PreviewDecisionInput,
  ) {
    if (!this.shouldRefresh(input)) {
      this.state.hits++;
      return { worldPreview:this.state.worldPreview!, futurePreview:this.state.futurePreview!, refreshed:false };
    }
    this.state.misses++;
    const worldPreview: Record<string, ReturnType<WorldModel2['predict']>> = {};
    for (const action of DEFAULT_ACTIONS) worldPreview[action] = model.predict(action, 0.5, input.uncertainty01);
    const futurePreview = futureSimulator.simulate(model, ['reflect','verify'], 0.5);
    this.state.worldPreview = worldPreview;
    this.state.futurePreview = futurePreview;
    this.state.lastTick = input.tick;
    this.state.lastWorldContextVersion = input.worldContextVersion;
    this.state.lastUncertainty01 = input.uncertainty01;
    this.state.refreshes++;
    this.state.lastWorldAt = Date.now();
    this.state.lastFutureAt = this.state.lastWorldAt;
    return { worldPreview, futurePreview, refreshed:true };
  }
}
