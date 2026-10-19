/**
 * B295 — Critical Function Passport registry.
 *
 * The registry deliberately starts with the current canonical B289-B294 seam.
 * It is executable: tests can run these contracts and store evidence instead
 * of relying on source presence alone.
 */
import { B289NeuralOrganismIntegrationSpine, defaultB289State } from './B289NeuralOrganismIntegrationSpine.ts';
import { B290RealityGatedNeurodevelopment, defaultB290State } from './B290RealityGatedNeurodevelopment.ts';
import { B291UnifiedSelfAgencyGate, defaultB291State } from './B291UnifiedSelfAgencyGate.ts';
import { B292CognitiveStateBus, defaultB292CognitiveStateBus } from './B292CognitiveStateBus.ts';
import { B292IntentTrace, defaultB292IntentTrace } from './B292IntentTrace.ts';
import { B293SelfWorldPredictiveMicrocircuit, defaultB293State } from './B293SelfWorldPredictiveMicrocircuit.ts';
import { B294CausalNeuralEventSpine, defaultB294State } from './B294CausalNeuralEventSpine.ts';

export interface B295PassportEntry {
  id:string;
  owner:string;
  method:string;
  layer:'neural'|'executive'|'coordination'|'trace'|'causal';
  inputs:string[];
  output:string;
  contract:string;
  reversible:boolean;
}

export const B295_CRITICAL_FUNCTION_PASSPORTS:B295PassportEntry[]=[
  {id:'b296.step',owner:'B296',method:'step',layer:'neural',inputs:['spiking/self/agency/prediction state'],output:'neural personality-agency frame',contract:'runs bounded LIF-style circuit, produces finite sparse activity and action readout',reversible:true},
  {id:'b296.learnFromOutcome',owner:'B296',method:'learnFromOutcome',layer:'neural',inputs:['real outcome'],output:'plasticity metrics',contract:'three-factor outcome learning changes synaptic/readout state',reversible:true},
  {id:'b296.actionBias',owner:'B296',method:'actionBias',layer:'neural',inputs:['action'],output:'scalar',contract:'returns bounded neural readout influence and decreases under lesion',reversible:true},
  {id:'b296.lesion',owner:'B296',method:'lesion',layer:'neural',inputs:['fraction'],output:'lesion state',contract:'reduces B296 action influence and is reversible',reversible:true},
  {id:'b296.diagnostics',owner:'B296',method:'diagnostics',layer:'neural',inputs:[],output:'metrics',contract:'returns finite spiking, plasticity, homeostatic and organism-coupling metrics',reversible:true},
  {id:'b289.diagnostics',owner:'B289',method:'diagnostics',layer:'neural',inputs:[],output:'diagnostics',contract:'returns finite integration metrics without mutation',reversible:true},
  {id:'b289.step',owner:'B289',method:'step',layer:'neural',inputs:['runtime state'],output:'neural frame',contract:'updates recurrent state and returns bounded neural output',reversible:true},
  {id:'b289.actionBias',owner:'B289',method:'actionBias',layer:'neural',inputs:['action'],output:'scalar',contract:'returns finite bounded action influence',reversible:true},
  {id:'b289.learnFromOutcome',owner:'B289',method:'learnFromOutcome',layer:'neural',inputs:['outcome'],output:'learning metrics',contract:'outcome changes learned state',reversible:true},
  {id:'b290.controlMetrics',owner:'B290',method:'controlMetrics',layer:'executive',inputs:[],output:'control metrics',contract:'returns bounded developmental gate state',reversible:true},
  {id:'b290.actionBias',owner:'B290',method:'actionBias',layer:'executive',inputs:['action'],output:'scalar',contract:'returns finite bounded developmental action bias',reversible:true},
  {id:'b290.observe',owner:'B290',method:'observe',layer:'executive',inputs:['organism evidence'],output:'mode/readiness',contract:'observation updates developmental controller',reversible:true},
  {id:'b290.learnFromOutcome',owner:'B290',method:'learnFromOutcome',layer:'executive',inputs:['outcome'],output:'learning metrics',contract:'outcome updates gate/plasticity state',reversible:true},
  {id:'b291.metrics',owner:'B291',method:'metrics',layer:'executive',inputs:[],output:'agency metrics',contract:'returns bounded agency/personality metrics',reversible:true},
  {id:'b291.currentIntent',owner:'B291',method:'currentIntent',layer:'executive',inputs:[],output:'intent|null',contract:'returns current internally selected intent',reversible:true},
  {id:'b291.step',owner:'B291',method:'step',layer:'executive',inputs:['shared cognition'],output:'gate decision',contract:'selects bounded executive mode',reversible:true},
  {id:'b291.actionBias',owner:'B291',method:'actionBias',layer:'executive',inputs:['action'],output:'scalar',contract:'returns personality/agency fit influence',reversible:true},
  {id:'b291.learnFromOutcome',owner:'B291',method:'learnFromOutcome',layer:'executive',inputs:['outcome'],output:'learning metrics',contract:'outcome modifies intent/agency state',reversible:true},
  {id:'b292.bus.build',owner:'B292',method:'build',layer:'coordination',inputs:['shared state'],output:'state bus',contract:'produces one bounded per-cycle shared state',reversible:true},
  {id:'b292.bus.read',owner:'B292',method:'read',layer:'coordination',inputs:[],output:'state bus',contract:'returns latest state without mutation',reversible:true},
  {id:'b292.trace.observeDecision',owner:'B292',method:'observeDecision',layer:'trace',inputs:['decision'],output:'trace metrics',contract:'records intention lineage',reversible:true},
  {id:'b292.trace.observeOutcome',owner:'B292',method:'observeOutcome',layer:'trace',inputs:['outcome'],output:'trace metrics',contract:'closes intention episode with outcome',reversible:true},
  {id:'b293.step',owner:'B293',method:'step',layer:'neural',inputs:['self/world state'],output:'prediction frame',contract:'updates recurrent spiking circuit and predicts self/world',reversible:true},
  {id:'b293.learnFromOutcome',owner:'B293',method:'learnFromOutcome',layer:'neural',inputs:['outcome'],output:'learning metrics',contract:'plasticity responds to real outcome',reversible:true},
  {id:'b293.actionBias',owner:'B293',method:'actionBias',layer:'neural',inputs:['action'],output:'scalar',contract:'returns bounded predictive action influence',reversible:true},
  {id:'b293.lesion',owner:'B293',method:'lesion',layer:'neural',inputs:['fraction'],output:'metrics',contract:'causally alters circuit influence',reversible:true},
  {id:'b294.beginDecision',owner:'B294',method:'beginDecision',layer:'causal',inputs:['decision'],output:'episode id',contract:'opens one bounded causal episode',reversible:true},
  {id:'b294.closeOutcome',owner:'B294',method:'closeOutcome',layer:'causal',inputs:['outcome'],output:'causal update',contract:'closes episode and updates credit assignment',reversible:true},
  {id:'b294.actionBias',owner:'B294',method:'actionBias',layer:'causal',inputs:['action'],output:'scalar',contract:'returns bounded causal credit influence',reversible:true},
  {id:'b294.lesion',owner:'B294',method:'lesion',layer:'causal',inputs:['fraction'],output:'metrics',contract:'reduces neural causal contribution and is reversible',reversible:true},
  {id:'b294.diagnostics',owner:'B294',method:'diagnostics',layer:'causal',inputs:[],output:'metrics',contract:'returns causal/spike/learning diagnostics',reversible:true},
  {id:'b294.snapshot',owner:'B294',method:'snapshot',layer:'causal',inputs:[],output:'state',contract:'captures bounded persistent state',reversible:true},
];

export interface B295PassportContext { b289:B289NeuralOrganismIntegrationSpine; b290:B290RealityGatedNeurodevelopment; b291:B291UnifiedSelfAgencyGate; bus:B292CognitiveStateBus; trace:B292IntentTrace; b293:B293SelfWorldPredictiveMicrocircuit; b294:B294CausalNeuralEventSpine; }

export const createB295PassportContext=():B295PassportContext=>({
  b289:new B289NeuralOrganismIntegrationSpine(),
  b290:new B290RealityGatedNeurodevelopment(),
  b291:new B291UnifiedSelfAgencyGate(),
  bus:new B292CognitiveStateBus(),
  trace:new B292IntentTrace(),
  b293:new B293SelfWorldPredictiveMicrocircuit(),
  b294:new B294CausalNeuralEventSpine(),
});

export const restoreB295PassportDefaults=(ctx:B295PassportContext)=>{
  ctx.b289.restore(defaultB289State());
  ctx.b290.restore(defaultB290State());
  ctx.b291.restore(defaultB291State());
  ctx.bus.restore(defaultB292CognitiveStateBus());
  ctx.trace.restore(defaultB292IntentTrace());
  ctx.b293.restore(defaultB293State());
  ctx.b294.restore(defaultB294State());
  return ctx;
};
