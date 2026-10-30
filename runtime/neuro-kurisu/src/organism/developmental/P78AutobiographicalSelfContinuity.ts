export type P78EvidenceStatus = 'verified-independent'|'observed'|'unverified';
export type P78Authorship = 'self-initiated'|'self-selected'|'user-directed'|'system'|'unknown';

/**
 * P78 records autobiographical continuity, not an unqualified truth ledger.
 * Outcomes and authorship only contribute to their respective confidence metrics
 * when their provenance is explicit. Legacy events remain readable but are treated
 * as unverified/unknown rather than silently upgraded to evidence.
 */
export interface P78Event {
  at:number;
  tick:number;
  action:string;
  outcome?:number|null;
  text?:string;
  mode?:string;
  evidenceStatus?:P78EvidenceStatus;
  evidenceRef?:string;
  authorship?:P78Authorship;
  episodeId?:string;
}
export interface P78State {
  version:2;
  chapters:number;
  samples:number;
  continuity01:number;
  narrativeCoherence01:number;
  selfAuthorship01:number;
  turningPoints:number;
  recentSummary:string;
  chaptersData:Array<{id:string;fromTick:number;toTick:number;summary:string;significance01:number}>;
  lastObservationKey:string;
  verifiedOutcomeSamples:number;
  unverifiedOutcomeSamples:number;
  authorshipEvidenceSamples:number;
  /** Bounded event-level replay ledger; survives restart to prevent non-adjacent duplicates. */
  processedEventKeys:string[];
}
const clamp=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
const boundedText=(value:unknown,max=180)=>String(value??'').replace(/[\u0000-\u001f\u007f-\u009f]/g,' ').replace(/\s+/g,' ').trim().slice(0,max);
const hasBoundEvidence=(event:P78Event)=>event.evidenceStatus==='verified-independent'&&/^([a-z][a-z0-9-]*):[^\s]{1,220}$/i.test(String(event.evidenceRef??'').trim());
const isAuthored=(event:P78Event)=>event.authorship==='self-initiated'||event.authorship==='self-selected';
export const defaultP78=():P78State=>({
  version:2,chapters:0,samples:0,continuity01:.5,narrativeCoherence01:.5,selfAuthorship01:.5,
  turningPoints:0,recentSummary:'История ещё не содержит подтверждённых автобиографических наблюдений.',
  chaptersData:[],lastObservationKey:'',verifiedOutcomeSamples:0,unverifiedOutcomeSamples:0,authorshipEvidenceSamples:0,processedEventKeys:[]
});
export class P78AutobiographicalSelfContinuity{
  private state=JSON.parse(JSON.stringify(defaultP78())) as P78State;
  restore(raw:Partial<P78State>|undefined){
    if(!raw)return;
    const d=defaultP78();
    const counter=(value:unknown)=>{
      const n=Number(value);
      return Number.isSafeInteger(n)&&n>=0?n:0;
    };
    const chaptersData=Array.isArray(raw.chaptersData)?raw.chaptersData.slice(-32).map((row:any,index:number)=>({
      id:boundedText(row?.id,96)||`chapter:restored:${index}`,
      fromTick:counter(row?.fromTick),toTick:counter(row?.toTick),
      summary:boundedText(row?.summary,240),
      significance01:clamp(Number(row?.significance01??0))
    })):[];
    this.state={
      ...d,...raw,version:2,
      chapters:counter(raw.chapters),
      samples:counter(raw.samples),
      chaptersData,
      recentSummary:boundedText(raw.recentSummary,512)||d.recentSummary,
      lastObservationKey:boundedText(raw.lastObservationKey,4096),
      verifiedOutcomeSamples:counter(raw.verifiedOutcomeSamples),
      unverifiedOutcomeSamples:counter(raw.unverifiedOutcomeSamples),
      authorshipEvidenceSamples:counter(raw.authorshipEvidenceSamples),
      processedEventKeys:Array.isArray(raw.processedEventKeys)
        ? [...new Set(raw.processedEventKeys.filter((x):x is string=>typeof x==='string'&&x.length>0&&x.length<=2048))].slice(-512)
        : []
    };
    for(const key of ['continuity01','narrativeCoherence01','selfAuthorship01'] as const){
      this.state[key]=clamp(Number(this.state[key]));
    }
  }
  snapshot(){return JSON.parse(JSON.stringify(this.state)) as P78State;}
  observe(events:P78Event[]){
    const candidates=events.slice(-16).filter(e=>e&&Number.isFinite(e.tick)&&Number.isFinite(e.at)&&typeof e.action==='string');
    const eventKey=(e:P78Event)=>JSON.stringify([
      e.tick,e.at,boundedText(e.action,48),e.outcome??'',boundedText(e.text,120),boundedText(e.mode,32),
      e.evidenceStatus??'legacy-unverified',boundedText(e.evidenceRef,220),e.authorship??'unknown',boundedText(e.episodeId,80)
    ]);
    const seen=new Set(this.state.processedEventKeys);
    const recent=candidates.filter(e=>{const key=eventKey(e);if(seen.has(key))return false;seen.add(key);return true;});
    if(!recent.length)return this.snapshot();
    this.state.processedEventKeys=[...this.state.processedEventKeys,...recent.map(eventKey)].slice(-512);
    const observationKey=recent.map(e=>[
      e.tick,e.at,boundedText(e.action,48),e.outcome??'',boundedText(e.text,120),boundedText(e.mode,32),
      e.evidenceStatus??'legacy-unverified',boundedText(e.evidenceRef,220),e.authorship??'unknown',boundedText(e.episodeId,80)
    ].join('|')).join('\\u001f').slice(-4096);
    if(observationKey===this.state.lastObservationKey)return this.snapshot();
    this.state.lastObservationKey=observationKey;
    this.state.samples+=recent.length;
    const actions=new Set(recent.map(e=>boundedText(e.action,48)));
    const verified=recent.filter(e=>typeof e.outcome==='number'&&Number.isFinite(e.outcome)&&hasBoundEvidence(e));
    const rawOutcomes=recent.filter(e=>typeof e.outcome==='number'&&Number.isFinite(e.outcome));
    const authored=recent.filter(isAuthored);
    const authorshipKnown=recent.filter(e=>e.authorship&&e.authorship!=='unknown');
    this.state.verifiedOutcomeSamples+=verified.length;
    this.state.unverifiedOutcomeSamples+=Math.max(0,rawOutcomes.length-verified.length);
    this.state.authorshipEvidenceSamples+=authorshipKnown.length;
    const outcomeVariance=verified.length>1
      ?Math.min(1,new Set(verified.map(e=>Math.round((e.outcome??0)*10))).size/5):0;
    const authorshipRatio=authorshipKnown.length?authored.length/authorshipKnown.length:0;
    const evidenceCoverage=verified.length/Math.max(1,rawOutcomes.length);
    const significance=clamp(.12+outcomeVariance*.24+authorshipRatio*.24+evidenceCoverage*.24+(actions.size/6)*.16);
    const from=recent[0]!.tick,to=recent[recent.length-1]!.tick;
    const modes=new Set(recent.map(e=>boundedText(e.mode,32)||'unknown'));
    const summary=`Период ${from}–${to}: действия=${[...actions].slice(0,4).join(',')||'none'}; подтверждённые независимые исходы=${verified.length}; неподтверждённые исходы=${rawOutcomes.length-verified.length}; подтверждённое авторство=${authorshipKnown.length}; режимы=${modes.size}.`;
    const groundedNarrative=clamp((actions.size/6)*.55+evidenceCoverage*.30+Math.min(1,authorshipKnown.length/Math.max(1,recent.length))*.15);
    this.state.narrativeCoherence01=clamp(this.state.narrativeCoherence01*.92+groundedNarrative*.08);
    if(authorshipKnown.length){
      this.state.selfAuthorship01=clamp(this.state.selfAuthorship01*.9+authorshipRatio*.1);
    }
    if(verified.length){
      this.state.continuity01=clamp(this.state.continuity01*.94+(1-Math.min(1,Math.abs(outcomeVariance-.4))*.3)*.06);
    }
    if(significance>.68&&verified.length>0){
      this.state.turningPoints++;
      this.state.chapters++;
      this.state.chaptersData=[...this.state.chaptersData,{
        id:`p78:${to}:${this.state.chapters}`,fromTick:from,toTick:to,summary,significance01:significance
      }].slice(-32);
    }
    this.state.recentSummary=summary;
    return this.snapshot();
  }
}
