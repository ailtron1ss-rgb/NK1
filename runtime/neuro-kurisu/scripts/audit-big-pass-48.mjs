import fs from 'node:fs';
import path from 'node:path';
const root=process.cwd();
const required=[
  'src/organism/system/EvidenceFirewall.ts',
  'src/organism/system/ProjectResearchSession.ts',
  'src/organism/core/CognitiveSubsystemPorts.ts',
  'src/organism/core/CognitiveSubsystemRegistry.ts',
  'tests/big-pass-48-firewall.mjs',
  'tests/big-pass-48-subsystem-ports.mjs',
  'tests/big-pass-48-persistence.mjs',
];
const missing=required.filter(f=>!fs.existsSync(path.join(root,f)));
if(missing.length) throw new Error(`missing=${missing.join(',')}`);
const fw=fs.readFileSync(path.join(root,'src/organism/system/EvidenceFirewall.ts'),'utf8');
const ports=fs.readFileSync(path.join(root,'src/organism/core/CognitiveSubsystemPorts.ts'),'utf8');
const core=fs.readFileSync(path.join(root,'src/organism/core/OrganismCore.ts'),'utf8');
const checks={
  firewall:fw.includes("status:'quarantine'")&&fw.includes('uniqueSources'),
  sourceIdentitySeparated:fw.includes('contentHash')&&fw.includes('sourceKey'),
  dependencyInversion:ports.includes('CognitiveSubsystemAccessors')&&!ports.includes("import type { OrganismCore"),
  persistence:core.includes('evidenceFirewall')&&core.includes('projectResearchSession'),
  externalGateway:core.includes("organism.project.research"),
};
if(Object.values(checks).some(v=>!v)) throw new Error(`checks-failed=${JSON.stringify(checks)}`);
console.log('BIG_PASS_48_AUDIT=PASS',JSON.stringify({checks,required:required.length}));
