import type { IntentCandidate, OrganismState } from '../core/types.ts';

export type ShadowLens = 'balanced'|'cautious'|'epistemic'|'goal'|'frugal';

export interface ShadowPanelEntry {
  lens:ShadowLens;
  action:string;
  confidence01:number;
  score01:number;
}

export interface ShadowDecision {
  tick:number;
  contextKey:string;
  shadowAction:string;
  actualAction:string;
  divergence01:number;
  confidence01:number;
  disagreement01:number;
  entropy01:number;
  escalation:boolean;
  panel:ShadowPanelEntry[];
  at:number;
}

export interface ShadowOrganismState {
  version:3;
  comparisons:number;
  divergence01:number;
  ensembleDisagreement01:number;
  meanRegret01:number;
  escalations:number;
  lastEscalationTick:number;
  lastAt:number;
  recent:ShadowDecision[];
}

const clamp=(n:number)=>Math.max(0,Math.min(1,Number.isFinite(n)?n:0));
const LENSES:ShadowLens[]=['balanced','cautious','epistemic','goal','frugal'];

export const defaultShadowOrganism=():ShadowOrganismState=>({
  version:3,
  comparisons:0,
  divergence01:0,
  ensembleDisagreement01:0,
  meanRegret01:0,
  escalations:0,
  lastEscalationTick:-999999,
  lastAt:0,
  recent:[],
});

function normalizedEntropy(counts:Map<string,number>):number{
  const total=[...counts.values()].reduce((a,b)=>a+b,0)||1;
  const k=Math.max(2,counts.size);
  let h=0;
  for(const count of counts.values()){
    const p=count/total;
    if(p>0) h-=p*Math.log(p);
  }
  return clamp(h/Math.log(k));
}

function lensScore(lens:ShadowLens,c:IntentCandidate):number{
  const utility=clamp(c.predictedUtility);
  const confidence=clamp(c.confidence);
  const relief=clamp(c.predictedNeedRelief);
  const cost=clamp(c.predictedCost);
  if(lens==='cautious') return clamp(utility*.52+confidence*.28+relief*.10-cost*.18);
  if(lens==='epistemic') return clamp(utility*.42+confidence*.36+relief*.14+(c.action==='verify'?.10:0)-cost*.06);
  if(lens==='goal') return clamp(utility*.60+relief*.30+confidence*.10-cost*.06);
  if(lens==='frugal') return clamp(utility*.54+confidence*.16+relief*.10+(c.action==='rest'?.08:0)-cost*.28);
  return clamp(utility*.64+confidence*.20+relief*.10-cost*.08+(c.action==='verify'?.04:c.action==='explore'?.03:c.action==='reflect'?.02:0));
}

function chooseForLens(lens:ShadowLens,candidates:IntentCandidate[]):ShadowPanelEntry|null{
  if(!candidates.length)return null;
  let best:IntentCandidate|null=null;
  let bestScore=-Infinity;
  for(const c of candidates){
    const s=lensScore(lens,c);
    if(s>bestScore){bestScore=s;best=c;}
  }
  return best?{lens,action:best.action,confidence01:clamp(best.confidence),score01:clamp(bestScore)}:null;
}

export interface ShadowSummary { ensembleDisagreement01:number; escalations:number; recent:Array<{escalation?:boolean}>; }

export class ShadowOrganismEngine{
  private state=defaultShadowOrganism();

  restore(raw?:Partial<ShadowOrganismState>|null){
    const d=defaultShadowOrganism();
    const legacyDivergence=clamp(Number(raw?.divergence01??0));
    this.state={
      ...d,
      ...(raw??{}),
      version:3,
      divergence01:legacyDivergence,
      ensembleDisagreement01:clamp(Number(raw?.ensembleDisagreement01??legacyDivergence)),
      escalations:Math.max(0,Math.floor(Number(raw?.escalations??0))),
      lastEscalationTick:Number.isFinite(Number((raw as any)?.lastEscalationTick))?Number((raw as any).lastEscalationTick):-999999,
      recent:Array.isArray(raw?.recent)?raw!.recent.slice(-96).map((x:any)=>({
        tick:Number(x?.tick??0),
        contextKey:String(x?.contextKey??''),
        shadowAction:String(x?.shadowAction??'wait'),
        actualAction:String(x?.actualAction??'wait'),
        divergence01:clamp(Number(x?.divergence01??0)),
        confidence01:clamp(Number(x?.confidence01??0)),
        disagreement01:clamp(Number(x?.disagreement01??x?.divergence01??0)),
        entropy01:clamp(Number(x?.entropy01??x?.disagreement01??x?.divergence01??0)),
        escalation:Boolean(x?.escalation),
        panel:Array.isArray(x?.panel)?x.panel.slice(0,5).map((p:any)=>({lens:String(p?.lens??'balanced') as ShadowLens,action:String(p?.action??'wait'),confidence01:clamp(Number(p?.confidence01??0)),score01:clamp(Number(p?.score01??0))})):[],
        at:Number(x?.at??Date.now()),
      })):[],
    };
  }

  snapshot(){return structuredClone(this.state);}
  planningSummary():ShadowSummary {
    const latest=this.state.recent[0];
    return { ensembleDisagreement01:this.state.ensembleDisagreement01, escalations:this.state.escalations, recent:latest? [{ escalation: latest.escalation }]:[] };
  }

  decide(input:{state:OrganismState;candidates:IntentCandidate[];actualAction:string;pressure01?:number;forceDeep?:boolean}){
    const panel=LENSES.map(lens=>chooseForLens(lens,input.candidates)).filter(Boolean) as ShadowPanelEntry[];
    const counts=new Map<string,number>();
    for(const p of panel) counts.set(p.action,(counts.get(p.action)??0)+1);
    let consensus='wait'; let consensusCount=0;
    for(const [action,count] of counts){if(count>consensusCount){consensus=action;consensusCount=count;}}
    const disagreement=panel.length?1-(consensusCount/panel.length):0;
    const entropy=normalizedEntropy(counts);
    const divergence=consensus===input.actualAction?0:1;
    const pressure=clamp(input.pressure01??0);
    const rawEscalation=Boolean(input.forceDeep) || (disagreement>=.60 && entropy>=.88) || (pressure>.92 && disagreement>=.45);
    const withinCooldown=input.state.tick-this.state.lastEscalationTick<4;
    const escalation=rawEscalation && (!withinCooldown || Boolean(input.forceDeep) || disagreement>=.85);
    const confidence=panel.length?clamp((panel.reduce((s,p)=>s+p.confidence01,0)/panel.length)*(1-disagreement*.55)):0;
    const d:ShadowDecision={
      tick:input.state.tick,
      contextKey:`e=${input.state.needs.energy.toFixed(2)}|u=${input.state.needs.uncertainty.toFixed(2)}|c=${input.state.needs.cognitiveLoad.toFixed(2)}`,
      shadowAction:consensus,
      actualAction:input.actualAction,
      divergence01:divergence,
      confidence01:confidence,
      disagreement01:clamp(disagreement),
      entropy01:clamp(entropy),
      escalation,
      panel,
      at:Date.now(),
    };
    this.state.comparisons++;
    this.state.divergence01=clamp(this.state.divergence01*.94+divergence*.06);
    this.state.ensembleDisagreement01=clamp(this.state.ensembleDisagreement01*.90+disagreement*.10);
    if(escalation){this.state.escalations++;this.state.lastEscalationTick=input.state.tick;}
    this.state.lastAt=d.at;
    this.state.recent=[d,...this.state.recent].slice(0,96);
    return structuredClone(d);
  }

  observeOutcome(input:{tick:number;actualSuccess:number;actualAction:string}){
    const d=this.state.recent.find(x=>x.tick===input.tick);
    if(!d)return null;
    const success=clamp(input.actualSuccess);
    const mismatch=d.shadowAction!==input.actualAction;
    const regret=mismatch?clamp((.5+success*.5)*.35*(.55+d.confidence01*.45)):0;
    this.state.meanRegret01=clamp(this.state.meanRegret01*.94+regret*.06);
    return regret;
  }
}
