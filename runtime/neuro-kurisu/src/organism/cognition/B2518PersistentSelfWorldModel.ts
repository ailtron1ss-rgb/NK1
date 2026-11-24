import type { ActionKind } from '../core/types.ts';
const ACTIONS:ActionKind[]=['respond','explore','verify','rest','reflect','wait','defer'];
const clamp=(x:number,a=0,b=1)=>Math.max(a,Math.min(b,Number.isFinite(x)?x:(a+b)/2));
const key=(v:number[])=>v.slice(0,12).map(x=>Math.round(clamp(Number(x))*7)).join('');
export interface B2518Transition{n:number;action:ActionKind;reward01:number;error01:number;verified01:number;nextKey:string;confidence01:number;lastTick:number;}
export interface B2518State{version:1;enabled:boolean;tick:number;cycles:number;learningUpdates:number;predictions:number;transitions:number;confidence01:number;selfContinuity01:number;worldStability01:number;predictionError01:number;actionBias:Record<ActionKind,number>;model:Record<string,B2518Transition>;lastKey:string;lesionFraction01:number;}
export const defaultB2518State=():B2518State=>({version:1,enabled:true,tick:0,cycles:0,learningUpdates:0,predictions:0,transitions:0,confidence01:.35,selfContinuity01:.65,worldStability01:.55,predictionError01:.42,actionBias:Object.fromEntries(ACTIONS.map(a=>[a,0])) as Record<ActionKind,number>,model:{},lastKey:'root',lesionFraction01:0});
export class B2518PersistentSelfWorldModel{
 private state=defaultB2518State(); readonly systemName='cognition:b2518-persistent-self-world-model' as const;
 snapshot(){return structuredClone(this.state)} restore(raw?:Partial<B2518State>|null){const d=defaultB2518State(),r:any=raw??{};this.state={...d,...structuredClone(r),version:1,actionBias:{...d.actionBias,...(r.actionBias??{})},model:{...r.model}};}
 setEnabled(v:boolean){this.state.enabled=!!v} setLesion(v:number){this.state.lesionFraction01=clamp(v)}
 beforeDecision(i:{tick:number;latent:number[];goal01?:number[];baseUtilities?:Partial<Record<ActionKind,number>>;uncertainty01:number;predictionError01:number}){
  this.state.tick=i.tick;if(!this.state.enabled)return {actionBias:Object.fromEntries(ACTIONS.map(a=>[a,0])) as Record<ActionKind,number>,confidence01:this.state.confidence01,selfContinuity01:this.state.selfContinuity01,worldStability01:this.state.worldStability01};
  const k=key(i.latent),bias=Object.fromEntries(ACTIONS.map(a=>[a,0])) as Record<ActionKind,number>;let support=0;
  for(const a of ACTIONS){const hits=Object.entries(this.state.model).filter(([id,e])=>id.startsWith(k+'|'+a+'|'));if(hits.length){const e=hits.sort((x,y)=>y[1].lastTick-x[1].lastTick)[0]![1];const expected=e.reward01-.5;bias[a]=clamp(expected*.075*e.confidence01*(1-this.state.lesionFraction01),-.065,.065);support+=e.confidence01;}}
  const confidence=clamp(.25+Math.min(.55,support*.07)+.20*(1-i.predictionError01));
  this.state.lastKey=k;this.state.confidence01=clamp(this.state.confidence01*.96+confidence*.04);this.state.cycles++;this.state.predictions++;this.state.actionBias=bias;
  return {actionBias:{...bias},confidence01:this.state.confidence01,selfContinuity01:this.state.selfContinuity01,worldStability01:this.state.worldStability01,stateKey:k};
 }
 afterOutcome(i:{tick:number;latent:number[];nextLatent:number[];action:ActionKind;reward01:number;predictionError01:number;verified01:number;selfContinuity01:number;worldStability01:number}){
  if(!this.state.enabled)return;const from=key(i.latent),to=key(i.nextLatent),id=`${from}|${i.action}|${to}`,old=this.state.model[id];const lr=i.verified01>.5?.16:.035;
  const e: B2518Transition=old??{n:0,action:i.action,reward01:.5,error01:.5,verified01:0,nextKey:to,confidence01:.2,lastTick:i.tick};e.n++;e.reward01=clamp(e.reward01*(1-lr)+i.reward01*lr);e.error01=clamp(e.error01*(1-lr)+i.predictionError01*lr);e.verified01=clamp(e.verified01*.94+i.verified01*.06);e.confidence01=clamp(e.confidence01*.92+((1-e.error01)*.55+e.verified01*.45)*.08);e.lastTick=i.tick;this.state.model[id]=e;
  this.state.transitions=Object.keys(this.state.model).length;this.state.learningUpdates++;this.state.selfContinuity01=clamp(this.state.selfContinuity01*.97+i.selfContinuity01*.03);this.state.worldStability01=clamp(this.state.worldStability01*.96+i.worldStability01*.04);this.state.predictionError01=clamp(this.state.predictionError01*.92+i.predictionError01*.08);this.state.confidence01=clamp(this.state.confidence01*.94+e.confidence01*.06);this.state.tick=i.tick;
  if(this.state.transitions>384){const keep=Object.entries(this.state.model).sort((a,b)=>b[1].lastTick-a[1].lastTick).slice(0,384);this.state.model=Object.fromEntries(keep);this.state.transitions=keep.length;}
 }
 diagnostics(){return structuredClone(this.state)}
 lesion(f=.5){const latent=this.state.lastKey.split('').map(x=>Number(x)/7);this.setLesion(0);const on=this.beforeDecision({tick:this.state.tick+1,latent,uncertainty01:.5,predictionError01:this.state.predictionError01??.5}).actionBias;this.setLesion(f);const off=this.beforeDecision({tick:this.state.tick+2,latent,uncertainty01:.5,predictionError01:this.state.predictionError01??.5}).actionBias;this.setLesion(0);const effect=ACTIONS.reduce((s,a)=>s+Math.abs((on[a]??0)-(off[a]??0)),0);return {causalDrop01:clamp(effect*4),before01:this.state.confidence01,after01:clamp(this.state.confidence01-effect)};}
}
