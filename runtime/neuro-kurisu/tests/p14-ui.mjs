import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const html = await readFile(new URL('../public/index.html', import.meta.url),'utf8');
const js = await readFile(new URL('../public/app.js', import.meta.url),'utf8');
const avatar = await readFile(new URL('../public/avatar.html', import.meta.url),'utf8');
for (const id of ['refresh','speak','listen','viewer','camera','sleep','wake','snapshot','form','message','send','perception','network','memory','social']) assert.ok(html.includes(`id="${id}"`), `missing ${id}`);
for (const fragment of ["$('camera')", "'/api/organism/vision/capture'"]) assert.ok(js.includes(fragment), `missing-ui-binding:${fragment}`);
assert.ok(avatar.includes('/api/organism/avatar'));
console.log('P14_UI_STATIC=PASS');
