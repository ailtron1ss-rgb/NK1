import { countOr, isPlainDataArray, isPlainDataRecord, ownDataValue, stringOr, timestampOr, unitOr } from '../body/RestoreSanitizers.ts';

const clamp=(n:number)=>Math.max(0,Math.min(1,Number.isFinite(n)?n:0));
export interface SceneEpisode { id:string; label:string; firstAt:number; lastAt:number; visits:number; stability01:number; transitions:number; }
export interface ContinuityState { version:1; scenes:SceneEpisode[]; transitions:number; stableTransitions:number; objectPersistence01:number; sceneContinuity01:number; temporalGrounding01:number; lastScene:string; lastAt:number; }
export const defaultPerceptualContinuityState=():ContinuityState=>({version:1,scenes:[],transitions:0,stableTransitions:0,objectPersistence01:.05,sceneContinuity01:.1,temporalGrounding01:.1,lastScene:'unknown',lastAt:0});
export class PerceptualContinuityModel {
 private state=defaultPerceptualContinuityState();
 restore(raw?:Partial<ContinuityState>|null){
  const d=defaultPerceptualContinuityState();
  const r=isPlainDataRecord(raw)?raw:{};
  const lastAt=timestampOr(ownDataValue(r,'lastAt'),0);
  const scenes:SceneEpisode[]=[];
  const rawScenes=ownDataValue(r,'scenes');
  if(isPlainDataArray(rawScenes,256)){
    for(const candidate of rawScenes.slice(-64)){
      if(!isPlainDataRecord(candidate))continue;
      const id=stringOr(ownDataValue(candidate,'id'),'').trim().slice(0,120);
      const label=stringOr(ownDataValue(candidate,'label'),'').trim().slice(0,120);
      if(!id||!label)continue;
      const last= Math.min(lastAt||timestampOr(ownDataValue(candidate,'lastAt'),0),timestampOr(ownDataValue(candidate,'lastAt'),0));
      const first=Math.min(timestampOr(ownDataValue(candidate,'firstAt'),last),last);
      scenes.push({
        id,label,firstAt:first,lastAt:last,
        visits:Math.max(1,Math.min(1_000_000_000,countOr(ownDataValue(candidate,'visits'),1))),
        stability01:unitOr(ownDataValue(candidate,'stability01'),0),
        transitions:Math.min(1_000_000_000,countOr(ownDataValue(candidate,'transitions'),0)),
      });
    }
  }
  this.state={
    version:1,
    scenes,
    transitions:Math.min(1_000_000_000,countOr(ownDataValue(r,'transitions'),0)),
    stableTransitions:Math.min(1_000_000_000,countOr(ownDataValue(r,'stableTransitions'),0)),
    objectPersistence01:unitOr(ownDataValue(r,'objectPersistence01'),d.objectPersistence01),
    sceneContinuity01:unitOr(ownDataValue(r,'sceneContinuity01'),d.sceneContinuity01),
    temporalGrounding01:unitOr(ownDataValue(r,'temporalGrounding01'),d.temporalGrounding01),
    lastScene:stringOr(ownDataValue(r,'lastScene'),d.lastScene,120),
    lastAt,
  };
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
