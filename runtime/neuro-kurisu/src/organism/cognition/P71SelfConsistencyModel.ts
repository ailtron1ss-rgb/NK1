/**
 * P71 — Self Consistency Model.
 *
 * Maintains a compact model of whether identity, values, goals, narrative and
 * recent actions remain mutually compatible. It is a detector/repair-pressure
 * source, not a personality generator.
 */
const clamp=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
export interface P71State {version:1;cycles:number;meanConsistency01:number;identityDrift01:number;goalConflict01:number;valueConflict01:number;actionMismatch01:number;repairPressure01:number;lastReason:string;history:Array<{tick:number;consistency01:number;repairPressure01:number;reason:string}>;}
const finN=(v:unknown,f:number):number=>{const n=typeof v==='number'?v:Number(v);return Number.isFinite(n)?n:f;};
const cnt=(v:unknown,f:number):number=>Math.max(0,Math.floor(finN(v,f)));
const str=(v:unknown,f:string,n=160):string=>typeof v==='string'&&v?v.slice(0,n):f;
export const defaultP71=():P71State=>({version:1,cycles:0,meanConsistency01:.82,identityDrift01:0,goalConflict01:.1,valueConflict01:0,actionMismatch01:0,repairPressure01:.18,lastReason:'bootstrap',history:[]});
export class P71SelfConsistencyModel {
 private state=defaultP71();
 summary(){return{version:1,cycles:this.state.cycles,consistency01:this.state.meanConsistency01,identityDrift01:this.state.identityDrift01,goalConflict01:this.state.goalConflict01,valueConflict01:this.state.valueConflict01,actionMismatch01:this.state.actionMismatch01,repairPressure01:this.state.repairPressure01,lastReason:this.state.lastReason};} restore(raw?:Partial<P71State>|null){const d=defaultP71();const src=(raw&&typeof raw==='object')?raw as Record<string,unknown>:{};const read=(k:string):unknown=>{try{return src[k];}catch{return undefined;}};const hRaw=read('history');
this.state={version:1,cycles:cnt(read('cycles'),d.cycles),meanConsistency01:clamp(finN(read('meanConsistency01'),d.meanConsistency01)),identityDrift01:clamp(finN(read('identityDrift01'),d.identityDrift01)),goalConflict01:clamp(finN(read('goalConflict01'),d.goalConflict01)),valueConflict01:clamp(finN(read('valueConflict01'),d.valueConflict01)),actionMismatch01:clamp(finN(read('actionMismatch01'),d.actionMismatch01)),repairPressure01:clamp(finN(read('repairPressure01'),d.repairPressure01)),lastReason:str(read('lastReason'),d.lastReason),history:Array.isArray(hRaw)?(hRaw as unknown[]).slice(-96).filter(v=>v&&typeof v==='object').map(v=>{const r=v as Record<string,unknown>;return {tick:cnt(r.tick,0),consistency01:clamp(finN(r.consistency01,0)),repairPressure01:clamp(finN(r.repairPressure01,0)),reason:str(r.reason,'')};}):[]};
}
 snapshot(){return structuredClone(this.state);}
 evaluate(input:{tick:number;identity01:number;identityDrift01:number;goalConflict01:number;valueConflict01:number;chosenAction:string;mode:string;goalPressure01:number;realityGap01:number}):{consistency01:number;repairPressure01:number;reason:string}{
   const id=clamp(input.identity01),dr=clamp(input.identityDrift01),gc=clamp(input.goalConflict01),vc=clamp(input.valueConflict01),gp=clamp(input.goalPressure01),rg=clamp(input.realityGap01);
   const actionMismatch=clamp((input.mode==='rest'&&['explore','respond'].includes(input.chosenAction))?0.7:(input.mode==='protect'&&input.chosenAction==='explore')?.8:0);
   const consistency=clamp(id*.34+(1-dr)*.18+(1-gc)*.18+(1-vc)*.14+(1-actionMismatch)*.08+(1-rg)*.08);
   const pressure=clamp((1-consistency)*.55+gc*.18+vc*.12+rg*.08+gp*.07);
   let reason='self-consistent'; if(dr>.45)reason='identity-drift'; else if(gc>.45)reason='goal-conflict'; else if(vc>.4)reason='value-conflict'; else if(actionMismatch>.6)reason='action-self-mismatch'; else if(rg>.5)reason='reality-misalignment';
   this.state.cycles++;this.state.identityDrift01=dr;this.state.goalConflict01=gc;this.state.valueConflict01=vc;this.state.actionMismatch01=actionMismatch;this.state.repairPressure01=pressure;this.state.meanConsistency01=clamp(this.state.meanConsistency01*.96+consistency*.04);this.state.lastReason=reason;this.state.history=[{tick:input.tick,consistency01:consistency,repairPressure01:pressure,reason},...this.state.history].slice(0,96);
   return {consistency01:consistency,repairPressure01:pressure,reason};
 }
}
