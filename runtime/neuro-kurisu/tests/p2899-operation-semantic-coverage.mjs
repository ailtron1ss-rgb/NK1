import assert from 'node:assert/strict'; import fs from 'node:fs';
if(!fs.existsSync('SEMANTIC_COVERAGE_AUDIT.json')) throw new Error('run semantic audit first');
const c=JSON.parse(fs.readFileSync('SEMANTIC_COVERAGE_AUDIT.json','utf8')); const domains=new Set(['memory','world','learning','self','agency','consciousness','perception']); const rows=c.contracts.filter(x=>domains.has(x.domain)&&x.safety==='stateful'); const covered=rows.filter(x=>x.status!=='UNVERIFIED').length;
assert.ok(rows.length>200,'critical operation inventory must be substantial'); assert.ok(covered>0); console.log(JSON.stringify({pass:true,criticalOperations:rows.length,coveredOperations:covered,coverage01:covered/rows.length}));
