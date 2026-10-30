import { randomUUID } from 'node:crypto';

export interface NormalizedBoundingBox {
  /** Normalized image coordinates in [0, 1], origin at top-left. */
  x:number;
  y:number;
  width:number;
  height:number;
}

export interface TemporalDetection {
  label:string;
  kind?:'person'|'object'|'place'|'event'|'concept'|'body'|'unknown';
  confidence01?:number;
  trackId?:string;
  sourceId?:string;
  bbox?:NormalizedBoundingBox;
  bboxConfidence01?:number;
}

export interface TemporalTrackedDetection extends TemporalDetection {
  trackId?:string;
  sourceId?:string;
  trackingStatus?:'provider'|'associated'|'new'|'ambiguous'|'untracked';
}

export interface TemporalObjectTrackerConfig {
  /** Maximum gap in which a previous 2D track may be associated again. */
  maxTrackGapMs?:number;
  /** Retain an unseen track for this long before it is discarded. */
  maxTrackAgeMs?:number;
  /** Minimum overlap/proximity score for a candidate association. */
  minimumAssociationScore?:number;
  /** Required score margin over the second-best candidate. */
  ambiguityMargin?:number;
  /** Minimum box-localization confidence to associate with an existing track. */
  minimumBoxConfidence01?:number;
  /** Higher confidence required before a detection may create a new local identity. */
  minimumNewTrackBoxConfidence01?:number;
  maxTracksPerCamera?:number;
  sessionId?:string;
}

export interface TemporalObjectTrackerMetrics {
  cameraId:number;
  at:number;
  acceptedFrame:boolean;
  reason?:'invalid-frame'|'stale-frame'|'duplicate-frame';
  inputCount:number;
  validBoxCount:number;
  providerTrackCount:number;
  associatedTrackCount:number;
  newTrackCount:number;
  ambiguousCount:number;
  untrackedCount:number;
  activeTrackCount:number;
}

interface Track {
  id:string;
  label:string;
  kind:string;
  bbox:NormalizedBoundingBox;
  confidence01:number;
  firstSeenAt:number;
  lastSeenAt:number;
  hits:number;
  providerOwned:boolean;
  velocityX:number;
  velocityY:number;
  velocityWidth:number;
  velocityHeight:number;
}

interface CameraState {
  lastFrameAt:number;
  lastFrameId?:string;
  tracks:Track[];
}

interface MatchEdge {
  detectionIndex:number;
  trackId:string;
  score:number;
}

const clamp=(n:number)=>Math.max(0,Math.min(1,Number.isFinite(n)?n:0));
const clean=(value:unknown,max=120)=>typeof value==='string'?value.normalize('NFKC').replace(/[\r\n\t]+/g,' ').trim().slice(0,max):'';
const kindOf=(value:unknown)=>clean(value,32)||'unknown';

export function isValidNormalizedBoundingBox(value:unknown):value is NormalizedBoundingBox {
  if(!value||typeof value!=='object')return false;
  const box=value as Record<string,unknown>;
  if(![box.x,box.y,box.width,box.height].every(v=>typeof v==='number'&&Number.isFinite(v)))return false;
  const x=Number(box.x),y=Number(box.y),width=Number(box.width),height=Number(box.height);
  return x>=0&&y>=0&&width>0&&height>0&&x+width<=1.000001&&y+height<=1.000001;
}

function center(box:NormalizedBoundingBox){return {x:box.x+box.width/2,y:box.y+box.height/2};}
function intersectionOverUnion(a:NormalizedBoundingBox,b:NormalizedBoundingBox){
  const left=Math.max(a.x,b.x),top=Math.max(a.y,b.y);
  const right=Math.min(a.x+a.width,b.x+b.width),bottom=Math.min(a.y+a.height,b.y+b.height);
  const intersection=Math.max(0,right-left)*Math.max(0,bottom-top);
  const union=a.width*a.height+b.width*b.height-intersection;
  return union>0?intersection/union:0;
}
function centerDistance01(a:NormalizedBoundingBox,b:NormalizedBoundingBox){
  const ac=center(a),bc=center(b);
  return Math.hypot(ac.x-bc.x,ac.y-bc.y)/Math.SQRT2;
}
function sizeRatio(a:NormalizedBoundingBox,b:NormalizedBoundingBox){
  const ar=a.width*a.height,br=b.width*b.height;
  if(ar<=0||br<=0)return Number.POSITIVE_INFINITY;
  return Math.max(ar,br)/Math.min(ar,br);
}
function predictTrackBox(track:Track,at:number):NormalizedBoundingBox{
  const dt=Math.max(0,Math.min(1.5,(at-track.lastSeenAt)/1000));
  const previous=center(track.bbox);
  const width=Math.max(.01,Math.min(1,track.bbox.width+track.velocityWidth*dt));
  const height=Math.max(.01,Math.min(1,track.bbox.height+track.velocityHeight*dt));
  const x=previous.x+track.velocityX*dt-width/2;
  const y=previous.y+track.velocityY*dt-height/2;
  return {x,y,width,height};
}
function updateTrackMotion(track:Track,next:NormalizedBoundingBox,at:number){
  const dt=(at-track.lastSeenAt)/1000;
  if(dt>0&&dt<=30){
    const before=center(track.bbox),after=center(next);
    const measuredX=Math.max(-1.5,Math.min(1.5,(after.x-before.x)/dt));
    const measuredY=Math.max(-1.5,Math.min(1.5,(after.y-before.y)/dt));
    const measuredWidth=Math.max(-1,Math.min(1,(next.width-track.bbox.width)/dt));
    const measuredHeight=Math.max(-1,Math.min(1,(next.height-track.bbox.height)/dt));
    track.velocityX=track.velocityX*.65+measuredX*.35;
    track.velocityY=track.velocityY*.65+measuredY*.35;
    track.velocityWidth=track.velocityWidth*.65+measuredWidth*.35;
    track.velocityHeight=track.velocityHeight*.65+measuredHeight*.35;
  }
  track.bbox={...next};
  track.lastSeenAt=at;
}

export class TemporalObjectTracker {
  private readonly cameras=new Map<number,CameraState>();
  private readonly config:Required<Omit<TemporalObjectTrackerConfig,'sessionId'>> & {sessionId:string};
  private nextTrackSequence=0;

  constructor(config:TemporalObjectTrackerConfig={}){
    this.config={
      maxTrackGapMs:Math.max(250,Math.min(60_000,Math.floor(config.maxTrackGapMs??10_000))),
      maxTrackAgeMs:Math.max(1_000,Math.min(120_000,Math.floor(config.maxTrackAgeMs??30_000))),
      minimumAssociationScore:clamp(config.minimumAssociationScore??.28),
      ambiguityMargin:clamp(config.ambiguityMargin??.10),
      minimumBoxConfidence01:clamp(config.minimumBoxConfidence01??.42),
      minimumNewTrackBoxConfidence01:clamp(config.minimumNewTrackBoxConfidence01??.72),
      maxTracksPerCamera:Math.max(8,Math.min(256,Math.floor(config.maxTracksPerCamera??128))),
      sessionId:clean(config.sessionId,64)||randomUUID().slice(0,12),
    };
  }

  reset(cameraId?:number){
    if(cameraId===undefined)this.cameras.clear();
    else this.cameras.delete(Math.max(0,Math.floor(Number(cameraId)||0)));
  }

  /** Rebuild local tracks from the persisted canonical P41 snapshot after process restart. */
  restoreFromPerception(
    entities:ReadonlyArray<{
      label:string;
      kind?:string;
      trackId?:string;
      firstSeenAt?:number;
      lastSeenAt:number;
      observations?:number;
      imageBox?:NormalizedBoundingBox;
      imageBoxCameraId?:number;
      imageBoxAt?:number;
      imageBoxConfidence01?:number;
    }>,
    at=Date.now(),
  ){
    this.cameras.clear();
    if(!Number.isFinite(at)||at<0)return {restored:0,skipped:entities.length};
    let restored=0,skipped=0;
    const seen=new Set<string>();
    for(const entity of entities){
      const cameraId=Number.isFinite(entity.imageBoxCameraId)&&Number(entity.imageBoxCameraId)>=0
        ?Math.floor(Number(entity.imageBoxCameraId)):-1;
      const imageAt=Number(entity.imageBoxAt);
      const trackId=clean(entity.trackId,240);
      const cameraPrefix=cameraId>=0?`vision:${cameraId}:`:'';
      const namespacedSource=cameraPrefix&&trackId.startsWith(cameraPrefix)?trackId.slice(cameraPrefix.length):'';
      const trackerMarker=':nk1-temporal-box-tracker:';
      const trackerMarkerAt=namespacedSource.lastIndexOf(trackerMarker);
      const localId=trackerMarkerAt>=0?namespacedSource.slice(trackerMarkerAt+trackerMarker.length):'';
      const box=entity.imageBox;
      if(cameraId<0||!localId.startsWith('local:')||!box||!isValidNormalizedBoundingBox(box)
        ||!Number.isFinite(imageAt)||imageAt>at||at-imageAt>this.config.maxTrackAgeMs
        ||Number(entity.imageBoxConfidence01??0)<this.config.minimumBoxConfidence01
        ||!clean(entity.label)){
        skipped++;continue;
      }
      const key=cameraId+':'+localId;
      if(seen.has(key)){skipped++;continue;}
      seen.add(key);
      const state=this.cameras.get(cameraId)??{lastFrameAt:imageAt,tracks:[]};
      state.lastFrameAt=Math.max(state.lastFrameAt,imageAt);
      state.tracks.push({
        id:localId,label:clean(entity.label).toLocaleLowerCase(),kind:kindOf(entity.kind),
        bbox:{...box},confidence01:clamp(entity.imageBoxConfidence01??.5),
        firstSeenAt:Number.isFinite(entity.firstSeenAt)?Math.min(imageAt,Number(entity.firstSeenAt)):imageAt,
        lastSeenAt:imageAt,hits:Math.max(1,Math.floor(Number(entity.observations??1))),
        providerOwned:false,velocityX:0,velocityY:0,velocityWidth:0,velocityHeight:0,
      });
      this.cameras.set(cameraId,state);
      restored++;
    }
    for(const state of this.cameras.values()){
      state.tracks.sort((a,b)=>b.lastSeenAt-a.lastSeenAt);
      state.tracks=state.tracks.slice(0,this.config.maxTracksPerCamera);
    }
    return {restored,skipped};
  }

  snapshot(cameraId?:number){
    const entries=[...this.cameras.entries()].filter(([id])=>cameraId===undefined||id===cameraId);
    return entries.map(([id,state])=>({
      cameraId:id,lastFrameAt:state.lastFrameAt,activeTrackCount:state.tracks.length,
      tracks:state.tracks.map(track=>({...track,bbox:{...track.bbox}})),
    }));
  }

  update(input:{
    cameraId:number;
    at:number;
    frameId?:string;
    objects:readonly TemporalDetection[];
  }):{objects:TemporalTrackedDetection[];metrics:TemporalObjectTrackerMetrics}{
    const cameraId=Number.isFinite(input.cameraId)&&input.cameraId>=0?Math.floor(input.cameraId):-1;
    const at=input.at;
    const objects=Array.isArray(input.objects)?input.objects:[];
    const current=this.cameras.get(cameraId);
    const rejected=(reason:'invalid-frame'|'stale-frame'|'duplicate-frame')=>({
      objects:objects.map(object=>({...object,trackingStatus:object.trackId?'provider' as const:'untracked' as const})),
      metrics:{
        cameraId,at:Number.isFinite(at)?at:0,acceptedFrame:false,reason,inputCount:objects.length,
        validBoxCount:objects.filter(object=>isValidNormalizedBoundingBox(object.bbox)).length,
        providerTrackCount:objects.filter(object=>Boolean(clean(object.trackId))).length,
        associatedTrackCount:0,newTrackCount:0,ambiguousCount:0,
        untrackedCount:objects.length,activeTrackCount:current?.tracks.length??0,
      },
    });
    if(cameraId<0||!Number.isFinite(at)||at<0||!Array.isArray(input.objects))return rejected('invalid-frame');
    if(current&&at<current.lastFrameAt)return rejected('stale-frame');
    const frameId=clean(input.frameId,160)||undefined;
    if(current&&frameId&&frameId===current.lastFrameId)return rejected('duplicate-frame');

    const state=current??{lastFrameAt:at,tracks:[]};
    state.tracks=state.tracks.filter(track=>at>=track.lastSeenAt&&at-track.lastSeenAt<=this.config.maxTrackAgeMs);
    const outputs:TemporalTrackedDetection[]=objects.map(object=>({...object,trackingStatus:clean(object.trackId)?'provider':'untracked'}));
    const usableBox=(object:TemporalDetection)=>isValidNormalizedBoundingBox(object.bbox)
      &&clamp(object.bboxConfidence01??0)>=this.config.minimumBoxConfidence01
      &&Boolean(clean(object.label));
    const boxIndices=objects.map((object,index)=>usableBox(object)?index:-1).filter(index=>index>=0);
    const providerTrackCount=objects.filter(object=>Boolean(clean(object.trackId))).length;

    // Provider IDs are authoritative within their own backend/source namespace.
    const providerIds=new Set<string>();
    for(const index of boxIndices){
      const object=objects[index],providerId=clean(object.trackId);
      if(!providerId)continue;
      const key=clean(object.sourceId)||'provider';
      const composite=key+':'+providerId;
      if(providerIds.has(composite)){
        outputs[index].trackingStatus='ambiguous';
        outputs[index].trackId=undefined;
        continue;
      }
      providerIds.add(composite);
      outputs[index].trackingStatus='provider';
      const trackIndex=state.tracks.findIndex(track=>track.id===composite);
      const track:Track={
        id:composite,label:clean(object.label).toLocaleLowerCase(),kind:kindOf(object.kind),
        bbox:{...object.bbox!},confidence01:clamp(object.confidence01??.5),
        firstSeenAt:trackIndex>=0?state.tracks[trackIndex].firstSeenAt:at,
        lastSeenAt:at,hits:trackIndex>=0?state.tracks[trackIndex].hits+1:1,providerOwned:true,
        velocityX:0,velocityY:0,velocityWidth:0,velocityHeight:0,
      };
      if(trackIndex>=0){
        const previous=state.tracks[trackIndex];
        track.velocityX=previous.velocityX;track.velocityY=previous.velocityY;
        track.velocityWidth=previous.velocityWidth;track.velocityHeight=previous.velocityHeight;
        track.bbox={...previous.bbox};track.lastSeenAt=previous.lastSeenAt;
        updateTrackMotion(track,object.bbox!,at);
        state.tracks[trackIndex]=track;
      }
      else state.tracks.push(track);
    }

    // Duplicate overlapping detections in one frame are not independent tracks.
    // Keep both records visible to callers, but refuse to fabricate two identities.
    const duplicateLocalDetections=new Set<number>();
    for(let i=0;i<boxIndices.length;i++){
      const leftIndex=boxIndices[i];
      if(clean(objects[leftIndex].trackId))continue;
      for(let j=i+1;j<boxIndices.length;j++){
        const rightIndex=boxIndices[j];
        if(clean(objects[rightIndex].trackId))continue;
        const left=objects[leftIndex],right=objects[rightIndex];
        if(clean(left.label).toLocaleLowerCase()!==clean(right.label).toLocaleLowerCase())continue;
        if(kindOf(left.kind)!==kindOf(right.kind))continue;
        if(intersectionOverUnion(left.bbox!,right.bbox!)>=.92){
          duplicateLocalDetections.add(leftIndex);duplicateLocalDetections.add(rightIndex);
        }
      }
    }
    for(const index of duplicateLocalDetections)outputs[index].trackingStatus='ambiguous';
    const localDetectionIndices=boxIndices.filter(index=>!clean(objects[index].trackId)&&!duplicateLocalDetections.has(index));
    const localTracks=state.tracks.filter(track=>!track.providerOwned&&at>=track.lastSeenAt&&at-track.lastSeenAt<=this.config.maxTrackGapMs);
    const edges:MatchEdge[]=[];
    for(const detectionIndex of localDetectionIndices){
      const detection=objects[detectionIndex],box=detection.bbox!;
      const label=clean(detection.label).toLocaleLowerCase(),kind=kindOf(detection.kind);
      for(const track of localTracks){
        if(track.label!==label||!(track.kind===kind||track.kind==='unknown'||kind==='unknown'))continue;
        const predictedBox=predictTrackBox(track,at);
        const iou=intersectionOverUnion(box,predictedBox);
        const distance=centerDistance01(box,predictedBox);
        const ratio=sizeRatio(box,predictedBox);
        if(ratio>4||!(iou>=.05||distance<=.09))continue;
        const score=clamp(.72*iou+.28*Math.max(0,1-distance/.25));
        if(score>=this.config.minimumAssociationScore)edges.push({detectionIndex,trackId:track.id,score});
      }
    }
    const detectionEdges=new Map<number,MatchEdge[]>();
    const trackEdges=new Map<string,MatchEdge[]>();
    for(const edge of edges){
      const d=detectionEdges.get(edge.detectionIndex)??[];d.push(edge);detectionEdges.set(edge.detectionIndex,d);
      const t=trackEdges.get(edge.trackId)??[];t.push(edge);trackEdges.set(edge.trackId,t);
    }
    const sort=(list:MatchEdge[])=>list.sort((a,b)=>b.score-a.score||a.trackId.localeCompare(b.trackId)||a.detectionIndex-b.detectionIndex);
    const accepted:MatchEdge[]=[];
    for(const edge of edges){
      const d=sort([...(detectionEdges.get(edge.detectionIndex)??[])]);
      const t=sort([...(trackEdges.get(edge.trackId)??[])]);
      const dMargin=d.length<2?1:d[0].score-d[1].score;
      const tMargin=t.length<2?1:t[0].score-t[1].score;
      if(d[0]===edge&&t[0]===edge&&dMargin>=this.config.ambiguityMargin&&tMargin>=this.config.ambiguityMargin)accepted.push(edge);
    }
    const assignedDetections=new Set<number>(),assignedTracks=new Set<string>();
    let associatedTrackCount=0,newTrackCount=0,ambiguousCount=0,untrackedCount=0;
    for(const edge of accepted){
      if(assignedDetections.has(edge.detectionIndex)||assignedTracks.has(edge.trackId))continue;
      const index=edge.detectionIndex,track=state.tracks.find(item=>item.id===edge.trackId);
      if(!track)continue;
      const detection=objects[index];
      updateTrackMotion(track,detection.bbox!,at);track.hits++;
      track.confidence01=clamp(track.confidence01*.65+clamp(detection.confidence01??.5)*.35);
      outputs[index].trackId=track.id;
      outputs[index].sourceId=[clean(detection.sourceId),'nk1-temporal-box-tracker'].filter(Boolean).join(':');
      outputs[index].trackingStatus='associated';
      assignedDetections.add(index);assignedTracks.add(track.id);associatedTrackCount++;
    }
    for(const index of localDetectionIndices){
      if(assignedDetections.has(index))continue;
      const possible=detectionEdges.get(index)??[];
      const isAmbiguous=possible.length>0;
      if(isAmbiguous){
        outputs[index].trackingStatus='ambiguous';ambiguousCount++;continue;
      }
      if(clamp(objects[index].bboxConfidence01??0)<this.config.minimumNewTrackBoxConfidence01){
        outputs[index].trackingStatus='untracked';untrackedCount++;continue;
      }
      const id='local:'+this.config.sessionId+':'+cameraId+':'+(++this.nextTrackSequence);
      state.tracks.push({
        id,label:clean(objects[index].label).toLocaleLowerCase(),kind:kindOf(objects[index].kind),
        bbox:{...objects[index].bbox!},confidence01:clamp(objects[index].confidence01??.5),
        firstSeenAt:at,lastSeenAt:at,hits:1,providerOwned:false,
        velocityX:0,velocityY:0,velocityWidth:0,velocityHeight:0,
      });
      outputs[index].trackId=id;
      outputs[index].sourceId=[clean(objects[index].sourceId),'nk1-temporal-box-tracker'].filter(Boolean).join(':');
      outputs[index].trackingStatus='new';newTrackCount++;
    }
    for(const index of objects.keys()){
      if(outputs[index].trackingStatus==='untracked')untrackedCount++;
    }
    state.tracks=state.tracks.sort((a,b)=>b.lastSeenAt-a.lastSeenAt).slice(0,this.config.maxTracksPerCamera);
    state.lastFrameAt=at;state.lastFrameId=frameId;
    this.cameras.set(cameraId,state);
    return {
      objects:outputs,
      metrics:{
        cameraId,at,acceptedFrame:true,inputCount:objects.length,validBoxCount:boxIndices.length,
        providerTrackCount,associatedTrackCount,newTrackCount,ambiguousCount,untrackedCount,
        activeTrackCount:state.tracks.length,
      },
    };
  }
}
