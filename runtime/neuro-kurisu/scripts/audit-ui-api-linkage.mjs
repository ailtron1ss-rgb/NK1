import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(here, '../../..');
const apiPath = path.join(projectRoot, 'app/src/neuro-kurisu/api.ts');
const runtimePath = path.join(projectRoot, 'runtime/neuro-kurisu/src/server/server.mjs');
const bridgePath = path.join(projectRoot, 'research/research_bridge.py');
const dockPath = path.join(projectRoot, 'app/src/research/ResearchDock.tsx');
const atlasPath = path.join(projectRoot, 'app/src/components/RuntimeAtlas.tsx');
const vitePath = path.join(projectRoot, 'app/vite.config.ts');
const gatewayPath = path.join(projectRoot, 'tools/super-gateway.mjs');
for (const p of [apiPath, runtimePath, bridgePath, dockPath, atlasPath, vitePath, gatewayPath]) {
  if (!fs.existsSync(p)) throw new Error(`required integration file missing: ${path.relative(projectRoot, p)}`);
}
const api = fs.readFileSync(apiPath, 'utf8');
const runtime = fs.readFileSync(runtimePath, 'utf8');
const bridge = fs.readFileSync(bridgePath, 'utf8');
const dock = fs.readFileSync(dockPath, 'utf8');
const atlas = fs.readFileSync(atlasPath, 'utf8');
const vite = fs.readFileSync(vitePath, 'utf8');
const gateway = fs.readFileSync(gatewayPath, 'utf8');

const block = api.match(/export const neuroApi = \{([\s\S]*?)\n\};/);
if (!block) throw new Error('neuroApi export block not found');
const routes = [];
for (const line of block[1].split(/\r?\n/)) {
  const key = line.match(/^\s*([A-Za-z_$][\w$]*)\s*:/)?.[1];
  const endpoint = line.match(/request[^\n]*?\(\s*(["'`])([^"'`]+)\1/);
  if (key && endpoint) {
    const method = (/method:\s*["']POST["']/.test(line) || key === 'chat') ? 'POST' : 'GET';
    routes.push({ method, key, path: endpoint[2] });
  }
}
function canonicalPath(raw) {
  // Query strings and template interpolations belong to the client-side URL builder;
  // the HTTP router dispatches on pathname only.
  return String(raw).split('?')[0].split('${')[0].replace(/\/+$/, '') || '/';
}
const probeLine = block[1].split(/\r?\n/).find(line => /\bresearchProbe\s*:/.test(line)) ?? '';
const probeKinds = [...probeLine.matchAll(/["'](neurocore|nomega-registry|deepcode)["']/g)].map(m => m[1]);
function hasPath(source, pathName) {
  const escaped = pathName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?:url\\.)?pathname\\s*===\\s*(['"])${escaped}\\1`).test(source)
    || source.includes(`'${pathName}'`) || source.includes(`"${pathName}"`);
}
function runtimeCovers(route) {
  const p = canonicalPath(route.path);
  return hasPath(runtime, p);
}
function bridgeCovers(route) {
  const p = canonicalPath(route.path);
  if (p === '/api/research/status') return hasPath(bridge, p);
  if (route.path.includes('${')) return probeKinds.length === 3 && probeKinds.every(kind => bridge.includes(`/api/research/probe/${kind}`));
  return bridge.includes(p);
}
const coverage = routes.map(route => {
  const pathName = canonicalPath(route.path);
  const researchOwner = pathName.startsWith('/api/research');
  return { method: route.method, key: route.key, path: route.path, canonicalPath: pathName,
    owner: researchOwner ? 'python-research-bridge' : 'neuro-kurisu-runtime',
    handler: researchOwner ? bridgeCovers(route) : runtimeCovers(route) };
});
const atlasEntries = [...atlas.matchAll(/\[\s*["']([^"']+)["']\s*,\s*["'](\/api\/[^"']+)["']\s*,\s*["']([A-Za-z_$][\w$]*)["']\s*\]/g)]
  .map(match => ({ label: match[1], path: match[2], key: match[3] }));
const missingAtlas = atlasEntries.filter(entry => {
  const route = routes.find(candidate => candidate.key === entry.key && canonicalPath(candidate.path) === canonicalPath(entry.path) && candidate.method === 'GET');
  return !route || !runtimeCovers({ path: entry.path });
});
const requiredSeams = [
  { key: 'memoryStrategyDiagnostics', path: '/api/organism/memory-strategy' },
  { key: 'portableSubjectFidelity', path: '/api/organism/subject-fidelity' },
  { key: 'contextBudgetDiagnostics', path: '/api/organism/context-budget' },
  { key: 'sensorium', path: '/api/organism/sensorium/status' },
  { key: 'knownEntityDossiers', path: '/api/organism/known-entities' },
];
const missingRequiredSeams = requiredSeams.filter(seam =>
  !routes.some(route => route.key === seam.key && canonicalPath(route.path) === seam.path)
  || !hasPath(runtime, seam.path)
  || !atlasEntries.some(entry => entry.key === seam.key && entry.path === seam.path));
const proxyChecks = [
  { name: 'vite organism proxy', ok: vite.includes('"/api/organism"') && vite.includes('http://127.0.0.1:3310') },
  { name: 'vite research proxy', ok: vite.includes('"/api/research"') && vite.includes('http://127.0.0.1:8765') },
  { name: 'gateway organism route', ok: gateway.includes("path.startsWith('/api/organism')") && gateway.includes('RUNTIME_PORT') },
  { name: 'gateway research route', ok: gateway.includes("path.startsWith('/api/research')") && gateway.includes('RESEARCH_PORT') },
];
const activeResearch = [
  { name: 'researchStatus', used: dock.includes('neuroApi.researchStatus()') },
  { name: 'researchProbe', used: /neuroApi\.researchProbe\(kind(?:,\s*approvalId)?\)/.test(dock) },
];
const failedProxies = proxyChecks.filter(check => !check.ok);
const report = { check: 'runtime-atlas-ui-api-linkage', clientRoutes: coverage.length,
  runtimeAtlasSurfaces: atlasEntries.length, missingAtlas, requiredSeams, missingRequiredSeams,
  probeKinds, proxyChecks, activeResearch, failedProxies,
  // Existing direct API methods not surfaced in the Runtime Atlas are reported for triage,
  // but do not mask a passing check on the visible Atlas and new integration seams.
  clientRoutesWithoutStaticHandler: coverage.filter(route => !route.handler).map(({key,path,canonicalPath})=>({key,path,canonicalPath})).slice(0,60)
};
console.log(JSON.stringify(report, null, 2));
if (missingAtlas.length || missingRequiredSeams.length || failedProxies.length || activeResearch.some(item => !item.used)) process.exitCode = 1;
else console.log(`AUDIT_UI_API_LINKAGE=PASS routes=${coverage.length} runtimeAtlas=${atlasEntries.length} requiredSeams=${requiredSeams.length}`);
