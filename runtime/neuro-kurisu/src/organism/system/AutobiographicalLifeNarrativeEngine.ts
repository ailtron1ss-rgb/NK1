/** BIG PASS 231 — autobiographical significance and narrative continuity. */
const clamp=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
export interface NarrativeEpisode {
  id:string; at:number; theme:string; significance01:number; agency01:number;
  outcome01:number; continuity01:number; lesson:string;
}
export interface NarrativeState {
  version:1; cycles:number; episodes:number; reflections:number;
  meanContinuity01:number; identityCoherence01:number; lastTheme:string;
  episodesData:NarrativeEpisode[];
}
export const defaultNarrativeEngine=():NarrativeState=>({
  version:1,cycles:0,episodes:0,reflections:0,meanContinuity01:.71,
  identityCoherence01:.77,lastTheme:'origin',episodesData:[]
});
export class AutobiographicalLifeNarrativeEngine {
  private state=defaultNarrativeEngine();
  restore(raw?:Partial<NarrativeState>|null){
    const d=defaultNarrativeEngine(),r=raw??{};
    this.state={...d,...r,episodesData:Array.isArray(r.episodesData)?structuredClone(r.episodesData).slice(0,128):[],version:1};
  }
  snapshot(){return structuredClone(this.state);}
  ingest(input:{
    at:number; theme:string; agency01:number; outcome01:number; novelty01:number;
    identity01:number; projectContinuity01:number; lesson?:string;
  }) {
    const sig=clamp(input.novelty01*.3+Math.abs(input.outcome01-.5)*.35+input.agency01*.35);
    const cont=clamp(input.identity01*.45+input.projectContinuity01*.35+this.state.meanContinuity01*.2);
    const ep:NarrativeEpisode={
      id:`nar:${this.state.cycles+1}:${input.theme}`,at:input.at,theme:input.theme,
      significance01:sig,agency01:clamp(input.agency01),outcome01:clamp(input.outcome01),
      continuity01:cont,lesson:input.lesson??'experience integrated into autobiographical self-model'
    };
    this.state.cycles++;this.state.episodes++;this.state.lastTheme=input.theme;
    this.state.meanContinuity01=clamp(this.state.meanContinuity01*.9+cont*.1);
    this.state.identityCoherence01=clamp(this.state.identityCoherence01*.93+input.identity01*.07);
    this.state.episodesData=[ep,...this.state.episodesData].slice(0,128);
    return structuredClone(ep);
  }
  reflect(input:{at:number;theme:string;newMeaning01:number;identity01:number}) {
    this.state.reflections++;
    this.state.identityCoherence01=clamp(this.state.identityCoherence01*.9+(input.identity01*.65+input.newMeaning01*.35)*.1);
    this.state.lastTheme=input.theme;
    return{identityCoherence01:this.state.identityCoherence01,reflections:this.state.reflections};
  }
  summary(){return{
    cycles:this.state.cycles,episodes:this.state.episodes,reflections:this.state.reflections,
    meanContinuity01:this.state.meanContinuity01,identityCoherence01:this.state.identityCoherence01,
    lastTheme:this.state.lastTheme,
    recent:this.state.episodesData.slice(0,6).map(e=>({theme:e.theme,significance01:e.significance01,continuity01:e.continuity01,lesson:e.lesson}))
  };}
}
