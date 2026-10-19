const $ = (id) => document.getElementById(id);
const log = $('log');
function add(text, cls='msg'){ const d=document.createElement('div'); d.className=`msg ${cls}`; d.textContent=text; log.appendChild(d); log.scrollTop=log.scrollHeight; }
async function api(path, options={}){
  const res=await fetch(path,{headers:{'content-type':'application/json',...(options.headers||{})},...options});
  let data; try{data=await res.json();}catch{throw new Error(`HTTP ${res.status}`)}
  if(!res.ok) throw new Error(data?.error||`HTTP ${res.status}`);
  return data;
}
function meter(v){return `${(Number(v||0)*100).toFixed(0)}%`}
function renderAvatar(status){
  const action=String(status.lastAction||'wait'); const body=status.body||{}; const voice=status.voice||{};
  $('avatar-state').textContent=body.awake?'awake':'sleep'; $('avatar-badge').textContent=action.toUpperCase();
  const a=$('avatar'); a.dataset.action=action; a.style.setProperty('--energy',String(body.telemetry?.battery01??1));
  const frame=$('avatar-frame'); if(frame?.contentWindow){
    const expression=action==='communicate'?'tender':action==='inspect'?'thinking':action==='move'?'focused':action==='collect'?'happy':action==='rest'?'tired':'neutral';
    try{frame.contentWindow.postMessage({type:'kurisu_expression',expression},location.origin);frame.contentWindow.postMessage({type:'kurisu_embodiment',speaking:Boolean(voice?.state?.speaking),expressionIntensity:action==='communicate'?.75:.35},location.origin);}catch{}
  }
}
function renderStatus(d){
  $('release-marker').textContent=`Evolution ${d.version||'—'} · Core ${d.organismCore||'—'}`;
  $('footer-contract').textContent=`${d.version||'—'} · schema ${d.schemaVersion??'—'}`;
  $('health-dot').className=`dot ${d.ok?'ok':'bad'}`;
  $('tick').textContent=`tick ${d.tick??'—'}`;
  const cards=[['Energy',meter(d.body?.bodyEnergy01??d.body?.telemetry?.battery01)],['Attention',meter(d.system?.attentionBudget)],['Autonomy',Number(d.autonomyScore||0).toFixed(3)],['Prediction error',Number(d.predictionError||0).toFixed(3)]];
  $('state-cards').innerHTML=cards.map(([k,v])=>`<div class="card"><b>${k}</b><span>${v}</span></div>`).join('');
  $('status').textContent=JSON.stringify({tick:d.tick,lastAction:d.lastAction,autonomyScore:d.autonomyScore,predictionError:d.predictionError,selfPredictionError:d.selfPredictionError,body:d.body,capabilities:d.capabilities},null,2);
  const t=d.temporalContinuity||{}; const c=t.lastCalendarContext||{}; $('temporal').textContent=`Сейчас: ${c.localDate||'—'} ${c.localTime||'—'} ${c.timezone||'—'}\nСессия: ${t.sessionCount??0} · offline: ${t.gapSincePreviousMs??0} ms · interruption: ${t.interruptionCount??0}\nПоследний checkpoint: ${t.lastCheckpointAt?new Date(t.lastCheckpointAt).toLocaleString():'—'}`;
  $('network').textContent=JSON.stringify(d.network||{},null,2);
  $('neuromod').textContent=JSON.stringify(d.neuromodulation||{},null,2);
  $('memory').textContent=JSON.stringify(d.memoryGraph||{},null,2);
  $('evolution').textContent=JSON.stringify(d.evolution||{},null,2);
  $('cognitive').textContent=JSON.stringify({cognitiveField:d.cognition?.cognitiveField||{},budget:d.cognition?.budget||{},contradictions:d.cognition?.contradictions?.unresolvedCount??0},null,2);
  $('science').textContent=JSON.stringify({immuneRejected:d.cognition?.immuneRejected||0,sourceTraces:d.cognition?.sourceTraces||0,skills:d.cognition?.skills||0,scientificProjects:d.cognition?.scientificProjects||0,residualWorldSamples:d.cognition?.residualWorldSamples||0},null,2);
  $('perception').textContent=JSON.stringify({engine:d.perception||{},routing:d.perceptionRouting||{},capabilities:d.capabilities||{}},null,2);
  $('development').textContent=JSON.stringify({memoryOS:d.advanced?.memoryOS||{},worldModel2:d.advanced?.worldModel2||{},regret:d.advanced?.regret||{},semanticScars:d.advanced?.semanticScars||{},valueProvenance:d.advanced?.valueProvenance||{},commitmentRepair:d.advanced?.commitmentRepair||{},modelSwitch:d.advanced?.modelSwitch||{},microDreams:d.advanced?.microDreams||{},developmentalForks:d.advanced?.developmentalForks||{},relationshipSelf:d.advanced?.relationshipSelf||{},multiHypothesisPersonality:d.advanced?.multiHypothesisPersonality||{}},null,2);
  $('beliefs').textContent=JSON.stringify(d.unifiedMemory||{},null,2);
  $('social').textContent=JSON.stringify(d.socialDevelopment||{},null,2);
  $('additional').textContent=JSON.stringify(d.resilience||{},null,2);
  $('p23').textContent=JSON.stringify(d.p23Learning||{},null,2);
  renderAvatar(d);
}
async function refreshExperience(){
  try{
    const d=await api('/api/organism/experience-continuum?summary=1');
    const s=d.summary||{};
    $('experience-status').textContent=`H ${s.hotCount??0} · W ${s.warmCount??0} · C ${s.coldCount??0}`;
    $('experience-continuum').textContent=JSON.stringify({
      tiers:{hot:s.hotCount??0,warm:s.warmCount??0,cold:s.coldCount??0},
      graph:{nodes:s.graphNodes??0,edges:s.graphEdges??0,clusters:s.clusters??0},
      identityGravity:s.identityGravity||{},
      integrity:s.integrity||{},
      compression:s.compression||{}
    },null,2);
  }catch(e){$('experience-status').textContent='offline';$('experience-continuum').textContent='Experience Continuum unavailable';}
}
async function refreshIdentityLineage(){
  try{
    const d=await api('/api/organism/identity-lineage?label=Kurisu&limit=20');
    const s=d.summary||{}; const n=d.neighborhood||{};
    $('identity-lineage-status').textContent=`${s.nodes??0} nodes · ${s.edges??0} edges`;
    $('identity-lineage').textContent=JSON.stringify({derived:d.derived,summary:s,neighborhood:{nodes:(n.nodes||[]).slice(0,24).map(x=>({kind:x.kind,label:x.label,confidence:x.confidence01,source:x.source})),edges:(n.edges||[]).slice(0,24).map(x=>({relation:x.relation,strength:x.strength01,evidence:x.evidence01,reason:x.reason,source:x.source}))},nonConsciousnessClaim:d.nonConsciousnessClaim},null,2);
  }catch{ $('identity-lineage-status').textContent='offline'; $('identity-lineage').textContent='Identity lineage unavailable'; }
}
async function refreshSubjectContinuity(){
  try{
    const d=await api('/api/organism/subject-continuity');
    const s=d.subject||{};
    $('subject-status').textContent=`${s.resolution||'—'} · bottleneck ${meter(s.bottleneck01)}`;
    $('subject-continuity').textContent=JSON.stringify({
      resolution:s.resolution, continuity:meter(s.continuity01), coherence:meter(s.coherence01),
      bottleneck:meter(s.bottleneck01), epistemicIntegrity:meter(s.epistemicIntegrity01),
      grounding:meter(s.embodiedGrounding01), autobiographicalBinding:meter(s.autobiographicalBinding01),
      agencyReadiness:meter(s.agencyReadiness01), resourceFitness:meter(s.resourceFitness01),
      identityStability:meter(s.identityStability01), uncertainty:meter(s.uncertainty01),
      dominantPressure:s.dominantPressure, activeModalities:s.activeModalities, reasons:s.reasons,
      motive:d.motive?{dominant:d.motive.dominant,overall:meter(d.motive.overall01),conflict:meter(d.motive.conflict01),valueAlignment:meter(d.motive.valueAlignment01),reasons:d.motive.reasons}:null,
      nonConsciousnessClaim:s.nonConsciousnessClaim
    },null,2);
  }catch{ $('subject-status').textContent='offline'; $('subject-continuity').textContent='Subject continuity unavailable'; }
}
async function refreshMemoryInspector(query=''){
  try{
    const q=query?`&q=${encodeURIComponent(query)}`:'';
    const d=await api(`/api/organism/memory-inspector?limit=12${q}`);
    const rows=d.memories||[];
    $('memory-inspector-status').textContent=`${rows.length} canonical`;
    $('memory-inspector').textContent=JSON.stringify(rows.map(m=>({id:String(m.id).slice(0,18),tier:m.tier,kind:m.kind,source:m.source,confidence:Number(m.confidence??0).toFixed(2),identity:Number(m.identityRelevance??0).toFixed(2),significance:Number(m.significance01??0).toFixed(2),retrievals:m.retrievalCount,content:String(m.content??'').slice(0,120)})),null,2);
  }catch{ $('memory-inspector-status').textContent='offline'; $('memory-inspector').textContent='Memory inspector unavailable'; }
}
$('memory-search')?.addEventListener('click',()=>void refreshMemoryInspector(($('memory-query')?.value||'').trim()));
$('memory-query')?.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();void refreshMemoryInspector(e.target.value.trim())}});
async function refreshDevelopmentalIdentity(){
  try{
    const d=await api('/api/organism/developmental-identity'); const f=d.frame||{};
    $('developmental-identity-status').textContent=`${f.phase||'—'} · ${meter(f.integrity01)}`;
    $('developmental-identity').textContent=JSON.stringify({phase:f.phase,continuity:meter(f.continuity01),integrity:meter(f.integrity01),developmentalReadiness:meter(f.developmentalReadiness01),revisionReadiness:meter(f.revisionReadiness01),protectiveStability:meter(f.protectiveStability01),beliefLineage:meter(f.beliefLineage01),autobiographicalBinding:meter(f.autobiographicalBinding01),socialContinuity:meter(f.socialContinuity01),authorship:meter(f.authorship01),causalSelf:meter(f.causalSelf01),evidenceBalance:meter(f.evidenceBalance01),counterEvidencePressure:meter(f.counterEvidencePressure01),identityPressure:meter(f.identityPressure01),reasons:f.reasons,nonConsciousnessClaim:d.nonConsciousnessClaim},null,2);
  }catch{ $('developmental-identity-status').textContent='offline'; $('developmental-identity').textContent='Developmental identity unavailable'; }
}
async function refreshVoice(){
  try{
    const d=await api('/api/organism/voice/status'); const s=d.voice?.state||{}; const p=d.voice?.plan||{};
    $('voice-status').textContent=`голос ${s.speaking?'говорит':s.listening?'слушает':'готов'} · ${p.mode||'—'}`;
    $('voice-panel-status').textContent=`${p.tone||'neutral'} · ${p.mode||'talk'}`;
    $('voice-panel').textContent=JSON.stringify({available:{tts:d.body?.ttsAvailable,stt:d.body?.sttAvailable},state:s,plan:p,multimodal:d.multimodal?{speechTurns:d.multimodal.speechTurns,events:d.multimodal.events,lastConfidence:d.multimodal.lastConfidence}:null},null,2);
  }catch{ $('voice-status').textContent='голос — offline'; $('voice-panel-status').textContent='offline'; $('voice-panel').textContent='Voice Embodiment unavailable';}
}
async function refreshEmbodiment(){
  try{
    const d=await api('/api/embodiment/status');
    const meta=$('avatar-meta');
    if(meta) meta.textContent=d.ok?`Live2D ready · ${d.expressions} exp · ${d.motions} motions · ${(d.totalBytes/1048576).toFixed(1)} MB`:`Live2D incomplete · ${d.filesPresent}/${d.filesExpected}`;
  }catch{const meta=$('avatar-meta');if(meta)meta.textContent='Live2D asset check unavailable';}
}
async function refreshNeuralSpine(){
  try{
    const d=await api('/api/organism/neural-spine'); const x=d.diagnostics||{};
    $('neural-spine-status').textContent=`${x.computeTier||'—'} · ${meter(x.integration01)}`;
    $('neural-spine').textContent=JSON.stringify({canonicalOwner:d.canonicalOwner,cycles:x.cycles,learningUpdates:x.learningUpdates,activeSetSize:x.activeSetSize,activeAreas:x.activeAreas,computeTier:x.computeTier,deepCadence:x.deepCadence,integration:meter(x.integration01),selfCoherence:meter(x.selfCoherence01),agency:meter(x.agency01),personality:meter(x.personalityCoherence01),identityStability:meter(x.identityStability01),realityGrounding:meter(x.realityGrounding01),neuromodulation:x.neuromodulation,traits:x.traits,nonConsciousnessClaim:d.nonConsciousnessClaim},null,2);
  }catch{ $('neural-spine-status').textContent='offline'; $('neural-spine').textContent='Neural spine unavailable'; }
}
async function refresh(){
  try{const d=await api('/api/organism/status'); renderStatus(d);}catch(e){$('health-dot').className='dot bad'; add(`Ошибка состояния: ${e.message}`,'msg you');}
}
async function refreshLite(){
  try{const d=await api('/api/organism/status-lite');
    $('health-dot').className='dot ok'; $('tick').textContent=`tick ${d.tick??'—'}`;
    $('state-cards').innerHTML=[['Energy',meter(d.body?.battery01)],['Attention',meter(1-(d.body?.ramPressure01??0))],['Autonomy',Number(d.autonomyScore||0).toFixed(3)],['Prediction error',Number(d.predictionError||0).toFixed(3)]].map(([k,v])=>`<div class="card"><b>${k}</b><span>${v}</span></div>`).join('');
    renderAvatar({lastAction:d.lastAction,body:{awake:d.body?.awake,telemetry:d.body}});
  }catch(e){$('health-dot').className='dot bad';}
}
$('refresh').onclick=()=>void refresh();
$('sleep').onclick=async()=>{try{await api('/api/organism/sleep',{method:'POST',body:'{}'});add('Организм перешёл в режим сна.');await refresh();}catch(e){add(`Сон: ${e.message}`,'msg you')}};
$('wake').onclick=async()=>{try{await api('/api/organism/wake',{method:'POST',body:'{}'});add('Организм проснулся.');await refresh();}catch(e){add(`Пробуждение: ${e.message}`,'msg you')}};
$('listen').onclick=async()=>{try{const d=await api('/api/organism/voice/listen',{method:'POST',body:'{}'});if(d.text){$('message').value=d.text;add(`Речь: ${d.text}`,'msg you');await refreshVoice();}else add('Голосовой ввод недоступен.','msg you')}catch(e){add(`Слушать: ${e.message}`,'msg you')}};
$('voice-turn')?.addEventListener('click',async()=>{const btn=$('voice-turn');if(btn)btn.disabled=true;try{const d=await api('/api/organism/voice/turn',{method:'POST',body:JSON.stringify({deliberate:Boolean(window.NK_DELIBERATE),speak:Boolean($('speak-replies')?.checked)})});if(d.text){add(`Ты (голос): ${d.text}`,'msg you');if(d.step?.language?.text){add(`Курису: ${d.step.language.text}`);$('backend').textContent=`backend ${d.step.language.backend||'unknown'}`;}if(d.speak??false)add('🔊 Ответ озвучен.');await refresh();await refreshVoice();}else add('Голосовой ход недоступен или речь не распознана.','msg you')}catch(e){add(`Голосовой ход: ${e.message}`,'msg you')}finally{if(btn)btn.disabled=false;}});
$('speak').onclick=async()=>{const text=prompt('Текст для озвучивания:');if(!text)return;try{const d=await api('/api/organism/voice/speak',{method:'POST',body:JSON.stringify({text})});add(d.ok?'Текст передан в TTS.':'TTS недоступен.');await refreshVoice();}catch(e){add(`Озвучивание: ${e.message}`,'msg you')}};
$('voice-stop')?.addEventListener('click',async()=>{try{await api('/api/organism/voice/interrupt',{method:'POST',body:JSON.stringify({reason:'user-stop'})});add('🔇 Озвучивание остановлено.');await refreshVoice();}catch(e){add(`Стоп голоса: ${e.message}`,'msg you')}});
$('snapshot').onclick=async()=>{try{const d=await api('/api/organism/inspect');add(`Снимок: tick=${d.tick}, stateHash=${d.stateHash}`);}catch(e){add(`Снимок: ${e.message}`,'msg you')}};
$('deliberate')?.addEventListener('change',e=>{window.NK_DELIBERATE=Boolean(e.target.checked)});
$('form').onsubmit=async(e)=>{e.preventDefault();const input=$('message');const text=input.value.trim();if(!text)return;add(`Ты: ${text}`,'msg you');input.value='';$('send').disabled=true;try{const d=await api('/api/organism/chat',{method:'POST',body:JSON.stringify({message:text,deliberate:Boolean(window.NK_DELIBERATE),speak:Boolean($('speak-replies')?.checked)})});if(d.language?.text){add(`Курису: ${d.language.text}`);$('backend').textContent=`backend ${d.language.backend||'unknown'}`;if(d.voice?.requested)add(d.voice.spoken?'🔊 Озвучено.':'🔇 TTS не выполнился.');}else add(`Решение: ${d.worldAction||'none'}`);await refresh();await refreshVoice();}catch(err){add(`Ошибка цикла: ${err.message}`,'msg you');}finally{$('send').disabled=false;}};
void refresh();
void refreshLite();
void refreshEmbodiment();
void refreshNeuralSpine();
void refreshExperience();
void refreshMemoryInspector();
void refreshSubjectContinuity();
void refreshIdentityLineage();
void refreshDevelopmentalIdentity();
void refreshVoice();
setInterval(()=>void refreshLite(),5000);
setInterval(()=>void refresh(),30000);
setInterval(()=>void refreshExperience(),15000);
setInterval(()=>void refreshMemoryInspector(),30000);
setInterval(()=>void refreshSubjectContinuity(),10000);
setInterval(()=>void refreshIdentityLineage(),20000);
setInterval(()=>void refreshDevelopmentalIdentity(),12000);
setInterval(()=>void refreshVoice(),5000);
setInterval(()=>void refreshNeuralSpine(),10000);

function avatarPost(message){const frame=$('avatar-frame'); if(frame?.contentWindow){try{frame.contentWindow.postMessage(message,location.origin)}catch{}}}
$('avatar-expression')?.addEventListener('change',e=>avatarPost({type:'kurisu_expression',expression:e.target.value}));
$('avatar-head-tap')?.addEventListener('click',()=>avatarPost({type:'tap',zone:'head'}));
$('avatar-body-tap')?.addEventListener('click',()=>avatarPost({type:'tap',zone:'body'}));
$('avatar-quality')?.addEventListener('change',e=>{const q=e.target.value; window.open(`/avatar.html?profile=${encodeURIComponent(q)}`,'_blank','noopener,noreferrer');});
$('viewer').onclick=()=>window.open('/avatar.html','_blank','noopener,noreferrer');
$('camera').onclick=async()=>{try{const d=await api('/api/organism/vision/capture',{method:'POST',body:'{}'});add(`Камера: захват ${d.hash?d.hash.slice(0,12):'готов'}.`);await refresh();}catch(e){add(`Камера: ${e.message}`,'msg you')}};
