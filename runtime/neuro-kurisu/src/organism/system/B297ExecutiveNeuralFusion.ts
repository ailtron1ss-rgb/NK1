import type { ActionKind } from '../core/types.ts';

const ACTIONS:ActionKind[]=['respond','explore','verify','rest','reflect','wait','defer'];
const SOURCES=['self','personality','agency','predictive','homeostasis','causal','neural','kernel','social','resource','policy'] as const;
type Source=typeof SOURCES[number];
const clamp=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
const signed=(x:number)=>Math.max(-1,Math.min(1,Number.isFinite(x)?x:0));
const normaliseSignal=(x:number)=>signed((Number.isFinite(x)?x:0)/.12);
const actionKey=(a:ActionKind)=>ACTIONS.includes(a)?a:'wait';
const emptySourceMap=()=>Object.fromEntries(SOURCES.map(s=>[s,{}])) as Record<Source,Partial<Record<ActionKind,number>>>;
const defaultReliability=()=>Object.fromEntries(SOURCES.map(s=>[s,s==='policy'?.72:.5])) as Record<Source,number>;
const defaultSourceCredit=()=>Object.fromEntries(SOURCES.map(s=>[s,s==='policy'?.62:.5])) as Record<Source,number>;
const defaultPairRedundancy=()=>{const out:Record<string,number>={}; for(let i=0;i<SOURCES.length;i++) for(let j=i+1;j<SOURCES.length;j++) out[`${SOURCES[i]}|${SOURCES[j]}`]=0; return out;};
const defaultActionReliability=()=>Object.fromEntries(ACTIONS.map(a=>[a,.5])) as Record<ActionKind,number>;

export interface B297ActionFrame { action:ActionKind; fusedSignal01:number; competition01:number; confidence01:number; autonomyContribution01:number; sourceCount:number; dominantSource:Source|null; }
export interface B297State {
  version:1;
  cycles:number;
  outcomeUpdates:number;
  commits:number;
  holds:number;
  sourceReliability:Record<Source,number>;
  sourceCredit:Record<Source,number>;
  sourceCreditUpdates:number;
  pairRedundancy:Record<string,number>;
  actionReliability:Record<ActionKind,number>;
  lastSignals:Record<ActionKind,Partial<Record<Source,number>>>;
  lastAction:ActionKind|null;
  lastAutonomy01:number;
  lastDisagreement01:number;
  lastCommitMargin01:number;
  lastFrame:B297ActionFrame[];
  history:Array<{tick:number;selected:ActionKind;autonomous01:number;disagreement01:number;reward01:number;predicted01:number}>;
  consolidationEvents:number;
  lastEffectiveWeights:Partial<Record<Source,number>>;
  lastDeduplicatedContribution01:number;
  sourceConsolidation01:number;
}
export interface B297Input {
  tick:number;
  candidates:Array<{action:ActionKind;score:number;predictedUtility:number;confidence01:number}>;
  sources:Partial<Record<Source,Partial<Record<ActionKind,number>>>>;
  identity01:number;
  personality01:number;
  agency01:number;
  goalPressure01:number;
  uncertainty01:number;
  novelty01:number;
  energy01:number;
  cognitiveCapacity01:number;
  externalInput:boolean;
  requestedAction?:ActionKind|null;
  facadeIdentity01?:number;
  facadeBudget01?:number;
  facadeAgency01?:number;
  personalityConsolidation01?:number;
  personalityGeneralization01?:number;
}
export interface B297Result {
  candidates:Array<{action:ActionKind;score:number;predictedUtility:number;confidence01:number}>;
  selectedAction:ActionKind|null;
  autonomous01:number;
  disagreement01:number;
  commitMargin01:number;
  actions:B297ActionFrame[];
}

export const defaultB297State=():B297State=>({version:1,cycles:0,outcomeUpdates:0,commits:0,holds:0,sourceReliability:defaultReliability(),sourceCredit:defaultSourceCredit(),sourceCreditUpdates:0,pairRedundancy:defaultPairRedundancy(),actionReliability:defaultActionReliability(),lastSignals:Object.fromEntries(ACTIONS.map(a=>[a,{}])) as Record<ActionKind,Partial<Record<Source,number>>>,lastAction:null,lastAutonomy01:.5,lastDisagreement01:.2,lastCommitMargin01:0,lastFrame:[],history:[],consolidationEvents:0,lastEffectiveWeights:{},lastDeduplicatedContribution01:0,sourceConsolidation01:0});

export class B297ExecutiveNeuralFusion {
  private state=B297ExecutiveNeuralFusion.normalize(defaultB297State());
  private lesions=new Set<Source>();
  private static normalize(raw?:Partial<B297State>|null):B297State{
    const d=defaultB297State(),r=raw??{};
    const lastSignals={...d.lastSignals};
    for(const a of ACTIONS){ const row=(r.lastSignals as any)?.[a]; if(row&&typeof row==='object') lastSignals[a]={...row}; }
    return {
      ...d,...r,version:1,
      sourceReliability:{...d.sourceReliability,...(r.sourceReliability??{})},
      sourceCredit:{...d.sourceCredit,...(r.sourceCredit??{})},
      sourceCreditUpdates:Math.max(0,Math.floor(Number(r.sourceCreditUpdates??0))),
      pairRedundancy:{...d.pairRedundancy,...(r.pairRedundancy??{})},
      actionReliability:{...d.actionReliability,...(r.actionReliability??{})},
      lastSignals,
      lastFrame:Array.isArray(r.lastFrame)?r.lastFrame.slice(-7):[],
      history:Array.isArray(r.history)?r.history.slice(-128):[],
      cycles:Math.max(0,Math.floor(Number(r.cycles??0))),
      outcomeUpdates:Math.max(0,Math.floor(Number(r.outcomeUpdates??0))),
      commits:Math.max(0,Math.floor(Number(r.commits??0))),
      holds:Math.max(0,Math.floor(Number(r.holds??0))),
      lastAction:r.lastAction??null,
      lastAutonomy01:clamp(Number(r.lastAutonomy01??.5)),
      lastDisagreement01:clamp(Number(r.lastDisagreement01??.2)),
      lastCommitMargin01:clamp(Number(r.lastCommitMargin01??0)),
      consolidationEvents:Math.max(0,Math.floor(Number(r.consolidationEvents??0))),
      lastEffectiveWeights:{...(r.lastEffectiveWeights??{})},
      lastDeduplicatedContribution01:clamp(Number(r.lastDeduplicatedContribution01??0)),
      sourceConsolidation01:clamp(Number(r.sourceConsolidation01??0)),
    };
  }
  restore(raw?:Partial<B297State>|null){this.state=B297ExecutiveNeuralFusion.normalize(raw);this.lesions.clear();}
  snapshot(){return structuredClone(this.state);}
  lesion(source:Source,enabled=true){if(enabled)this.lesions.add(source);else this.lesions.delete(source);return {source,lesioned:this.lesions.has(source)};}
  clearLesions(){this.lesions.clear();}
  private reliability(source:Source){
    if(this.lesions.has(source)) return 0;
    const base=clamp(this.state.sourceReliability[source]??.5);
    const credit=clamp(this.state.sourceCredit[source]??.5);
    return clamp(base*(.76+.48*credit));
  }

  fuse(input:B297Input):B297Result{
    const identity=clamp((input.identity01*.75)+(input.facadeIdentity01??input.identity01)*.25);
    const personality=clamp(input.personality01), agency=clamp((input.agency01*.75)+(input.facadeAgency01??input.agency01)*.25);
    const goal=clamp(input.goalPressure01), uncertainty=clamp(input.uncertainty01), novelty=clamp(input.novelty01), energy=clamp(input.energy01), capacity=clamp(input.cognitiveCapacity01), facadeBudget=clamp(input.facadeBudget01??1);
    const candidates=input.candidates.slice(0,7).map(c=>({...c,action:actionKey(c.action),score:clamp(c.score),predictedUtility:clamp(c.predictedUtility),confidence01:clamp(c.confidence01)}));
    const rows:B297ActionFrame[]=[];
    const captured:Record<ActionKind,Partial<Record<Source,number>>>={...Object.fromEntries(ACTIONS.map(a=>[a,{}]))} as any;
    for(const candidate of candidates){
      const values:Partial<Record<Source,number>>={};
      for(const source of SOURCES){ const raw=Number(input.sources[source]?.[candidate.action]??0); values[source]=normaliseSignal(raw); }
      captured[candidate.action]={...values};
      // Only sources that actually emit a meaningful signal enter the fusion
      // denominator. Silent sources remain available for later learning but
      // must not dilute an evidence-bearing source merely by existing.
      const allWeighted=SOURCES.map(source=>{
        const base=this.reliability(source);
        const credit=clamp(this.state.sourceCredit[source]??.5);
        // B311 Evidence Gravity: a source that has accumulated strong, verified
        // predictive credit may exert more executive influence. This is bounded,
        // signed through the existing signal, and only activates above a trust
        // threshold so unverified/noisy sources keep the old gain.
        const personalityConsolidation=clamp(input.personalityConsolidation01??input.personality01);
        const personalityGeneralization=clamp(input.personalityGeneralization01??input.personality01);
        const gravity=source==='policy'
          ? 1 + Math.min(1.4, Math.max(0, (credit-.68)/.32)*1.4)
          : source==='personality'
            ? 1 + Math.min(1.10, Math.max(0, personalityConsolidation-.52)*1.20 + Math.max(0, personalityGeneralization-.50)*0.90)
            : 1;
        return {source,value:signed(values[source]??0),baseWeight:base*gravity,weight:base*gravity};
      }).filter(x=>x.baseWeight>0);
      const weighted=allWeighted.filter(x=>Math.abs(x.value)>.015);
      let pairRedundancy=0,pairs=0;
      for(let i=0;i<weighted.length;i++) for(let j=i+1;j<weighted.length;j++){
        const a=weighted[i],b=weighted[j],key=a.source<b.source?`${a.source}|${b.source}`:`${b.source}|${a.source}`;
        const similarity=Math.min(1,Math.abs(a.value))*Math.min(1,Math.abs(b.value))*(a.value*b.value>=0?1:.25);
        this.state.pairRedundancy[key]=clamp((this.state.pairRedundancy[key]??0)*.985+similarity*.015);
      }
      const activeRedundancies=weighted.map(item=>{
        const peers=weighted.filter(other=>other.source!==item.source);
        if(!peers.length)return {source:item.source,redundancy:0};
        const mean=peers.reduce((sum,other)=>{ const key=item.source<other.source?`${item.source}|${other.source}`:`${other.source}|${item.source}`; return sum+(this.state.pairRedundancy[key]??0); },0)/peers.length;
        return {source:item.source,redundancy:clamp(mean)};
      });
      const effectiveWeights:Partial<Record<Source,number>>={};
      for(const item of allWeighted){
        const redundancy=activeRedundancies.find(x=>x.source===item.source)?.redundancy??0;
        item.weight=item.baseWeight*Math.max(.28,1-redundancy*.52);
        effectiveWeights[item.source]=item.weight;
      }
      for(const item of weighted){
        const redundancy=activeRedundancies.find(x=>x.source===item.source)?.redundancy??0;
        pairRedundancy+=redundancy;pairs++;
      }
      pairRedundancy=pairs?pairRedundancy/pairs:0;
      const effectiveTotal=weighted.reduce((s,x)=>s+x.weight,0);
      const baseTotal=weighted.reduce((s,x)=>s+x.baseWeight,0);
      const weightedMean=effectiveTotal?weighted.reduce((s,x)=>s+x.value*x.weight,0)/effectiveTotal:0;
      const deduplicatedContribution=clamp(1-(effectiveTotal/Math.max(.0001,baseTotal)));
      this.state.lastEffectiveWeights={...effectiveWeights};
      this.state.lastDeduplicatedContribution01=deduplicatedContribution;
      this.state.sourceConsolidation01=clamp(.6*deduplicatedContribution+.4*(1-Math.min(1,pairRedundancy)));
      if(deduplicatedContribution>.015)this.state.consolidationEvents++;
      const redundancyPenalty=clamp(pairRedundancy*.20);
      const competition=clamp(.34*uncertainty+.22*(1-capacity)+.16*(1-energy)+.14*(1-identity)+.14*(1-facadeBudget));
      const personalityAnchor=clamp(.48*identity+.30*personality+.22*agency);
      const autonomyContribution=clamp(.34*agency+.25*goal+.12*novelty+.09*uncertainty+.20*personalityAnchor);
      const personalityActive=Math.abs(values.personality??0)>.015;
      const personalityConsolidation=clamp(input.personalityConsolidation01??personality);
      const personalityGeneralization=clamp(input.personalityGeneralization01??personality);
      const personalityGain=personalityActive
        ? clamp(Math.max(0,personalityConsolidation-.52)*.72 + Math.max(0,personalityGeneralization-.50)*.48)
        : 0;
      const fusedSignal=clamp(weightedMean*(.72+.18*autonomyContribution+.10*identity)*(1-redundancyPenalty)*(1+personalityGain*.28));
      const dominant=weighted.slice().sort((a,b)=>Math.abs(b.value*b.weight)-Math.abs(a.value*a.weight))[0]?.source??null;
      rows.push({action:candidate.action,fusedSignal01:fusedSignal,competition01:competition,confidence01:clamp(candidate.confidence01*(.76+.24*autonomyContribution)*(1-.10*pairRedundancy)),autonomyContribution01:autonomyContribution,sourceCount:weighted.filter(x=>Math.abs(x.value)>.015).length,dominantSource:dominant});
    }
    rows.sort((a,b)=>b.fusedSignal01-a.fusedSignal01);
    const meanSignal=rows.length?rows.reduce((s,r)=>s+r.fusedSignal01,0)/rows.length:0;
    const disagreement=clamp(rows.length?rows.reduce((s,r)=>s+Math.abs(r.fusedSignal01-meanSignal),0)/rows.length*1.8:0);
    const autonomy=clamp((rows.length?Math.max(...rows.map(r=>r.autonomyContribution01)):.5)*(input.externalInput?.86:1));
    const margin=rows.length?clamp(rows[0].fusedSignal01-(rows[1]?.fusedSignal01??0)+.04*(1-disagreement)):0;
    let selected=candidates.slice().sort((a,b)=>{const ba=rows.find(r=>r.action===a.action)?.fusedSignal01??0,bb=rows.find(r=>r.action===b.action)?.fusedSignal01??0;return (b.score+bb*.08)-(a.score+ba*.08);})[0]??null;
    if(input.requestedAction&&input.externalInput){const req=candidates.find(c=>c.action===input.requestedAction);const reqFrame=rows.find(r=>r.action===input.requestedAction);if(req&&reqFrame&&req.score+.04+Math.max(0,(agency-.7)*.05)>=(selected?.score??0))selected=req;}
    const previous=this.state.lastAction,previousScore=previous?candidates.find(c=>c.action===previous)?.score??0:0;
    const policyCredit=clamp(this.state.sourceCredit.policy??.5);
    const policyEvidenceInertiaRelief=policyCredit>.68 ? Math.min(.042,(policyCredit-.68)/.32*.042) : 0;
    const holdThreshold=Math.max(.008,.055+.05*disagreement+.03*(1-capacity)-policyEvidenceInertiaRelief);
    if(previous&&selected&&previous!==selected.action&&selected.score-previousScore<holdThreshold){selected=candidates.find(c=>c.action===previous)??selected;this.state.holds++;}
    if(selected)this.state.commits++;
    this.state.cycles++;this.state.lastAction=selected?.action??null;this.state.lastAutonomy01=autonomy;this.state.lastDisagreement01=disagreement;this.state.lastCommitMargin01=margin;this.state.lastFrame=rows.slice(0,7);this.state.lastSignals=captured;
    const mapped=candidates.map(c=>{
      const f=rows.find(r=>r.action===c.action);
      const policySignal=signed(captured[c.action]?.policy??0);
      const policyCredit=clamp(this.state.sourceCredit.policy??.5);
      const evidenceGravity = policyCredit>.68 && Math.abs(policySignal)>.04
        ? Math.min(.12,((policyCredit-.68)/.32)*.12*Math.min(1,Math.abs(policySignal)))
        : 0;
      const baseDelta=signed(f?.fusedSignal01??0)*.055*(.84+.16*autonomy)*(1-(f?.competition01??0)*.16);
      const policyDelta=policySignal*evidenceGravity*(.82+.18*autonomy);
      const delta=baseDelta+policyDelta;
      return {...c,score:clamp(c.score+delta),predictedUtility:clamp(c.predictedUtility+delta*.60),confidence01:clamp(f?.confidence01??c.confidence01)};
    });
    return {candidates:mapped,selectedAction:selected?.action??null,autonomous01:autonomy,disagreement01:disagreement,commitMargin01:margin,actions:rows};
  }

  recordOutcome(input:{tick:number;action:ActionKind;reward01:number;predictionError01:number;externalEvidence01:number;verified01?:number;independent01?:number;autonomous01?:number}){
    const action=actionKey(input.action),target=signed(clamp(input.reward01)-.5)*2,surprise=clamp(input.predictionError01),grounded=clamp(input.externalEvidence01);
    const verified=clamp(input.verified01??grounded),independent=clamp(input.independent01??0),autonomous=clamp(input.autonomous01??0);
    const lr=.018+.020*surprise+.012*grounded+.018*verified+.008*independent;
    const signals=this.state.lastSignals[action]??{};
    for(const source of SOURCES){
      const signal=signed(signals[source]??0);
      const hasEvidence=Math.abs(signal)>.015;
      if(hasEvidence){
        const alignment=1-Math.abs(target-signal);
        const delta=(alignment-.5)*lr;
        this.state.sourceReliability[source]=clamp((this.state.sourceReliability[source]??.5)+delta);
      }
      const directional=hasEvidence&&target!==0?target*signal:0;
      const evidenceGate=.22+.30*grounded+.28*verified+.12*independent+.08*autonomous;
      const creditTarget=clamp(.5+directional*.5);
      const creditRate=Math.min(.16,.035+evidenceGate*.08)/(1+Math.min(24,this.state.sourceCreditUpdates)*.008);
      this.state.sourceCredit[source]=clamp((this.state.sourceCredit[source]??.5)+(creditTarget-(this.state.sourceCredit[source]??.5))*creditRate);
    }
    this.state.sourceCreditUpdates++;
    this.state.actionReliability[action]=clamp((this.state.actionReliability[action]??.5)*.94+clamp(input.reward01)*.06);this.state.outcomeUpdates++;
    this.state.history=[{tick:Math.max(0,Math.floor(input.tick)),selected:action,autonomous01:this.state.lastAutonomy01,disagreement01:this.state.lastDisagreement01,reward01:clamp(input.reward01),predicted01:clamp(.5+Number(signals.neural??0)*.12)},...this.state.history].slice(0,128);
  }
  diagnostics(){
    const reliability=Object.entries(this.state.sourceReliability).sort((a,b)=>b[1]-a[1]);
    const redundant=Object.entries(this.state.pairRedundancy).filter(([,v])=>v>.25).sort((a,b)=>b[1]-a[1]).slice(0,8);
    const highRedundancy=redundant.filter(([,v])=>v>.65);
    return {
      version:1,cycles:this.state.cycles,outcomeUpdates:this.state.outcomeUpdates,commits:this.state.commits,holds:this.state.holds,lesions:Array.from(this.lesions),
      meanSourceReliability:reliability.reduce((s,[,v])=>s+v,0)/SOURCES.length,topSources:reliability.slice(0,6),
      sourceCreditUpdates:this.state.sourceCreditUpdates,sourceCredit:{...this.state.sourceCredit},sourceReliability:{...this.state.sourceReliability},topCreditedSources:Object.entries(this.state.sourceCredit).sort((a,b)=>b[1]-a[1]).slice(0,6),
      redundantPairs:redundant,highRedundancy,lastAutonomy01:this.state.lastAutonomy01,lastDisagreement01:this.state.lastDisagreement01,lastCommitMargin01:this.state.lastCommitMargin01,lastAction:this.state.lastAction,historyDepth:this.state.history.length,
      consolidationEvents:this.state.consolidationEvents,lastEffectiveWeights:{...this.state.lastEffectiveWeights},lastDeduplicatedContribution01:this.state.lastDeduplicatedContribution01,sourceConsolidation01:this.state.sourceConsolidation01,sourceCount:SOURCES.length,
    };
  }
}
