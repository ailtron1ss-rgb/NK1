import { readFile } from 'node:fs/promises';

const source = await readFile('src/organism/persistence/PortableSubjectContract.ts', 'utf8');
const required = [
  "PORTABLE_SUBJECT_PROTOCOL = 'neuro-kurisu.subject-transfer.v1'",
  'facets: structuredClone({',
  'memory: persisted.facets.memory',
  'learning: persisted.facets.learning',
  'consciousness: persisted.facets.consciousness',
  'evolution: persisted.facets.evolution',
  'cognition: persisted.facets.cognition',
  'advanced: persisted.facets.advanced',
  "if (!mayAdopt && identity.subjectId !== bundle.subjectId)",
];
const missing = required.filter(x => !source.includes(x));
const forbidden = ['projection: structuredClone(persisted.facets.embodiment)', 'projection: structuredClone(persisted.system.capabilities)'];
const violations = forbidden.filter(x => source.includes(x));
console.log(missing.length || violations.length
  ? `SUBJECT_BOUNDARY=FAIL\nmissing=${missing.join('|')}\nforbidden=${violations.join('|')}`
  : 'SUBJECT_BOUNDARY=PASS');
process.exit(missing.length || violations.length ? 1 : 0);
