export interface B336ActionContribution { action:string; fullRaw:number; ablatedRaw:number; projectContribution:number; }
export interface B336State {version:1; observations:number; projectActiveCycles:number; ablationComparisons:number; changedTopAction:number; meanProjectContribution01:number; lastFullAction:string|null; lastAblatedAction:string|null; eligible:boolean; reason:string;}
const clamp=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
const fin=(v:unknown,f:number):number=>{const n=typeof v==='number'?v:typeof v==='string'&&v.trim().length?Number(v):NaN;return Number.isFinite(n)?n:(Number.isFinite(f)?f:0);};
const cnt=(v:unknown,f:number):number=>Math.max(0,Math.floor(fin(v,f)));
const optStr=(v:unknown):string|null=>typeof v==='string'?v.slice(0,160):null;
export const defaultB336State=():B336State=>({version:1,observations:0,projectActiveCycles:0,ablationComparisons:0,changedTopAction:0,meanProjectContribution01:0,lastFullAction:null,lastAblatedAction:null,eligible:false,reason:'insufficient-evidence'});
export class B336ProjectCausalOwnershipGate {
 private state=defaultB336State();
 restore(raw?:Partial<B336State>|null){
  const d=defaultB336State();
  const src:Record<string,unknown>=(raw&&typeof raw==='object')?raw as unknown as Record<string,unknown>:{};
  const read=(k:string):unknown=>{try{return src[k];}catch{return undefined;}};
  this.state={version:1,observations:cnt(read('observations'),d.observations),projectActiveCycles:cnt(read('projectActiveCycles'),d.projectActiveCycles),ablationComparisons:cnt(read('ablationComparisons'),d.ablationComparisons),changedTopAction:cnt(read('changedTopAction'),d.changedTopAction),meanProjectContribution01:clamp(fin(read('meanProjectContribution01'),d.meanProjectContribution01)),lastFullAction:optStr(read('lastFullAction')),lastAblatedAction:optStr(read('lastAblatedAction')),eligible:Boolean(read('eligible')),reason:typeof read('reason')==='string'?(read('reason') as string).slice(0,160):d.reason};
 }
 snapshot(){return structuredClone(this.state);}
 observe(input:{projectActive:boolean; candidates:B336ActionContribution[]}){
  this.state.observations++;
  if(!input.projectActive)return;
  this.state.projectActiveCycles++;
  if(!input.candidates.length)return;
  this.state.ablationComparisons++;
  const full=[...input.candidates].sort((a,b)=>b.fullRaw-a.fullRaw)[0];
  const ablated=[...input.candidates].sort((a,b)=>b.ablatedRaw-a.ablatedRaw)[0];
  this.state.lastFullAction=full?.action??null;
  this.state.lastAblatedAction=ablated?.action??null;
  const mean=input.candidates.reduce((s,c)=>s+Math.abs(c.projectContribution),0)/input.candidates.length;
  this.state.meanProjectContribution01=clamp(.75*this.state.meanProjectContribution01+.25*mean);
  if(full?.action!==ablated?.action)this.state.changedTopAction++;
  const required=this.state.ablationComparisons>=3;
  this.state.eligible=required&&this.state.changedTopAction>=1&&this.state.meanProjectContribution01>0;
  this.state.reason=this.state.eligible?'project-causal-action-influence-observed':!required?'need-3-project-cycles':'no-action-selection-change-under-project-lesion';
 }
 diagnostics(){return{...this.snapshot(),evaluation:{eligible:this.state.eligible,reason:this.state.reason}};}
}
