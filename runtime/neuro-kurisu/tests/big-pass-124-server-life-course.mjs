import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const server=readFileSync(new URL('../src/server/server.mjs',import.meta.url),'utf8');
const core=readFileSync(new URL('../src/organism/core/OrganismCore.ts',import.meta.url),'utf8');
assert.match(server,/\/api\/organism\/life-course/);
assert.match(server,/lifeCourseDiagnostics/);
assert.match(core,/lifeCourseNavigator\.assess/);
assert.match(core,/lifeCourseNavigator\.actionBias/);
console.log('BIG_PASS_124_SERVER=PASS');
