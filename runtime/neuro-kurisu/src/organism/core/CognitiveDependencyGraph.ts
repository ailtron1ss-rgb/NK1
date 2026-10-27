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
const VALID_MASK=DOMAINS.reduce((mask,domain)=>mask|BIT[domain],0);
const safeCounter=(value:unknown):number=>typeof value==='number'&&Number.isSafeInteger(value)&&value>=0?value:0;
const clamp01=(value:unknown):number=>typeof value==='number'&&Number.isFinite(value)?Math.max(0,Math.min(1,value)):0;
const isRecord=(value:unknown):value is Record<string,unknown>=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const cleanText=(value:unknown,fallback:string,maxLength:number):string=>{
  if(typeof value!=='string')return fallback;
  const text=value.replace(/[\u0000-\u001f\u007f-\u009f]/gu,' ').replace(/\s+/gu,' ').trim().slice(0,maxLength);
  return text||fallback;
};
const validDomain=(value:unknown):value is CognitiveDomain=>typeof value==='string'&&DOMAINS.includes(value as CognitiveDomain);
const safeDomains=(value:unknown):CognitiveDomain[]=>{
  if(!Array.isArray(value))return [];
  return [...new Set(value.filter(validDomain))];
};
const normalizeInterrupt=(value:unknown):CognitiveDependencyState['interrupt']=>{
  if(!isRecord(value))return {active:false,priority01:0,type:'none',domains:[]};
  return {
    active:value.active===true,
    priority01:clamp01(value.priority01),
    type:cleanText(value.type,'none',64),
    domains:safeDomains(value.domains),
  };
};

export const defaultCognitiveDependencyState=():CognitiveDependencyState=>({version:1,lastTick:0,wakeMask:0,dirtyCount:0,transitionCount:0,lastReason:'',interrupt:{active:false,priority01:0,type:'none',domains:[]},interrupts:0,domainTransitions:{self:0,world:0,memory:0,agency:0,embodiment:0,research:0,governance:0}});

export class CognitiveDependencyGraph {
  private state=defaultCognitiveDependencyState();
  private previous:Record<CognitiveDomain,boolean>={self:false,world:false,memory:false,agency:false,embodiment:false,research:false,governance:false};

  restore(raw?:Partial<CognitiveDependencyState>|null):void {
    const source=isRecord(raw)?raw:{};
    if(source.version!==undefined&&source.version!==1)throw new RangeError('unsupported cognitive-dependency state version');

    const wakeMask=safeCounter(source.wakeMask)&VALID_MASK;
    const base=defaultCognitiveDependencyState();
    const rawTransitions:Record<string,unknown>=isRecord(source.domainTransitions)?source.domainTransitions:{};
    const domainTransitions:Record<CognitiveDomain,number>={...base.domainTransitions};
    for(const domain of DOMAINS) {
      domainTransitions[domain]=safeCounter(Object.hasOwn(rawTransitions,domain)?rawTransitions[domain]:undefined);
    }

    const interrupt=normalizeInterrupt(source.interrupt);
    this.state={
      version:1,
      lastTick:safeCounter(source.lastTick),
      wakeMask,
      // Wake masks are authoritative; a contradictory persisted dirty count is not.
      dirtyCount:DOMAINS.reduce((count,domain)=>count+((wakeMask&BIT[domain])!==0?1:0),0),
      transitionCount:safeCounter(source.transitionCount),
      lastReason:cleanText(source.lastReason,'',256),
      interrupt,
      interrupts:safeCounter(source.interrupts),
      domainTransitions,
    };
    // Continue from the last persisted dirty-domain state instead of fabricating
    // seven transitions on the first post-restart resolve().
    this.previous={self:Boolean(wakeMask&BIT.self),world:Boolean(wakeMask&BIT.world),memory:Boolean(wakeMask&BIT.memory),agency:Boolean(wakeMask&BIT.agency),embodiment:Boolean(wakeMask&BIT.embodiment),research:Boolean(wakeMask&BIT.research),governance:Boolean(wakeMask&BIT.governance)};
  }

  snapshot(){return structuredClone(this.state);}

  resolve(frame:CognitiveFrame){
    let mask=0,count=0,transitions=0;
    for(const domain of DOMAINS){
      const dirty=Boolean(frame.dirtyDomains[domain]);
      if(dirty){mask|=BIT[domain];count++;}
      if(dirty!==this.previous[domain]){
        transitions++;
        this.state.domainTransitions[domain]=Math.min(Number.MAX_SAFE_INTEGER,(this.state.domainTransitions[domain]??0)+1);
      }
      this.previous[domain]=dirty;
    }
    this.state.lastTick=safeCounter(frame.tick);
    this.state.wakeMask=mask;
    this.state.dirtyCount=count;
    this.state.transitionCount=Math.min(Number.MAX_SAFE_INTEGER,this.state.transitionCount+transitions);
    this.state.lastReason=cleanText(frame.reason,'',256);
    const previousInterrupt=this.state.interrupt;
    const nextInterrupt=normalizeInterrupt(frame.interrupt);
    const sameInterruptDomains=previousInterrupt.domains.slice().sort().join('|')===nextInterrupt.domains.slice().sort().join('|');
    const startsNewInterrupt=nextInterrupt.active&&(!previousInterrupt.active||previousInterrupt.type!==nextInterrupt.type||!sameInterruptDomains);
    this.state.interrupt=nextInterrupt;
    // Count interrupt episodes, not each tick for which one episode remains active.
    if(startsNewInterrupt)this.state.interrupts=Math.min(Number.MAX_SAFE_INTEGER,this.state.interrupts+1);
    return {wakeMask:mask,dirtyCount:count,transitions};
  }

  shouldWake(domain:CognitiveDomain){return Boolean(this.state.wakeMask&BIT[domain])||(this.state.interrupt.active&&this.state.interrupt.domains.includes(domain));}
  interruption(){return structuredClone(this.state.interrupt);}
  diagnostics(){return structuredClone(this.state);}
}
