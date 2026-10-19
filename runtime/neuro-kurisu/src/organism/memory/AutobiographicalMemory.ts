import type { ConsolidatedMemory } from '../core/types.ts';
import type { OrganismEvent } from './EventSourcing.ts';
import type { MemoryRecord } from './MultiTimescaleMemory.ts';

export class AutobiographicalMemory {
  buildEpisode(events: OrganismEvent[], now=Date.now()): MemoryRecord | null {
    if (!events.length) return null;
    const recent=events.slice(-24);
    const decisions=recent.filter(e=>e.type==='decision');
    const worlds=recent.filter(e=>e.type==='world-transition');
    const goals=recent.filter(e=>e.type==='goal-created');
    const recoveries=recent.filter(e=>e.type==='recovery');
    const firstId=recent[0].id; const lastId=recent.at(-1)!.id; const summary=`Episode tick ${recent[0].tick}-${recent.at(-1)!.tick}: ${decisions.length} decision(s), ${worlds.length} world transition(s), ${goals.length} goal creation(s), ${recoveries.length} recovery event(s).`;
    const evidence=recent.slice(-8).map(e=>`${e.type}@${e.tick}`);
    const salience=Math.min(1,0.25+decisions.length*0.03+worlds.length*0.05+goals.length*0.04+recoveries.length*0.10);
    const confidence=Math.min(1,0.45+recent.length/60);
    return { id:`auto-${firstId}-${lastId}`, kind:'episode', summary, salience, evidence, createdAt:now, timescale:'autobiographical', retrievalCount:0, lastRetrievedAt:0, confidence, sourceEventIds:recent.map(e=>e.id) };
  }
  pattern(events: OrganismEvent[], now=Date.now()): MemoryRecord | null {
    const decisions=events.filter(e=>e.type==='decision').slice(-100);
    if(decisions.length<10) return null;
    const counts=new Map<string,number>();
    for(const d of decisions){const a=String(d.payload.selectedAction??'wait'); counts.set(a,(counts.get(a)||0)+1);}
    const top=[...counts.entries()].sort((a,b)=>b[1]-a[1])[0];
    if(!top) return null;
    return { id:`pattern-${decisions.at(-1)!.id}`, kind:'pattern', summary:`Повторяющийся паттерн выбора: ${top[0]} (${top[1]}/${decisions.length}).`, salience:0.45, evidence:[...counts.entries()].map(([a,c])=>`${a}:${c}`), createdAt:now, timescale:'semantic', retrievalCount:0,lastRetrievedAt:0,confidence:0.62,sourceEventIds:decisions.slice(-20).map(e=>e.id) };
  }
}
