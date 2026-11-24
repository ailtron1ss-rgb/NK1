import { probeOrganismSystem, type OrganismSystemHealthSnapshot } from './OrganismSystemContract.ts';
import { CapabilityRegistry } from '../system/CapabilityRegistry.ts';
import { IntegritySentinel } from '../system/IntegritySentinel.ts';
import { ReplayEngine } from '../system/ReplayEngine.ts';
import { AdvancedResilienceEngine } from '../learning/AdvancedResilienceEngine.ts';
import { P69ConstitutionalArbiter } from '../cognition/P69ConstitutionalArbiter.ts';
import { P72LifeCycleOrchestrator } from '../system/P72LifeCycleOrchestrator.ts';
import { P73CapabilityEvolutionLedger } from '../system/P73CapabilityEvolutionLedger.ts';
import { SelfGovernanceEngine } from '../cognition/evolution/SelfGovernanceEngine.ts';
import { ConstitutionEvolutionEngine } from '../cognition/evolution/ConstitutionEvolutionEngine.ts';
import { BehavioralInfluenceLedger } from '../system/BehavioralInfluenceLedger.ts';
import { RealityEvidenceLedger } from '../system/RealityEvidenceLedger.ts';
import { SelfModelValidationEngine } from '../system/SelfModelValidationEngine.ts';
import { FailureRecoveryCertification } from '../system/FailureRecoveryCertification.ts';
import { CognitiveDomainClosure } from '../system/CognitiveDomainClosure.ts';
import { CausalDomainClosureLedger } from '../system/CausalDomainClosureLedger.ts';
import { CognitiveParliament, type ParliamentTrustPort, type ParliamentEvidenceReference, type ParliamentRisk } from '../system/CognitiveParliament.ts';
import { CognitiveParliamentDispatcher, type ParliamentDispatchResult, type ParliamentRoleExecutorMap } from '../system/CognitiveParliamentDispatcher.ts';
import type { P69Input } from '../cognition/P69ConstitutionalArbiter.ts';

/** BIG PASS 51: physical owner for capability, integrity, resilience and constitutional governance. */
export class GovernanceSubsystemRuntime {
  readonly cognitiveParliament: CognitiveParliament;
  readonly cognitiveParliamentDispatcher: CognitiveParliamentDispatcher;
  constructor(input: { parliamentTrustPort?: ParliamentTrustPort; parliamentRoleExecutors?: ParliamentRoleExecutorMap } = {}) {
    this.cognitiveParliament = new CognitiveParliament(input.parliamentTrustPort);
    this.cognitiveParliamentDispatcher = new CognitiveParliamentDispatcher(this.cognitiveParliament,input.parliamentRoleExecutors);
  }

  readonly systemName='governance' as const;
  readonly dependencies=['self'] as const;
  readonly systemCapabilities=['governance', 'persistence'] as const;
  health(): OrganismSystemHealthSnapshot { return probeOrganismSystem(this); }

  readonly capabilities = new CapabilityRegistry();
  readonly integrity = new IntegritySentinel();
  readonly replay = new ReplayEngine();
  readonly resilience = new AdvancedResilienceEngine();
  readonly p69ConstitutionalArbiter = new P69ConstitutionalArbiter();
  readonly p72LifeCycle = new P72LifeCycleOrchestrator();
  readonly p73CapabilityLedger = new P73CapabilityEvolutionLedger();
  readonly selfGovernance = new SelfGovernanceEngine();
  /** OmeStro #20: versioned governance ledger; it never rewrites P69 or protected host controls. */
  readonly constitutionEvolution = new ConstitutionEvolutionEngine();

  readonly behavioralInfluenceLedger = new BehavioralInfluenceLedger();
  readonly realityEvidenceLedger = new RealityEvidenceLedger(384);
  readonly selfModelValidation = new SelfModelValidationEngine();
  readonly failureRecoveryCertification = new FailureRecoveryCertification();
  readonly cognitiveDomainClosure = new CognitiveDomainClosure(16);
  readonly causalDomainClosureLedger = new CausalDomainClosureLedger(32);

  async deliberateAndArbitrate(input: {
    candidateId:string; risk:ParliamentRisk; task:string; evidenceReferences?:ParliamentEvidenceReference[];
    p69Input:P69Input; timeoutMs?:number; maxConcurrent?:number; maxTotalTokens?:number; maxInputChars?:number;
  }): Promise<{
    status:'parliament-not-approved'|'candidate-not-in-p69-set'|'p69-selected'|'p69-safe-fallback'|'p69-diverted';
    parliament:ParliamentDispatchResult;
    arbitration:ReturnType<P69ConstitutionalArbiter['arbitrate']>|null;
  }> {
    let snapshot:P69Input;
    try { snapshot=structuredClone(input.p69Input); } catch { throw new Error('cognitive-parliament-p69-candidate-snapshot-invalid'); }
    const candidates=Array.isArray(snapshot?.candidates)?snapshot.candidates:[];
    const ids=candidates.map(row=>row?.id);
    const valid=ids.every(id=>typeof id==='string'&&id.trim())&&new Set(ids).size===ids.length&&candidates.filter(row=>row?.id===input.candidateId).length===1;
    if(!valid){
      const parliament=await this.cognitiveParliamentDispatcher.dispatch({candidateId:'',risk:input.risk,task:input.task,evidenceReferences:[],timeoutMs:input.timeoutMs,maxConcurrent:input.maxConcurrent,maxTotalTokens:input.maxTotalTokens,maxInputChars:input.maxInputChars});
      return {status:'candidate-not-in-p69-set',parliament,arbitration:null};
    }
    const parliament=await this.cognitiveParliamentDispatcher.dispatch({
      candidateId:input.candidateId,risk:input.risk,task:input.task,evidenceReferences:input.evidenceReferences,
      timeoutMs:input.timeoutMs,maxConcurrent:input.maxConcurrent,maxTotalTokens:input.maxTotalTokens,maxInputChars:input.maxInputChars,
    });
    if(parliament.decision.status!=='approved')return {status:'parliament-not-approved',parliament,arbitration:null};
    const safeActions=new Set(['rest','wait','defer']);
    const allowed=candidates.filter(row=>row.id===input.candidateId||safeActions.has(row.action));
    const allowedIds=new Set(allowed.map(row=>row.id));
    const arbitration=this.p69ConstitutionalArbiter.arbitrate({...snapshot,candidates:allowed});
    const chosenId=arbitration.chosen?.id??null;
    return {status:chosenId===input.candidateId?'p69-selected':
      chosenId&&allowedIds.has(chosenId)&&safeActions.has(allowed.find(row=>row.id===chosenId)?.action??'')?'p69-safe-fallback':'p69-diverted',parliament,arbitration};
  }
  async deliberateCycleCandidate(input: {
    candidateId:string; risk:ParliamentRisk; task:string; evidenceReferences?:ParliamentEvidenceReference[];
    p69Input:P69Input; timeoutMs?:number; maxConcurrent?:number; maxTotalTokens?:number; maxInputChars?:number;
  }): Promise<{
    status:'p69-selected'|'p69-safe-fallback'|'parliament-blocked'|'candidate-not-in-p69-set';
    parliament:ParliamentDispatchResult;
    arbitration:ReturnType<P69ConstitutionalArbiter['arbitrate']>|null;
    selectedCandidate:P69Input['candidates'][number]|null;
  }> {
    const attempt=await this.deliberateAndArbitrate(input);
    if(attempt.status==='candidate-not-in-p69-set')return {status:'candidate-not-in-p69-set',parliament:attempt.parliament,arbitration:null,selectedCandidate:null};
    let arbitration=attempt.arbitration;
    if(!arbitration){
      const snapshot=structuredClone(input.p69Input);
      arbitration=this.p69ConstitutionalArbiter.arbitrate({...snapshot,candidates:snapshot.candidates.filter(c=>['rest','wait','defer'].includes(c.action)),requestedAction:null});
    }
    const chosenId=arbitration?.chosen?.id??null;
    const chosen=input.p69Input.candidates.find(c=>c.id===chosenId)??null;
    const approved=chosen?.id===input.candidateId&&attempt.status==='p69-selected';
    const fallback=Boolean(chosen&&['rest','wait','defer'].includes(chosen.action));
    return {status:approved?'p69-selected':fallback?'p69-safe-fallback':'parliament-blocked',parliament:attempt.parliament,arbitration,selectedCandidate:approved||fallback?structuredClone(chosen):null};
  }


  restoreFromPersisted(input: { advanced?: any }) {
    const advanced=input.advanced ?? {};
    this.resilience.restore(advanced.advancedResilience);
    this.p69ConstitutionalArbiter.restore(advanced.p69ConstitutionalArbiter);
    this.p72LifeCycle.restore(advanced.p72LifeCycle);
    this.p73CapabilityLedger.restore(advanced.p73CapabilityLedger);
    this.selfGovernance.restore(advanced.selfGovernance);
    // Fail-closed restore: invalid snapshots reset to the compiled immutable baseline and expose diagnostics.
    this.constitutionEvolution.restore(advanced.constitutionEvolution);
  }

  snapshot() {
    return {
      capabilities: this.capabilities.snapshot(),
      advancedResilience: this.resilience.snapshot(),
      p69ConstitutionalArbiter: this.p69ConstitutionalArbiter.snapshot(),
      p72LifeCycle: this.p72LifeCycle.snapshot(),
      p73CapabilityLedger: this.p73CapabilityLedger.snapshot(),
      selfGovernance: this.selfGovernance.snapshot(),
      constitutionEvolution: this.constitutionEvolution.snapshot(),
    };
  }
}
