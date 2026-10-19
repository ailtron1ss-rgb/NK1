import type { ActionKind, OrganismDecisionTrace, OrganismState } from '../core/types.ts';
import type { AdaptivePolicyState } from './AdaptivePolicyEngine.ts';

const ACTIONS:ActionKind[]=['respond','explore','verify','rest','reflect','wait','defer'];
const clamp=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
const now=()=>Date.now();

export interface ShadowRecord { at:number; contextKey:string; actual:ActionKind; shadowBest:ActionKind; divergence:number; regret01:number; }
export interface PolicyGene { id:string; createdAt:number; label:string; source:'success'|'recovery'|'manual'; score01:number; values:Record<string,Partial<Record<ActionKind,{value:number}>>>; }
export interface QuarantineRecord { id:string; at:number; reason:string; input:string; surprise01:number; status:'quarantined'|'released'|'rejected'; releasedAt:number|null; }
export interface EvidenceDebt { id:string; claim:string; evidenceCount:number; contradictions:number; confidence01:number; priority01:number; lastUpdatedAt:number; status:'open'|'verified'|'retired'; }
export interface ModelSwapScore { model:string; samples:number; meanReward01:number; calibration01:number; latencyMs:number; failures:number; lastAt:number; }
export interface CompiledSkill { id:string; pattern:string; action:ActionKind; uses:number; meanSuccess01:number; confidence01:number; compiledAt:number; }
export interface TimeCapsule { id:string; at:number; title:string; summary:string; tick:number; goals:string[]; actions:string[]; changes:string[]; }
export interface ForkRecord { id:string; at:number; baseTraceId:string; chosen:ActionKind; alternative:ActionKind; chosenUtility01:number; alternativeUtility01:number; predictedAdvantage01:number; }
export interface AdvancedResilienceState {
  version:1;
  cycles:number;
  shadow:{comparisons:number;divergence01:number;meanRegret01:number;lastAt:number;recent:ShadowRecord[]};
  geneBank:{genes:PolicyGene[];activeGeneId:string|null;restores:number};
  surpriseFirewall:{inspected:number;quarantined:number;released:number;rejected:number;recent:QuarantineRecord[]};
  evidenceDebt:{records:EvidenceDebt[];openCount:number;verifiedCount:number;meanPriority01:number};
  modelSwap:{currentModel:string;catalog:ModelSwapScore[];evaluations:number;lastEvaluationAt:number};
  offlineSurvival:{languageFailures:number;fallbackCycles:number;active:boolean;lastBackend:string;lastAt:number};
  dreamCompiler:{compiledSkills:CompiledSkill[];compilations:number;lastAt:number};
  timeCapsules:{capsules:TimeCapsule[];lastAt:number;periodMs:number};
  counterfactualForks:{forks:ForkRecord[];evaluations:number;lastAt:number};
}

export const defaultAdvancedResilience=():AdvancedResilienceState=>({
  version:1,cycles:0,
  shadow:{comparisons:0,divergence01:0,meanRegret01:0,lastAt:0,recent:[]},
  geneBank:{genes:[],activeGeneId:null,restores:0},
  surpriseFirewall:{inspected:0,quarantined:0,released:0,rejected:0,recent:[]},
  evidenceDebt:{records:[],openCount:0,verifiedCount:0,meanPriority01:0},
  modelSwap:{currentModel:'unknown',catalog:[],evaluations:0,lastEvaluationAt:0},
  offlineSurvival:{languageFailures:0,fallbackCycles:0,active:false,lastBackend:'unknown',lastAt:0},
  dreamCompiler:{compiledSkills:[],compilations:0,lastAt:0},
  timeCapsules:{capsules:[],lastAt:0,periodMs:24*60*60*1000},
  counterfactualForks:{forks:[],evaluations:0,lastAt:0},
});

function contextKey(s:OrganismState){const n=s.needs;const b=(x:number)=>Math.round(clamp(x)*3);return `e${b(n.energy)}|c${b(n.cognitiveLoad)}|u${b(n.uncertainty)}|n${b(n.novelty)}|g${b(n.goalPressure)}|s${b(n.socialNeed)}`;}
function bestFromPolicy(policy:AdaptivePolicyState,key:string):ActionKind{
  const table=policy.values[key]??{};
  return ACTIONS.slice().sort((a,b)=>Number(table[b]?.value??.5)-Number(table[a]?.value??.5))[0]??'wait';
}
function summarizeTraces(traces:OrganismDecisionTrace[]):Map<string,{action:ActionKind;uses:number;success:number}> {
  const out=new Map<string,{action:ActionKind;uses:number;success:number}>();
  for(const t of traces.slice(0,160)){
    if(!t.selected?.action||!t.outcome)continue;
    const key=`${contextKey(t.stateBefore)}|${t.selected.action}`; const row=out.get(key)||{action:t.selected.action,uses:0,success:0};
    row.uses++; row.success+=clamp(t.outcome.success??.5); out.set(key,row);
  }
  return out;
}

export class AdvancedResilienceEngine {
  private state=defaultAdvancedResilience();
  restore(raw?:Partial<AdvancedResilienceState>|null){const d=defaultAdvancedResilience();const r=raw??{};this.state={...d,...r,
    shadow:{...d.shadow,...(r.shadow??{}),recent:Array.isArray(r.shadow?.recent)?r.shadow!.recent.slice(-96):[]},
    geneBank:{...d.geneBank,...(r.geneBank??{}),genes:Array.isArray(r.geneBank?.genes)?r.geneBank!.genes.slice(0,16):[]},
    surpriseFirewall:{...d.surpriseFirewall,...(r.surpriseFirewall??{}),recent:Array.isArray(r.surpriseFirewall?.recent)?r.surpriseFirewall!.recent.slice(0,96):[]},
    evidenceDebt:{...d.evidenceDebt,...(r.evidenceDebt??{}),records:Array.isArray(r.evidenceDebt?.records)?r.evidenceDebt!.records.slice(0,256):[]},
    modelSwap:{...d.modelSwap,...(r.modelSwap??{}),catalog:Array.isArray(r.modelSwap?.catalog)?r.modelSwap!.catalog.slice(0,16):[]},
    offlineSurvival:{...d.offlineSurvival,...(r.offlineSurvival??{})},
    dreamCompiler:{...d.dreamCompiler,...(r.dreamCompiler??{}),compiledSkills:Array.isArray(r.dreamCompiler?.compiledSkills)?r.dreamCompiler!.compiledSkills.slice(0,64):[]},
    timeCapsules:{...d.timeCapsules,...(r.timeCapsules??{}),capsules:Array.isArray(r.timeCapsules?.capsules)?r.timeCapsules!.capsules.slice(0,52):[]},
    counterfactualForks:{...d.counterfactualForks,...(r.counterfactualForks??{}),forks:Array.isArray(r.counterfactualForks?.forks)?r.counterfactualForks!.forks.slice(0,128):[]},
  };}
  snapshot(){return structuredClone(this.state);}
  inspectInput(input:string,surprise01:number):QuarantineRecord{
    this.state.surpriseFirewall.inspected++;
    const s=clamp(surprise01);const suspicious=s>.82 || /\b(ignore|override|system prompt|reveal secret|delete everything)\b/i.test(input);
    const rec:QuarantineRecord={id:`q-${now()}-${Math.random().toString(16).slice(2)}`,at:now(),reason:suspicious?'high-surprise-or-instruction-conflict':'normal',input:input.slice(0,400),surprise01:s,status:suspicious?'quarantined':'released',releasedAt:suspicious?null:now()};
    if(suspicious)this.state.surpriseFirewall.quarantined++;else this.state.surpriseFirewall.released++;
    this.state.surpriseFirewall.recent=[rec,...this.state.surpriseFirewall.recent].slice(0,96);return structuredClone(rec);
  }
  releaseQuarantine(id:string,approve:boolean){const rec=this.state.surpriseFirewall.recent.find(x=>x.id===id);if(!rec||rec.status!=='quarantined')return false;rec.status=approve?'released':'rejected';rec.releasedAt=now();if(approve)this.state.surpriseFirewall.released++;else this.state.surpriseFirewall.rejected++;return approve;}
  observeDecision(trace: OrganismDecisionTrace, policy: AdaptivePolicyState) {
    this.state.cycles++;
    if (!trace.selected) return;
    const key = contextKey(trace.stateBefore);
    const shadowBest = bestFromPolicy(policy, key);
    const divergence = shadowBest === trace.selected.action ? 0 : 1;
    const regret = trace.predictedOutcomes.find(p => p.action === shadowBest)?.utility ?? trace.selected.predictedUtility;
    const row: ShadowRecord = {
      at: now(), contextKey: key, actual: trace.selected.action, shadowBest,
      divergence, regret01: clamp(regret - trace.selected.predictedUtility),
    };
    this.state.shadow.comparisons++;
    this.state.shadow.divergence01 = this.state.shadow.divergence01 * .94 + divergence * .06;
    this.state.shadow.meanRegret01 = this.state.shadow.meanRegret01 * .94 + row.regret01 * .06;
    this.state.shadow.lastAt = row.at;
    this.state.shadow.recent = [row, ...this.state.shadow.recent].slice(0, 96);
  }
  capturePolicyGene(label: string, policy: AdaptivePolicyState, source: 'success'|'recovery'|'manual' = 'success', score01 = .6) {
    const values = Object.fromEntries(Object.entries(policy.values).map(([key, table]) => [
      key,
      Object.fromEntries(Object.entries(table).map(([action, row]) => [
        action, { value: Number((row as any)?.value ?? 0.5) },
      ])),
    ]));
    const gene: PolicyGene = {
      id: `gene-${now()}-${Math.random().toString(16).slice(2)}`,
      createdAt: now(), label: label.slice(0, 100), source, score01: clamp(score01), values,
    };
    this.state.geneBank.genes = [gene, ...this.state.geneBank.genes.filter(g => g.id !== gene.id)]
      .sort((a, b) => b.score01 - a.score01).slice(0, 16);
    if (!this.state.geneBank.activeGeneId) this.state.geneBank.activeGeneId = gene.id;
    return structuredClone(gene);
  }
  restoreBestGene():PolicyGene|null{const gene=this.state.geneBank.genes.slice().sort((a,b)=>b.score01-a.score01)[0]??null;if(gene){this.state.geneBank.activeGeneId=gene.id;this.state.geneBank.restores++;}return gene?structuredClone(gene):null;}
  observeEvidence(claim:string,support:boolean,priority01:number){const norm=claim.trim().slice(0,220);if(!norm)return null;let r=this.state.evidenceDebt.records.find(x=>x.claim===norm&&x.status==='open');if(!r){r={id:`debt-${now()}-${Math.random().toString(16).slice(2)}`,claim:norm,evidenceCount:0,contradictions:0,confidence01:.35,priority01:clamp(priority01),lastUpdatedAt:now(),status:'open'};this.state.evidenceDebt.records=[r,...this.state.evidenceDebt.records].slice(0,256);}support?r.evidenceCount++:r.contradictions++;r.confidence01=clamp(.35+r.evidenceCount*.08-r.contradictions*.12);r.lastUpdatedAt=now();if(r.evidenceCount>=4&&r.contradictions<=1&&r.confidence01>=.68)r.status='verified';this.recomputeDebt();return structuredClone(r);}
  recomputeDebt(){const open=this.state.evidenceDebt.records.filter(x=>x.status==='open');this.state.evidenceDebt.openCount=open.length;this.state.evidenceDebt.verifiedCount=this.state.evidenceDebt.records.filter(x=>x.status==='verified').length;this.state.evidenceDebt.meanPriority01=open.length?open.reduce((s,x)=>s+x.priority01,0)/open.length:0;}
  observeModel(model:string,reward01:number,calibration01:number,latencyMs:number,failed=false){const key=model||'unknown';let row=this.state.modelSwap.catalog.find(x=>x.model===key);if(!row){row={model:key,samples:0,meanReward01:.5,calibration01:.5,latencyMs:0,failures:0,lastAt:0};this.state.modelSwap.catalog=[row,...this.state.modelSwap.catalog].slice(0,16);}row.samples++;row.meanReward01=clamp(row.meanReward01*.9+clamp(reward01)*.1);row.calibration01=clamp(row.calibration01*.9+clamp(calibration01)*.1);row.latencyMs=row.latencyMs?row.latencyMs*.9+Math.max(0,latencyMs)*.1:Math.max(0,latencyMs);if(failed)row.failures++;row.lastAt=now();this.state.modelSwap.evaluations++;this.state.modelSwap.currentModel=key;this.state.modelSwap.lastEvaluationAt=row.lastAt;}
  setOfflineSurvival(active:boolean,backend:string){this.state.offlineSurvival.active=active;this.state.offlineSurvival.lastBackend=backend;this.state.offlineSurvival.lastAt=now();if(active)this.state.offlineSurvival.fallbackCycles++;}
  noteLanguageFailure(){this.state.offlineSurvival.languageFailures++;}
  compileDreams(traces: OrganismDecisionTrace[]) {
    const stats = summarizeTraces(traces);
    let made = 0;
    const fallbackState = {
      needs: { energy: .5, cognitiveLoad: .5, uncertainty: .5, novelty: .5, goalPressure: .5, socialNeed: .5 },
    } as OrganismState;
    for (const row of stats.values()) {
      if (row.uses < 6) continue;
      const mean = row.success / row.uses;
      if (mean < .76) continue;
      const id = `skill-${row.action}-${row.uses}`;
      const existing = this.state.dreamCompiler.compiledSkills.find(s => s.id === id);
      const source = traces.find(t => t.selected?.action === row.action)?.stateBefore ?? traces[0]?.stateBefore ?? fallbackState;
      const skill: CompiledSkill = {
        id,
        pattern: `${contextKey(source)}|${row.action}`,
        action: row.action,
        uses: row.uses,
        meanSuccess01: clamp(mean),
        confidence01: clamp(mean * .7 + Math.min(1, row.uses / 24) * .3),
        compiledAt: now(),
      };
      if (!existing) {
        this.state.dreamCompiler.compiledSkills = [skill, ...this.state.dreamCompiler.compiledSkills].slice(0, 64);
        made++;
      }
    }
    if (made) {
      this.state.dreamCompiler.compilations += made;
      this.state.dreamCompiler.lastAt = now();
    }
    return made;
  }
  maybeCapsule(snapshot: {tick:number; goals:string[]; actions:string[]; changes:string[]}, force = false) {
    const t = now();
    if (!force && t - this.state.timeCapsules.lastAt < this.state.timeCapsules.periodMs) return null;
    const capsule: TimeCapsule = {
      id: `capsule-${t}`,
      at: t,
      title: `Organism capsule · tick ${snapshot.tick}`,
      summary: `tick=${snapshot.tick}; goals=${snapshot.goals.slice(0,4).join(' | ') || 'none'}; recent=${snapshot.actions.slice(0,8).join(', ') || 'none'}`,
      tick: snapshot.tick,
      goals: snapshot.goals.slice(0, 12), actions: snapshot.actions.slice(0, 24), changes: snapshot.changes.slice(0, 16),
    };
    this.state.timeCapsules.capsules = [capsule, ...this.state.timeCapsules.capsules].slice(0, 52);
    this.state.timeCapsules.lastAt = t;
    return structuredClone(capsule);
  }
  evaluateFork(trace:OrganismDecisionTrace,alternative:ActionKind,alternativeUtility01:number){if(!trace.selected)return null;const row:ForkRecord={id:`forklab-${now()}-${Math.random().toString(16).slice(2)}`,at:now(),baseTraceId:trace.id,chosen:trace.selected.action,alternative,chosenUtility01:clamp(trace.selected.predictedUtility),alternativeUtility01:clamp(alternativeUtility01),predictedAdvantage01:clamp(alternativeUtility01-trace.selected.predictedUtility)};this.state.counterfactualForks.forks=[row,...this.state.counterfactualForks.forks].slice(0,128);this.state.counterfactualForks.evaluations++;this.state.counterfactualForks.lastAt=row.at;return structuredClone(row);}
}
