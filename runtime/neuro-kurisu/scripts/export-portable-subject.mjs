import { readFile, writeFile } from 'node:fs/promises';
import { buildPortableSubjectBundle, validatePortableSubjectBundle } from '../src/organism/persistence/PortableSubjectContract.ts';

const input = process.argv[2] || process.env.NEURO_STATE_FILE;
const output = process.argv[3] || 'portable-subject.json';
if (!input) throw new Error('Usage: npm run subject:export -- <state.json> [portable-subject.json]');
const state = JSON.parse(await readFile(input, 'utf8'));
const bundle = buildPortableSubjectBundle(state);
validatePortableSubjectBundle(bundle);
await writeFile(output, JSON.stringify(bundle, null, 2), 'utf8');
console.log(`PORTABLE_SUBJECT_EXPORT=PASS subjectId=${bundle.subjectId} fingerprint=${bundle.subjectFingerprint} output=${output}`);
