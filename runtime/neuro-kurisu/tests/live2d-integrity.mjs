import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const variants=[
  {name:'quality',dir:path.join(root,'public/live2d/Kurisu'),model:'Kurisu.model3.json',texture:path.join('Kurisu.4096','texture_00.png')},
  {name:'mobile',dir:path.join(root,'public/live2d/Kurisu.mobile'),model:'Kurisu-mobile.model3.json',texture:path.join('Kurisu.2048','texture_00_mobile_2048.png')},
];
for(const v of variants){
  const modelPath=path.join(v.dir,v.model);
  assert.ok(fs.existsSync(modelPath),`${v.name}: model missing`);
  const model=JSON.parse(fs.readFileSync(modelPath,'utf8'));
  const refs=model.FileReferences||{};
  const refsList=[refs.Moc,refs.Physics,refs.DisplayInfo,...(refs.Textures||[]),...(Object.values(refs.Motions||{}).flat().map(x=>x.File)),...(refs.Expressions||[]).map(x=>x.File)].filter(Boolean);
  assert.ok(refsList.length>=10,`${v.name}: too few references`);
  for(const rel of refsList) assert.ok(fs.existsSync(path.resolve(v.dir,rel)),`${v.name}: missing ${rel}`);
  assert.ok(fs.existsSync(path.join(v.dir,v.texture)),`${v.name}: texture missing`);
  const tex=JSON.parse(JSON.stringify({size:fs.statSync(path.join(v.dir,v.texture)).size}));
  assert.ok(tex.size>100000,`${v.name}: texture unexpectedly small`);
  assert.ok((refs.Expressions||[]).length>=7,`${v.name}: expression coverage`);
  assert.ok(Object.values(refs.Motions||{}).flat().length>=4,`${v.name}: motion coverage`);
}

const viewer=fs.readFileSync(path.join(root,'public/live2d/viewer.html'),'utf8');
for(const token of ['Kurisu.mobile/Kurisu-mobile.model3.json','Kurisu/Kurisu.model3.json','kurisu_expression','kurisu_embodiment','kurisu_lipsync','TapHead','TapBody']) assert.ok(viewer.includes(token),`viewer missing ${token}`);
assert.ok(viewer.includes('lastAppliedExpression'), 'viewer must cache the last applied expression');
assert.ok(viewer.includes('expressionName===lastAppliedExpression'), 'mouth/embodiment updates must not restart an unchanged expression');
for(const runtimeFile of ['./vendor/pixi.min.js','./vendor/live2dcubismcore.min.js','./vendor/cubism4.min.js']){
  const localPath=path.join(root,'public/live2d',runtimeFile);
  assert.ok(viewer.includes(`loadScript('${runtimeFile}')`),`runtime viewer must load local SDK file ${runtimeFile}`);
  assert.ok(fs.existsSync(localPath),`runtime viewer SDK file missing: ${runtimeFile}`);
  assert.ok(fs.statSync(localPath).size>10000,`runtime viewer SDK file unexpectedly small: ${runtimeFile}`);
}
assert.doesNotMatch(viewer,/loadScript\(['"]https?:\/\//u,'runtime viewer must not execute remote CDN scripts');
assert.ok(viewer.includes('autoStart:false'),'runtime viewer must not start an unbounded ticker during model load');
assert.ok(viewer.includes("document.addEventListener('visibilitychange',syncViewerVisibility)"),'runtime viewer must pause while hidden');
assert.ok(viewer.includes('ev.source!==window.parent'),'runtime viewer must accept controls only from its parent window');
const rootModel=JSON.parse(fs.readFileSync(path.join(root,'public/live2d/Kurisu/Kurisu.model3.json'),'utf8'));
const mobileModel=JSON.parse(fs.readFileSync(path.join(root,'public/live2d/Kurisu.mobile/Kurisu-mobile.model3.json'),'utf8'));
assert.equal((rootModel.FileReferences.Expressions||[]).length,(mobileModel.FileReferences.Expressions||[]).length);
assert.deepEqual(Object.keys(rootModel.FileReferences.Motions||{}),Object.keys(mobileModel.FileReferences.Motions||{}));
const avatarHtml=fs.readFileSync(path.join(root,'public/avatar.html'),'utf8');
assert.ok(avatarHtml.includes("fetch('/api/organism/ui-snapshot'"), 'avatar UI must consume the actual organism snapshot');
assert.ok(!avatarHtml.includes("fetch('/api/organism/avatar'"), 'asset inventory must not be mistaken for runtime state');
assert.ok(avatarHtml.includes('buildAvatarPresentation(snapshot)'), 'avatar UI must normalize the live snapshot before posting to its iframe');
assert.ok(avatarHtml.includes("post('kurisu_embodiment_intent', intent)"), 'avatar UI must send one versioned EmbodimentIntent to Live2D');
assert.ok(avatarHtml.includes("mouth: { open: pose.open, form: pose.form, viseme: pose.viseme }"), 'avatar UI must carry the sampled time-indexed mouth pose in the unified intent');
assert.ok(avatarHtml.includes("headTilt: affect.headTilt"), 'avatar UI must send bounded, smoothed head tilt to Live2D');
assert.ok(avatarHtml.includes("import { smoothEmbodimentAffect } from './embodiment-affect-core.mjs'"),
  'standalone runtime must import the canonical shared affect smoother');
const affectCorePath=path.join(root,'public/embodiment-affect-core.mjs');
assert.ok(fs.existsSync(affectCorePath),'the shared affect smoother must be shipped beside the runtime avatar');
const affectCoreSource=fs.readFileSync(affectCorePath,'utf8');
assert.ok(affectCoreSource.includes('export function smoothEmbodimentAffect'),
  'the shared affect core must own the interpolation algorithm');
assert.ok(avatarHtml.includes("window.setInterval(() => { void refreshSpeech(); }, 150)"), 'speech cursor refresh must remain separate from the slow cognitive snapshot');
const runtimeViewerSource=fs.readFileSync(path.join(root,'public/live2d/viewer.html'),'utf8');
const avatarSource=fs.readFileSync(path.join(root,'public/avatar.html'),'utf8');
const avatarStateSource=fs.readFileSync(path.join(root,'public/avatar-state.mjs'),'utf8');
const sharedVisemeCorePath=path.join(root,'public/speech-viseme-core.mjs');
assert.ok(fs.existsSync(sharedVisemeCorePath),'the shared grapheme/viseme core must be shipped beside the runtime avatar');
const sharedVisemeCore=fs.readFileSync(sharedVisemeCorePath,'utf8');
assert.ok(avatarStateSource.includes("from './speech-viseme-core.mjs'"),'runtime avatar must import the canonical shared viseme core');
assert.ok(avatarStateSource.includes('buildVisemeTimeline(normalized, rate, language)'), 'runtime avatar must delegate timing to the shared timeline');
assert.ok(sharedVisemeCore.includes('export function buildVisemeTimeline') && sharedVisemeCore.includes('export function sampleVisemeTimeline'),
  'shared core must own timeline construction and sampling');
assert.ok(!avatarStateSource.includes('function speechWeight') && !avatarStateSource.includes('function poseForSpeechGrapheme'),
  'runtime avatar must not contain a second viseme algorithm');

const serverSource=fs.readFileSync(path.join(root,'src/server/server.mjs'),'utf8');
assert.ok(serverSource.includes("url.pathname === '/api/organism/avatar-speech'"), 'server must expose lightweight active speech cursor');
assert.ok(serverSource.includes('state.lastSpeechEventId') && serverSource.includes('state.lastSpeechText') && serverSource.includes('state.speechStartedAt'),
  'speech endpoint must publish the exact utterance id, text and start timestamp');
assert.ok(avatarSource.includes("fetch('/api/organism/avatar-speech'"), 'avatar must sample current speech metadata');
assert.ok(avatarSource.includes('requestAnimationFrame(animateSpeech)'), 'viseme cursor must animate independently of the slow cognitive snapshot');
assert.ok(avatarStateSource.includes('export function buildAvatarSpeechTimeline'), 'avatar mapper must build grapheme pose windows');
assert.ok(avatarStateSource.includes('export function sampleAvatarSpeechTimeline'), 'avatar mapper must sample time-indexed visemes');
assert.ok(!avatarStateSource.includes('clamp(0.32 + arousal * 0.35'), 'mouth motion cannot be a constant amplitude while speaking');
assert.ok(avatarSource.includes("post('kurisu_embodiment_intent', intent)"), 'runtime avatar must publish a single versioned embodiment intent');
assert.ok(!avatarSource.includes("post('kurisu_expression'") && !avatarSource.includes("post('kurisu_embodiment',") && !avatarSource.includes("post('kurisu_lipsync',"),
  'runtime avatar must not emit split legacy control messages after switching to intent v1');
assert.ok(runtimeViewerSource.includes('function sanitizeIntent(d)') && runtimeViewerSource.includes('function applyIntent(intent)'),
  'runtime viewer must validate and apply the shared EmbodimentIntent v1 contract');
assert.ok(runtimeViewerSource.includes("d.type==='kurisu_embodiment_intent'"), 'runtime viewer must receive the versioned intent');
assert.ok(runtimeViewerSource.includes('runtime-tts-start-anchored-monotonic'), 'runtime viewer must accept its declared start-clock source');
console.log(`LIVE2D_INTEGRITY=PASS qualityTextureBytes=${fs.statSync(path.join(root,'public/live2d/Kurisu/Kurisu.4096/texture_00.png')).size} mobileTextureBytes=${fs.statSync(path.join(root,'public/live2d/Kurisu.mobile/Kurisu.2048/texture_00_mobile_2048.png')).size}`);
