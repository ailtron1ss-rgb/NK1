import type { ActionKind } from '../core/types.ts';
import { PerceptualContinuityModel, defaultPerceptualContinuityState, type ContinuityState } from './PerceptualContinuityModel.ts';
import { PerceptualEpistemicGraph, defaultEpistemicState, type EpistemicState } from './PerceptualEpistemicGraph.ts';

const clamp = (n:number) => Math.max(0, Math.min(1, Number.isFinite(n) ? n : 0));
const now = () => Date.now();
const MAX_TRACK_GAP_MS=30_000;
const MAX_TRACK_ASSOCIATION_DISTANCE=.75;
function normalizePerceptualLabel(value:unknown):string{
  if(typeof value!=='string')return '';
  return value.normalize('NFKC').replace(/\s+/g,' ').trim().toLowerCase().slice(0,180);
}
function cleanTrackId(value:unknown):string{
  if(typeof value!=='string')return '';
  return value.normalize('NFKC').replace(/[\r\n\t]+/g,' ').trim().slice(0,120);
}
function finitePosition(x:unknown,y:unknown,z:unknown):{x:number;y:number;z:number}|null{
  if(![x,y,z].every(v=>typeof v==='number'&&Number.isFinite(v)))return null;
  return {x:Number(x),y:Number(y),z:Number(z)};
}
function positionDistance(a:{x:number;y:number;z:number},b:{x:number;y:number;z:number}):number{
  return Math.sqrt((a.x-b.x)**2+(a.y-b.y)**2+(a.z-b.z)**2);
}
const ACTIONS:ActionKind[] = ['respond','explore','verify','rest','reflect','wait','defer'];
export type P41Modality = 'text'|'vision'|'audio'|'sensor'|'world';
export type P41EvidenceKind = 'observed'|'model-output'|'derived'|'unresolved';
export type P41EntityKind = 'person'|'object'|'place'|'event'|'concept'|'body'|'unknown';

export interface P41PerceptualEntity {
  id:string;
  label:string;
  kind:P41EntityKind;
  /** Stable sensor/vendor track key. Absent for legacy singletons or untracked concepts. */
  trackId?:string;
  /** Coordinate-frame identifier; spatial association is forbidden across unknown/different frames. */
  positionFrameId?:string;
  /** IDs from other modalities that were safely associated with this same object track. */
  trackAliases?:string[];
  confidence01:number;
  salience01:number;
  present01:number;
  firstSeenAt:number;
  lastSeenAt:number;
  observations:number;
  modalities:P41Modality[];
  position:{x:number;y:number;z:number}|null;
  /** Smoothed velocity in the same coordinate frame as position, per second. */
  velocity?:{x:number;y:number;z:number}|null;
}

export interface P41PerceptualRelation {
  id:string;
  from:string;
  relation:string;
  to:string;
  confidence01:number;
  modality:P41Modality;
  evidenceKind:P41EvidenceKind;
  at:number;
}

export interface P41PerceptualEvent {
  id:string;
  label:string;
  confidence01:number;
  modalities:P41Modality[];
  startedAt:number;
  lastAt:number;
  persistence01:number;
  evidenceKind:P41EvidenceKind;
}

export interface P41PendingPerception {
  id:string;
  modality:P41Modality;
  query:string;
  expectedInformationGain01:number;
  estimatedCost01:number;
  priority01:number;
  createdAt:number;
  expiresAt:number;
  status:'pending'|'fulfilled'|'expired'|'rejected';
}

export interface P41PerceptualSnapshot {
  id:string;
  tick:number;
  at:number;
  scene:string;
  entityIds:string[];
  eventIds:string[];
  relationIds:string[];
  uncertainty01:number;
  coherence01:number;
  selfLocation:string;
}

export interface P41PerceptionState {
  version:1;
  tick:number;
  scene:{label:string;confidence01:number;stability01:number;at:number};
  entities:P41PerceptualEntity[];
  relations:P41PerceptualRelation[];
  events:P41PerceptualEvent[];
  snapshots:P41PerceptualSnapshot[];
  pending:P41PendingPerception[];
  modalityReliability:Record<P41Modality,{
    /** Empirical correctness estimate. Only independent/human-labelled outcomes may update it. */
    reliability01:number;
    observations:number;
    conflict01:number;
    latency01:number;
    /** Reported detector/model quality, deliberately kept separate from empirical accuracy. */
    reportedQuality01:number;
    /** Tool/service completion is not semantic correctness. */
    serviceSuccess01:number;
    calibrationSamples:number;
    calibrationMae01:number;
    calibrationBias01:number;
    lastVerifiedAt:number;
  }>;
  /** Bounded IDs prevent replaying one verifier receipt to inflate calibration. */
  calibrationEvidenceIds:string[];
  /** Monotonic IDs for anonymous spatial tracks. */
  nextTrackSequence:number;
  actionBias:Record<ActionKind,number>;
  metrics:{grounding01:number;temporalBinding01:number;objectPermanence01:number;crossModalAgreement01:number;crossModalEvidenceCoverage01:number;activePerceptionUtility01:number;unresolvedRate01:number;updates:number;sceneContinuity01:number;temporalGrounding01:number;evidenceTraceability01:number};
  continuity?:ContinuityState;
  epistemic?:EpistemicState;
  lastCheckpointAt:number;
  lastHash:string;
}

export const defaultP41SemanticPerception = ():P41PerceptionState => ({
  version:1,
  tick:0,
  scene:{label:'unknown',confidence01:.12,stability01:.15,at:0},
  entities:[], relations:[], events:[], snapshots:[], pending:[],
  modalityReliability:{
    text:{reliability01:.72,observations:0,conflict01:0,latency01:.15,reportedQuality01:.45,serviceSuccess01:.5,calibrationSamples:0,calibrationMae01:0,calibrationBias01:0,lastVerifiedAt:0},
    vision:{reliability01:.38,observations:0,conflict01:0,latency01:.48,reportedQuality01:.45,serviceSuccess01:.5,calibrationSamples:0,calibrationMae01:0,calibrationBias01:0,lastVerifiedAt:0},
    audio:{reliability01:.30,observations:0,conflict01:0,latency01:.46,reportedQuality01:.42,serviceSuccess01:.5,calibrationSamples:0,calibrationMae01:0,calibrationBias01:0,lastVerifiedAt:0},
    sensor:{reliability01:.62,observations:0,conflict01:0,latency01:.18,reportedQuality01:.62,serviceSuccess01:.5,calibrationSamples:0,calibrationMae01:0,calibrationBias01:0,lastVerifiedAt:0},
    world:{reliability01:.66,observations:0,conflict01:0,latency01:.14,reportedQuality01:.66,serviceSuccess01:.5,calibrationSamples:0,calibrationMae01:0,calibrationBias01:0,lastVerifiedAt:0},
  },
  actionBias:Object.fromEntries(ACTIONS.map(a=>[a,0])) as Record<ActionKind,number>,
  metrics:{grounding01:.18,temporalBinding01:.12,objectPermanence01:.05,crossModalAgreement01:.5,crossModalEvidenceCoverage01:0,activePerceptionUtility01:.1,unresolvedRate01:0,updates:0,sceneContinuity01:.1,temporalGrounding01:.1,evidenceTraceability01:.1},
  continuity:defaultPerceptualContinuityState(),
  epistemic:defaultEpistemicState(),
  calibrationEvidenceIds:[],
  nextTrackSequence:0,
  lastCheckpointAt:0,lastHash:'',
});

function stableId(prefix:string, seed:string){
  let h=2166136261;
  for(let i=0;i<seed.length;i++){h^=seed.charCodeAt(i);h=Math.imul(h,16777619);}
  return `${prefix}-${(h>>>0).toString(16).padStart(8,'0')}`;
}

export interface P41SemanticInput {
  text?:string;
  vision?:{
    cameraId?:number;
    sceneLabel?:string;
    confidence01?:number;
    objects?:Array<{label:string;kind?:P41EntityKind;confidence01?:number;trackId?:string;sourceId?:string;coordinateFrameId?:string;x?:number;y?:number;z?:number}>;
    relations?:Array<{from:string;relation:string;to:string;confidence01?:number}>;
    events?:Array<{label:string;confidence01?:number}>;
    latencyMs?:number;
    semantic:boolean;
  };
  audio?:{events?:Array<{label:string;confidence01?:number}>;relations?:Array<{from:string;relation:string;to:string;confidence01?:number}>;latencyMs?:number;semantic:boolean};
  sensor?:{location?:string;orientationDeg?:number;energy01?:number;thermal01?:number;capacity01?:number;motion01?:number;freshness01?:number};
  world?:{scene?:string;objects?:Array<{label:string;kind?:P41EntityKind;confidence01?:number;trackId?:string;sourceId?:string;coordinateFrameId?:string}>;events?:string[]};
  at?:number;
}

export class P41SemanticPerceptionEngine {
  private state = defaultP41SemanticPerception();
  private readonly continuity = new PerceptualContinuityModel();
  private readonly epistemic = new PerceptualEpistemicGraph();

  restore(raw?:Partial<P41PerceptionState>|null){
    const d=defaultP41SemanticPerception(); const r=raw??{};
    this.state={...d,...r,
      scene:{...d.scene,...(r.scene??{})},
      entities:Array.isArray(r.entities)?r.entities.slice(-192):[],
      relations:Array.isArray(r.relations)?r.relations.slice(-384):[],
      events:Array.isArray(r.events)?r.events.slice(-128):[],
      snapshots:Array.isArray(r.snapshots)?r.snapshots.slice(-128):[],
      pending:Array.isArray(r.pending)?r.pending.slice(-64):[],
      modalityReliability:Object.fromEntries((Object.keys(d.modalityReliability) as P41Modality[]).map(modality=>[
        modality,{...d.modalityReliability[modality],...(r.modalityReliability?.[modality]??{})}
      ])) as P41PerceptionState['modalityReliability'],
      actionBias:{...d.actionBias,...(r.actionBias??{})},
      metrics:{...d.metrics,...(r.metrics??{})},
      calibrationEvidenceIds:Array.isArray(r.calibrationEvidenceIds)?r.calibrationEvidenceIds.filter((x):x is string=>typeof x==='string').slice(-256):[],
      nextTrackSequence:Number.isSafeInteger(r.nextTrackSequence)&&Number(r.nextTrackSequence)>=0?Number(r.nextTrackSequence):0,
      continuity:d.continuity,
      epistemic:d.epistemic,
    };
    this.continuity.restore(r.continuity as any);
    this.epistemic.restore(r.epistemic as any);
    this.state.continuity=this.continuity.snapshot();
    this.state.epistemic=this.epistemic.snapshot();
  }

  snapshot(){return structuredClone(this.state);}

  ingest(input:P41SemanticInput){
    const requestedAt=Number(input.at??now());
    const latestAt=this.state.snapshots[0]?.at??0;
    if(!Number.isFinite(requestedAt)||requestedAt<0)return this.snapshot();
    if(latestAt>0&&requestedAt<latestAt)return this.snapshot();
    const at=requestedAt;
    if(input.text?.trim()) this.ingestText(input.text,at);
    if(input.vision) this.ingestVision(input.vision,at);
    if(input.audio) this.ingestAudio(input.audio,at);
    if(input.sensor) this.ingestSensor(input.sensor,at);
    if(input.world) this.ingestWorld(input.world,at);
    this.expirePending(at);
    this.reconcile(at);
    const activeIds=this.state.entities.filter(e=>e.present01>.25).slice(0,32).map(e=>e.id);
    const previousIds=this.state.snapshots[0]?.entityIds??[];
    this.state.continuity=this.continuity.observe({scene:this.state.scene.label,at,entityIds:activeIds,previousEntityIds:previousIds});
    this.state.metrics.sceneContinuity01=this.state.continuity.sceneContinuity01;
    this.state.metrics.temporalGrounding01=this.state.continuity.temporalGrounding01;
    this.state.epistemic=this.epistemic.snapshot();
    this.state.metrics.evidenceTraceability01=clamp(Math.min(1,this.state.epistemic.claims.length/32));
    this.state.snapshots.unshift({
      id:stableId('snapshot',`${this.state.tick}:${at}:${this.state.scene.label}`),tick:this.state.tick,at,
      scene:this.state.scene.label,entityIds:this.state.entities.filter(e=>e.present01>.25).slice(0,32).map(e=>e.id),
      eventIds:this.state.events.slice(0,16).map(e=>e.id),relationIds:this.state.relations.slice(0,32).map(r=>r.id),
      uncertainty01:clamp(1-this.state.metrics.crossModalAgreement01),coherence01:clamp((this.state.metrics.grounding01+this.state.metrics.temporalBinding01)/2),selfLocation: this.state.entities.find(e=>e.kind==='body')?.label??'unknown'
    });
    this.state.snapshots=this.state.snapshots.slice(0,128);
    this.state.tick++;
    this.state.metrics.updates++;
    return this.snapshot();
  }

  ingestText(text:string,at:number){
    const tokens=[...new Set(text.toLowerCase().split(/[^a-zа-яё0-9_-]+/i).filter(x=>x.length>=4))].slice(0,16);
    for(const token of tokens){ this.upsertEntity(token,token.includes('курис')?'person':'concept',.46,.28,'text',at,null,'derived'); }
    this.recordModality('text',.45,0);
  }

  ingestVision(v:NonNullable<P41SemanticInput['vision']>,at:number){
    if(!v.semantic){ this.queuePending('vision','semantic scene/object extraction',.74,.5,at); this.epistemic.add({at,modality:'vision',claim:'semantic-vision-unresolved',source:'unresolved',confidence01:.12}); return; }
    if(v.sceneLabel){
      const label=normalizePerceptualLabel(v.sceneLabel).slice(0,120);
      this.state.scene={label,confidence01:clamp(v.confidence01??.55),stability01:clamp(this.state.scene.label===label?this.state.scene.stability01+.08:.42),at};
      this.epistemic.add({at,modality:'vision',claim:`scene:${label}`,source:'model-output',confidence01:Number(v.confidence01??.55)});
    }
    const targets:string[]=[];
    const cameraId=Math.max(0,Math.floor(Number(v.cameraId??0)||0));
    for(const o of (v.objects??[]).slice(0,32)){
      const suppliedTrackId=cleanTrackId(o.trackId);
      const namespacedTrackId=suppliedTrackId?'vision:'+cameraId+':'+(cleanTrackId(o.sourceId)||'backend')+':'+suppliedTrackId:undefined;
      const position=finitePosition(o.x,o.y,o.z);
      const positionFrameId=cleanTrackId(o.coordinateFrameId);
      const e=this.upsertEntity(String(o.label),o.kind??'object',clamp(o.confidence01??.5),.66,'vision',at,position,'model-output',namespacedTrackId,positionFrameId);
      if(e)targets.push(e.id);
    }
    for(const e of (v.events??[]).slice(0,16)) this.upsertEvent(String(e.label),clamp(e.confidence01??.45),'vision',at,'model-output');
    for(const r of (v.relations??[]).slice(0,32)) this.upsertRelation(r.from,r.relation,r.to,clamp(r.confidence01??.5),'vision',at,'model-output');
    if(targets.length)this.epistemic.add({at,modality:'vision',claim:`objects:${targets.length}`,source:'model-output',confidence01:Number(v.confidence01??.5),targetIds:targets});
    this.recordModality('vision',Number(v.confidence01??.45),Number(v.latencyMs??750));
  }

  ingestAudio(a:NonNullable<P41SemanticInput['audio']>,at:number){
    if(!a.semantic){ this.queuePending('audio','semantic audio event extraction',.68,.42,at); this.epistemic.add({at,modality:'audio',claim:'semantic-audio-unresolved',source:'unresolved',confidence01:.1}); return; }
    for(const e of (a.events??[]).slice(0,16)) this.upsertEvent(String(e.label),clamp(e.confidence01??.42),'audio',at,'model-output');
    for(const r of (a.relations??[]).slice(0,16)) this.upsertRelation(r.from,r.relation,r.to,clamp(r.confidence01??.42),'audio',at,'model-output');
    this.recordModality('audio',.42,Number(a.latencyMs??650));
  }

  ingestSensor(s:NonNullable<P41SemanticInput['sensor']>,at:number){
    const label=String(s.location??'host-local');
    this.upsertEntity(label,'place',.82,.35,'sensor',at,null,'observed');
    this.upsertEntity(`body@${label}`,'body',.92,.42,'sensor',at,null,'observed');
    this.recordModality('sensor',clamp(s.freshness01??.85),0);
  }

  ingestWorld(w:NonNullable<P41SemanticInput['world']>,at:number){
    if(w.scene){ const label=String(w.scene).slice(0,120); this.state.scene={label,confidence01:.68,stability01:clamp(this.state.scene.label===label?this.state.scene.stability01+.05:.5),at}; this.epistemic.add({at,modality:'world',claim:`scene:${label}`,source:'observed',confidence01:.68}); }
    for(const o of (w.objects??[]).slice(0,24)){
      const suppliedTrackId=cleanTrackId(o.trackId);
      const namespacedTrackId=suppliedTrackId?'world:'+(cleanTrackId(o.sourceId)||'canonical')+':'+suppliedTrackId:undefined;
      this.upsertEntity(String(o.label),o.kind??'object',clamp(o.confidence01??.6),.52,'world',at,null,'observed',namespacedTrackId);
    }
    for(const e of (w.events??[]).slice(0,16)) this.upsertEvent(String(e),.6,'world',at,'observed');
    this.recordModality('world',.7,0);
  }

  private queuePending(modality:P41Modality,query:string,gain:number,cost:number,at:number){
    const id=stableId('pending',`${modality}:${query}`); if(this.state.pending.some(x=>x.id===id&&x.status==='pending')) return;
    this.state.pending.unshift({id,modality,query,expectedInformationGain01:clamp(gain),estimatedCost01:clamp(cost),priority01:clamp(gain/(.1+cost)),createdAt:at,expiresAt:at+300000,status:'pending'});
    this.state.pending=this.state.pending.slice(0,64);
  }

  private expirePending(at:number){ for(const p of this.state.pending){ if(p.status==='pending'&&p.expiresAt<=at) p.status='expired'; } }

  private upsertEntity(label:string,kind:P41EntityKind,confidence01:number,salience01:number,modality:P41Modality,at:number,pos:{x:number;y:number;z:number}|null,evidenceKind:P41EvidenceKind,suppliedTrackId?:string,positionFrameId?:string){
    const key=normalizePerceptualLabel(label); if(!key) return null;
    const explicitTrackId=cleanTrackId(suppliedTrackId);
    const safePositionFrameId=cleanTrackId(positionFrameId);
    let e=explicitTrackId?this.state.entities.find(x=>x.trackId===explicitTrackId||x.trackAliases?.includes(explicitTrackId)):undefined;
    // Cross-modal association is allowed only when there is exactly one recent
    // same-label candidate that has not already been observed by this modality.
    // Ambiguous repeated objects remain separate instead of being force-merged.
    if(!e&&explicitTrackId){
      const crossModal=this.state.entities.filter(x=>x.label===key&&x.kind===kind&&!x.modalities.includes(modality)&&at>=x.lastSeenAt&&at-x.lastSeenAt<=5_000);
      if(crossModal.length===1){
        e=crossModal[0];
        e.trackAliases=[...new Set([...(e.trackAliases??[]),explicitTrackId])].slice(-12);
      }
    }
    // Spatial nearest-neighbour association is only used when observations share
    // a coordinate frame. A same-frame detection cannot consume a track twice.
    if(!e&&pos){
      const candidates=this.state.entities
        .filter(x=>x.label===key&&x.kind===kind&&safePositionFrameId&&x.positionFrameId===safePositionFrameId&&x.position&&x.lastSeenAt<at&&at-x.lastSeenAt<=MAX_TRACK_GAP_MS)
        .map(x=>({entity:x,distance:positionDistance(x.position!,pos)}))
        .filter(x=>x.distance<=MAX_TRACK_ASSOCIATION_DISTANCE)
        .sort((a,b)=>a.distance-b.distance);
      e=candidates[0]?.entity;
    }
    // Without either a provider track ID or geometry, retain legacy singleton
    // semantics rather than manufacturing multiple indistinguishable objects.
    if(!e&&!explicitTrackId&&!pos)e=this.state.entities.find(x=>x.label===key&&x.kind===kind&&!x.trackId);
    const canTrackPosition=Boolean(pos&&safePositionFrameId);
    const trackId=explicitTrackId??(!e&&canTrackPosition?'auto-track-'+(++this.state.nextTrackSequence):undefined);
    if(!e){
      const id=stableId('entity',kind+':'+key+':'+(trackId??'singleton'));
      e={id,label:key,kind,...(trackId?{trackId}:{}),confidence01:clamp(confidence01),salience01:clamp(salience01),present01:1,firstSeenAt:at,lastSeenAt:at,observations:1,modalities:[modality],position:pos,positionFrameId:safePositionFrameId||undefined,velocity:null,trackAliases:[]};
      this.state.entities.unshift(e);
    }else{
      const previousAt=e.lastSeenAt;
      const previousPosition=e.position;
      if(pos&&previousPosition&&safePositionFrameId&&e.positionFrameId===safePositionFrameId&&at>previousAt&&at-previousAt<=MAX_TRACK_GAP_MS){
        const dt=Math.max(.001,(at-previousAt)/1000);
        const measured={x:(pos.x-previousPosition.x)/dt,y:(pos.y-previousPosition.y)/dt,z:(pos.z-previousPosition.z)/dt};
        e.velocity=e.velocity
          ? {x:e.velocity.x*.65+measured.x*.35,y:e.velocity.y*.65+measured.y*.35,z:e.velocity.z*.65+measured.z*.35}
          : measured;
      }
      e.confidence01=clamp(e.confidence01*.72+confidence01*.28);
      e.salience01=clamp(e.salience01*.72+salience01*.28);
      e.present01=clamp(e.present01*.6+.4);
      e.lastSeenAt=at;
      e.observations++;
      if(!e.modalities.includes(modality))e.modalities.push(modality);
      if(pos)e.position=pos;
      if(safePositionFrameId)e.positionFrameId=safePositionFrameId;
      if(explicitTrackId&&e.trackId&&e.trackId!==explicitTrackId){
        e.trackAliases=[...new Set([...(e.trackAliases??[]),explicitTrackId])].slice(-12);
      }else if(explicitTrackId&&!e.trackId)e.trackId=explicitTrackId;
      else if(trackId&&!e.trackId)e.trackId=trackId;
    }
    this.state.entities=this.state.entities.slice(0,192);
    return e;
  }

  private upsertRelation(from:string,relation:string,to:string,confidence01:number,modality:P41Modality,at:number,evidenceKind:P41EvidenceKind){
    const id=stableId('rel',`${from}:${relation}:${to}`);
    const existing=this.state.relations.find(x=>x.id===id);
    if(existing){existing.confidence01=clamp(existing.confidence01*.8+confidence01*.2);existing.at=at;existing.evidenceKind=evidenceKind;}
    else this.state.relations.unshift({id,from,relation,to,confidence01:clamp(confidence01),modality,evidenceKind,at});
    this.state.relations=this.state.relations.slice(0,384);
  }

  private upsertEvent(label:string,confidence01:number,modality:P41Modality,at:number,evidenceKind:P41EvidenceKind){
    const key=normalizePerceptualLabel(label); if(!key)return;
    let e=this.state.events.find(x=>x.label===key);
    if(!e)e={id:stableId('event',key),label:key,confidence01:clamp(confidence01),modalities:[modality],startedAt:at,lastAt:at,persistence01:.5,evidenceKind};
    else {e.confidence01=clamp(e.confidence01*.78+confidence01*.22);e.lastAt=at;e.persistence01=clamp(e.persistence01*.82+.18);if(!e.modalities.includes(modality))e.modalities.push(modality);e.evidenceKind=evidenceKind;}
    if(!this.state.events.some(x=>x.id===e!.id))this.state.events.unshift(e!);
    this.state.events=this.state.events.slice(0,128);
  }

  private recordModality(modality:P41Modality,quality01:number,latencyMs:number){
    const h=this.state.modalityReliability[modality];
    h.observations++;
    h.reportedQuality01=clamp(h.reportedQuality01*.94+clamp(quality01)*.06);
    h.latency01=clamp(h.latency01*.9+clamp(latencyMs/15000)*.1);
  }

  /** Only independent verification or a human label may update empirical modality accuracy. */
  observeModalityOutcome(input:{
    modality:P41Modality;
    predictedConfidence01:number;
    correctness01:number;
    evidenceId:string;
    evidenceSource:'human-annotation'|'independent-verifier';
    at?:number;
  }):boolean{
    if(input.evidenceSource!=='human-annotation'&&input.evidenceSource!=='independent-verifier')return false;
    const evidenceId=cleanTrackId(input.evidenceId);
    if(!evidenceId||this.state.calibrationEvidenceIds.includes(evidenceId))return false;
    if(!Number.isFinite(input.predictedConfidence01)||!Number.isFinite(input.correctness01))return false;
    if(input.predictedConfidence01<0||input.predictedConfidence01>1||input.correctness01<0||input.correctness01>1)return false;
    const at=Number.isFinite(input.at)&&Number(input.at)>0?Number(input.at):now();
    const h=this.state.modalityReliability[input.modality];
    const error=Math.abs(input.predictedConfidence01-input.correctness01);
    const bias=input.predictedConfidence01-input.correctness01;
    h.reliability01=clamp(h.reliability01*.9+input.correctness01*.1);
    h.calibrationMae01=clamp(h.calibrationSamples===0?error:h.calibrationMae01*.9+error*.1);
    h.calibrationBias01=clampSigned(h.calibrationSamples===0?bias:h.calibrationBias01*.9+bias*.1);
    h.calibrationSamples++;
    h.lastVerifiedAt=at;
    this.state.calibrationEvidenceIds.unshift(evidenceId);
    this.state.calibrationEvidenceIds=this.state.calibrationEvidenceIds.slice(0,256);
    return true;
  }

  private reconcile(at:number){
    for(const e of this.state.entities){const age=Math.max(0,at-e.lastSeenAt);e.present01=clamp(e.present01*Math.exp(-Math.min(age,300000)/180000));}
    const active=this.state.entities.filter(e=>e.present01>.25).slice(0,32);
    // Confidence priors from unrelated modalities do not prove agreement.
    // Track the fraction of active entities independently corroborated by at
    // least two modalities; retain crossModalAgreement as an outcome-calibrated
    // metric until explicit contradictory evidence is available.
    const corroborated=active.filter(e=>new Set(e.modalities).size>=2).length;
    const coverage=active.length?corroborated/active.length:0;
    this.state.metrics.crossModalEvidenceCoverage01=clamp(this.state.metrics.crossModalEvidenceCoverage01*.9+coverage*.1);
    const unresolved=this.state.pending.filter(x=>x.status==='pending').length;
    this.state.metrics.unresolvedRate01=clamp(unresolved/Math.max(1,this.state.pending.length));
    this.state.metrics.grounding01=clamp(this.state.metrics.grounding01*.95+(active.length? .65:.05)*.05);
    const previous=this.state.snapshots[0];
    this.state.metrics.temporalBinding01=clamp(this.state.metrics.temporalBinding01*.95+(previous? .75:.1)*.05);
    const repeated=active.filter(e=>e.observations>1).length;
    this.state.metrics.objectPermanence01=clamp(this.state.metrics.objectPermanence01*.94+Math.min(1,repeated/8)*.06);
    const bestPending=this.state.pending.filter(p=>p.status==='pending').sort((a,b)=>b.priority01-a.priority01)[0];
    this.state.metrics.activePerceptionUtility01=clamp(bestPending?.priority01??this.state.metrics.activePerceptionUtility01*.96);
    const restRisk=clamp((1-this.state.metrics.crossModalAgreement01)*.25+(1-this.state.metrics.grounding01)*.15);
    this.state.actionBias.rest=clamp(this.state.actionBias.rest*.92+restRisk*.08);
    this.state.actionBias.verify=clampSigned(this.state.actionBias.verify*.92+(1-this.state.metrics.crossModalAgreement01)*.08);
    this.state.actionBias.explore=clampSigned(this.state.actionBias.explore*.92+(this.state.metrics.objectPermanence01>0.5?.02:0));
    this.state.actionBias.respond=clampSigned(this.state.actionBias.respond*.92+this.state.modalityReliability.text.reliability01*.025);
    this.state.actionBias.reflect=clampSigned(this.state.actionBias.reflect*.92+(this.state.metrics.unresolvedRate01*.02));
    this.state.actionBias.wait=clampSigned(this.state.actionBias.wait*.92+(this.state.metrics.crossModalAgreement01<.4?.025:0));
    this.state.actionBias.defer=clampSigned(this.state.actionBias.defer*.92+restRisk*.025);
    this.state.lastCheckpointAt=at;
  }

  nextPerception(at=now()){
    this.expirePending(at);
    return this.state.pending.filter(x=>x.status==='pending'&&x.expiresAt>at).sort((a,b)=>b.priority01-a.priority01)[0]??null;
  }
  bias(action:ActionKind){return Number(this.state.actionBias[action]??0);}
  fulfill(id:string,success:boolean,at=now()){
    const p=this.state.pending.find(x=>x.id===id);
    if(!p||p.status!=='pending')return false;
    if(!Number.isFinite(at)||at>=p.expiresAt){p.status='expired';return false;}
    p.status=success?'fulfilled':'rejected';
    const h=this.state.modalityReliability[p.modality];
    h.serviceSuccess01=clamp(h.serviceSuccess01*.9+(success?1:0)*.1);
    return true;
  }
  observeOutcome(success01:number,surprise01:number){const s=clamp(success01),u=clamp(surprise01);this.state.metrics.crossModalAgreement01=clamp(this.state.metrics.crossModalAgreement01*.93+s*.04-u*.03);return this.snapshot();}
  semanticSummary(){return {scene:this.state.scene,entities:this.state.entities.slice(0,12),events:this.state.events.slice(0,8),relations:this.state.relations.slice(0,16),nextPerception:this.nextPerception(),metrics:this.state.metrics,continuity:this.continuity.snapshot(),epistemic:this.epistemic.summary()};}
}
function clampSigned(n:number){return Math.max(-1,Math.min(1,Number.isFinite(n)?n:0));}
