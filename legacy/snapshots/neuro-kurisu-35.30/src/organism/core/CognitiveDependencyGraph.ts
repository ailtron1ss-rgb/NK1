import type { CognitiveDomain, CognitiveFrame } from './CognitiveFrame.ts';

export interface CognitiveDependencyState {
  version:1;
  lastTick:number;
  wakeMask:number;
  dirtyCount:number;
  transitionCount:number;
  lastReason:string;
  interrupt:{active:boolean;priority01:number;type:string;domains:CognitiveDomain[]};
  interrupts:number;
  domainTransitions:Record<CognitiveDomain,number>;
}

const DOMAINS:CognitiveDomain[]=['self','world','memory','agency','embodiment','research','governance'];
const BIT:Record<CognitiveDomain,number>={self:1,world:2,memory:4,agency:8,embodiment:16,research:32,governance:64};

export const defaultCognitiveDependencyState=():CognitiveDependencyState=>({version:1,lastTick:0,wakeMask:0,dirtyCount:0,transitionCount:0,lastReason:'',interrupt:{active:false,priority01:0,type:'none',domains:[]},interrupts:0,domainTransitions:{self:0,world:0,memory:0,agency:0,embodiment:0,research:0,governance:0}});

export class CognitiveDependencyGraph {
  private state=defaultCognitiveDependencyState();
  private previous:Record<CognitiveDomain,boolean>={self:false,world:false,memory:false,agency:false,embodiment:false,research:false,governance:false};
  restore(raw?:Partial<CognitiveDependencyState>|null){
    const d=defaultCognitiveDependencyState(),r=raw??{};
    this.state={...d,...r,domainTransitions:{...d.domainTransitions,...(r.domainTransitions??{})}};
  }
  snapshot(){return structuredClone(this.state);}
  resolve(frame:CognitiveFrame){
    let mask=0,count=0,transitions=0;
    for(const d of DOMAINS){
      const dirty=Boolean(frame.dirtyDomains[d]);
      if(dirty){mask|=BIT[d];count++;}
      if(dirty!==this.previous[d]){transitions++;this.state.domainTransitions[d]=(this.state.domainTransitions[d]??0)+1;}
      this.previous[d]=dirty;
    }
    this.state.lastTick=frame.tick;this.state.wakeMask=mask;this.state.dirtyCount=count;this.state.transitionCount+=transitions;this.state.lastReason=frame.reason;this.state.interrupt=structuredClone(frame.interrupt??{active:false,priority01:0,type:'none',domains:[]});if(this.state.interrupt.active)this.state.interrupts+=1;
    return {wakeMask:mask,dirtyCount:count,transitions};
  }
  shouldWake(domain:CognitiveDomain){return Boolean(this.state.wakeMask & BIT[domain]) || (this.state.interrupt.active && this.state.interrupt.domains.includes(domain));}
  interruption(){return structuredClone(this.state.interrupt);}
  diagnostics(){return structuredClone(this.state);}
}
