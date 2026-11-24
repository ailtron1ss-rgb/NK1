/**
 * P53 — Developmental Self-Modification Laboratory.
 *
 * This is a deliberately reversible meta-learning layer.  It can propose changes
 * to bounded behavioural policy knobs, but it never mutates identity anchors or
 * live executable architecture. Candidates must first pass deterministic shadow
 * evaluation, identity preservation, anti-oscillation, and longitudinal evidence.
 */
const clamp=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));

export type P53Knob = 'exploration'|'verification'|'reflection'|'attention'|'prediction';
export type P53Status = 'candidate'|'testing'|'promotable'|'promoted'|'rejected'|'cooldown';

export interface P53IdentityFirewall {
  protectedKeys:string[];
  protectedHash:string;
  violations:number;
}

export interface P53Candidate {
  id:string;
  createdAt:number;
  tick:number;
  knob:P53Knob;
  delta:number;
  reason:string;
  baseline01:number;
  shadow01:number;
  holdout01:number;
  identityPreservation01:number;
  stability01:number;
  transfer01:number;
  improvement01:number;
  risk01:number;
  evidenceCount:number;
  status:P53Status;
  lastAt:number;
}

export interface P53State {
  version:2;
  proposals:number;
  tests:number;
  promotions:number;
  rejections:number;
  cooldowns:number;
  oscillationBlocks:number;
  identityViolations:number;
  bestImprovement01:number;
  developmentalReadiness01:number;
  labStability01:number;
  candidates:P53Candidate[];
  activeKnobProfile:Record<P53Knob,number>;
  firewall:P53IdentityFirewall;
  lastReason:string;
}

export const defaultP53=():P53State=>({
  version:2,proposals:0,tests:0,promotions:0,rejections:0,cooldowns:0,oscillationBlocks:0,
  identityViolations:0,bestImprovement01:0,developmentalReadiness01:.25,labStability01:.8,
  candidates:[],activeKnobProfile:{exploration:.5,verification:.5,reflection:.5,attention:.5,prediction:.5},
  firewall:{protectedKeys:['identity','coreValues','name','continuityAnchors'],protectedHash:'P53-ID-FIREWALL-v2',violations:0},lastReason:''
});

function hash(s:string){let h=2166136261>>>0;for(let i=0;i<s.length;i++)h=Math.imul(h^s.charCodeAt(i),16777619)>>>0;return h.toString(16)}

export class P53DevelopmentalSelfModificationLab {
  private state=defaultP53();
  restore(raw?:Partial<P53State>|null){
    const d=defaultP53(),r=raw??{};
    this.state={...d,...r,
      candidates:Array.isArray(r.candidates)?r.candidates.slice(-128):[],
      activeKnobProfile:{...d.activeKnobProfile,...(r.activeKnobProfile??{})},
      firewall:{...d.firewall,...(r.firewall??{})}
    };
  }
  snapshot(){return structuredClone(this.state);}

  private candidateId(tick:number,knob:P53Knob,delta:number){return `p53:${tick}:${knob}:${hash(`${tick}|${knob}|${delta}`)}`;}

  propose(input:{tick:number;at:number;predictionError01:number;selfPredictionError01:number;uncertainty01:number;novelty01:number;attention01:number;identityContinuity01:number;reason?:string}):P53Candidate|null{
    const signals:Record<P53Knob,number>={
      exploration:clamp(input.novelty01*.62+input.uncertainty01*.38),
      verification:clamp(input.predictionError01*.72+input.uncertainty01*.28),
      reflection:clamp(input.selfPredictionError01*.65+input.predictionError01*.35),
      attention:clamp((1-input.attention01)*.7+input.uncertainty01*.3),
      prediction:clamp(input.predictionError01*.55+input.selfPredictionError01*.45),
    };
    const knob=(Object.entries(signals).sort((a,b)=>b[1]-a[1])[0]?.[0]??'verification') as P53Knob;
    const pressure=signals[knob];
    if(pressure<.45)return null;
    const sign=input.identityContinuity01>=.8?1:-1;
    const delta=Math.max(-.08,Math.min(.08,(pressure-.5)*.18*sign));
    if(Math.abs(delta)<.01)return null;
    const active=this.state.activeKnobProfile[knob];
    const id=this.candidateId(input.tick,knob,delta);
    if(this.state.candidates.some(c=>c.id===id) || this.state.candidates.some(c=>c.knob===knob && Math.sign(c.delta)===Math.sign(delta) && c.status==='cooldown')){
      this.state.oscillationBlocks++; return null;
    }
    const base=this.state.labStability01*.5+(1-input.predictionError01)*.3+input.identityContinuity01*.2;
    const c:P53Candidate={id,createdAt:input.at,tick:input.tick,knob,delta,reason:input.reason??`pressure:${pressure.toFixed(3)}`,
      baseline01:clamp(base),shadow01:0,holdout01:0,identityPreservation01:input.identityContinuity01,stability01:0,transfer01:0,improvement01:0,risk01:0,evidenceCount:0,status:'candidate',lastAt:input.at};
    this.state.proposals++; this.state.candidates.unshift(c); this.state.candidates=this.state.candidates.slice(0,128); this.state.lastReason=c.reason;
    // active profile is merely a proposal context; live policy remains untouched until promotion.
    void active;
    return structuredClone(c);
  }

  test(id:string,input:{predictionError01:number;selfPredictionError01:number;uncertainty01:number;identityContinuity01:number;grounding01:number;causalAlignment01:number;holdoutFactor01?:number}):P53Candidate|null{
    const c=this.state.candidates.find(x=>x.id===id); if(!c)return null;
    if(c.status==='promoted'||c.status==='rejected')return structuredClone(c);
    c.status='testing'; this.state.tests++;
    const change=Math.min(.12,Math.abs(c.delta)*1.4);
    const targetSignal=c.knob==='verification'?1-input.predictionError01:c.knob==='prediction'?1-input.selfPredictionError01:c.knob==='attention'?1-input.uncertainty01:1-input.predictionError01*.6;
    c.shadow01=clamp(c.baseline01 + targetSignal*.18 + change*.25 - input.uncertainty01*.08);
    c.holdout01=clamp(c.shadow01*.64+(input.holdoutFactor01??.72)*.24+input.grounding01*.12);
    c.identityPreservation01=clamp(Math.min(c.identityPreservation01,input.identityContinuity01));
    c.stability01=clamp((1-input.selfPredictionError01)*.38+(1-input.uncertainty01)*.24+input.causalAlignment01*.22+input.grounding01*.16);
    c.transfer01=clamp(c.holdout01*.55+c.stability01*.3+input.grounding01*.15);
    c.improvement01=clamp((c.holdout01-c.baseline01)*2.8);
    c.risk01=clamp(input.uncertainty01*.35+(1-c.identityPreservation01)*.45+Math.abs(c.delta)*1.8);
    c.evidenceCount++;
    const ready=c.improvement01>=.08 && c.holdout01>=.62 && c.transfer01>=.60 && c.identityPreservation01>=.84 && c.risk01<.28 && c.stability01>=.58;
    c.status=ready?'promotable':'testing'; c.lastAt=Date.now();
    if(c.improvement01>this.state.bestImprovement01)this.state.bestImprovement01=c.improvement01;
    this.state.developmentalReadiness01=clamp(this.state.developmentalReadiness01*.9+(ready?.9:.3)*.1);
    return structuredClone(c);
  }

  promote(id:string,at=Date.now()):P53Candidate|null{
    const c=this.state.candidates.find(x=>x.id===id); if(!c)return null;
    if(c.status!=='promotable')return structuredClone(c);
    if(!this.state.firewall.protectedKeys.length){this.state.identityViolations++;c.status='rejected';return structuredClone(c);}
    const next=clamp(this.state.activeKnobProfile[c.knob]+c.delta);
    this.state.activeKnobProfile[c.knob]=next;
    c.status='promoted'; c.lastAt=at; this.state.promotions++;
    const opposites=this.state.candidates.filter(x=>x.id!==c.id&&x.knob===c.knob&&Math.sign(x.delta)!==Math.sign(c.delta)&&x.status==='promotable');
    for(const o of opposites)o.status='cooldown';
    this.state.cooldowns+=opposites.length;
    this.state.labStability01=clamp(this.state.labStability01*.94+c.stability01*.06);
    return structuredClone(c);
  }

  reject(id:string,reason='insufficient-evidence',at=Date.now()):P53Candidate|null{
    const c=this.state.candidates.find(x=>x.id===id); if(!c)return null;
    c.status='rejected'; c.reason=`${c.reason}|rejected:${reason}`; c.lastAt=at; this.state.rejections++; return structuredClone(c);
  }

  periodic(input:{tick:number;at:number;predictionError01:number;selfPredictionError01:number;uncertainty01:number;novelty01:number;attention01:number;identityContinuity01:number;grounding01:number;causalAlignment01:number;learningAllocation01?:number;strategyAbstraction01?:number}){
    let proposal:P53Candidate|null=null;
    const metaPressure=clamp((input.learningAllocation01??.25)*.55+(input.strategyAbstraction01??0)*.45);
    const proposalInput={...input,reason:metaPressure>.58?`meta-curriculum-pressure:${metaPressure.toFixed(3)}`:undefined,novelty01:clamp(input.novelty01*.75+metaPressure*.25),predictionError01:clamp(input.predictionError01*.82+metaPressure*.18)};
    if(input.tick%12===0)proposal=this.propose(proposalInput);
    const pending=this.state.candidates.filter(c=>c.status==='candidate'||c.status==='testing').slice(0,3);
    for(const c of pending){this.test(c.id,input);}
    for(const c of this.state.candidates.filter(c=>c.status==='promotable').slice(0,2)){
      if(c.evidenceCount>=2 && input.identityContinuity01>=.86)this.promote(c.id,input.at);
    }
    this.state.candidates=this.state.candidates.slice(0,96);
    return {proposal,activeKnobProfile:{...this.state.activeKnobProfile},readiness01:this.state.developmentalReadiness01};
  }
}
