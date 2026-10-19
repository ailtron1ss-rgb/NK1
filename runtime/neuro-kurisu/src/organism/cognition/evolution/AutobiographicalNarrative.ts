import type { OrganismEvent } from '../../memory/EventSourcing.ts';
import type { SelfProject } from './SelfProjectEngine.ts';

export interface NarrativeChapter { id:string; title:string; evidenceIds:string[]; createdAt:number; lastUpdatedAt:number; salience:number; }
export interface AutobiographicalNarrativeState { version:2; chapters:NarrativeChapter[]; continuity:number; lastUpdatedAt:number; lastEvidenceKey:string; }
const clamp=(n:number)=>Math.max(0,Math.min(1,Number.isFinite(n)?n:0));
export function defaultNarrative():AutobiographicalNarrativeState{return{version:2,chapters:[],continuity:0.5,lastUpdatedAt:0,lastEvidenceKey:''};}
export class AutobiographicalNarrativeEngine{
  private state=defaultNarrative();
  restore(v:AutobiographicalNarrativeState|undefined){this.state={...defaultNarrative(),...(v||{}),version:2,chapters:[...(v?.chapters||[])],lastEvidenceKey:String(v?.lastEvidenceKey??'')};}
  snapshot(){return structuredClone(this.state);}
  summary(){return{version:2,chapterCount:this.state.chapters.length,continuity:this.state.continuity,salience01:this.state.chapters[0]?.salience??0,lastUpdatedAt:this.state.lastUpdatedAt};}
  update(input:{events:OrganismEvent[]; activeProjects:SelfProject[]; identityContinuity:number; revisionCount:number}){
    const p=input.activeProjects[0]; const important=input.events.slice(0,12).filter((e:any)=>e.type==='decision'||e.type==='world-transition'||e.type==='experiment');
    const evidenceKey=`${p?.id??'none'}|${important.map((e:any)=>e.id).join(',')}|${input.revisionCount}`;
    if(evidenceKey===this.state.lastEvidenceKey){ this.state.continuity=clamp(this.state.continuity*.98+input.identityContinuity*.02); return this.snapshot(); }
    this.state.lastEvidenceKey=evidenceKey;
    if(p && important.length){
      const title=`Глава: ${p.title}`;
      const existing=this.state.chapters.find(c=>c.title===title);
      if(existing){ existing.evidenceIds=[...new Set([...important.map((e:any)=>e.id),...existing.evidenceIds])].slice(0,32); existing.lastUpdatedAt=Date.now(); existing.salience=clamp(existing.salience+0.02); }
      else this.state.chapters.unshift({id:`chapter-${Date.now()}-${Math.random().toString(16).slice(2)}`,title,evidenceIds:important.map((e:any)=>e.id).slice(0,32),createdAt:Date.now(),lastUpdatedAt:Date.now(),salience:clamp(0.52+input.identityContinuity*0.24+Math.min(0.2,input.revisionCount*0.02))});
      this.state.chapters=this.state.chapters.slice(0,64);
    }
    this.state.continuity=clamp(this.state.continuity*0.86+input.identityContinuity*0.10+Math.min(1,this.state.chapters.length/12)*0.04); this.state.lastUpdatedAt=Date.now();
    return this.snapshot();
  }
}
