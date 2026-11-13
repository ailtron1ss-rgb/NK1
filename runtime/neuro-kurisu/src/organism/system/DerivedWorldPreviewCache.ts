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

const fin=(v:unknown,f:number):number=>{const n=typeof v==='number'?v:Number(v);return Number.isFinite(n)?n:f;};
const cnt=(v:unknown,f:number):number=>Math.max(0,Math.floor(fin(v,f)));
const clamp01=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
type WorldPrediction=ReturnType<WorldModel2['predict']>;
const sanitizeWorldPreview=(v:unknown):Record<string,WorldPrediction>|null=>{
  if(!v||typeof v!=='object')return null;
  const out:Record<string,WorldPrediction>={};
  try{for(const [k,p] of Object.entries(v as Record<string,unknown>)){if(!p||typeof p!=='object')continue;const r=p as Record<string,unknown>;out[k.slice(0,40)]={...r,reward:clamp01(fin(r.reward,0)),confidence:clamp01(fin(r.confidence,0)),uncertainty:clamp01(fin(r.uncertainty,0))} as WorldPrediction;}}catch{return null;}
  return out;
};
const sanitizeFuturePreview=(v:unknown):DerivedWorldPreviewCacheState['futurePreview']=>{
  if(!v||typeof v!=='object')return null;
  const r=v as Record<string,unknown>;
  const path=Array.isArray(r.path)?r.path.filter((s):s is Record<string,unknown>=>Boolean(s&&typeof s==='object')).map(s=>({action:typeof s.action==='string'?s.action.slice(0,40):'',reward:fin(s.reward,0),uncertainty:clamp01(fin(s.uncertainty,0)),confidence:clamp01(fin(s.confidence,0))})).slice(0,16):[];
  return {path,expectedReward:fin(r.expectedReward,0),uncertainty:clamp01(fin(r.uncertainty,0)),horizon:cnt(r.horizon,path.length)};
};

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
    const src: Record<string, unknown> = (raw && typeof raw === 'object') ? raw as unknown as Record<string, unknown> : {};
    const read = (k: string): unknown => { try { return src[k]; } catch { return undefined; } };
    this.state = {
      version: 1,
      lastTick: fin(read('lastTick'), d.lastTick),
      lastWorldContextVersion: fin(read('lastWorldContextVersion'), d.lastWorldContextVersion),
      lastUncertainty01: fin(read('lastUncertainty01'), d.lastUncertainty01),
      refreshes: cnt(read('refreshes'), d.refreshes),
      hits: cnt(read('hits'), d.hits),
      misses: cnt(read('misses'), d.misses),
      lastFutureAt: Math.max(0, fin(read('lastFutureAt'), d.lastFutureAt)),
      lastWorldAt: Math.max(0, fin(read('lastWorldAt'), d.lastWorldAt)),
      worldPreview: sanitizeWorldPreview(read('worldPreview')),
      futurePreview: sanitizeFuturePreview(read('futurePreview')),
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
