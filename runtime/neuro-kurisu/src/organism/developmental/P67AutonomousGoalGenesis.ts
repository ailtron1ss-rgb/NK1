import type { AdaptiveValueWeights } from '../cognition/ValuePlasticity.ts';
import { snapshotPlainData } from '../core/PlainDataSnapshot.ts';
/**
 * P67 — Autonomous Goal Genesis.
 *
 * Generates bounded intrinsic/homeostatic/learned goal proposals from unresolved
 * pressures. The core may promote a proposal to a real organism goal, but the
 * generator itself never executes actions and never overrides identity safeguards.
 */
const clamp=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
export interface P67Candidate {id:string;tick:number;at:number;title:string;reason:string;source:'intrinsic'|'homeostatic'|'learned';importance:number;urgency:number;confidence:number;parentId?:string;valueFocus?:string;valueAlignment01?:number;}
export interface P67DecisionReceipt {id:string;decision:'promoted'|'rejected';at:number;}
export interface P67State {version:1;cycles:number;proposals:number;promoted:number;rejected:number;cooldowns:number;lastGeneratedAt:number;generatedIds:string[];history:P67Candidate[];decisions:P67DecisionReceipt[];}
export const defaultP67=():P67State=>({version:1,cycles:0,proposals:0,promoted:0,rejected:0,cooldowns:0,lastGeneratedAt:0,generatedIds:[],history:[],decisions:[]});
const isUnit=(value:unknown):value is number=>typeof value==='number'&&Number.isFinite(value)&&value>=0&&value<=1;
const safeCount=(value:unknown,fallback=0)=>Number.isSafeInteger(value)&&Number(value)>=0?Number(value):fallback;
function stableId(tick:number,title:string){let h=2166136261>>>0;for(const c of `${tick}|${title}`)h=Math.imul(h^c.charCodeAt(0),16777619)>>>0;return `p67:${tick}:${h.toString(16)}`;}
function normalizeCandidate(raw:unknown,generatedIds:Set<string>):P67Candidate|null{
 if(!raw||typeof raw!=='object'||Array.isArray(raw))return null;
 const r=raw as Record<string,unknown>;
 const id=typeof r.id==='string'?r.id:'';
 const tick=r.tick,at=r.at,title=r.title,reason=r.reason,source=r.source;
 if(!generatedIds.has(id)||!Number.isSafeInteger(tick)||Number(tick)<0||typeof at!=='number'||!Number.isFinite(at)||at<0||
    typeof title!=='string'||!title.trim()||title.length>240||typeof reason!=='string'||!reason.trim()||reason.length>512||
    !['intrinsic','homeostatic','learned'].includes(String(source))||
    !isUnit(r.importance)||!isUnit(r.urgency)||!isUnit(r.confidence))return null;
 if(r.parentId!==undefined&&(typeof r.parentId!=='string'||r.parentId.length>180))return null;
 if(r.valueFocus!==undefined&&(typeof r.valueFocus!=='string'||r.valueFocus.length>96))return null;
 if(r.valueAlignment01!==undefined&&!isUnit(r.valueAlignment01))return null;
 return {id,tick:Number(tick),at,title,reason,source:source as P67Candidate['source'],importance:r.importance as number,urgency:r.urgency as number,confidence:r.confidence as number,parentId:r.parentId as string|undefined,valueFocus:r.valueFocus as string|undefined,valueAlignment01:r.valueAlignment01 as number|undefined};
}
export class P67AutonomousGoalGenesis {
 private state=defaultP67();
 restore(raw?:Partial<P67State>|null){
  const d=defaultP67();let detached:unknown;
  try{detached=snapshotPlainData<unknown>(raw??{}, {maxDepth:12,maxNodes:4096,maxStringUnits:512*1024});}
  catch{this.state=d;return;}
  if(!detached||typeof detached!=='object'||Array.isArray(detached)){this.state=d;return;}
  const r=detached as Record<string,unknown>;
  if(r.version!==undefined&&r.version!==1){this.state=d;return;}
  const generatedIds=[...new Set((Array.isArray(r.generatedIds)?r.generatedIds:[])
    .filter((id):id is string=>typeof id==='string'&&/^p67:\d+:[0-9a-f]{1,8}$/i.test(id)))].slice(-256);
  const idSet=new Set(generatedIds);
  const history=(Array.isArray(r.history)?r.history:[])
    .map(row=>normalizeCandidate(row,idSet)).filter((row):row is P67Candidate=>row!==null).slice(-96);
  const decisions: P67DecisionReceipt[]=[];
  const seenDecisions=new Set<string>();
  for(const row of (Array.isArray(r.decisions)?r.decisions:[]).slice(-512)){
   if(!row||typeof row!=='object'||Array.isArray(row))continue;
   const decision=row as Record<string,unknown>;
   if(typeof decision.id!=='string'||!idSet.has(decision.id)||
      (decision.decision!=='promoted'&&decision.decision!=='rejected')||
      !Number.isSafeInteger(decision.at)||Number(decision.at)<0||seenDecisions.has(decision.id))continue;
   seenDecisions.add(decision.id);
   decisions.push({id:decision.id,decision:decision.decision,at:Number(decision.at)});
  }
  this.state={
   version:1,cycles:safeCount(r.cycles),proposals:safeCount(r.proposals),promoted:r.decisions===undefined?safeCount(r.promoted):decisions.filter(x=>x.decision==='promoted').length,
   rejected:r.decisions===undefined?safeCount(r.rejected):decisions.filter(x=>x.decision==='rejected').length,cooldowns:safeCount(r.cooldowns),
   lastGeneratedAt:safeCount(r.lastGeneratedAt),generatedIds,history,decisions,
  };
 }
 snapshot(){return structuredClone(this.state);}
 propose(rawInput:{tick:number;at:number;energy01:number;uncertainty01:number;predictionError01:number;novelty01:number;socialNeed01:number;goalPressure01:number;homeostaticPressure01:number;epistemicUnresolved:number;identity01:number;activeGoalCount:number;lastMode:string;identityDecision:'allow'|'caution'|'veto';motiveOverall01?:number;motiveConflict01?:number;motiveDominant?:string;attractorOverall01?:number;attractorConflict01?:number;attractorDominant?:string;valueWeights?:AdaptiveValueWeights;curriculumPressure01?:number;historyUnresolved01?:number;socialLearning01?:number;worldTransitionConfidence01?:number;worldTransitionError01?:number;worldTransitionNovelty01?:number;neuralConfidence01?:number}):P67Candidate|null{
  let input:typeof rawInput;
  try{input=snapshotPlainData<typeof rawInput>(rawInput,{maxDepth:8,maxNodes:256,maxStringUnits:8192});}
  catch{throw new TypeError('p67-goal-input-invalid');}
  if(!input||typeof input!=='object'||Array.isArray(input))throw new TypeError('p67-goal-input-invalid');
  const allowedKeys=new Set(['tick','at','energy01','uncertainty01','predictionError01','novelty01','socialNeed01','goalPressure01','homeostaticPressure01','epistemicUnresolved','identity01','activeGoalCount','lastMode','identityDecision','motiveOverall01','motiveConflict01','motiveDominant','attractorOverall01','attractorConflict01','attractorDominant','valueWeights','curriculumPressure01','historyUnresolved01','socialLearning01','worldTransitionConfidence01','worldTransitionError01','worldTransitionNovelty01','neuralConfidence01']);
  const unitKeys=['energy01','uncertainty01','predictionError01','novelty01','socialNeed01','goalPressure01','homeostaticPressure01','identity01','motiveOverall01','motiveConflict01','attractorOverall01','attractorConflict01','curriculumPressure01','historyUnresolved01','socialLearning01','worldTransitionConfidence01','worldTransitionError01','worldTransitionNovelty01','neuralConfidence01'];
  if(Object.keys(input).some(key=>!allowedKeys.has(key))||
     !Number.isSafeInteger(input.tick)||input.tick<0||typeof input.at!=='number'||!Number.isFinite(input.at)||input.at<0||
     unitKeys.some(key=>(input as any)[key]!==undefined&&!isUnit((input as any)[key]))||
     !Number.isSafeInteger(input.epistemicUnresolved)||input.epistemicUnresolved<0||input.epistemicUnresolved>100_000||
     !Number.isSafeInteger(input.activeGoalCount)||input.activeGoalCount<0||input.activeGoalCount>1000||
     typeof input.lastMode!=='string'||input.lastMode.length>96||
     !['allow','caution','veto'].includes(input.identityDecision)||
     ['motiveDominant','attractorDominant'].some(key=>(input as any)[key]!==undefined&&(typeof (input as any)[key]!=='string'||(input as any)[key].length>96))||
     (input.valueWeights!==undefined&&(!input.valueWeights||typeof input.valueWeights!=='object'||Object.values(input.valueWeights).length>32||Object.values(input.valueWeights).some(value=>!isUnit(value))))) {
   throw new TypeError('p67-goal-input-invalid');
  }
  this.state.cycles++;
  if(input.activeGoalCount>=4 || input.tick-this.state.lastGeneratedAt<16 || input.identityDecision==='veto') return null;
  const values:Partial<AdaptiveValueWeights>=input.valueWeights??{};
  const value=(k:keyof AdaptiveValueWeights, fallback=.5)=>clamp(Number(values[k]??fallback));
  const valueAlignment={
    homeostatic:clamp(value('responsibility')*.42+value('care')*.28+value('autonomy')*.18+value('evidence')*.12),
    learned:clamp(value('truth')*.36+value('evidence')*.34+value('responsibility')*.18+value('autonomy')*.12),
    intrinsic:clamp(value('curiosity')*.46+value('autonomy')*.30+value('social')*.10+value('care')*.06+value('truth')*.08)
  };
  const curriculumPressure=clamp(input.curriculumPressure01??0);
  const historyUnresolved=clamp(input.historyUnresolved01??0);
  const socialLearning=clamp(input.socialLearning01??0);
  const worldConfidence=clamp(input.worldTransitionConfidence01??.5);
  const worldError=clamp(input.worldTransitionError01??input.predictionError01);
  const worldNovelty=clamp(input.worldTransitionNovelty01??input.novelty01);
  const neuralConfidence=clamp(input.neuralConfidence01??.5);
  const pressures=[
    {source:'homeostatic' as const,score:clamp(input.homeostaticPressure01*.66+(1-input.energy01)*.16+input.predictionError01*.08+valueAlignment.homeostatic*.10),title:'Восстановить внутренний ресурс',reason:'устойчивая внутренняя регуляторная нагрузка',valueFocus:'responsibility',valueAlignment01:valueAlignment.homeostatic},
    {source:'learned' as const,score:clamp(input.predictionError01*.30+input.epistemicUnresolved/12*.20+input.goalPressure01*.12+input.uncertainty01*.10+curriculumPressure*.16+historyUnresolved*.08+valueAlignment.learned*.04),title:'Проверить неизвестное',reason:'повторяющееся расхождение между ожиданием и наблюдением',valueFocus:'truth/evidence',valueAlignment01:valueAlignment.learned},
    {source:'intrinsic' as const,score:clamp(input.novelty01*.34+input.uncertainty01*.16+input.socialNeed01*.05+input.goalPressure01*.18+curriculumPressure*.10+historyUnresolved*.05+socialLearning*.06+valueAlignment.intrinsic*.06),title:'Исследовать новую возможность',reason:'сочетание новизны и нерешённого внутреннего интереса',valueFocus:'curiosity/autonomy',valueAlignment01:valueAlignment.intrinsic}
  ].sort((a,b)=>b.score-a.score);
  const top=pressures[0];
  const motiveOverall=clamp(input.motiveOverall01??top.score);
  const motiveConflict=clamp(input.motiveConflict01??0);
  const attractorOverall=clamp(input.attractorOverall01??motiveOverall);
  const attractorConflict=clamp(input.attractorConflict01??0);
  const threshold=input.identityDecision==='caution'?.64:.56 + motiveConflict*.04 + attractorConflict*.025;
  const blendedScore=clamp(top.score*.62+motiveOverall*.2+attractorOverall*.18);
  if(blendedScore<threshold || input.identity01<.55) return null;
  const title=top.title;
  const id=stableId(input.tick,title);
  if(this.state.generatedIds.includes(id) || this.state.history.some(x=>x.title===title && input.tick-x.tick<96)){this.state.cooldowns++;return null;}
  const dominantSuffix=[input.motiveDominant?`motive=${input.motiveDominant}`:'',input.attractorDominant?`attractor=${input.attractorDominant}`:'',top.valueFocus?`value=${top.valueFocus}`:''].filter(Boolean).length?`; ${[input.motiveDominant?`motive=${input.motiveDominant}`:'',input.attractorDominant?`attractor=${input.attractorDominant}`:'',top.valueFocus?`value=${top.valueFocus}`:''].filter(Boolean).join(', ')}`:'';
  const candidate:P67Candidate={id,tick:input.tick,at:input.at,title,reason:`${top.reason}${dominantSuffix}`,source:top.source,importance:clamp(.35+blendedScore*.5),urgency:clamp(.2+blendedScore*.62),confidence:clamp(.35+blendedScore*.55),valueFocus:top.valueFocus,valueAlignment01:top.valueAlignment01};
  this.state.proposals++;this.state.generatedIds=[id,...this.state.generatedIds].slice(0,256);this.state.history=[candidate,...this.state.history].slice(0,96);this.state.lastGeneratedAt=input.tick;return structuredClone(candidate);
 }
 markPromoted(id:string){
  if(typeof id!=='string'||!this.state.generatedIds.includes(id)||this.state.decisions.some(row=>row.id===id))return false;
  this.state.decisions=[...this.state.decisions,{id,decision:'promoted',at:this.state.lastGeneratedAt}].slice(-256);
  this.state.promoted++;return true;
 }
 markRejected(id:string){
  if(typeof id!=='string'||!this.state.generatedIds.includes(id)||this.state.decisions.some(row=>row.id===id))return false;
  this.state.decisions=[...this.state.decisions,{id,decision:'rejected',at:this.state.lastGeneratedAt}].slice(-256);
  this.state.rejected++;return true;
 }
 recalibrateActiveGoals(input:{tick:number;goals:Array<{id:string;title:string;source:string;importance:number;urgency:number;confidence:number;status:string}>;valueWeights:AdaptiveValueWeights;identityStability01?:number;worldConfidence01?:number;neuralConfidence01?:number}){
  if(input.tick%8!==0)return [];
  const v=input.valueWeights; const value=(k:keyof AdaptiveValueWeights)=>clamp(Number(v[k]??.5));
  const identityStability=clamp(input.identityStability01??.7);
  const worldConfidence=clamp(input.worldConfidence01??.5);
  const neuralConfidence=clamp(input.neuralConfidence01??.5);
  const consolidationGate=clamp(.34+.36*identityStability+.20*worldConfidence+.10*neuralConfidence);
  const alignment=(focus:string)=>clamp(focus==='responsibility'?value('responsibility')*.58+value('care')*.22+value('autonomy')*.10+value('evidence')*.10:focus==='truth/evidence'?value('truth')*.56+value('evidence')*.34+value('responsibility')*.10:focus==='curiosity/autonomy'?value('curiosity')*.54+value('autonomy')*.36+value('evidence')*.10:focus==='social/care'?value('social')*.48+value('care')*.34+value('responsibility')*.18:value('responsibility')*.34+value('evidence')*.22+value('autonomy')*.22+value('care')*.22);
  const updates=[];
  for(const goal of input.goals.filter(g=>g.status==='active')){
    const candidate=this.state.history.find(h=>h.id===goal.id)??this.state.history.find(h=>h.title===goal.title);
    const focus=candidate?.valueFocus??(goal.source==='learned'?'truth/evidence':goal.source==='intrinsic'?'curiosity/autonomy':'responsibility');
    const target=alignment(focus);
    const desiredImportance=clamp(.44+target*.40), desiredUrgency=clamp(.18+target*.46);
    const delta=Math.max(-.018,Math.min(.018,(desiredImportance-goal.importance)*.14*consolidationGate));
    const urgencyDelta=Math.max(-.014,Math.min(.014,(desiredUrgency-goal.urgency)*.14*consolidationGate));
    const importance=clamp(goal.importance+delta),urgency=clamp(goal.urgency+urgencyDelta),confidence=clamp(goal.confidence+Math.abs(delta)*.16*(.55+.45*worldConfidence));
    if(Math.abs(importance-goal.importance)>.0002||Math.abs(urgency-goal.urgency)>.0002)updates.push({id:goal.id,importance,urgency,confidence,valueFocus:focus,valueAlignment01:target});
  }
  return updates;
 }
 summary(){return {cycles:this.state.cycles,proposals:this.state.proposals,promoted:this.state.promoted,rejected:this.state.rejected,cooldowns:this.state.cooldowns,lastGeneratedAt:this.state.lastGeneratedAt};}
}
