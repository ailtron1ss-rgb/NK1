export interface UnifiedCognitiveSubstrateState {
  version:1; cycles:number; lastTick:number;
  self:{continuity01:number;coherence01:number;agency01:number;realityAlignment01:number;mode:string;lastAction:string};
  world:{confidence01:number;uncertainty01:number;entityCount:number;eventCount:number;relationCount:number;conflict01:number;newEntityRate01:number};
  prediction:{error01:number;openCount:number;agingCount:number;expiredCount:number;priority01:number};
  resources:{battery01:number;thermal01:number;ramPressure01:number;computeCapacity01:number;scarcity01:number;efficiency01:number};
  coupling:{selfWorld01:number;predictionGrounding01:number;memoryPressure01:number;actionReadiness01:number};
  provenance:{evidenceCoverage01:number;realObservationCoverage01:number;unknown01:number};
  lastReason:string;
}
type UnknownRecord=Record<string,unknown>;
const isRecord=(v:unknown):v is UnknownRecord=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const ownRecord=(v:unknown):UnknownRecord=>isRecord(v)?Object.fromEntries(Object.entries(v)):{};
const clamp=(v:number)=>Math.max(0,Math.min(1,Number.isFinite(v)?v:0));
const safeMetric=(v:unknown,fallback:number)=>typeof v==='number'&&Number.isFinite(v)?clamp(v):fallback;
const safeCounter=(v:unknown,fallback:number)=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=0?v:fallback;
const safeLabel=(v:unknown,fallback:string,max=96)=>typeof v==='string'&&v.trim().length>0&&v.length<=max&&!/[\u0000-\u001f\u007f]/.test(v)?v.trim():fallback;
const metric=(r:UnknownRecord,k:string,d:number)=>safeMetric(r[k],d);
const count=(r:UnknownRecord,k:string,d=0)=>safeCounter(r[k],d);
export const defaultUnifiedCognitiveSubstrate=():UnifiedCognitiveSubstrateState=>({
  version:1,cycles:0,lastTick:0,
  self:{continuity01:.7,coherence01:.7,agency01:.5,realityAlignment01:.5,mode:'wait',lastAction:'wait'},
  world:{confidence01:.35,uncertainty01:.65,entityCount:0,eventCount:0,relationCount:0,conflict01:0,newEntityRate01:0},
  prediction:{error01:.5,openCount:0,agingCount:0,expiredCount:0,priority01:0},
  resources:{battery01:.82,thermal01:.18,ramPressure01:.18,computeCapacity01:.82,scarcity01:.18,efficiency01:.82},
  coupling:{selfWorld01:.35,predictionGrounding01:.35,memoryPressure01:0,actionReadiness01:.4},
  provenance:{evidenceCoverage01:0,realObservationCoverage01:0,unknown01:1},lastReason:'initial',
});
/** Bounded cross-system projection. It never owns canonical domain state. */
export class UnifiedCognitiveSubstrate {
  private state=defaultUnifiedCognitiveSubstrate();
  restore(raw?:Partial<UnifiedCognitiveSubstrateState>|null):void {
    const d=defaultUnifiedCognitiveSubstrate(),r=ownRecord(raw);
    if(r.version!==undefined&&r.version!==1)throw new RangeError('unsupported unified cognitive substrate state version');
    const s=ownRecord(r.self),w=ownRecord(r.world),p=ownRecord(r.prediction),z=ownRecord(r.resources),c=ownRecord(r.coupling),v=ownRecord(r.provenance);
    const next:UnifiedCognitiveSubstrateState={
      version:1,cycles:count(r,'cycles',d.cycles),lastTick:count(r,'lastTick',d.lastTick),
      self:{continuity01:metric(s,'continuity01',d.self.continuity01),coherence01:metric(s,'coherence01',d.self.coherence01),
        agency01:metric(s,'agency01',d.self.agency01),realityAlignment01:metric(s,'realityAlignment01',d.self.realityAlignment01),
        mode:safeLabel(s.mode,d.self.mode),lastAction:safeLabel(s.lastAction,d.self.lastAction)},
      world:{confidence01:metric(w,'confidence01',d.world.confidence01),uncertainty01:metric(w,'uncertainty01',d.world.uncertainty01),
        entityCount:count(w,'entityCount'),eventCount:count(w,'eventCount'),relationCount:count(w,'relationCount'),
        conflict01:metric(w,'conflict01',d.world.conflict01),newEntityRate01:metric(w,'newEntityRate01',d.world.newEntityRate01)},
      prediction:{error01:metric(p,'error01',d.prediction.error01),openCount:count(p,'openCount'),agingCount:count(p,'agingCount'),
        expiredCount:count(p,'expiredCount'),priority01:metric(p,'priority01',d.prediction.priority01)},
      resources:{battery01:metric(z,'battery01',d.resources.battery01),thermal01:metric(z,'thermal01',d.resources.thermal01),
        ramPressure01:metric(z,'ramPressure01',d.resources.ramPressure01),computeCapacity01:metric(z,'computeCapacity01',d.resources.computeCapacity01),
        scarcity01:metric(z,'scarcity01',d.resources.scarcity01),efficiency01:metric(z,'efficiency01',d.resources.efficiency01)},
      coupling:{selfWorld01:metric(c,'selfWorld01',d.coupling.selfWorld01),predictionGrounding01:metric(c,'predictionGrounding01',d.coupling.predictionGrounding01),
        memoryPressure01:metric(c,'memoryPressure01',d.coupling.memoryPressure01),actionReadiness01:metric(c,'actionReadiness01',d.coupling.actionReadiness01)},
      provenance:{evidenceCoverage01:metric(v,'evidenceCoverage01',d.provenance.evidenceCoverage01),
        realObservationCoverage01:metric(v,'realObservationCoverage01',d.provenance.realObservationCoverage01),unknown01:metric(v,'unknown01',d.provenance.unknown01)},
      lastReason:safeLabel(r.lastReason,d.lastReason,512),
    };
    this.state=next;
  }
  snapshot():UnifiedCognitiveSubstrateState{return structuredClone(this.state);}
  integrate(input:{tick:number;self:UnifiedCognitiveSubstrateState['self'];world:UnifiedCognitiveSubstrateState['world'];
    prediction:UnifiedCognitiveSubstrateState['prediction'];resources:UnifiedCognitiveSubstrateState['resources'];
    memoryPressure01:number;evidenceCoverage01:number;realObservationCoverage01:number;unknown01:number;reason?:string;}):UnifiedCognitiveSubstrateState {
    if(input===null||typeof input!=='object')throw new TypeError('unified cognitive substrate input must be an object');
    if(!Number.isSafeInteger(input.tick)||input.tick<=this.state.lastTick)throw new RangeError('unified cognitive substrate tick must strictly increase');
    if(this.state.cycles>=Number.MAX_SAFE_INTEGER)throw new RangeError('unified cognitive substrate cycle counter reached safe integer limit');
    for(const [name,value] of Object.entries({self:input.self,world:input.world,prediction:input.prediction,resources:input.resources}))
      if(!isRecord(value))throw new TypeError(`unified cognitive substrate ${name} input must be an object`);
    const s=ownRecord(input.self),w=ownRecord(input.world),p=ownRecord(input.prediction),z=ownRecord(input.resources);
    const sm=(k:string,d:number)=>metric(s,k,d),wm=(k:string,d:number)=>metric(w,k,d),pm=(k:string,d:number)=>metric(p,k,d),zm=(k:string,d:number)=>metric(z,k,d);
    const selfWorld=clamp(sm('realityAlignment01',.5)*.30+wm('confidence01',.35)*.34+(1-wm('conflict01',0))*.18+sm('coherence01',.7)*.18);
    const predictionGrounding=clamp((1-pm('error01',.5))*.28+wm('confidence01',.35)*.28+sm('realityAlignment01',.5)*.22+safeMetric(input.evidenceCoverage01,0)*.22);
    const actionReadiness=clamp(sm('agency01',.5)*.26+sm('coherence01',.7)*.18+zm('computeCapacity01',.82)*.20+(1-wm('uncertainty01',.65))*.18+(1-pm('error01',.5))*.18);
    const d=defaultUnifiedCognitiveSubstrate(),cycles=this.state.cycles+1;
    this.state={version:1,cycles,lastTick:input.tick,
      self:{continuity01:sm('continuity01',d.self.continuity01),coherence01:sm('coherence01',d.self.coherence01),agency01:sm('agency01',d.self.agency01),
        realityAlignment01:sm('realityAlignment01',d.self.realityAlignment01),mode:safeLabel(s.mode,d.self.mode),lastAction:safeLabel(s.lastAction,d.self.lastAction)},
      world:{confidence01:wm('confidence01',d.world.confidence01),uncertainty01:wm('uncertainty01',d.world.uncertainty01),
        entityCount:count(w,'entityCount'),eventCount:count(w,'eventCount'),relationCount:count(w,'relationCount'),
        conflict01:wm('conflict01',d.world.conflict01),newEntityRate01:wm('newEntityRate01',d.world.newEntityRate01)},
      prediction:{error01:pm('error01',d.prediction.error01),openCount:count(p,'openCount'),agingCount:count(p,'agingCount'),
        expiredCount:count(p,'expiredCount'),priority01:pm('priority01',d.prediction.priority01)},
      resources:{battery01:zm('battery01',d.resources.battery01),thermal01:zm('thermal01',d.resources.thermal01),ramPressure01:zm('ramPressure01',d.resources.ramPressure01),
        computeCapacity01:zm('computeCapacity01',d.resources.computeCapacity01),scarcity01:zm('scarcity01',d.resources.scarcity01),efficiency01:zm('efficiency01',d.resources.efficiency01)},
      coupling:{selfWorld01:selfWorld,predictionGrounding01:predictionGrounding,memoryPressure01:safeMetric(input.memoryPressure01,0),actionReadiness01:actionReadiness},
      provenance:{evidenceCoverage01:safeMetric(input.evidenceCoverage01,0),realObservationCoverage01:safeMetric(input.realObservationCoverage01,0),unknown01:safeMetric(input.unknown01,1)},
      lastReason:safeLabel(input.reason,`tick=${input.tick};selfWorld=${selfWorld.toFixed(2)};predictionGrounding=${predictionGrounding.toFixed(2)}`,512)};
    return this.snapshot();
  }
  actionBias(action:string):number {
    const readiness=this.state.coupling.actionReadiness01,grounding=this.state.coupling.predictionGrounding01,resource=this.state.resources.efficiency01;
    const map:Record<string,number>={respond:this.state.self.agency01*.02,explore:this.state.world.uncertainty01*.035,
      verify:(1-grounding)*.045,rest:(1-resource)*.045,reflect:this.state.prediction.error01*.03,
      wait:this.state.world.conflict01*.035,defer:(1-resource)*.05};
    return clamp((map[action]??0)+readiness*.005)-.0025;
  }
}
