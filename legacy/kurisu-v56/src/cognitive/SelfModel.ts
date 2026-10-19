/**
 * Persistent self-model.
 * Separates observed facts, capabilities, preferences and uncertain beliefs.
 * This prevents a personality prompt from becoming an ungrounded "identity".
 */
export type BeliefKind='fact'|'capability'|'preference'|'uncertain'|'goal'|'limitation';
export interface SelfBelief {
  id:string;
  kind:BeliefKind;
  statement:string;
  confidence:number;
  evidenceCount:number;
  updatedAt:number;
  source:'system'|'user'|'experience'|'inference';
}
export interface SelfModelSnapshot {
  version:1;
  beliefs:SelfBelief[];
  identityRevision:number;
  coherence:number;
  lastReviewAt:number;
}
const KEY='kurisu_self_model_v1';
const MAX=80;
const clamp=(n:number)=>Math.max(0,Math.min(100,Number.isFinite(n)?n:0));
const uid=()=>`self_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,7)}`;
function load():SelfModelSnapshot{
  try{
    const p=JSON.parse(localStorage.getItem(KEY)||'null') as Partial<SelfModelSnapshot>|null;
    return {...{version:1,beliefs:[],identityRevision:0,coherence:78,lastReviewAt:0},...p,
      beliefs:Array.isArray(p?.beliefs)?p!.beliefs.slice(0,MAX):[]};
  }catch{return {version:1,beliefs:[],identityRevision:0,coherence:78,lastReviewAt:0};}
}
function save(s:SelfModelSnapshot){try{localStorage.setItem(KEY,JSON.stringify(s));}catch{}}
class SelfModel {
 private state=load();
 snapshot(){return JSON.parse(JSON.stringify(this.state)) as SelfModelSnapshot;}
 observe(kind:BeliefKind,statement:string,confidence:number,source:SelfBelief['source']){
   const clean=statement.trim().slice(0,240); if(!clean)return;
   const existing=this.state.beliefs.find(b=>b.kind===kind&&b.statement.toLowerCase()===clean.toLowerCase());
   if(existing){
     existing.confidence=clamp(existing.confidence*0.75+confidence*0.25);
     existing.evidenceCount++; existing.updatedAt=Date.now();
   }else{
     this.state.beliefs.unshift({id:uid(),kind,statement:clean,confidence:clamp(confidence),evidenceCount:1,updatedAt:Date.now(),source});
     this.state.beliefs=this.state.beliefs.slice(0,MAX);
   }
   save(this.state);
 }
 forget(id:string){this.state.beliefs=this.state.beliefs.filter(b=>b.id!==id);this.state.identityRevision++;save(this.state);}
 review(){
   const now=Date.now();
   this.state.beliefs=this.state.beliefs
     .filter(b=>b.kind==='fact'||b.kind==='capability'||b.kind==='limitation'||b.confidence>=18)
     .sort((a,b)=>b.confidence-a.confidence)
     .slice(0,MAX);
   const uncertain=this.state.beliefs.filter(b=>b.kind==='uncertain').length;
   this.state.coherence=clamp(84-Math.min(40,uncertain*2));
   this.state.identityRevision++; this.state.lastReviewAt=now; save(this.state);
 }
 promptHint(max=900){
   const strong=this.state.beliefs.filter(b=>b.confidence>=70).slice(0,8);
   const uncertain=this.state.beliefs.filter(b=>b.kind==='uncertain').slice(0,4);
   return [
    '[SELF MODEL — GROUNDED]',
    `identity_revision=${this.state.identityRevision} coherence=${Math.round(this.state.coherence)}`,
    strong.length?`stable_beliefs=${strong.map(b=>`${b.kind}:${b.statement}`).join(' | ')}`:'stable_beliefs=none',
    uncertain.length?`uncertain_beliefs=${uncertain.map(b=>`${b.statement}(${Math.round(b.confidence)}%)`).join(' | ')}`:'uncertain_beliefs=none',
    'Do not invent autobiographical facts. Treat uncertain beliefs as hypotheses.'
   ].join('\n').slice(0,max);
 }
}
export const selfModel=new SelfModel();
