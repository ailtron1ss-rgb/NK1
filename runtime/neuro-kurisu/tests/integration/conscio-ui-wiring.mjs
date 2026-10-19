import { readFileSync } from 'node:fs';

const api = readFileSync(new URL('../../../../app/src/neuro-kurisu/api.ts', import.meta.url), 'utf8');
const ui = readFileSync(new URL('../../../../app/src/components/ConscioControlConsole.tsx', import.meta.url), 'utf8');
const names = [
  'conscio', 'conscioSyncMemory', 'conscioSearch', 'conscioSourceBoundary', 'conscioSkills',
  'conscioPublishSkill', 'conscioTrialSkill', 'conscioReviewSkill', 'conscioPeers', 'conscioPairPeer',
  'conscioDecidePeer', 'conscioPeerMessage', 'conscioPeerAck', 'conscioCalibration', 'conscioCalibrationObserve',
  'conscioClaims', 'conscioRecordClaim', 'conscioMetabolic'
];
const missing = names.filter((name) => !new RegExp(`\\b${name}\\s*:`).test(api));
const unused = names.filter((name) => (ui.match(new RegExp(`neuroApi\\.${name}\\b`, 'g')) ?? []).length === 0);
if (missing.length || unused.length || !ui.includes('ConscioControlConsole')) {
  console.error(JSON.stringify({ missing, unused, component: ui.includes('ConscioControlConsole') }));
  process.exit(1);
}
console.log(`CONSCIO_UI_WIRING_PASS methods=${names.length} missing=${missing.length} unused=${unused.length}`);
