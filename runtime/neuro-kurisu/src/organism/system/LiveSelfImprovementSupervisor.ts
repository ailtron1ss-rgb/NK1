/** BIG PASS 233 — live self-improvement supervisor: steer, abort and distill validated lessons. */
const clamp=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
export interface ImprovementLesson{id:string;domain:string;delta01:number;validated01:number;reusable:true;at:number;}
export interface SupervisorState{version:1;cycles:number;redirects:number;aborts:number;lessons:number;meanSteering01:number;lastDecision:'continue'|'redirect'|'abort';lessonsData:ImprovementLesson[];}
export const defaultLiveSupervisor=():SupervisorState=>({version:1,cycles:0,redirects:0,aborts:0,lessons:0,meanSteering01:.4,lastDecision:'continue',lessonsData:[]});
export class LiveSelfImprovementSupervisor{
 private state=defaultLiveSupervisor();
 restore(raw?:Partial<SupervisorState>|null){const d=defaultLiveSupervisor(),r=raw??{};this.state={...d,...r,lessonsData:Array.isArray(r.lessonsData)?structuredClone(r.lessonsData).slice(0,96):[],version:1};}
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
