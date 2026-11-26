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

// The registry's agency port must be a read-only snapshot, not a scheduling command.
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

// The facade exposes both safe probe details and the separate active scheduling command.
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

// Every declared snapshot owner is probed, not only the seven root snapshots.
{
  const { accessors, calls } = createAccessors();
  accessors.p71Snapshot = () => { calls.p71Snapshot += 1; throw new Error('SECRET_TOKEN_must_not_escape'); };
  accessors.predictionDebtSnapshot = () => [];
  accessors.externalEvidenceSnapshot = () => undefined;
  accessors.evidenceFirewallSnapshot = () => 'primitive';
  const registry = new CognitiveSubsystemRegistry(accessors);
  const details = registry.probeDetails(true);
  assert.equal(details.length, 34, 'all declared read-only ports must be observed');
  const p71 = details.find((row) => row.domain === 'self' && row.port === 'consistency');
  assert.equal(p71.status, 'throw');
  assert.equal(p71.available, false);
  assert.equal(p71.probeKind, 'read-only-snapshot');
  assert.equal(p71.evidence, 'snapshot-only');
  assert.equal(p71.errorType, 'Error');
  assert.equal(JSON.stringify(details).includes('SECRET_TOKEN'), false, 'exception messages must not leak');
  assert.equal('owner' in p71, false, 'snapshot payloads must never be returned');

  const debt = details.find((row) => row.domain === 'memory' && row.port === 'predictionDebt');
  assert.equal(debt.status, 'invalid', 'arrays are not valid object snapshots');
  assert.equal(debt.available, false);
  const missingEvidence = details.find((row) => row.domain === 'memory' && row.port === 'evidenceTrust');
  const primitiveEvidence = details.find((row) => row.domain === 'memory' && row.port === 'evidenceFirewall');
  assert.equal(missingEvidence.status, 'invalid', 'undefined is not a valid snapshot');
  assert.equal(primitiveEvidence.status, 'invalid', 'primitive values are not valid snapshots');
  const emptySchedule = details.find((row) => row.domain === 'agency' && row.port === 'multiProjectSchedule');
  assert.equal(emptySchedule.status, 'empty', 'null is a valid empty snapshot');
  assert.equal(emptySchedule.available, true);

  const health = registry.health();
  const self = health.find((row) => row.name === 'self');
  const memory = health.find((row) => row.name === 'memory');
  const agency = health.find((row) => row.name === 'agency');
  assert.equal(self.available, false, 'nested self failure must not be masked by root snapshot');
  assert.equal(self.failedProbeCount, 1);
  assert.deepEqual(self.failedPorts, ['consistency']);
  assert.equal(memory.available, false, 'invalid nested snapshot must make the owning domain unavailable');
  assert.deepEqual(memory.failedPorts, ['predictionDebt','evidenceTrust','evidenceFirewall']);
  assert.equal(agency.available, true, 'an intentionally empty schedule is not an error');
  assert.equal(self.evidence, 'snapshot-only');
}

// Repeated observations use the two-second cache; forced refresh is explicit.
{
  const { accessors, calls } = createAccessors();
  const registry = new CognitiveSubsystemRegistry(accessors);
  const first = registry.probeDetails(true);
  const afterFirst = calls.memorySnapshot;
  assert.equal(afterFirst, 1);
  const second = registry.probeDetails();
  const health = registry.health();
  assert.equal(calls.memorySnapshot, afterFirst, 'cached detail and health reads must not reprobe owners');
  assert.equal(second.length, first.length);
  assert.equal(health.find((row) => row.name === 'memory').available, true);
  registry.probeDetails(true);
  assert.equal(calls.memorySnapshot, afterFirst + 1, 'forced refresh must call owners again');
  const flight = registry.flightSnapshot();
  const flightSummary = registry.flightSummary();
  assert.ok(flight['memory.snapshot']);
  assert.ok(flight['agency.multiProjectSchedule']);
  assert.equal(flightSummary.subsystems, 7, 'flight summary should count owning domains, not each port');
  assert.equal(flightSummary.probes, 34, 'flight summary should separately count probed ports');
}

// The real Core diagnostics surface must preserve the scheduler state.
{
  const core = new OrganismCore(new MemoryStateStore(), { enableLanguage:false, performanceProfile:'mobile', cycleResultMode:'operational' });
  await core.init();
  const before = core.multiProjectScheduleSnapshot();
  const tickBefore = core.snapshot().state.tick;
  const details = core.cognitiveSubsystemProbeDetails(true);
  const after = core.multiProjectScheduleSnapshot();
  const tickAfter = core.snapshot().state.tick;
  assert.equal(details.length, 34);
  assert.deepEqual(after, before, 'read-only probes must not mutate the live scheduler snapshot');
  assert.equal(tickAfter, tickBefore, 'read-only probes must not advance organism cognition');
  const health = core.cognitiveSubsystemHealth();
  const architecture = core.organismCognitiveArchitecture();
  assert.equal(health.length, 7);
  assert.ok(health.every(row => row.evidence === 'snapshot-only' && row.available));
  assert.equal(health.reduce((sum, row) => sum + row.probeCount, 0), 34);
  assert.equal(health.reduce((sum, row) => sum + row.failedProbeCount, 0), 0);
  assert.equal(architecture.runtimeSnapshot.cognitiveSubsystems.length, 7, 'the read-only architecture endpoint must expose subsystem diagnostics');
  assert.ok(architecture.runtimeSnapshot.cognitiveSubsystems.every(row => row.evidence === 'snapshot-only'));
  assert.ok(details.every(row => row.probeKind === 'read-only-snapshot' && row.evidence === 'snapshot-only'));
  const schedule = details.find(row => row.domain === 'agency' && row.port === 'multiProjectSchedule');
  assert.equal(schedule.status, 'empty');
  await core.flush();
}

console.log('SPECIAL_SYSTEM_PORT_PROBES=PASS');
