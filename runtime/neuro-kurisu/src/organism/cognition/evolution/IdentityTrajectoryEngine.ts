import type { AdaptiveValueWeights } from '../ValuePlasticity.ts';
import type { SelfProject } from './SelfProjectEngine.ts';
import type { ActionKind } from '../../core/types.ts';

export interface IdentityTrajectorySnapshot {
  version:2;
  samples:number;
  continuity:number;
  trajectoryStability:number;
  projectContinuity:number;
  valueContinuity:number;
  narrativeContinuity:number;
  authoredContinuity:number;
  chapters:string[];
  anchorValues:number[];
  anchorProjects:string[];
  actionBiases:Partial<Record<ActionKind,number>>;
  outcomeSamples:number;
  positiveOutcomeStreak:number;
  negativeOutcomeStreak:number;
  developmentalPressure01:number;
  pathDependence01:number;
  dominantDirection:string;
  recentPath:string[];
  lastAction:ActionKind|'none';
  lastOutcome01:number|null;
  lastPhase:string;
  lastAttractor:string;
  lastAt:number;
}

const ACTIONS:ActionKind[]=['respond','explore','verify','rest','reflect','wait','defer'];
const clamp=(n:number)=>Math.max(0,Math.min(1,Number.isFinite(n)?n:0));
const signed=(n:number,limit=.06)=>Math.max(-limit,Math.min(limit,Number.isFinite(n)?n:0));
const vector=(v:AdaptiveValueWeights)=>[v.curiosity,v.truth,v.autonomy,v.evidence,v.care,v.responsibility,v.social];
const dist=(a:number[],b:number[])=>Math.sqrt(a.reduce((s,x,i)=>s+(x-(b[i]??0))**2,0)/Math.max(1,a.length));
const outcomeBin=(x:number)=>x<.38?'L':x>.62?'H':'M';

export function defaultIdentityTrajectory():IdentityTrajectorySnapshot{return{
  version:2,samples:0,continuity:0.8,trajectoryStability:0.8,projectContinuity:0.5,valueContinuity:1,
  narrativeContinuity:0.5,authoredContinuity:0.5,chapters:[],anchorValues:[],anchorProjects:[],actionBiases:{},
  outcomeSamples:0,positiveOutcomeStreak:0,negativeOutcomeStreak:0,developmentalPressure01:0,pathDependence01:0.15,
  dominantDirection:'stabilizing',recentPath:[],lastAction:'none',lastOutcome01:null,lastPhase:'stabilizing',lastAttractor:'curiosity',lastAt:0,
};}

/**
 * Evolution-domain state. It is persistent developmental history, not personality truth:
 * verified/external consequences and ordinary runtime outcomes can bias future action choice
 * without directly rewriting identity, values, memory or goals.
 */
export class IdentityTrajectoryEngine{
  private state=defaultIdentityTrajectory();
  private previousValues:number[]|null=null;
  private previousProjects:string[]=[];

  restore(v:IdentityTrajectorySnapshot|undefined){
    const d=defaultIdentityTrajectory();
    const raw=v as any;
    this.state={...d,...(raw||{}),version:2,
      chapters:[...(raw?.chapters||[])].slice(-64),anchorValues:[...(raw?.anchorValues||[])],anchorProjects:[...(raw?.anchorProjects||[])],
      actionBiases:{...(raw?.actionBiases||{})},recentPath:[...(raw?.recentPath||[])].slice(-12)};
    this.previousValues=this.state.anchorValues.length?[...this.state.anchorValues]:null;
    this.previousProjects=[...this.state.anchorProjects];
  }
  snapshot(){return structuredClone(this.state);}

  update(input:{values:AdaptiveValueWeights;activeProjects:SelfProject[];narrativeContinuity:number;authoredContinuity:number}){
    const vals=vector(input.values);
    const valueContinuity=this.previousValues?clamp(1-dist(vals,this.previousValues)*2.2):1;
    const projects=input.activeProjects.map(p=>p.id);
    const overlap=this.previousProjects.length&&projects.length
      ?projects.filter(p=>this.previousProjects.includes(p)).length/Math.max(1,Math.min(projects.length,this.previousProjects.length))
      :projects.length?0.5:1;
    const projectContinuity=clamp(overlap);
    const stability=clamp(valueContinuity*0.42+projectContinuity*0.25+clamp(input.narrativeContinuity)*0.18+clamp(input.authoredContinuity)*0.15);
    const pathInfluence=clamp(this.state.pathDependence01);
    this.state={...this.state,
      continuity:clamp(this.state.continuity*0.85+stability*0.15),
      trajectoryStability:clamp(this.state.trajectoryStability*0.82+stability*0.18*(1-pathInfluence*.3)+pathInfluence*.03),
      projectContinuity,valueContinuity,narrativeContinuity:clamp(input.narrativeContinuity),authoredContinuity:clamp(input.authoredContinuity),
      samples:this.state.samples+1,lastAt:Date.now(),
    };
    this.previousValues=vals;this.previousProjects=projects;this.state.anchorValues=[...vals];this.state.anchorProjects=[...projects];
    return this.snapshot();
  }

  /**
   * Causal carry-over from action consequences into the developmental trajectory.
   * The effect is deliberately small, bounded and context-light: it records path dependence
   * rather than becoming a second policy engine. Stronger trust gets stronger carry-over.
   */
  observeOutcome(input:{
    action:ActionKind|string;success01:number;surprise01:number;trust01:number;phase?:string;attractor?:string;
    motive?:string;goalFamily?:string;identityPressure01?:number;predictionError01?:number;
  }){
    const action=(ACTIONS.includes(input.action as ActionKind)?input.action as ActionKind:'wait');
    const success=clamp(input.success01); const surprise=clamp(input.surprise01); const trust=clamp(input.trust01);
    const phase=String(input.phase||'stabilizing').slice(0,32); const attractor=String(input.attractor||'curiosity').slice(0,32);
    const goal=String(input.goalFamily||'none').trim().toLowerCase().replace(/[^a-z0-9_-]/g,'_').slice(0,32)||'none';
    const signedOutcome=success-.5;
    const learningRate=(.022+trust*.024)*(0.65+surprise*.35);
    for(const candidate of ACTIONS){
      const prior=Number(this.state.actionBiases[candidate]??0)*.994;
      const same=candidate===action;
      const delta=same?signedOutcome*learningRate:0;
      this.state.actionBiases[candidate]=signed(prior+delta,.085);
    }
    const previousDirection=this.state.dominantDirection;
    const direction=phase==='repairing'?'repair':phase==='revising'?'verify':phase==='exploring'?'explore':
      attractor==='connection'?'connect':attractor==='care'?'care':attractor==='autonomy'?'autonomy':
      attractor==='truthfulness'?'verify':attractor==='exploration'||attractor==='curiosity'?'explore':'stabilize';
    const pathToken=`${action}:${outcomeBin(success)}:${phase}:${attractor}:${goal}`;
    const previousToken=this.state.recentPath.at(-1);
    const repeated=Boolean(previousToken&&previousToken===pathToken);
    const pressure=clamp((input.identityPressure01??0)*.44+(input.predictionError01??surprise)*.36+surprise*.20);
    this.state.developmentalPressure01=clamp(this.state.developmentalPressure01*.92+pressure*.08);
    this.state.pathDependence01=clamp(this.state.pathDependence01*.97+(repeated?.04:0)+Math.min(.03,Math.abs(signedOutcome)*.04)+trust*.008);
    this.state.outcomeSamples+=1;
    this.state.positiveOutcomeStreak=success>.62?this.state.positiveOutcomeStreak+1:0;
    this.state.negativeOutcomeStreak=success<.38?this.state.negativeOutcomeStreak+1:0;
    const directionConsistency=previousDirection===direction?1:0;
    this.state.trajectoryStability=clamp(this.state.trajectoryStability*.94+directionConsistency*.025+(1-Math.abs(signedOutcome))*.012);
    this.state.dominantDirection=direction;
    this.state.recentPath=[...this.state.recentPath,pathToken].slice(-12);
    this.state.lastAction=action;this.state.lastOutcome01=success;this.state.lastPhase=phase;this.state.lastAttractor=attractor;this.state.lastAt=Date.now();
    return this.snapshot();
  }

  actionBias(action:ActionKind){
    const raw=Number(this.state.actionBiases[action]??0);
    // Additional gating prevents a single surprising outcome from steering choice.
    const evidenceGate=clamp(this.state.outcomeSamples/6);
    const pathGate=clamp(.55+this.state.pathDependence01*.45);
    return signed(raw*evidenceGate*pathGate,.05);
  }

  /** Evidence-gated memory-to-identity bridge. Memory may only alter path-dependence
   * after repeated outcomes and independent support; a single vivid episode never rewrites identity. */
  observeMemoryInfluence(input:{magnitude01:number;independentSources:number;outcomeCount:number;verified:boolean;memoryIds?:string[];at?:number}){
    const magnitude=clamp(input.magnitude01);
    const gate=clamp(Math.min(1,input.independentSources/2)*.45 + Math.min(1,input.outcomeCount/3)*.35 + (input.verified?.20:0));
    if(gate<.78 || magnitude<.18) return {applied:false,gate,magnitude01:magnitude,state:this.snapshot()};
    const delta=Math.min(.035, magnitude*.028*gate);
    this.state.pathDependence01=clamp(this.state.pathDependence01+delta);
    this.state.developmentalPressure01=clamp(this.state.developmentalPressure01+delta*.35);
    this.state.lastAt=Number(input.at??Date.now());
    const ids=(input.memoryIds??[]).slice(0,3).join(',');
    if(ids) this.state.recentPath=[...this.state.recentPath,`memory:${ids}:influence:${delta.toFixed(4)}`].slice(-12);
    return {applied:true,gate,magnitude01:magnitude,delta,pathDependence01:this.state.pathDependence01,state:this.snapshot()};
  }

  /** Evidence-gated value revision enters trajectory memory immediately.
   * It does not replace the identity model; it records a bounded authored change that
   * the next normal update can incorporate into continuity/stability.
   */
  observeValueRevision(input:{value:string;before:number;after:number;delta:number;evidence01:number;success01:number;at?:number}){
    const magnitude=clamp(Math.abs(input.delta));
    const evidence=clamp(input.evidence01); const success=clamp(input.success01);
    if(magnitude<0.0005 || evidence<0.55) return {applied:false,state:this.snapshot()};
    const pressure=clamp(magnitude*8*evidence);
    this.state.developmentalPressure01=clamp(this.state.developmentalPressure01*.94+pressure*.06);
    this.state.pathDependence01=clamp(this.state.pathDependence01*.975+magnitude*.12*evidence);
    this.state.trajectoryStability=clamp(this.state.trajectoryStability*.985+Math.min(.012,evidence*.008+success*.004));
    this.state.lastAt=Number(input.at??Date.now());
    this.state.recentPath=[...this.state.recentPath,`value:${input.value}:${input.before.toFixed(4)}>${input.after.toFixed(4)}`].slice(-12);
    this.noteChapter(`Value revision: ${input.value} ${input.before.toFixed(3)}→${input.after.toFixed(3)}`);
    return {applied:true,pressure01:pressure,pathDependence01:this.state.pathDependence01,state:this.snapshot()};
  }

  noteChapter(title:string){const cleanTitle=title.trim().slice(0,180);if(!cleanTitle)return;this.state.chapters=[cleanTitle,...this.state.chapters].slice(0,64);this.state.lastAt=Date.now();}
}
