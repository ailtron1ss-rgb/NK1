export type DevelopmentalIdentityPhase = 'stabilizing' | 'exploring' | 'revising' | 'integrating' | 'repairing';

export interface DevelopmentalIdentityInput {
  identity:{continuity01:number;stability01:number;drift01:number;goalContinuity01:number;memoryContinuity01:number;authorshipContinuity01:number;valueDistance01:number};
  p76:{continuity01:number;conservation01:number;drift01:number;protectedViolations:number};
  p78:{continuity01:number;narrativeCoherence01:number;selfAuthorship01:number;turningPoints:number;chapters:number};
  p84:{lifeContinuity01:number;causalContinuity01:number;autobiographicalIntegrity01:number;beliefContinuity01:number;socialBinding01:number;selfChangeLoad01:number;memoryBinding01:number;identityChangeCount:number;counterEvidence01?:number;evidenceQuality01?:number};
  p80:{continuity01:number;coherence01:number;agency01:number;noveltyPressure01:number;currentMode:string};
  p71:{consistency01:number;repairPressure01:number;identityDrift01:number;goalConflict01:number;valueConflict01:number;actionMismatch01:number};
  p32:{selfCausalCoherence01:number;agencyCalibration01:number;selfPredictionAccuracy01:number;causalSpecificity01:number;revisionReadiness01:number};
  trajectory:{continuity:number;trajectoryStability:number;projectContinuity:number;valueContinuity:number;narrativeContinuity:number;authoredContinuity:number};
  narrative:{continuity:number;chapterCount:number;salience01:number};
  social:{personCount:number;predictionError01:number;trust01:number;warmth01:number;predictability01:number};
  immune:{acceptedCount:number;quarantineCount:number;reviewCount:number};
};

export interface DevelopmentalIdentityFrame {
  version:1;
  continuity01:number;
  integrity01:number;
  developmentalReadiness01:number;
  revisionReadiness01:number;
  protectiveStability01:number;
  beliefLineage01:number;
  autobiographicalBinding01:number;
  socialContinuity01:number;
  authorship01:number;
  causalSelf01:number;
  evidenceBalance01:number;
  counterEvidencePressure01:number;
  selfConsistency01:number;
  identityPressure01:number;
  noveltyPressure01:number;
  phase:DevelopmentalIdentityPhase;
  reasons:string[];
  nonConsciousnessClaim:true;
}

const clamp=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
const harmonic=(values:number[])=>{const xs=values.map(clamp).map(x=>Math.max(.04,x));return xs.length?xs.length/xs.reduce((s,x)=>s+1/x,0):0;};

/**
 * Derived synthesis only. It owns no persistent state and never rewrites identity,
 * memory, beliefs or goals. It makes the existing developmental subsystems legible
 * as one evidence-weighted developmental state.
 */
export class DevelopmentalIdentityFabric {
  build(i:DevelopmentalIdentityInput):DevelopmentalIdentityFrame {
    const evidenceQuality=clamp(i.p84.evidenceQuality01??.5);
    const counterEvidence=clamp(i.p84.counterEvidence01??0);
    const evidenceBalance=clamp(evidenceQuality*(.65)+Math.min(1,evidenceQuality+counterEvidence)*.35);
    const beliefLineage=harmonic([i.p84.beliefContinuity01, evidenceQuality, 1-counterEvidence*.55, i.p32.causalSpecificity01]);
    const autobiographicalBinding=harmonic([i.p78.continuity01,i.p78.narrativeCoherence01,i.p84.lifeContinuity01,i.p84.autobiographicalIntegrity01,i.p84.memoryBinding01]);
    const socialContinuity=harmonic([i.p84.socialBinding01,i.social.predictability01, i.social.trust01*.8+.2, i.social.warmth01*.8+.2]);
    const authorship=harmonic([i.identity.authorshipContinuity01,i.p78.selfAuthorship01,i.p80.agency01,i.trajectory.authoredContinuity]);
    const causalSelf=harmonic([i.p32.selfCausalCoherence01,i.p32.agencyCalibration01,i.p32.selfPredictionAccuracy01,i.p32.causalSpecificity01]);
    const protectiveStability=clamp(i.p76.conservation01*.32+i.identity.stability01*.28+i.p71.consistency01*.2+i.trajectory.trajectoryStability*.2);
    const identityPressure=clamp(i.p76.drift01*.22+i.p71.identityDrift01*.18+i.p71.goalConflict01*.15+i.p71.valueConflict01*.15+i.p71.repairPressure01*.12+i.p84.selfChangeLoad01*.1+(1-i.p84.autobiographicalIntegrity01)*.08);
    const revisionReadiness=clamp(i.p32.revisionReadiness01*.34+i.p71.repairPressure01*.18+counterEvidence*.18+i.p84.selfChangeLoad01*.12+(1-i.p76.conservation01)*.10+i.p80.noveltyPressure01*.08);
    const continuity=harmonic([i.identity.continuity01,i.p76.continuity01,i.p78.continuity01,i.p84.lifeContinuity01,i.p80.continuity01,i.trajectory.continuity,i.narrative.continuity]);
    const integrity=harmonic([continuity,evidenceBalance,beliefLineage,autobiographicalBinding,causalSelf,i.p71.consistency01,protectiveStability]);
    const developmentalReadiness=clamp(revisionReadiness*.35+(1-protectiveStability)*.18+i.p32.causalSpecificity01*.15+i.p84.causalContinuity01*.12+authorship*.10+i.p80.noveltyPressure01*.10);
    let phase:DevelopmentalIdentityPhase='stabilizing';
    if(i.p71.repairPressure01>.58||i.p71.goalConflict01>.58||i.p71.valueConflict01>.5) phase='repairing';
    else if(counterEvidence>.45||i.p32.revisionReadiness01>.58||revisionReadiness>.6) phase='revising';
    else if(i.p80.noveltyPressure01>.56&&identityPressure<.4) phase='exploring';
    else if(developmentalReadiness>.58&&autobiographicalBinding>.62) phase='integrating';
    const reasons:string[]=[];
    if(counterEvidence>.32) reasons.push('counter-evidence-active');
    if(revisionReadiness>.55) reasons.push('revision-ready');
    if(autobiographicalBinding<.58) reasons.push('autobiographical-binding-weak');
    if(beliefLineage<.58) reasons.push('belief-lineage-weak');
    if(socialContinuity<.52) reasons.push('social-continuity-weak');
    if(causalSelf<.52) reasons.push('causal-self-weak');
    if(protectiveStability<.62) reasons.push('identity-protection-needed');
    if(identityPressure>.55) reasons.push('identity-pressure');
    if(i.immune.quarantineCount>4) reasons.push('epistemic-quarantine');
    if(i.social.predictionError01>.55) reasons.push('social-prediction-error');
    return {version:1,continuity01:continuity,integrity01:integrity,developmentalReadiness01:developmentalReadiness,revisionReadiness01:revisionReadiness,protectiveStability01:protectiveStability,beliefLineage01:beliefLineage,autobiographicalBinding01:autobiographicalBinding,socialContinuity01:socialContinuity,authorship01:authorship,causalSelf01:causalSelf,evidenceBalance01:evidenceBalance,counterEvidencePressure01:counterEvidence,selfConsistency01:i.p71.consistency01,identityPressure01:identityPressure,noveltyPressure01:i.p80.noveltyPressure01,phase,reasons:[...new Set(reasons)].slice(0,10),nonConsciousnessClaim:true};
  }
}
