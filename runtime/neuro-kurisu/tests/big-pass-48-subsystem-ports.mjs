import assert from 'node:assert/strict';
import { createCognitiveSubsystemPorts } from '../src/organism/core/CognitiveSubsystemPorts.ts';
const values=new Map();
const A={
 consciousnessSnapshot:()=>({ok:true}),identityCausalitySnapshot:()=>({}),selfPredictionBenchmarkSnapshot:()=>({}),shadowOrganismSnapshot:()=>({}),p71Snapshot:()=>({}),
 developmentalCognitionSnapshot:()=>({}),perceptionSnapshot:()=>({}),longHorizonPredictionSnapshot:()=>({}),p57Snapshot:()=>({}),modelOlympicsSnapshot:()=>({}),
 memorySnapshot:()=>({}),p65Snapshot:()=>({}),predictionLedgerSnapshot:()=>({}),predictionDebtSnapshot:()=>({}),externalEvidenceSnapshot:()=>({}),evidenceFirewallSnapshot:()=>({ok:true}),skillAcquisitionBenchmarkSnapshot:()=>({}),
 evolutionSnapshot:()=>({}),autonomousProjectExecutorSnapshot:()=>({}),cognitiveBudgetSnapshot:()=>({}),cognitiveQuorumSnapshot:()=>({}),multiProjectSchedule:()=>({}),
 embodimentSnapshot:()=>({}),multimodalSnapshot:()=>({}),perceptionRoutingSnapshot:()=>({}),advancedDevelopmentSnapshot:()=>({}),p32Snapshot:()=>({}),p53Snapshot:()=>({}),externalProjectResearchConfig:()=>({}),projectResearchSessionSnapshot:()=>({}),
 systemSnapshot:()=>({}),capabilitiesSnapshot:()=>({}),p60Snapshot:()=>({}),advancedResilienceSnapshot:()=>({}),
};
const ports=createCognitiveSubsystemPorts(A);
assert.equal(ports.memory.evidenceFirewall().ok,true);
assert.deepEqual(Object.keys(ports).sort(),['agency','embodiment','governance','memory','research','self','world']);
console.log('BIG_PASS_48_SUBSYSTEM_PORTS=PASS',JSON.stringify({ports:Object.keys(ports).length}));
