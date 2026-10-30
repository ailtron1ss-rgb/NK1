import assert from "node:assert/strict";
import test from "node:test";
import { buildBrowserVoiceProsody, inferBrowserVoiceLanguage } from "../src/components/avatar/browserVoiceProsody.ts";
import { buildVoicePlan } from "../../runtime/neuro-kurisu/src/organism/body/VoiceEmbodiment.ts";

test("browser language inference delegates to the organism voice planner",()=>{
  assert.equal(inferBrowserVoiceLanguage("Курису, привет"),"ru-RU");
  assert.equal(inferBrowserVoiceLanguage("Hello Kurisu"),"en-US");
  assert.equal(inferBrowserVoiceLanguage("123 🙂"),"ru-RU");
});
test("browser adapter returns the exact canonical VoicePlan prosody",()=>{
  const input={text:"Почему это работает?",emotion:"curiosity",action:"verify",arousal:.72,valence:.61,cognitiveLoad:.48,uncertainty:.67,socialNeed:.35};
  const browser=buildBrowserVoiceProsody(input);
  const canonical=buildVoicePlan({
    text:input.text,emotion:{label:input.emotion,arousal01:input.arousal,valence01:input.valence},
    action:input.action,needs:{energy:1,cognitiveLoad:input.cognitiveLoad,uncertainty:input.uncertainty,socialNeed:input.socialNeed,novelty:.5,identityCoherence:.8,goalPressure:.3},
    body:{thermalStrain01:0,cognitiveCapacity01:1,circadian01:1},
    continuity01:.7,grounding01:.7,uncertainty01:input.uncertainty,
  });
  assert.equal(browser.language,canonical.language);
  assert.deepEqual({pitch:browser.pitch,rate:browser.rate,volume:browser.volume,pauseMs:browser.pauseMs,emphasis01:browser.emphasis01},canonical.prosody);
  assert.equal(browser.mode,canonical.mode);
  assert.equal(browser.tone,canonical.tone);
  assert.deepEqual(browser.reason,canonical.reason);
});
test("prosody remains bounded for every supported affect and action",()=>{
  const emotions=["curiosity","calm","joy","anxiety","frustration","sadness","anger","protective"];
  const actions=["rest","listen","reflect","inspect","explain","comfort","respond","explore","verify"];
  for(const emotion of emotions) for(const action of actions){
    const p=buildBrowserVoiceProsody({text:"Проверим это вместе.",emotion,action,arousal:.8,valence:.25,cognitiveLoad:.9,uncertainty:.9,socialNeed:.8});
    assert.ok(p.pitch>=.72&&p.pitch<=1.28);
    assert.ok(p.rate>=.72&&p.rate<=1.25);
    assert.ok(p.volume>=.4&&p.volume<=1);
    assert.ok(p.pauseMs>=55&&p.pauseMs<=450);
    assert.ok(p.emphasis01>=0&&p.emphasis01<=1);
  }
});
test("negative high-arousal affect is de-escalated by the canonical plan",()=>{
  const base={text:"Я объясню.",action:"respond",arousal:.8,valence:.2,cognitiveLoad:.2,uncertainty:.2,socialNeed:.2};
  const calm=buildBrowserVoiceProsody({...base,emotion:"calm"});
  const anxiety=buildBrowserVoiceProsody({...base,emotion:"anxiety"});
  const anger=buildBrowserVoiceProsody({...base,emotion:"anger"});
  assert.ok(anxiety.rate<calm.rate);
  assert.ok(anger.rate<calm.rate);
  assert.ok(anger.emphasis01<buildBrowserVoiceProsody({...base,emotion:"curiosity"}).emphasis01);
  assert.ok(anger.reason.includes("affect-regulation"));
});
test("cognitive load slows delivery and increases the canonical pause budget",()=>{
  const base={text:"Объяснение",emotion:"calm",action:"verify",arousal:.4,valence:.5,uncertainty:.2,socialNeed:.2};
  const loaded=buildBrowserVoiceProsody({...base,cognitiveLoad:.95});
  const rested=buildBrowserVoiceProsody({...base,cognitiveLoad:.1});
  assert.ok(loaded.reason.includes("high-cognitive-load"));
  assert.ok(loaded.rate<rested.rate);
  assert.ok(loaded.pauseMs>rested.pauseMs);
});
