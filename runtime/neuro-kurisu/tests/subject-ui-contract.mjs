import assert from 'node:assert/strict';
import fs from 'node:fs';
const html=fs.readFileSync('public/index.html','utf8');
const app=fs.readFileSync('public/app.js','utf8');
for (const token of ['subject-status','subject-continuity','identity-lineage-status','identity-lineage','voice-stop','Subject Continuity / Integration','Identity Lineage / Causality']) assert.ok(html.includes(token), `missing UI token: ${token}`);
for (const token of ['/api/organism/subject-continuity','refreshSubjectContinuity','/api/organism/identity-lineage','refreshIdentityLineage']) assert.ok(app.includes(token), `missing app token: ${token}`);
console.log('SUBJECT_UI_CONTRACT=PASS');
