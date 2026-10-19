const clamp=(n:number)=>Math.max(0,Math.min(1,Number.isFinite(n)?n:0));
export interface SceneEpisode { id:string; label:string; firstAt:number; lastAt:number; visits:number; stability01:number; transitions:number; }
export interface ContinuityState { version:1; scenes:SceneEpisode[]; transitions:number; stableTransitions:number; objectPersistence01:number; sceneContinuity01:number; temporalGrounding01:number; lastScene:string; lastAt:number; }
export const defaultPerceptualContinuityState=():ContinuityState=>({version:1,scenes:[],transitions:0,stableTransitions:0,objectPersistence01:.05,sceneContinuity01:.1,temporalGrounding01:.1,lastScene:'unknown',lastAt:0});
export class PerceptualContinuityModel {
 private state=defaultPerceptualContinuityState();
 restore(raw?:Partial<ContinuityState>|null){
  const d=defaultPerceptualContinuityState(); const r=raw??{};
  this.state={...d,...r,scenes:Array.isArray(r.scenes)?r.scenes.slice(-64):[]};
 }
 snapshot(){return structuredClone(this.state);}
 observe(input:{scene:string;at:number;entityIds:string[];previousEntityIds?:string[]}){
  const label=input.scene.trim().slice(0,120)||'unknown'; const prev=this.state.lastScene; const same=prev===label;
  this.state.transitions+=same?0:1;
  const episode=this.state.scenes.find(x=>x.label===label);
  if(episode){
   episode.lastAt=input.at; episode.visits++; episode.stability01=clamp(episode.stability01*.9+(same?.92:.35)*.1);
   if(!same)episode.transitions++;
  }else{
   const safe=label.toLowerCase().replace(/[^a-z0-9а-яё]+/gi,'-').slice(0,40);
   this.state.scenes.unshift({id:`scene-${this.state.scenes.length+1}-${safe}`,label,firstAt:input.at,lastAt:input.at,visits:1,stability01:.4,transitions:0});
  }
  this.state.scenes=this.state.scenes.slice(0,64);
  const a=new Set(input.entityIds),b=new Set(input.previousEntityIds??[]); const union=new Set([...a,...b]);
  const inter=[...a].filter(x=>b.has(x)).length; const objectJaccard=union.size?inter/union.size:(b.size===0?1:0);
  this.state.objectPersistence01=clamp(this.state.objectPersistence01*.85+objectJaccard*.15);
  this.state.sceneContinuity01=clamp(this.state.sceneContinuity01*.88+(same?.9:.2)*.12);
  this.state.temporalGrounding01=clamp(this.state.temporalGrounding01*.9+(.45*objectJaccard+.55*this.state.sceneContinuity01)*.1);
  if(same)this.state.stableTransitions++; this.state.lastScene=label; this.state.lastAt=input.at; return this.snapshot();
 }
}
