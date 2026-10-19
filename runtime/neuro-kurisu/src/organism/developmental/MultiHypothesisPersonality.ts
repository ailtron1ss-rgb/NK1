export interface PersonalityEvidence {
  at:number;
  tick:number;
  source:string;
  support:boolean;
  strength01:number;
  confidence01:number;
  evidence01:number;
}
export interface PersonalityHypothesis{
  id:string;
  context:string;
  trait:string;
  probability:number;
  support:number;
  contradictions:number;
  updatedAt:number;
  evidenceScore01:number;
  stability01:number;
  causalInfluence01:number;
  samples:number;
  recentEvidence:PersonalityEvidence[];
}
export interface PersonalityTrajectoryPoint{at:number;tick:number;trait:string;probability:number;stability01:number;causalInfluence01:number;source:string;}
export interface PersonalityHypothesisState{
  hypotheses:PersonalityHypothesis[];
  trajectory:PersonalityTrajectoryPoint[];
  version:number;
  causalUpdates:number;
  lastCausalAt:number;
}
const clamp=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
const now=()=>Date.now();
const clean=(x:unknown,n=96)=>String(x??'').replace(/\s+/g,' ').trim().slice(0,n);
const emptyEvidence=():PersonalityEvidence[]=>[];
export const defaultMultiHypothesisPersonality=():PersonalityHypothesisState=>({hypotheses:[],trajectory:[],version:2,causalUpdates:0,lastCausalAt:0});
export class MultiHypothesisPersonality{
  private state=defaultMultiHypothesisPersonality();
  restore(s:PersonalityHypothesisState|undefined){
    const raw:any=s??{};
    this.state={...defaultMultiHypothesisPersonality(),...raw,hypotheses:Array.isArray(raw.hypotheses)?raw.hypotheses.slice(0,128).map((h:any)=>({
      id:String(h?.id??`ph-${now()}`),context:clean(h?.context),trait:clean(h?.trait),probability:clamp(h?.probability??.5),support:Math.max(0,Number(h?.support??0)),contradictions:Math.max(0,Number(h?.contradictions??0)),updatedAt:Number(h?.updatedAt??0),evidenceScore01:clamp(h?.evidenceScore01??.5),stability01:clamp(h?.stability01??.5),causalInfluence01:clamp(h?.causalInfluence01??0),samples:Math.max(0,Math.floor(Number(h?.samples??0))),recentEvidence:Array.isArray(h?.recentEvidence)?h.recentEvidence.slice(-12):emptyEvidence()
    })):[],trajectory:Array.isArray(raw.trajectory)?raw.trajectory.slice(-256):[],version:2,causalUpdates:Math.max(0,Math.floor(Number(raw.causalUpdates??0))),lastCausalAt:Number(raw.lastCausalAt??0)};
  }
  snapshot(){return structuredClone(this.state);}
  private ensure(context:string,trait:string){
    let h=this.state.hypotheses.find(x=>x.context===context&&x.trait===trait);
    if(!h){h={id:`ph-${now()}-${this.state.hypotheses.length}`,context,trait,probability:.5,support:0,contradictions:0,updatedAt:now(),evidenceScore01:.5,stability01:.5,causalInfluence01:0,samples:0,recentEvidence:[]};this.state.hypotheses.unshift(h);}
    return h;
  }
  observe(context:string,trait:string,support:boolean){
    const h=this.ensure(clean(context),clean(trait));
    support?h.support++:h.contradictions++;
    h.samples++;
    h.probability=clamp((h.support+.5)/(h.support+h.contradictions+1));
    h.stability01=clamp(h.stability01*.94+(1-Math.min(1,Math.abs(h.probability-.5)*1.7))*.06);
    h.updatedAt=now();
    return structuredClone(h);
  }
  observeCausal(input:{tick:number;at?:number;context:string;trait:string;support:boolean;strength01?:number;confidence01?:number;evidence01?:number;source?:string}):PersonalityHypothesis{
    const h=this.ensure(clean(input.context),clean(input.trait));
    const strength=clamp(input.strength01??.5); const confidence=clamp(input.confidence01??.5); const evidence=clamp(input.evidence01??confidence);
    h.samples++; input.support?h.support+=strength:h.contradictions+=strength;
    const total=h.support+h.contradictions+1;
    const observed=clamp(h.support/total);
    h.probability=clamp(h.probability*(1-.18*confidence*evidence)+observed*(.18*confidence*evidence));
    h.evidenceScore01=clamp(h.evidenceScore01*.9+evidence*.1);
    h.stability01=clamp(h.stability01*.92+(1-Math.abs(observed-h.probability))*.08);
    h.causalInfluence01=clamp(h.causalInfluence01*.9+strength*confidence*evidence*.1);
    h.updatedAt=Number(input.at??now());
    h.recentEvidence=[...h.recentEvidence,{at:h.updatedAt,tick:Math.max(0,Math.floor(input.tick)),source:clean(input.source??'causal-outcome',72),support:input.support,strength01:strength,confidence01:confidence,evidence01:evidence}].slice(-12);
    this.state.trajectory=[...this.state.trajectory,{at:h.updatedAt,tick:Math.max(0,Math.floor(input.tick)),trait:h.trait,probability:h.probability,stability01:h.stability01,causalInfluence01:h.causalInfluence01,source:clean(input.source??'causal-outcome',72)}].slice(-256);
    this.state.causalUpdates++; this.state.lastCausalAt=h.updatedAt;
    return structuredClone(h);
  }
  rank(context:string){return this.state.hypotheses.filter(x=>x.context===clean(context)).sort((a,b)=>b.probability-a.probability).slice(0,4).map(x=>structuredClone(x));}
  strongest(context:string){return this.rank(context)[0]??null;}
  actionBias(action:string){
    const a=String(action);
    const rules:Array<[string,string,number]>=[
      ['explore','curiosity',.052],['verify','caution',.045],['verify','truth-seeking',.04],['reflect','self-reflection',.036],['respond','care',.034],['respond','social-attunement',.032],['rest','self-preservation',.028],['defer','caution',.02]
    ];
    let bias=0;
    for(const [act,trait,weight] of rules){if(act!==a)continue;const h=this.state.hypotheses.filter(x=>x.context==='life').find(x=>x.trait===trait);if(h&&h.samples>=3&&h.evidenceScore01>=.55) bias+=(h.probability-.5)*weight*clamp(.55+h.stability01*.45);}
    return Math.max(-.06,Math.min(.06,bias));
  }
  /** A verified value revision is a high-level autobiographical signal. It supports
   * trait hypotheses without being allowed to rewrite them in a single step.
   */
  observeValueRevision(input:{value:string;delta:number;evidence01:number;success01:number;at?:number;tick:number}){
    const value=clean(input.value,48); const mag=clamp(Math.abs(input.delta)); const evidence=clamp(input.evidence01);
    if(mag<0.0005 || evidence<0.55) return {applied:false,state:this.snapshot()};
    const traits:Record<string,string[]>= {
      curiosity:['curiosity'], truth:['truth-seeking'], evidence:['truth-seeking','caution'],
      autonomy:['autonomy'], care:['care','social-attunement'], responsibility:['responsibility','caution'], social:['social-attunement','care']
    };
    const applied=[] as PersonalityHypothesis[];
    for(const trait of traits[value]??[]){
      applied.push(this.observeCausal({tick:input.tick,at:input.at,context:'life',trait,support:input.success01>=0.58,strength01:clamp(.42+mag*8),confidence01:clamp(.62+evidence*.28),evidence01:evidence,source:'verified-value-revision'}));
    }
    return {applied:applied.length>0,traits:applied.map(x=>x.trait),state:this.snapshot()};
  }

  summary(){
    return {version:2,hypotheses:this.state.hypotheses.length,trajectorySamples:this.state.trajectory.length,causalUpdates:this.state.causalUpdates,strongest:this.state.hypotheses.slice().sort((a,b)=>b.causalInfluence01-a.causalInfluence01).slice(0,6).map(h=>({context:h.context,trait:h.trait,probability:h.probability,stability01:h.stability01,evidenceScore01:h.evidenceScore01,causalInfluence01:h.causalInfluence01,samples:h.samples}))};
  }
}
