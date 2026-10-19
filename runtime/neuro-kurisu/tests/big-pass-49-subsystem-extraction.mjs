import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { AgencySubsystemRuntime } from '../src/organism/core/AgencySubsystemRuntime.ts';
import { EvidenceResearchSubsystemRuntime } from '../src/organism/core/EvidenceResearchSubsystemRuntime.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';

const coreSource = await readFile(new URL('../src/organism/core/OrganismCore.ts', import.meta.url), 'utf8');
const forbidden = [
  'new SelfProjectEngine(', 'new AgencyDeliberationEngine(', 'new CognitiveBudgetManager(',
  'new CognitiveQuorumEngine(', 'new AutonomousProjectExecutor(', 'new MultiProjectScheduler(',
  'new PredictionLedger(', 'new ExternalEvidenceTrustEngine(', 'new ExternalProjectResearchTool(',
  'new EvidenceFirewallEngine(', 'new ProjectResearchSession(', 'new SkillAcquisitionBenchmark(',
  'new SelfPredictionBenchmark(', 'new ModelOlympics(', 'new PredictionDebtEngine(',
  'new ShadowOrganismEngine(', 'new IdentityCausalityGraphEngine(', 'new LongHorizonPredictionBenchmark(',
];
for (const marker of forbidden) assert.equal(coreSource.includes(marker), false, `Core must not own ${marker}`);

const agency = new AgencySubsystemRuntime();
agency.selfProjects.propose({ intrinsicOverall:.8, dominant:'competence', uncertainty:.7, predictionError:.7, identityDrift:.1, unresolvedExperiments:1, activeGoals:[] });
const agencyBefore = agency.snapshot();
const agencyRoundTrip = new AgencySubsystemRuntime();
agencyRoundTrip.restore(agencyBefore);
assert.deepEqual(agencyRoundTrip.snapshot(), agencyBefore);

const research = new EvidenceResearchSubsystemRuntime();
research.evidenceFirewall.observe({claimKey:'unit:receipt',sourceClass:'external-api',sourceKey:'alpha',contentHash:'a',trust01:.9,confidence01:.9,at:Date.now()});
research.evidenceFirewall.observe({claimKey:'unit:receipt',sourceClass:'external-api',sourceKey:'beta',contentHash:'b',trust01:.9,confidence01:.9,at:Date.now()+1});
const researchBefore = research.snapshot();
const researchRoundTrip = new EvidenceResearchSubsystemRuntime();
researchRoundTrip.restore(researchBefore);

const rt=researchRoundTrip.snapshot();
assert.equal(rt.evidenceFirewall.claims.length, researchBefore.evidenceFirewall.claims.length);
assert.equal(rt.evidenceFirewall.claims[0]?.status, researchBefore.evidenceFirewall.claims[0]?.status);
assert.equal(rt.evidenceFirewall.claims[0]?.independentSources, researchBefore.evidenceFirewall.claims[0]?.independentSources);
assert.equal(rt.predictionLedger.samples, researchBefore.predictionLedger.samples);
assert.equal(rt.projectResearchSession.projectId, researchBefore.projectResearchSession.projectId);

const core = new OrganismCore(new MemoryStateStore());
await core.init();
const eventsBefore = core.snapshot().facets.memory.eventLog.filter(e => e.type === 'session' && e.payload?.kind === 'end').length;
await core.endTemporalSession('big-pass-49-test', true);
const eventsAfter = core.snapshot().facets.memory.eventLog.filter(e => e.type === 'session' && e.payload?.kind === 'end').length;
assert.equal(eventsAfter - eventsBefore, 1, 'temporal session must emit exactly one end event');

console.log('BIG_PASS_49_SUBSYSTEM_EXTRACTION=PASS', JSON.stringify({
  agencyProjects: agencyBefore.selfProjects.projects.length,
  researchClaims: researchBefore.evidenceFirewall.claims.length,
  sessionEndEventsAdded: eventsAfter - eventsBefore,
}));
