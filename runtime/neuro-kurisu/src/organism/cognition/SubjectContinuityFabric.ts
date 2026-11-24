export type SubjectResolution = 'micro'|'pulse'|'investigate'|'rest';

export interface SubjectContinuityInput {
  tick:number;
  at:number;
  identity01:number;
  identityConservation01:number;
  memoryContinuity01:number;
  autobiographicalContinuity01:number;
  causalContinuity01:number;
  grounding01:number;
  realityAlignment01:number;
  workspace01:number;
  crossModalAgreement01:number;
  unresolved01:number;
  epistemicIntegrity01:number;
  agency01:number;
  energy01:number;
  cognitiveCapacity01:number;
  predictionError01:number;
  novelty01:number;
  goalPressure01:number;
  externalInput:boolean;
  activeModalities:string[];
  developmentalIdentity01?:number;
  beliefLineage01?:number;
  socialContinuity01?:number;
  developmentalPressure01?:number;
}

export interface SubjectContinuityFrame {
  version:1;
  tick:number;
  at:number;
  continuity01:number;
  coherence01:number;
  epistemicIntegrity01:number;
  embodiedGrounding01:number;
  autobiographicalBinding01:number;
  agencyReadiness01:number;
  resourceFitness01:number;
  identityStability01:number;
  uncertainty01:number;
  bottleneck01:number;
  resolution:SubjectResolution;
  activeModalities:string[];
  dominantPressure:'identity'|'reality'|'memory'|'agency'|'resource'|'novelty'|'none';
  reasons:string[];
  developmentalIdentity01:number;
  beliefLineage01:number;
  socialContinuity01:number;
  developmentalPressure01:number;
  nonConsciousnessClaim:true;
}

const clamp=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
const harmonic=(values:number[]):number=>{
  const v=values.map(clamp).map(x=>Math.max(.04,x));
  if(!v.length)return 0;
  return v.length/(v.reduce((sum,x)=>sum+1/x,0));
};

/**
 * Derived convergence layer. It owns no persistent truth and never mutates identity, memory or world.
 * Its key idea is bottleneck coherence: a single critically weak substrate should remain visible instead
 * of being hidden by a high arithmetic mean.
 */
export class SubjectContinuityFabric {
  build(i:SubjectContinuityInput):SubjectContinuityFrame {
    const embodiedGrounding=clamp(i.grounding01*.45+i.realityAlignment01*.2+i.crossModalAgreement01*.2+(1-i.unresolved01)*.15);
    const autobiographicalBinding=clamp(i.memoryContinuity01*.3+i.autobiographicalContinuity01*.35+i.identity01*.2+i.identityConservation01*.15);
    const agencyReadiness=clamp(i.agency01*.38+i.goalPressure01*.18+(1-i.predictionError01)*.16+i.cognitiveCapacity01*.14+i.energy01*.14);
    const resourceFitness=clamp(i.energy01*.55+i.cognitiveCapacity01*.3+(1-i.predictionError01)*.15);
    const epistemicIntegrity=clamp(i.epistemicIntegrity01*.58+i.crossModalAgreement01*.18+(1-i.unresolved01)*.12+i.realityAlignment01*.12);
    const continuity=clamp(harmonic([i.identity01,i.memoryContinuity01,i.autobiographicalContinuity01,i.causalContinuity01,i.workspace01]));
    const coherence=clamp(harmonic([embodiedGrounding,autobiographicalBinding,epistemicIntegrity,resourceFitness,i.causalContinuity01,i.workspace01]));
    const bottleneck=clamp(harmonic([continuity,coherence,epistemicIntegrity,agencyReadiness]));
    const uncertainty=clamp(i.predictionError01*.45+i.unresolved01*.25+(1-i.crossModalAgreement01)*.15+(1-i.grounding01)*.15);
    const identityStability=clamp(i.identityConservation01*.65+i.identity01*.35);
    let resolution:SubjectResolution='micro';
    if(i.energy01<.2||i.cognitiveCapacity01<.22) resolution='rest';
    else if(i.externalInput||i.predictionError01>.62||i.goalPressure01>.75||uncertainty>.7) resolution='pulse';
    else if(embodiedGrounding<.45||epistemicIntegrity<.5||i.crossModalAgreement01<.42) resolution='investigate';
    const scores={identity:i.goalPressure01*.2+(1-i.identityConservation01)*.8,reality:(1-i.realityAlignment01)*.55+(1-embodiedGrounding)*.45,memory:(1-i.memoryContinuity01)*.65+(1-i.autobiographicalContinuity01)*.35,agency:i.goalPressure01*.7+(1-i.agency01)*.3,resource:(1-resourceFitness),novelty:i.novelty01};
    const dominant=(Object.entries(scores).sort((a,b)=>b[1]-a[1])[0]?.[0]??'none') as SubjectContinuityFrame['dominantPressure'];
    const reasons:string[]=[];
    if(embodiedGrounding<.5) reasons.push('grounding-bottleneck');
    if(epistemicIntegrity<.5) reasons.push('epistemic-bottleneck');
    if(autobiographicalBinding<.5) reasons.push('autobiographical-binding-weak');
    if(i.identityConservation01<.7) reasons.push('identity-instability');
    if(i.predictionError01>.6) reasons.push('prediction-error');
    if(i.externalInput) reasons.push('external-input');
    if(i.energy01<.3||i.cognitiveCapacity01<.3) reasons.push('resource-pressure');
    const developmentalIdentity01=clamp(i.developmentalIdentity01??autobiographicalBinding);
    const beliefLineage01=clamp(i.beliefLineage01??i.autobiographicalContinuity01);
    const socialContinuity01=clamp(i.socialContinuity01??.5);
    const developmentalPressure01=clamp(i.developmentalPressure01??(1-developmentalIdentity01));
    if(developmentalPressure01>.6) reasons.push('developmental-pressure');
    return {
      version:1,tick:i.tick,at:i.at,continuity01:continuity,coherence01:coherence,
      epistemicIntegrity01:epistemicIntegrity,embodiedGrounding01:embodiedGrounding,
      autobiographicalBinding01:autobiographicalBinding,agencyReadiness01:agencyReadiness,
      resourceFitness01:resourceFitness,identityStability01:identityStability,uncertainty01:uncertainty,
      bottleneck01:bottleneck,resolution,activeModalities:[...new Set(i.activeModalities)].slice(0,8),
      dominantPressure:dominant,reasons:[...new Set(reasons)].slice(0,8),developmentalIdentity01,
      beliefLineage01,socialContinuity01,developmentalPressure01,nonConsciousnessClaim:true,
    };
  }
}
