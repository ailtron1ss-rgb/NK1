/**
 * Lightweight prediction tournament. Models compete on the same resolved outcomes;
 * it is intentionally generic so heavier world models can join later.
 */
export interface ModelScore{correct:number;total:number;brierSum:number;meanBrier01:number;accuracy01:number;}
export interface ModelOlympicsState{version:1;scores:Record<string,ModelScore>;rounds:number;winner:string|null;lastAt:number;}
const clamp=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
const finN=(v:unknown,f:number):number=>{const n=typeof v==='number'?v:Number(v);return Number.isFinite(n)?n:f;};
const cnt=(v:unknown,f:number):number=>Math.max(0,Math.floor(finN(v,f)));
const sanitizeScore=(v:unknown):ModelScore=>{const d={correct:0,total:0,brierSum:0,meanBrier01:.5,accuracy01:0};if(!v||typeof v!=='object')return d;const r=v as Record<string,unknown>;return {correct:cnt(r.correct,0),total:cnt(r.total,0),brierSum:Math.max(0,finN(r.brierSum,0)),meanBrier01:clamp(finN(r.meanBrier01,.5)),accuracy01:clamp(finN(r.accuracy01,0))};};
export const defaultModelOlympics=():ModelOlympicsState=>({version:1,scores:{},rounds:0,winner:null,lastAt:0});
export class ModelOlympics{
 private state=defaultModelOlympics();
 restore(raw?:Partial<ModelOlympicsState>|null){const src:Record<string,unknown>=(raw&&typeof raw==='object')?raw as unknown as Record<string,unknown>:{};const read=(k:string):unknown=>{try{return src[k];}catch{return undefined;}};const scores:Record<string,ModelScore>={};const rawScores=read('scores');if(rawScores&&typeof rawScores==='object')for(const [k,v] of Object.entries(rawScores as Record<string,unknown>))scores[k.slice(0,120)]=sanitizeScore(v);this.state={version:1,scores,rounds:cnt(read('rounds'),0),winner:typeof read('winner')==='string'?(read('winner') as string).slice(0,120):null,lastAt:Math.max(0,finN(read('lastAt'),0))};}
 snapshot(){return structuredClone(this.state);}
 calibrate(id:string,predicted01:number):number{
   const raw=clamp(predicted01); const score=this.state.scores[id];
   if(!score || score.total<4) return raw;
   const strength=Math.min(1,score.total/24); const empiricalSkill=clamp(1-Math.sqrt(score.meanBrier01));
   const weight=clamp((.35+.65*empiricalSkill)*strength+(1-strength)*.65);
   return clamp(.5+(raw-.5)*weight);
 }
 reliability01(id:string):number{
   const score=this.state.scores[id]; if(!score) return .5;
   return clamp((1-Math.sqrt(score.meanBrier01))*.7+score.accuracy01*.3);
 }
 ensemble(predictions:Record<string,number>):number{
   const entries=Object.entries(predictions).filter(([,v])=>Number.isFinite(v));
   if(!entries.length) return .5;
   let weighted=0,total=0;
   for(const [id,value] of entries){const w=Math.max(.1,this.reliability01(id)); weighted+=clamp(value)*w; total+=w;}
   return clamp(weighted/Math.max(.1,total));
 }
 scoreRound(input:{predictions:Record<string,{predicted01:number}>;actual01:number;at?:number}){
   const actual=clamp(input.actual01); this.state.rounds++;
   for(const [id,p] of Object.entries(input.predictions)){
     const predicted=clamp(p.predicted01); const correct=1-Math.abs(predicted-actual); const brier=(predicted-actual)**2;
     const s=this.state.scores[id]??{correct:0,total:0,brierSum:0,meanBrier01:.5,accuracy01:.5};
     // Relevance-weighted rolling memory: old rounds retain signal but decay slowly, preventing permanently winning stale models.
     s.correct=s.correct*.985 + correct; s.brierSum=s.brierSum*.985 + brier; s.total=Math.max(1,s.total*.985+1);
     s.meanBrier01=clamp(s.brierSum/s.total); s.accuracy01=clamp(s.correct/s.total); this.state.scores[id]=s;
   }
   const ranked=Object.entries(this.state.scores).sort((a,b)=>(b[1].accuracy01-b[1].meanBrier01*.35)-(a[1].accuracy01-a[1].meanBrier01*.35));this.state.winner=ranked[0]?.[0]??null;this.state.lastAt=input.at??Date.now();return this.state.winner;
 }
}
