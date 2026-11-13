/** BIG PASS 233 — live self-improvement supervisor: steer, abort and distill validated lessons. */
const clamp=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
export interface ImprovementLesson{id:string;domain:string;delta01:number;validated01:number;reusable:true;at:number;}
export interface SupervisorState{version:1;cycles:number;redirects:number;aborts:number;lessons:number;meanSteering01:number;lastDecision:'continue'|'redirect'|'abort';lessonsData:ImprovementLesson[];}
const finN=(v:unknown,f:number):number=>{const n=typeof v==='number'?v:Number(v);return Number.isFinite(n)?n:f;};
const cnt=(v:unknown,f:number):number=>Math.max(0,Math.floor(finN(v,f)));
const str=(v:unknown,f:string,n=160):string=>typeof v==='string'&&v?v.slice(0,n):f;
const DECISIONS:Array<SupervisorState['lastDecision']>=['continue','redirect','abort'];
const sanLesson=(x:unknown):ImprovementLesson|null=>{if(!x||typeof x!=='object')return null;const r=x as Record<string,unknown>;return {id:str(r.id,'lesson'),domain:str(r.domain,'unknown'),delta01:clamp(finN(r.delta01,0)),validated01:clamp(finN(r.validated01,0)),reusable:true,at:finN(r.at,0)};};
export const defaultLiveSupervisor=():SupervisorState=>({version:1,cycles:0,redirects:0,aborts:0,lessons:0,meanSteering01:.4,lastDecision:'continue',lessonsData:[]});
export class LiveSelfImprovementSupervisor{
 private state=defaultLiveSupervisor();
 restore(raw?:Partial<SupervisorState>|null){const d=defaultLiveSupervisor();const src=(raw&&typeof raw==='object')?raw as Record<string,unknown>:{};const read=(k:string):unknown=>{try{return src[k];}catch{return undefined;}};const lRaw=read('lessonsData');this.state={version:1,cycles:cnt(read('cycles'),d.cycles),redirects:cnt(read('redirects'),d.redirects),aborts:cnt(read('aborts'),d.aborts),lessons:cnt(read('lessons'),d.lessons),meanSteering01:clamp(finN(read('meanSteering01'),d.meanSteering01)),lastDecision:DECISIONS.includes(read('lastDecision') as SupervisorState['lastDecision'])?read('lastDecision') as SupervisorState['lastDecision']:d.lastDecision,lessonsData:Array.isArray(lRaw)?(lRaw as unknown[]).slice(0,96).map(sanLesson).filter((x):x is ImprovementLesson=>x!==null):[]};}
 snapshot(){return structuredClone(this.state);}
 supervise(input:{at:number;predictionError01:number;resourcePressure01:number;identity01:number;goalPressure01:number;activeRun:boolean;recoveryPressure01:number}):{decision:'continue'|'redirect'|'abort';steering01:number;reason:string}{
  const risk=clamp(input.predictionError01*.38+input.resourcePressure01*.22+input.recoveryPressure01*.25+(1-input.identity01)*.15);let decision:'continue'|'redirect'|'abort'='continue';let reason='stable trajectory';
  if(input.activeRun&&risk>.8){decision='abort';reason='protect organism from runaway trajectory';this.state.aborts++;}
  else if(input.activeRun&&risk>.56){decision='redirect';reason='steer toward lower-risk correction';this.state.redirects++;}
  this.state.cycles++;this.state.lastDecision=decision;const steering=clamp(risk*.9+(decision==='redirect'?.18:decision==='abort'?.28:0));this.state.meanSteering01=clamp(this.state.meanSteering01*.92+steering*.08);return{decision,steering01:steering,reason};
 }
 distill(input:{at:number;domain:string;beforeError01:number;afterError01:number;validated01:number}){const gain=clamp(input.beforeError01-input.afterError01);if(input.validated01>.72&&gain>.03){const lesson:ImprovementLesson={id:`lesson:${this.state.lessons+1}:${input.domain}`,domain:input.domain,delta01:gain,validated01:clamp(input.validated01),reusable:true,at:input.at};this.state.lessonsData=[lesson,...this.state.lessonsData].slice(0,96);this.state.lessons++;return structuredClone(lesson);}return null;}
 summary(){return{cycles:this.state.cycles,redirects:this.state.redirects,aborts:this.state.aborts,lessons:this.state.lessons,meanSteering01:this.state.meanSteering01,lastDecision:this.state.lastDecision,reusableLessons:this.state.lessonsData.length};}
}
