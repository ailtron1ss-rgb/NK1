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

const finN=(v:unknown,f:number):number=>{const n=typeof v==='number'?v:Number(v);return Number.isFinite(n)?n:f;};
const cnt=(v:unknown,f:number):number=>Math.max(0,Math.floor(finN(v,f)));
const act=(v:unknown,f:ActionKind='wait'):ActionKind=>ACTIONS.includes(v as ActionKind)?v as ActionKind:f;
const str=(v:unknown,cap=160):string=>typeof v==='string'?v.slice(0,cap):'';
const sanShadow=(x:unknown):ShadowRecord|null=>{if(!x||typeof x!=='object')return null;const r=x as Record<string,unknown>;return {at:cnt(r.at,0),contextKey:str(r.contextKey,240),actual:act(r.actual),shadowBest:act(r.shadowBest),divergence:clamp(finN(r.divergence,0)),regret01:clamp(finN(r.regret01,0))};};
const sanGene=(x:unknown):PolicyGene|null=>{if(!x||typeof x!=='object')return null;const r=x as Record<string,unknown>;if(typeof r.id!=='string'||!r.id)return null;const src=r.source;const values={} as PolicyGene['values'];if(r.values&&typeof r.values==='object'){for(const [k,v] of Object.entries(r.values as Record<string,unknown>).slice(0,64)){const inner=(v&&typeof v==='object')?v as Record<string,unknown>:{};const row={} as Partial<Record<ActionKind,{value:number}>>;for(const a of ACTIONS)if(inner[a]&&typeof inner[a]==='object'){const cell=inner[a] as Record<string,unknown>;row[a]={value:clamp(finN(cell.value,.5))};}values[str(k,96)]=row;}}return {id:r.id.slice(0,160),createdAt:cnt(r.createdAt,0),label:str(r.label,160),source:src==='success'||src==='recovery'||src==='manual'?src as PolicyGene['source']:'manual',score01:clamp(finN(r.score01,0)),values};};
const sanQuarantine=(x:unknown):QuarantineRecord|null=>{if(!x||typeof x!=='object')return null;const r=x as Record<string,unknown>;if(typeof r.id!=='string'||!r.id)return null;const st=r.status;return {id:r.id.slice(0,160),at:cnt(r.at,0),reason:str(r.reason,240),input:str(r.input,512),surprise01:clamp(finN(r.surprise01,0)),status:st==='quarantined'||st==='released'||st==='rejected'?st as QuarantineRecord['status']:'quarantined',releasedAt:r.releasedAt===null||r.releasedAt===undefined?null:cnt(r.releasedAt,0)};};
const sanEvidenceDebt=(x:unknown):EvidenceDebt|null=>{if(!x||typeof x!=='object')return null;const r=x as Record<string,unknown>;if(typeof r.id!=='string'||!r.id)return null;const st=r.status;return {id:r.id.slice(0,160),claim:str(r.claim,400),evidenceCount:cnt(r.evidenceCount,0),contradictions:cnt(r.contradictions,0),confidence01:clamp(finN(r.confidence01,0)),priority01:clamp(finN(r.priority01,0)),lastUpdatedAt:cnt(r.lastUpdatedAt,0),status:st==='open'||st==='verified'||st==='retired'?st as EvidenceDebt['status']:'open'};};
const sanModelScore=(x:unknown):ModelSwapScore|null=>{if(!x||typeof x!=='object')return null;const r=x as Record<string,unknown>;if(typeof r.model!=='string'||!r.model)return null;return {model:r.model.slice(0,160),samples:cnt(r.samples,0),meanReward01:clamp(finN(r.meanReward01,0)),calibration01:clamp(finN(r.calibration01,0)),latencyMs:Math.max(0,finN(r.latencyMs,0)),failures:cnt(r.failures,0),lastAt:cnt(r.lastAt,0)};};
const sanSkill=(x:unknown):CompiledSkill|null=>{if(!x||typeof x!=='object')return null;const r=x as Record<string,unknown>;if(typeof r.id!=='string'||!r.id)return null;return {id:r.id.slice(0,160),pattern:str(r.pattern,240),action:act(r.action),uses:cnt(r.uses,0),meanSuccess01:clamp(finN(r.meanSuccess01,0)),confidence01:clamp(finN(r.confidence01,0)),compiledAt:cnt(r.compiledAt,0)};};
const strList=(v:unknown,cap:number):string[]=>Array.isArray(v)?v.filter((x):x is string=>typeof x==='string'&&x.length>0).map(x=>x.slice(0,240)).slice(0,cap):[];
const sanCapsule=(x:unknown):TimeCapsule|null=>{if(!x||typeof x!=='object')return null;const r=x as Record<string,unknown>;if(typeof r.id!=='string'||!r.id)return null;return {id:r.id.slice(0,160),at:cnt(r.at,0),title:str(r.title,240),summary:str(r.summary,1000),tick:cnt(r.tick,0),goals:strList(r.goals,16),actions:strList(r.actions,16),changes:strList(r.changes,16)};};
const sanFork=(x:unknown):ForkRecord|null=>{if(!x||typeof x!=='object')return null;const r=x as Record<string,unknown>;if(typeof r.id!=='string'||!r.id)return null;return {id:r.id.slice(0,160),at:cnt(r.at,0),baseTraceId:str(r.baseTraceId,160),chosen:act(r.chosen),alternative:act(r.alternative),chosenUtility01:clamp(finN(r.chosenUtility01,0)),alternativeUtility01:clamp(finN(r.alternativeUtility01,0)),predictedAdvantage01:clamp(finN(r.predictedAdvantage01,0))};};
const rows=<T>(v:unknown,cap:number,fn:(x:unknown)=>T|null):T[]=>Array.isArray(v)?v.slice(0,cap).map(fn).filter((x):x is T=>x!==null):[];
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
  restore(raw?:Partial<AdvancedResilienceState>|null){const d=defaultAdvancedResilience();const src=(raw&&typeof raw==='object')?raw as Record<string,unknown>:{};const read=(k:string):unknown=>{try{return src[k];}catch{return undefined;}};const obj=(k:string):Record<string,unknown>=>{const v=read(k);return (v&&typeof v==='object')?v as Record<string,unknown>:{};};const sh=obj('shadow'),gb=obj('geneBank'),sf=obj('surpriseFirewall'),ed=obj('evidenceDebt'),ms=obj('modelSwap'),os=obj('offlineSurvival'),dc=obj('dreamCompiler'),tc=obj('timeCapsules'),cf=obj('counterfactualForks');const ag=gb.activeGeneId;this.state={version:1,cycles:cnt(read('cycles'),d.cycles),
    shadow:{comparisons:cnt(sh.comparisons,d.shadow.comparisons),divergence01:clamp(finN(sh.divergence01,d.shadow.divergence01)),meanRegret01:clamp(finN(sh.meanRegret01,d.shadow.meanRegret01)),lastAt:cnt(sh.lastAt,d.shadow.lastAt),recent:rows(sh.recent,96,sanShadow)},
    geneBank:{genes:rows(gb.genes,16,sanGene),activeGeneId:typeof ag==='string'&&ag?ag.slice(0,160):null,restores:cnt(gb.restores,d.geneBank.restores)},
    surpriseFirewall:{inspected:cnt(sf.inspected,d.surpriseFirewall.inspected),quarantined:cnt(sf.quarantined,d.surpriseFirewall.quarantined),released:cnt(sf.released,d.surpriseFirewall.released),rejected:cnt(sf.rejected,d.surpriseFirewall.rejected),recent:rows(sf.recent,96,sanQuarantine)},
    evidenceDebt:{records:rows(ed.records,256,sanEvidenceDebt),openCount:cnt(ed.openCount,d.evidenceDebt.openCount),verifiedCount:cnt(ed.verifiedCount,d.evidenceDebt.verifiedCount),meanPriority01:clamp(finN(ed.meanPriority01,d.evidenceDebt.meanPriority01))},
    modelSwap:{currentModel:typeof ms.currentModel==='string'&&ms.currentModel?ms.currentModel.slice(0,160):'unknown',catalog:rows(ms.catalog,16,sanModelScore),evaluations:cnt(ms.evaluations,d.modelSwap.evaluations),lastEvaluationAt:cnt(ms.lastEvaluationAt,d.modelSwap.lastEvaluationAt)},
    offlineSurvival:{languageFailures:cnt(os.languageFailures,d.offlineSurvival.languageFailures),fallbackCycles:cnt(os.fallbackCycles,d.offlineSurvival.fallbackCycles),active:os.active===true,lastBackend:typeof os.lastBackend==='string'&&os.lastBackend?os.lastBackend.slice(0,160):'unknown',lastAt:cnt(os.lastAt,d.offlineSurvival.lastAt)},
    dreamCompiler:{compiledSkills:rows(dc.compiledSkills,64,sanSkill),compilations:cnt(dc.compilations,d.dreamCompiler.compilations),lastAt:cnt(dc.lastAt,d.dreamCompiler.lastAt)},
    timeCapsules:{capsules:rows(tc.capsules,52,sanCapsule),lastAt:cnt(tc.lastAt,d.timeCapsules.lastAt),periodMs:Math.max(0,finN(tc.periodMs,d.timeCapsules.periodMs))},
    counterfactualForks:{forks:rows(cf.forks,128,sanFork),evaluations:cnt(cf.evaluations,d.counterfactualForks.evaluations),lastAt:cnt(cf.lastAt,d.counterfactualForks.lastAt)},
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
