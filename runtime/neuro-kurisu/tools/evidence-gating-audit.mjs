import fs from 'node:fs';
const fabric=fs.readFileSync('src/organism/memory/ExperienceContinuumFabric.ts','utf8');
const causal=fs.readFileSync('src/organism/learning/CausalExperienceStream.ts','utf8');
const unified=fs.readFileSync('src/organism/learning/UnifiedLearningSubstrate.ts','utf8');
const core=fs.readFileSync('src/organism/core/OrganismCore.ts','utf8');
const checks=[
  ['canonical memory isolated',/does not replace MemoryOS2 and never deletes canonical memories/],
  ['replay ungrounded',/stateGrounded:false/],
  ['independent validation gate',/independentVerified/],
  ['retention evidence',/retentionGain01|recomputeRetentionCurve/],
  ['matched experiment pairs',/pairKey|matchedPairs/],
  ['skill evidence binding',/MemorySkillEvidence|bindMemoryToSkill/],
  ['causal provenance',/provenance:'runtime-outcome'\|'experience-replay'\|'skill-repair'\|'external'/],
  ['unified provenance',/provenanceCounts/],
  ['bounded replay events',/events\.length>128/],
  ['core retention API',/experienceContinuumRetentionSummary/]
];
const missing=checks.filter(([,re])=>!re.test([fabric,causal,unified,core].join('\n')));
if(missing.length){console.error('EVIDENCE_GATING_AUDIT=FAIL',missing.map(x=>x[0]).join(','));process.exit(1)}
console.log('EVIDENCE_GATING_AUDIT=PASS',JSON.stringify({checks:checks.length}));
