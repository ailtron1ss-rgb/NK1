import assert from 'node:assert/strict';
import { CognitiveSubsystemRegistry } from '../src/organism/core/CognitiveSubsystemRegistry.ts';
import { CognitiveSubsystemFacade } from '../src/organism/core/CognitiveSubsystemFacade.ts';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';

const accessorNames = [
  'consciousnessSnapshot', 'identityCausalitySnapshot', 'selfPredictionBenchmarkSnapshot',
  'shadowOrganismSnapshot', 'p71Snapshot', 'developmentalCognitionSnapshot', 'perceptionSnapshot',
  'longHorizonPredictionSnapshot', 'p57Snapshot', 'modelOlympicsSnapshot', 'memorySnapshot',
  'p65Snapshot', 'predictionLedgerSnapshot', 'predictionDebtSnapshot', 'externalEvidenceSnapshot',
  'evidenceFirewallSnapshot', 'skillAcquisitionBenchmarkSnapshot', 'evolutionSnapshot',
  'autonomousProjectExecutorSnapshot', 'cognitiveBudgetSnapshot', 'cognitiveQuorumSnapshot',
  'multiProjectSchedule', 'multiProjectScheduleSnapshot', 'embodimentSnapshot', 'multimodalSnapshot',
  'perceptionRoutingSnapshot', 'advancedDevelopmentSnapshot', 'p32Snapshot', 'p53Snapshot',
  'externalProjectResearchConfig', 'projectResearchSessionSnapshot', 'systemSnapshot',
  'capabilitiesSnapshot', 'p60Snapshot', 'advancedResilienceSnapshot',
];

function createAccessors(overrides = {}) {
  const calls = Object.fromEntries(accessorNames.map((name) => [name, 0]));
  const accessors = Object.fromEntries(accessorNames.map((name) => [name, () => {
    calls[name] += 1;
    if (name === 'multiProjectScheduleSnapshot') return null;
    return { owner: name };
  }]));
  Object.assign(accessors, overrides);
  return { accessors, calls };
}

// RED target: the agency diagnostics port must not invoke the active scheduler.
{
  let activeSchedulingCalls = 0;
  const { accessors } = createAccessors({
    multiProjectSchedule: () => { activeSchedulingCalls += 1; throw new Error('active scheduler must not be invoked by diagnostics'); },
    multiProjectScheduleSnapshot: () => null,
  });
  const registry = new CognitiveSubsystemRegistry(accessors);
  assert.equal(registry.all().agency.multiProjectSchedule(), null);
  assert.equal(activeSchedulingCalls, 0, 'snapshot port must not invoke the active scheduler');
}

// The facade exposes safe port details and preserves the separate active scheduling command.
{
  let activeSchedulingCalls = 0;
  const { accessors } = createAccessors();
  const facade = new CognitiveSubsystemFacade({
    ...accessors,
    snapshot: () => ({}),
    systemSnapshot: () => ({}),
    p65Snapshot: () => ({}),
    cognitiveBudgetSpend: () => ({ ok:true }),
    cognitiveBudgetCanSpend: () => true,
    multiProjectSchedule: () => { activeSchedulingCalls += 1; return { selected:'active' }; },
    cognitiveKernelSnapshot: () => ({}),
    autonomousProjectExecutorSnapshot: () => ({}),
  });
  assert.equal(facade.subsystemProbeDetails(true).length, 34);
  assert.equal(activeSchedulingCalls, 0, 'facade diagnostics must not schedule work');
  assert.deepEqual(facade.multiProjectSchedule(), { selected:'active' });
  assert.equal(activeSchedulingCalls, 1, 'the active scheduling API remains available separately');
}

// All declared snapshot owners are probed; errors and malformed values are contained.
{
  const { accessors, calls } = createAccessors();
  accessors.p71Snapshot = () => { calls.p71Snapshot += 1; throw new Error('SECRET_TOKEN_must_not_escape'); };
  accessors.predictionDebtSnapshot = () => [];
  accessors.externalEvidenceSnapshot = () => undefined;
  accessors.evidenceFirewallSnapshot = () => 'primitive';
  const registry = new CognitiveSubsystemRegistry(accessors);
  const details = registry.probeDetails(true);
  assert.equal(details.length, 34);
  const p71 = details.find((row) => row.domain === 'self' && row.port === 'consistency');
  assert.equal(p71.status, 'throw');
  assert.equal(p71.available, false);
  assert.equal(p71.probeKind, 'read-only-snapshot');
  assert.equal(p71.evidence, 'snapshot-only');
  assert.equal(p71.errorType, 'Error');
  assert.equal(JSON.stringify(details).includes('SECRET_TOKEN'), false);
  assert.equal('owner' in p71, false);
  const debt = details.find((row) => row.domain === 'memory' && row.port === 'predictionDebt');
  assert.equal(debt.status, 'invalid');
  const missingEvidence = details.find((row) => row.domain === 'memory' && row.port === 'evidenceTrust');
  const primitiveEvidence = details.find((row) => row.domain === 'memory' && row.port === 'evidenceFirewall');
  assert.equal(missingEvidence.status, 'invalid');
  assert.equal(primitiveEvidence.status, 'invalid');
  const emptySchedule = details.find((row) => row.domain === 'agency' && row.port === 'multiProjectSchedule');
  assert.equal(emptySchedule.status, 'empty');
  assert.equal(emptySchedule.available, true);
  const health = registry.health();
  const self = health.find((row) => row.name === 'self');
  const memory = health.find((row) => row.name === 'memory');
  const agency = health.find((row) => row.name === 'agency');
  assert.equal(self.available, false);
  assert.equal(self.failedProbeCount, 1);
  assert.deepEqual(self.failedPorts, ['consistency']);
  assert.equal(memory.available, false);
  assert.deepEqual(memory.failedPorts, ['predictionDebt','evidenceTrust','evidenceFirewall']);
  assert.equal(agency.available, true);
  assert.equal(self.evidence, 'snapshot-only');
}

// Repeated observations use a bounded cache; forced refresh is explicit.
{
  const { accessors, calls } = createAccessors();
  const registry = new CognitiveSubsystemRegistry(accessors);
  const first = registry.probeDetails(true);
  const afterFirst = calls.memorySnapshot;
  assert.equal(afterFirst, 1);
  const second = registry.probeDetails();
  const health = registry.health();
  assert.equal(calls.memorySnapshot, afterFirst);
  assert.equal(second.length, first.length);
  assert.equal(health.find((row) => row.name === 'memory').available, true);
  registry.probeDetails(true);
  assert.equal(calls.memorySnapshot, afterFirst + 1);
  const flight = registry.flightSnapshot();
  const flightSummary = registry.flightSummary();
  assert.ok(flight['memory.snapshot']);
  assert.ok(flight['agency.multiProjectSchedule']);
  assert.equal(flightSummary.subsystems, 7);
  assert.equal(flightSummary.probes, 34);
}

// The real Core diagnostics surface must not mutate scheduler state or advance cognition.
{
  const core = new OrganismCore(new MemoryStateStore(), { enableLanguage:false, performanceProfile:'mobile', cycleResultMode:'operational' });
  await core.init();
  const before = core.multiProjectScheduleSnapshot();
  const tickBefore = core.snapshot().state.tick;
  const details = core.cognitiveSubsystemProbeDetails(true);
  const after = core.multiProjectScheduleSnapshot();
  const tickAfter = core.snapshot().state.tick;
  assert.equal(details.length, 34);
  assert.deepEqual(after, before);
  assert.equal(tickAfter, tickBefore);
  const health = core.cognitiveSubsystemHealth();
  const architecture = core.organismCognitiveArchitecture();
  assert.equal(health.length, 7);
  assert.ok(health.every(row => row.evidence === 'snapshot-only' && row.available));
  assert.equal(health.reduce((sum, row) => sum + row.probeCount, 0), 34);
  assert.equal(health.reduce((sum, row) => sum + row.failedProbeCount, 0), 0);
  assert.equal(architecture.runtimeSnapshot.cognitiveSubsystems.length, 7);
  assert.ok(architecture.runtimeSnapshot.cognitiveSubsystems.every(row => row.evidence === 'snapshot-only'));
  assert.ok(details.every(row => row.probeKind === 'read-only-snapshot' && row.evidence === 'snapshot-only'));
  const schedule = details.find(row => row.domain === 'agency' && row.port === 'multiProjectSchedule');
  assert.equal(schedule.status, 'empty');
  await core.flush();
}

console.log('SPECIAL_SYSTEM_PORT_PROBES=PASS');
