import assert from 'node:assert/strict';
import { AgencySubsystemRuntime } from '../src/organism/core/AgencySubsystemRuntime.ts';
import { EvidenceResearchSubsystemRuntime } from '../src/organism/core/EvidenceResearchSubsystemRuntime.ts';

const agency=new AgencySubsystemRuntime();
const p=agency.selfProjects.propose({intrinsicOverall:.9,dominant:'competence',uncertainty:.8,predictionError:.7,identityDrift:.1,unresolvedExperiments:1,activeGoals:[]});
assert.ok(p);
const before=agency.snapshot();
const restored=new AgencySubsystemRuntime(); restored.restore(before);
assert.equal(restored.selfProjects.snapshot().projects.length,1);
assert.equal(restored.projectExecutor.snapshot().version,7); // WorkPass 20 qualified-attempt persistence (schema v7: step operation checkpoints)

const research=new EvidenceResearchSubsystemRuntime();
const at=Date.now();
research.evidenceFirewall.observe({claimKey:'runtime:test',sourceClass:'external-api',sourceKey:'a.example',contentHash:'a',trust01:.9,confidence01:.9,at});
research.evidenceFirewall.observe({claimKey:'runtime:test',sourceClass:'external-api',sourceKey:'b.example',contentHash:'b',trust01:.9,confidence01:.9,at:at+1});
const rs=research.snapshot();
const restoredResearch=new EvidenceResearchSubsystemRuntime(); restoredResearch.restore(rs);
const rr=restoredResearch.snapshot();
assert.equal(rr.evidenceFirewall.claims[0].independentSources,2);
assert.equal(rr.evidenceFirewall.claims[0].status,'promoted');
assert.equal(rr.predictionLedger.version,2);
console.log('BIG_PASS_49_SUBSYSTEM_RUNTIME=PASS', JSON.stringify({projects:before.selfProjects.projects.length, evidenceStatus:rr.evidenceFirewall.claims[0].status}));
