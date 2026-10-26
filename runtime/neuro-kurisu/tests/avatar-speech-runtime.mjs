import assert from 'node:assert/strict';
import { EmbodimentRuntime } from '../src/organism/body/EmbodimentRuntime.ts';
import { defaultBodyState } from '../src/organism/body/EmbodiedBody.ts';
import { buildAvatarSpeechTimeline } from '../public/avatar-state.mjs';

const runtime = new EmbodimentRuntime();
runtime.body = { ...defaultBodyState(), ttsAvailable: true };
let resolveSpeech;
let dispatch;
runtime.setSpeechGatewayDispatcher((text, options, speechEventId) => {
  dispatch = { text, options, speechEventId };
  return new Promise(resolve => { resolveSpeech = resolve; });
});

const request = runtime.speak('Привет,\nКурису!', { action: 'respond', speechEventId: 'avatar-speech-runtime-test' });
await new Promise(resolve => setImmediate(resolve));
const active = runtime.voiceSnapshot();
assert.equal(active.state.speaking, true);
assert.equal(active.state.lastSpeechEventId, 'avatar-speech-runtime-test');
assert.equal(active.state.lastSpeechText, 'Привет, Курису!');
assert.ok(Number.isFinite(active.state.speechStartedAt) && active.state.speechStartedAt > 0);
assert.ok(active.state.lastProsody && active.state.lastProsody.rate >= 0.72 && active.state.lastProsody.rate <= 1.25);
assert.deepEqual(dispatch, {
  text: 'Привет, Курису!',
  options: {
    language: 'ru-RU',
    pitch: active.state.lastProsody.pitch,
    rate: active.state.lastProsody.rate,
    volume: active.state.lastProsody.volume,
    stream: 'MUSIC',
  },
  speechEventId: 'avatar-speech-runtime-test',
});

resolveSpeech({ ok: true });
assert.equal(await request, true);
const completed = runtime.voiceSnapshot();
assert.equal(completed.state.speaking, false);
assert.equal(completed.state.lastSpeechEventId, active.state.lastSpeechEventId);
assert.equal(completed.state.lastSpeechText, active.state.lastSpeechText);
assert.equal(completed.state.speechStartedAt, active.state.speechStartedAt,
  'the most recent utterance cursor stays readable after the dispatcher returns');
assert.equal(completed.state.utteranceCount, 1);
console.log('AVATAR_SPEECH_RUNTIME=PASS id/text/start/rate/terminal-state');


// Control-whitespace normalization must preserve UTF-16 offsets and source labels.
// The shared timeline substitutes a neutral space pose, while the metadata keeps the
// original grapheme so boundary offsets still refer to the original utterance.
const offsetProbe = 'а🙂‍↔️б\n';
const offsetTimeline = buildAvatarSpeechTimeline(offsetProbe, 0.96, 'ru-RU');
assert.deepEqual(offsetTimeline.map(frame => frame.grapheme), ['а', '🙂‍↔️', 'б', '\n']);
assert.equal(offsetTimeline.at(-1).charIndex, offsetProbe.length - 1);
assert.equal(offsetTimeline.at(-1).endCharIndex, offsetProbe.length);
assert.equal(offsetTimeline.at(-1).pose.viseme, 'neutral');
console.log('AVATAR_SPEECH_UTF16=PASS original-label/normalized-pose/offset-contract');
const identityRuntime = new EmbodimentRuntime();
identityRuntime.body = { ...defaultBodyState(), ttsAvailable: true };
const generatedSpeechIds = [];
identityRuntime.setSpeechGatewayDispatcher(async (_text, _options, speechEventId) => {
  generatedSpeechIds.push(speechEventId);
  return { ok: true };
});
assert.equal(await identityRuntime.speak('Одна и та же фраза'), true);
assert.equal(await identityRuntime.speak('Одна и та же фраза'), true);
assert.equal(generatedSpeechIds.length, 2);
assert.notEqual(generatedSpeechIds[0], generatedSpeechIds[1],
  'independent calls without an explicit speechEventId must not share the ActionGateway idempotency key');
assert.match(generatedSpeechIds[0], /^speech-[0-9a-f-]{36}$/);
assert.match(generatedSpeechIds[1], /^speech-[0-9a-f-]{36}$/);
assert.equal(identityRuntime.voiceSnapshot().state.utteranceCount, 2);
console.log('AVATAR_SPEECH_IDENTITY=PASS distinct-default-operations/explicit-id-preserved');

