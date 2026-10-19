import type { ActionKind } from '../../core/types.ts';

export type AttractorKind='curiosity'|'truthfulness'|'autonomy'|'care'|'responsibility'|'exploration'|'repair'|'connection';
export interface DevelopmentalAttractor {
  id:AttractorKind;
  strength01:number;
  stability01:number;
  confidence01:number;
  support01:number;
  contradiction01:number;
  activations:number;
  successes:number;
  failures:number;
  actionAffinity:Partial<Record<ActionKind,number>>;
  lastEvidenceKey:string;
  lastAt:number;
}
export interface DevelopmentalAttractorFieldState {
  version:1;
  observations:number;
  duplicateObservations:number;
  revisions:number;
  lastAt:number;
  lastPhase:string;
  dominant:AttractorKind;
  attractors:DevelopmentalAttractor[];
  seenEvidenceKeys:string[];
}
const ACTIONS:ActionKind[]=['respond','explore','verify','rest','reflect','wait','defer'];
const clamp=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
const unique=(xs:string[],limit:number)=>[...new Set(xs.filter(Boolean))].slice(-limit);

export const defaultDevelopmentalAttractorField=():DevelopmentalAttractorFieldState=>({
  version:1,observations:0,duplicateObservations:0,revisions:0,lastAt:0,lastPhase:'stabilizing',dominant:'curiosity',
  attractors:(['curiosity','truthfulness','autonomy','care','responsibility','exploration','repair','connection'] as AttractorKind[]).map(id=>({
    id,strength01:id==='truthfulness'?.74:id==='responsibility'?.58:id==='curiosity'?.62:id==='autonomy'?.5:.42,
    stability01:.35,confidence01:.35,support01:0,contradiction01:0,activations:0,successes:0,failures:0,actionAffinity:{},lastEvidenceKey:'',lastAt:0,
  })),
  seenEvidenceKeys:[],
});

function baselineValue(id:AttractorKind,v:any){
  return id==='curiosity'?v.curiosity:id==='truthfulness'?v.truth:id==='autonomy'?v.autonomy:id==='care'?v.care:id==='responsibility'?v.responsibility:id==='exploration'?Math.max(v.curiosity,v.autonomy):id==='repair'?v.evidence:id==='connection'?v.social:.5;
}
function actionMap(id:AttractorKind):Partial<Record<ActionKind,number>>{
  switch(id){
    case 'curiosity': return {explore:.12,verify:.07,reflect:.03};
    case 'truthfulness': return {verify:.14,reflect:.05,respond:.02};
    case 'autonomy': return {explore:.07,defer:-.03,respond:.02};
    case 'care': return {respond:.08,rest:.03,reflect:.03};
    case 'responsibility': return {verify:.06,respond:.05,reflect:.03};
    case 'exploration': return {explore:.14,verify:.03};
    case 'repair': return {reflect:.12,verify:.08,rest:.03};
    case 'connection': return {respond:.11,reflect:.03};
  }
}

export class DevelopmentalAttractorField {
  private state=defaultDevelopmentalAttractorField();
  restore(raw?:Partial<DevelopmentalAttractorFieldState>|null){
    const d=defaultDevelopmentalAttractorField(),r=raw??{};
    this.state={...d,...r,
      attractors:Array.isArray(r.attractors)?r.attractors.slice(0,8).map((a:any)=>({...d.attractors.find(x=>x.id===a.id)??d.attractors[0],...a,actionAffinity:{...(a.actionAffinity??{})}})):d.attractors,
      seenEvidenceKeys:Array.isArray(r.seenEvidenceKeys)?r.seenEvidenceKeys.slice(-256):[]
    };
  }
  snapshot(){return structuredClone(this.state);}
  observe(input:{evidenceKey:string;at:number;action:ActionKind;success01:number|null;predictionError01:number;uncertainty01:number;novelty01:number;socialNeed01:number;identityPressure01:number;counterEvidence01:number;phase:string;values:{curiosity:number;truth:number;autonomy:number;care:number;responsibility:number;evidence:number;social:number};motiveOverall01:number;motiveConflict01:number}){
    const key=String(input.evidenceKey||'').slice(0,160);
    if(key&&this.state.seenEvidenceKeys.includes(key)){this.state.duplicateObservations++;return this.snapshot();}
    if(key)this.state.seenEvidenceKeys=unique([...this.state.seenEvidenceKeys,key],256);
    this.state.observations++;
    const success=input.success01==null?0.5:clamp(input.success01);
    const surprise=clamp(input.predictionError01);
    const contradiction=clamp(input.counterEvidence01 + input.motiveConflict01*.35);
    const support=clamp(success*.35+(1-surprise)*.2+input.motiveOverall01*.15+Math.max(0,1-contradiction)*.3);
    const values=input.values;
    for(const a of this.state.attractors){
      const alignment=clamp((baselineValue(a.id,values)+ (a.id==='repair'&&input.phase==='repairing'?0.25:0) + (a.id==='exploration'&&input.phase==='exploring'?0.2:0) + (a.id==='truthfulness'&&input.phase==='revising'?0.18:0))/1.18);
      const relevance=clamp(.18+alignment*.42+(a.id==='connection'?input.socialNeed01*.18:0)+(a.id==='care'?input.socialNeed01*.12:0));
      const signed=(support-.5)*.045*relevance - contradiction*.028*relevance;
      const old=a.strength01;
      a.strength01=clamp(a.strength01*.985+baselineValue(a.id,values)*.008+signed);
      a.support01=clamp(a.support01*.92+support*.08);
      a.contradiction01=clamp(a.contradiction01*.9+contradiction*.1);
      a.stability01=clamp(a.stability01*.94+(1-Math.abs(a.strength01-old)*8)*.06);
      a.confidence01=clamp(a.confidence01*.96+(support*(1-contradiction))*.04);
      a.activations += relevance>.54?1:0;
      if(success>.62){a.successes += 1;} else if(success<.38){a.failures += 1;}
      const map=actionMap(a.id);
      for(const action of ACTIONS){
        const prior=a.actionAffinity[action]??map[action]??0;
        const observed=action===input.action ? (success-.5)*.09 : 0;
        a.actionAffinity[action]=Math.max(-.12,Math.min(.16,prior*.985+observed*relevance));
      }
      if(key&&a.id===this.state.dominant)a.lastEvidenceKey=key;
      a.lastAt=input.at;
    }
    this.state.revisions++;
    this.state.lastAt=input.at;
    const ranked=[...this.state.attractors].sort((a,b)=>b.strength01*b.stability01-a.strength01*a.stability01);
    this.state.dominant=ranked[0]?.id??'curiosity';
    this.state.lastPhase=input.phase;
    return this.snapshot();
  }
  actionBias(action:ActionKind, context:{phase:string;energy01:number;thermal01:number;uncertainty01:number;socialNeed01:number}):number{
    const ranked=[...this.state.attractors].sort((a,b)=>b.strength01*b.stability01-a.strength01*a.stability01).slice(0,5);
    let value=0;
    for(const a of ranked)value+=(a.actionAffinity[action]??0)*(.45+a.strength01*.55);
    if(context.phase==='repairing'&&action==='reflect')value+=.022;
    if(context.phase==='revising'&&action==='verify')value+=.024;
    if(context.phase==='exploring'&&action==='explore')value+=.022;
    if(context.energy01<.3&&action==='rest')value+=.04;
    if(context.thermal01>.75&&(action==='rest'||action==='wait'))value+=.025;
    if(context.uncertainty01>.68&&action==='verify')value+=.02;
    return Math.max(-.14,Math.min(.18,value*.22));
  }
  motiveBias(kind:AttractorKind){const a=this.state.attractors.find(x=>x.id===kind);return a?clamp(a.strength01*.58+a.stability01*.18+a.confidence01*.24):0;}
  summary(){
    const ranked=[...this.state.attractors].sort((a,b)=>b.strength01*b.stability01-a.strength01*a.stability01);
    return {version:1,observations:this.state.observations,duplicateObservations:this.state.duplicateObservations,revisions:this.state.revisions,lastAt:this.state.lastAt,lastPhase:this.state.lastPhase,dominant:this.state.dominant,fieldStrength01:clamp(ranked.slice(0,4).reduce((s,a)=>s+a.strength01*a.stability01,0)/Math.max(1,Math.min(4,ranked.length))),attractors:ranked.map(a=>({id:a.id,strength01:a.strength01,stability01:a.stability01,confidence01:a.confidence01,support01:a.support01,contradiction01:a.contradiction01,activations:a.activations,successes:a.successes,failures:a.failures})),nonConsciousnessClaim:true};
  }
}
