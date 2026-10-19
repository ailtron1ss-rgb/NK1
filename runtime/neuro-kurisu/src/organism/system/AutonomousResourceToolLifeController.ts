/**
 * BIG PASS 223 — autonomous resource/tool life.
 * Governs self-directed access to non-destructive capabilities with an explicit
 * resource envelope, verification requirement, cooldowns, and self-stop rule.
 * This is an engineering autonomy layer, not a claim of consciousness or legal personhood.
 */
const clamp=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
export interface AutonomousToolCandidate {id:string;capability:string;destructive:boolean;projectAllowed:boolean;requiresApproval?:boolean;requiresIdempotencyKey?:boolean;}
export interface AutonomousToolLifeState {
  version:1; ticks:number; toolPlans:number; toolExecutions:number; toolSuccesses:number; toolFailures:number;
  blockedDestructive:number; permissionBlocked:number; budgetBlocked:number; selfStops:number; cooldownBlocks:number;
  resourceSpent01:number; resourceEfficiency01:number; initiative01:number; stopPressure01:number;
  lastToolId:string|null; lastCapability:string|null; lastResult01:number; lastReason:string; lastAt:number;
  recent:Array<{tick:number;toolId:string;capability:string;ok:boolean;verified:boolean;cost01:number;reason:string;executionId?:string}>;
}
export const defaultAutonomousResourceToolLife=():AutonomousToolLifeState=>({version:1,ticks:0,toolPlans:0,toolExecutions:0,toolSuccesses:0,toolFailures:0,blockedDestructive:0,permissionBlocked:0,budgetBlocked:0,selfStops:0,cooldownBlocks:0,resourceSpent01:0,resourceEfficiency01:.7,initiative01:.4,stopPressure01:0,lastToolId:null,lastCapability:null,lastResult01:.5,lastReason:'initial',lastAt:0,recent:[]});
export class AutonomousResourceToolLifeController {
  private state=defaultAutonomousResourceToolLife();
  private cooldownUntil=0;
  restore(raw?:Partial<AutonomousToolLifeState>|null){const d=defaultAutonomousResourceToolLife(),r=raw??{};this.state={...d,...r,recent:Array.isArray(r.recent)?structuredClone(r.recent).slice(0,64):[],version:1};}
  snapshot(){return structuredClone(this.state);}
  plan(input:{tick:number;at:number;energy01:number;thermal01:number;ramPressure01:number;externalInteractionBudget01:number;initiative01:number;uncertainty01:number;goalPressure01:number;homeostaticPressure01:number;tools:AutonomousToolCandidate[]}):{allowed:boolean;tool:AutonomousToolCandidate|null;reason:string;cost01:number;stopPressure01:number} {
    this.state.ticks++; this.state.lastAt=input.at; this.state.initiative01=clamp(input.initiative01);
    const scarcity=clamp((1-input.energy01)*.30+input.thermal01*.24+input.ramPressure01*.18+(1-input.externalInteractionBudget01)*.28);
    const stopPressure=clamp(scarcity*.42+input.homeostaticPressure01*.28+(input.energy01<.18?.18:0)+(input.thermal01>.86?.20:0));
    this.state.stopPressure01=stopPressure;
    if(stopPressure>.82){this.state.selfStops++;return {allowed:false,tool:null,reason:'self-stop-resource-or-homeostasis-pressure',cost01:0,stopPressure01:stopPressure};}
    if(input.at<this.cooldownUntil){this.state.cooldownBlocks++;return {allowed:false,tool:null,reason:'tool-cooldown',cost01:0,stopPressure01:stopPressure};}
    if(input.externalInteractionBudget01<.34 || input.energy01<.22){this.state.budgetBlocked++;return {allowed:false,tool:null,reason:'resource-budget-block',cost01:0,stopPressure01:stopPressure};}
    const nonDestructive=input.tools.filter(t=>!t.destructive);
    // Autonomy may choose and propose a protected operation, but it must not launch
    // one that requires owner consent as though a background planner had consented.
    // The registered ActionGateway permission class is the source of this signal.
    const safe=nonDestructive.filter(t=>t.requiresApproval!==true);
    if(!safe.length){
      if(nonDestructive.length){this.state.permissionBlocked++;return {allowed:false,tool:null,reason:'no-autonomous-permitted-tool',cost01:0,stopPressure01:stopPressure};}
      this.state.blockedDestructive++;return {allowed:false,tool:null,reason:'no-safe-nondestructive-tool',cost01:0,stopPressure01:stopPressure};
    }
    const scored=safe.map(t=>{
      const c=String(t.capability||'');
      let score=.15;
      if(/read|inspect|status|evidence|research|context/.test(c)) score+=.34;
      if(t.id==='organism.inspect') score+=.45;
      if(t.id==='organism.device.status') score+=.16;
      if(t.id==='organism.project.context') score-=.08;
      if(input.uncertainty01>.58 && /research|evidence|read|inspect/.test(c)) score+=.18;
      if(input.goalPressure01>.62 && /project|context|evidence/.test(c)) score+=.10;
      if(input.initiative01>.58) score+=.06;
      if(/device\./.test(t.id)) score+=.02;
      return {t,score};
    }).sort((a,b)=>b.score-a.score);
    const chosen=scored[0]?.t??null; if(!chosen)return {allowed:false,tool:null,reason:'no-ranked-tool',cost01:0,stopPressure01:stopPressure};
    const cost=clamp(.10+scarcity*.16+(input.uncertainty01>.7?.06:0));
    if(input.externalInteractionBudget01<cost+.28){this.state.budgetBlocked++;return {allowed:false,tool:null,reason:'insufficient-tool-envelope',cost01:cost,stopPressure01:stopPressure};}
    this.state.toolPlans++;
    return {allowed:true,tool:chosen,reason:`autonomous-capability-selection;scarcity=${scarcity.toFixed(3)}`,cost01:cost,stopPressure01:stopPressure};
  }
  record(input:{tick:number;at:number;tool:AutonomousToolCandidate;ok:boolean;verified:boolean;cost01:number;reason:string;executionId?:string}):boolean{
    const executionId=String(input.executionId??'').trim().slice(0,180);
    // ActionGateway may replay a durable receipt when the previous process died
    // between tool completion and this controller's checkpoint. Repair the local
    // accounting if it is missing, but never count the same receipt twice.
    if(executionId && this.state.recent.some(row=>row.executionId===executionId)) return false;
    this.state.toolExecutions++; if(input.ok)this.state.toolSuccesses++; else this.state.toolFailures++; this.state.resourceSpent01=clamp(this.state.resourceSpent01*.97+clamp(input.cost01)*.03);
    const quality=clamp((input.ok?.7:0)+(input.verified?.3:0)); this.state.resourceEfficiency01=clamp(this.state.resourceEfficiency01*.92+quality*.08);
    this.state.lastToolId=input.tool.id;this.state.lastCapability=input.tool.capability;this.state.lastResult01=quality;this.state.lastReason=input.reason;this.state.lastAt=input.at;
    this.state.recent=[{tick:input.tick,toolId:input.tool.id,capability:input.tool.capability,ok:input.ok,verified:input.verified,cost01:clamp(input.cost01),reason:input.reason,...(executionId?{executionId}:{})},...this.state.recent].slice(0,64);
    this.cooldownUntil=input.at+Math.max(1000,Math.round(1800+clamp(input.cost01)*4200));
    return true;
  }
  summary(){return {ticks:this.state.ticks,toolPlans:this.state.toolPlans,toolExecutions:this.state.toolExecutions,toolSuccesses:this.state.toolSuccesses,toolFailures:this.state.toolFailures,blockedDestructive:this.state.blockedDestructive,permissionBlocked:this.state.permissionBlocked,budgetBlocked:this.state.budgetBlocked,selfStops:this.state.selfStops,cooldownBlocks:this.state.cooldownBlocks,resourceEfficiency01:this.state.resourceEfficiency01,initiative01:this.state.initiative01,stopPressure01:this.state.stopPressure01,lastToolId:this.state.lastToolId,lastCapability:this.state.lastCapability};}
}
