import fs from 'node:fs';
const semantic=JSON.parse(fs.readFileSync('SEMANTIC_COVERAGE_AUDIT.json','utf8'));
const live=JSON.parse(fs.readFileSync('FUNCTION_LIVENESS_AUDIT.json','utf8'));
const param=JSON.parse(fs.readFileSync('PARAMETERIZED_FUNCTION_PROBE.json','utf8'));
const closure=fs.existsSync('BIG_PASS_181_FUNCTION_REALITY_EVIDENCE.json')
  ? JSON.parse(fs.readFileSync('BIG_PASS_181_FUNCTION_REALITY_EVIDENCE.json','utf8')) : null;
const contracts=semantic.contracts??[];
const statuses={};
for(const c of contracts){
  statuses[c.id]={
    status:c.status,file:c.file,name:c.name,line:c.line,kind:c.kind,safety:c.safety,
    domain:c.domain,criticality:c.criticality,staticReferences:c.staticReferences,
    testReferences:c.testReferences,
    evidenceKinds:[...new Set((c.evidence??[]).filter(e=>e.ok).map(e=>e.kind))]
  };
}
const domainTotals={};
for(const c of contracts){
  const d=c.domain??'infrastructure';
  domainTotals[d]??={total:0,verified:0,integration:0,unsafe:0,unverified:0};
  domainTotals[d].total++;
  domainTotals[d][{VERIFIED:'verified',INTEGRATION_ONLY:'integration',UNSAFE_TO_AUTO_RUN:'unsafe',UNVERIFIED:'unverified'}[c.status]]++;
}
const totals={
  semanticFunctions:contracts.length,functionLikeDeclarations:live.functionLikeDeclarations,
  withBody:live.withBody,exported:live.exported,zeroReference:live.zeroReference,
  oneOrLessReference:live.oneOrLessReference,parameterizedAttempted:param.attempted,
  parameterizedPassed:param.passed,parameterizedSkipped:param.skipped,
  lifecycleNeeded:param.lifecycleNeeded,closureCandidates:closure?.candidates??null,
  closurePassed:closure?.passed??null,closureFailed:closure?.failed??null
};
const result={
  pass:188,generatedAt:new Date().toISOString(),
  definition:'function is complete only when behavioral evidence exists; static existence never counts as completion',
  totals,statusCounts:semantic.byStatus,strictVerifiedRate01:semantic.verifiedRate01,
  evidenceCoverage01:semantic.evidenceCoverage01,domains:domainTotals,
  functions:statuses,
  knownGaps:{parameterizedFailures:param.failed,unverified:semantic.byStatus.UNVERIFIED,
    lifecycleNeeded:param.lifecycleNeeded,unsafeToAutoRun:semantic.byStatus.UNSAFE_TO_AUTO_RUN,
    zeroReference:live.zeroReference},
  policy:{staticPresence:'NOT_COMPLETE',integrationOnly:'NOT_COMPLETE',
    verified:'COMPLETE_FOR_FUNCTIONAL_CLAIM_ONLY',longHorizonVerified:'separate-gate',
    realDeviceVerified:'separate-gate',researchGrade:'separate-gate'}
};
fs.writeFileSync('FUNCTION_REALITY_MASTER_188.json',JSON.stringify(result,null,2));
const domains=Object.entries(domainTotals).map(([d,v])=>
  `| ${d} | ${v.total} | ${v.verified} | ${v.integration} | ${v.unsafe} | ${v.unverified} |`).join('\n');
const lines=[
  '# BIG PASS 188 — MASTER FUNCTION REALITY AUDIT','',`Generated: ${result.generatedAt}`,'',
  '## Rule','',result.definition,'','## Global inventory','',
  `Semantic source functions: **${contracts.length}**`,
  `Function-like declarations in liveness sweep: **${live.functionLikeDeclarations}**`,
  `Functions with bodies: **${live.withBody}**`,
  `Zero static references: **${live.zeroReference}**`,
  `One-or-less static references: **${live.oneOrLessReference}**`,'',
  '## Behavioral evidence','',
  `Parameterized attempted: **${param.attempted}**`,
  `Parameterized passed: **${param.passed}**`,
  `Parameterized skipped (unsafe): **${param.skipped}**`,
  `Lifecycle-needed: **${param.lifecycleNeeded}**`,
  `Parameterized failures: **${param.failed}**`,'',
  `Snapshot/restore closure: **${closure?.passed??'n/a'}/${closure?.candidates??'n/a'} PASS**`,'',
  `Strict VERIFIED: **${semantic.byStatus.VERIFIED} / ${contracts.length} = ${(semantic.verifiedRate01*100).toFixed(2)}%**`,
  `Evidence coverage: **${(semantic.evidenceCoverage01*100).toFixed(2)}%**`,'','## By domain','',
  '| Domain | Total | Verified | Integration | Unsafe | Unverified |',
  '|---|---:|---:|---:|---:|---:|',domains,'','## Non-negotiable interpretation','',
  '- VERIFIED is not a consciousness claim.',
  '- INTEGRATION_ONLY is not a completion claim.',
  '- UNSAFE_TO_AUTO_RUN requires a dedicated controlled test.',
  '- UNVERIFIED remains incomplete regardless of how much code exists.','',
  '## Current highest-value gap','',
  `The largest gap is behavioral evidence across the ${semantic.byStatus.UNVERIFIED} unverified functions.`,
  'The next passes must target the highest-criticality stateful functions and attach direct, regression, persistence or replay evidence.'
];
fs.writeFileSync('FUNCTION_REALITY_MASTER_188_RU.md',lines.join('\n'));
console.log(JSON.stringify(result.totals,null,2));
