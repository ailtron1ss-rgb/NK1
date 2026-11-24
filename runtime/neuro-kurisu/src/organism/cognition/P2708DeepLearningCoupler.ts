export interface P2708DelayProfile {
  fastDecay01:number;
  midDecay01:number;
  slowDecay01:number;
  fastWeight01:number;
  midWeight01:number;
  slowWeight01:number;
}

export interface P2708DeepLearningCouplerState {
  version:1;
  enabled:boolean;
  delayProfile:P2708DelayProfile;
  selfNormalizationStrength01:number;
  targetWeightRms:number;
  targetWeightMean:number;
  epistemicCreditWeight01:number;
  causalCreditWeight01:number;
  normalizationUpdates:number;
  normalizationMeanAbs01:number;
  normalizationRms01:number;
  epistemicTeaching01:number;
  causalTeaching01:number;
  coupledCredit01:number;
  couplingStability01:number;
  forgettingProxy01:number;
  lastDelayProfileName:string;
}

const clamp=(x:number,a=0,b=1)=>Math.max(a,Math.min(b,Number.isFinite(x)?x:(a+b)/2));
const finite=(x:number,f=0)=>Number.isFinite(x)?x:f;

export const P2708_DELAY_PROFILES:Record<string,P2708DelayProfile>={
  short:{fastDecay01:.78,midDecay01:.92,slowDecay01:.985,fastWeight01:.62,midWeight01:.28,slowWeight01:.10},
  balanced:{fastDecay01:.84,midDecay01:.955,slowDecay01:.992,fastWeight01:.52,midWeight01:.30,slowWeight01:.18},
  long:{fastDecay01:.90,midDecay01:.972,slowDecay01:.996,fastWeight01:.40,midWeight01:.32,slowWeight01:.28},
  ultra:{fastDecay01:.94,midDecay01:.982,slowDecay01:.9985,fastWeight01:.30,midWeight01:.30,slowWeight01:.40},
};

const normalizedProfile=(p:P2708DelayProfile):P2708DelayProfile=>{
  const total=Math.max(.001,p.fastWeight01+p.midWeight01+p.slowWeight01);
  return {
    fastDecay01:clamp(p.fastDecay01,.55,.99),midDecay01:clamp(p.midDecay01,.70,.999),slowDecay01:clamp(p.slowDecay01,.85,.9998),
    fastWeight01:p.fastWeight01/total,midWeight01:p.midWeight01/total,slowWeight01:p.slowWeight01/total,
  };
};

export const defaultP2708DeepLearningCoupler=():P2708DeepLearningCouplerState=>({
  version:1,enabled:true,delayProfile:normalizedProfile(P2708_DELAY_PROFILES.balanced),selfNormalizationStrength01:.55,
  targetWeightRms:.035,targetWeightMean:0,epistemicCreditWeight01:.16,causalCreditWeight01:.84,
  normalizationUpdates:0,normalizationMeanAbs01:0,normalizationRms01:.035,epistemicTeaching01:0,causalTeaching01:0,
  coupledCredit01:0,couplingStability01:.6,forgettingProxy01:0,lastDelayProfileName:'balanced'
});

export class P2708DeepLearningCoupler {
  private state=defaultP2708DeepLearningCoupler();
  constructor(){this.state=defaultP2708DeepLearningCoupler();}
  snapshot(){return structuredClone(this.state);}
  restore(raw?:Partial<P2708DeepLearningCouplerState>|null){
    const d=defaultP2708DeepLearningCoupler(),r:any=raw??{};
    this.state={...d,...r,version:1,delayProfile:normalizedProfile({...d.delayProfile,...(r.delayProfile??{})})};
  }
  setEnabled(v:boolean){this.state.enabled=Boolean(v);}
  setSelfNormalization(strength01:number){this.state.selfNormalizationStrength01=clamp(strength01,0,.5);}
  setDelayProfile(name:string){
    const p=P2708_DELAY_PROFILES[name]??P2708_DELAY_PROFILES.balanced;
    this.state.delayProfile=normalizedProfile(p);this.state.lastDelayProfileName=P2708_DELAY_PROFILES[name]?name:'balanced';
  }
  delayProfile(){return {...this.state.delayProfile};}
  composeCredit(input:{causal01:number;epistemic01:number;experiment01:number;uncertainty01:number;verified01:number;stability01:number;budget01?:number}):number{
    const causal=clamp(input.causal01,-1,1);
    const epistemic=clamp((input.epistemic01*.72+input.experiment01*.28)*2-1,-1,1);
    const epistemicWeight=clamp(this.state.epistemicCreditWeight01 + .10*clamp(input.uncertainty01) + .04*(1-clamp(input.budget01??.7)),.08,.32);
    const causalWeight=1-epistemicWeight;
    const gate=clamp(.45+.35*input.verified01+.20*input.stability01,.2,1);
    const out=Math.tanh((causal*causalWeight+epistemic*epistemicWeight)*gate);
    this.state.epistemicCreditWeight01=this.state.epistemicCreditWeight01*.96+epistemicWeight*.04;
    this.state.causalCreditWeight01=1-this.state.epistemicCreditWeight01;
    this.state.epistemicTeaching01=this.state.epistemicTeaching01*.94+Math.abs(epistemic)*.06;
    this.state.causalTeaching01=this.state.causalTeaching01*.94+Math.abs(causal)*.06;
    this.state.coupledCredit01=this.state.coupledCredit01*.92+Math.abs(out)*.08;
    const agreement=1-Math.abs(causal-epistemic)/2;
    this.state.couplingStability01=this.state.couplingStability01*.95+clamp(agreement)*.05;
    return this.state.enabled?out:causal;
  }
  mixTrace(fast:number,mid:number,slow:number):number{
    const p=this.state.delayProfile;
    return finite(fast)*p.fastWeight01+finite(mid)*p.midWeight01+finite(slow)*p.slowWeight01;
  }
  normalizeRow(row:number[]):{mean:number;rms:number;delta01:number}{
    if(!this.state.enabled || this.state.selfNormalizationStrength01<=0 || row.length===0)return {mean:0,rms:0,delta01:0};
    let mean=0;for(const v of row)mean+=finite(v);mean/=row.length;
    let sq=0;for(const v of row){const d=finite(v)-mean;sq+=d*d;}const rms=Math.sqrt(sq/row.length);
    const strength=this.state.selfNormalizationStrength01;
    const targetMean=this.state.targetWeightMean;
    const desiredScale=clamp(this.state.targetWeightRms/Math.max(.004,rms),.05,1.2);
    const scale=clamp(1+strength*(desiredScale-1),.20,1.12);
    let delta=0;
    for(let i=0;i<row.length;i++){
      const old=finite(row[i]);const next=(old-mean)*scale+targetMean;row[i]=Math.max(-.35,Math.min(.35,next));delta+=Math.abs(row[i]-old);
    }
    this.state.normalizationUpdates+=1;
    this.state.normalizationMeanAbs01=this.state.normalizationMeanAbs01*.9+clamp(Math.abs(mean)/.1)*.1;
    this.state.normalizationRms01=this.state.normalizationRms01*.9+clamp(rms/.08)*.1;
    this.state.forgettingProxy01=this.state.forgettingProxy01*.96+clamp(delta/(row.length*.02))*.04;
    return {mean,rms,delta01:clamp(delta/(row.length*.02))};
  }
  metrics(){return {...this.state,delayProfile:{...this.state.delayProfile}};}
}
