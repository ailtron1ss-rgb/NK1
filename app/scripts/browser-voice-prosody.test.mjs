import assert from "node:assert/strict";
import test from "node:test";
import { buildBrowserVoiceProsody, inferBrowserVoiceLanguage } from "../src/components/avatar/browserVoiceProsody.ts";

test("browser voice language follows the dominant script and keeps a safe default",()=>{
  assert.equal(inferBrowserVoiceLanguage("Курису, привет"),"ru-RU");
  assert.equal(inferBrowserVoiceLanguage("Hello Kurisu"),"en-US");
  assert.equal(inferBrowserVoiceLanguage("123 🙂"),"ru-RU");
});
test("prosody remains bounded for every supported affect and action",()=>{
  const emotions=["curiosity","calm","joy","anxiety","frustration","sadness","anger","protective"];
  const actions=["rest","listen","reflect","inspect","explain","comfort","respond","explore","verify"];
  for(const emotion of emotions) for(const action of actions){
    const p=buildBrowserVoiceProsody({text:"Проверим это вместе.",emotion,action,arousal:.8,valence:.25,cognitiveLoad:.9,uncertainty:.9,socialNeed:.8});
    assert.ok(p.pitch>=.82&&p.pitch<=1.18);
    assert.ok(p.rate>=.78&&p.rate<=1.16);
    assert.ok(p.volume>=.55&&p.volume<=1);
    assert.ok(p.emphasis01>=0&&p.emphasis01<=1);
  }
});
test("joy colours the voice while anxiety and anger are regulated rather than escalated",()=>{
  const base={text:"Я объясню.",action:"respond",arousal:.5,valence:.5,cognitiveLoad:.2,uncertainty:.2,socialNeed:.2};
  const joy=buildBrowserVoiceProsody({...base,emotion:"joy"});
  const anxiety=buildBrowserVoiceProsody({...base,emotion:"anxiety"});
  const anger=buildBrowserVoiceProsody({...base,emotion:"anger"});
  assert.ok(joy.pitch>anxiety.pitch);
  assert.ok(anxiety.rate<baseRate(base));
  assert.ok(anger.emphasis01<joy.emphasis01);
});
function baseRate(input){return buildBrowserVoiceProsody({...input,emotion:"calm"}).rate;}
test("cognitive load slows delivery and reports the reason",()=>{
  const p=buildBrowserVoiceProsody({text:"Объяснение",emotion:"calm",action:"verify",arousal:.4,valence:.5,cognitiveLoad:.95,uncertainty:.2,socialNeed:.2});
  assert.ok(p.reason.includes("high-cognitive-load"));
  assert.ok(p.rate<buildBrowserVoiceProsody({text:"Объяснение",emotion:"calm",action:"verify",arousal:.4,valence:.5,cognitiveLoad:.1,uncertainty:.2,socialNeed:.2}).rate);
});
