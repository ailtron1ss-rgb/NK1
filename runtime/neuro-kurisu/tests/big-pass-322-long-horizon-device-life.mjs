import assert from 'node:assert/strict';
import { mkdir, readFile, rm, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import process from 'node:process';
import { performance } from 'node:perf_hooks';
import { P39ContinuousArtificialLifeEngine } from '../src/organism/learning/P39ContinuousArtificialLife.ts';
import { ResearchGradeOrganismEngine } from '../src/organism/learning/ResearchGradeOrganismEngine.ts';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { FileStateStore } from '../src/organism/persistence/FileStateStore.ts';

const OUT_DIR=join(process.env.NK_B322_REPORT_DIR??'state/device-life-b322');
await mkdir(OUT_DIR,{recursive:true});
const enduranceCycles=Math.max(120,Math.min(1200,Number(process.env.NK_B322_ENDURANCE_CYCLES??240)));
const corePulses=Math.max(6,Math.min(16,Number(process.env.NK_B322_CORE_PULSES??8)));
const dir=await mkdtemp(join(tmpdir(),'neuro-kurisu-b322-'));
const stateFile=join(dir,'organism-state.json');
try{
  const life=new P39ContinuousArtificialLifeEngine();
  const research=new ResearchGradeOrganismEngine();
  const start=Date.now();
  let phaseCounts={active:0,'wind-down':0,sleep:0,recovering:0,maintenance:0,wake:0};
  for(let i=0;i<enduranceCycles;i++){
    const phase=i<enduranceCycles*.4?'baseline':i<enduranceCycles*.75?'stress':'recovery';
    const battery=phase==='baseline'?.9:phase==='stress'?.24:.72;
    const thermal=phase==='baseline'?.14:phase==='stress'?.82:.28;
    const ram=phase==='baseline'?.16:phase==='stress'?.84:.30;
    const energy=phase==='baseline'?.92:phase==='stress'?.35:.76;
    const cognitive=phase==='baseline'?.28:phase==='stress'?.72:.34;
    const frame=life.beginCycle({at:start+i*1000,host:'phone-host',awake:true,energy01:energy,cognitiveLoad01:cognitive,battery01:battery,thermal01:thermal,storagePressure01:ram});
    phaseCounts[frame.phase]=(phaseCounts[frame.phase]??0)+1;
    life.recordAction(frame.suggestedAction==='rest'?.15:.05);
    life.recordOutcome(phase==='stress'?.12:.9,frame.phase!=='sleep');
    research.beginCycle({at:start+i*1000,energy01:energy,cognitiveLoad01:cognitive,battery01:battery,thermal01:thermal,memoryPressure01:ram,goalPressure01:phase==='stress'?.7:.3,selectedAction:frame.suggestedAction,verified:true});
    const decision=research.registerDecision(frame.suggestedAction,.6,`b322-${phase}`,start+i*1000);
    research.recordPostcondition({decisionId:decision,action:frame.suggestedAction,expected:'continuous-life',observed:frame.phase,matched:true,verified:true,independent01:.7,evidenceKind:'runtime',confidence01:.8,at:start+i*1000});
    const outcome=research.registerOutcome({decisionId:decision,actual01:phase==='stress'?.2:.9,reward01:phase==='stress'?.2:.9,verified01:1,causal01:.7,external01:.7,at:start+i*1000});
    assert.ok(outcome.ok===true,`B322 research outcome link failed at cycle ${i}: ${outcome.reason??'unknown'}`);
  }
  const lifeBefore=life.diagnostics();
  const researchBefore=research.diagnostics();
  const researchSnapshot=research.snapshot();
  assert.equal(researchSnapshot.outcomes.length,enduranceCycles,'B322 research outcome count mismatch');

  const store=new FileStateStore(stateFile,{backupEverySaves:2,directoryFsyncEverySaves:1});
  const core=new OrganismCore(store,{performanceProfile:'mobile',cycleResultMode:'operational',enableTemporalResolutionGovernor:true,operationalPulseEvery:2,checkpointMaxDirtyCycles:6,checkpointMinIntervalMs:0});
  await core.init();
  const obs={embodiment:{bodyEnergy01:.88,cognitiveCapacity01:.84,thermalStrain01:.18,sensoryFreshness01:.82,battery01:.78,cpuLoad01:.22,ramPressure01:.22,awake:true},novelty:.44,surprise:.08};
  const pulseMs=[];
  for(let i=0;i<corePulses;i++){
    const t=performance.now();
    const r=await core.observeOperational({...obs,text:`b322 endurance pulse ${i}`});
    const reward=i<corePulses/2?.88:.12;
    await core.feedback({success:reward,reward:reward*.92,surprise:reward>.5?.08:.64,evidenceSource:'device',worldTransition:{action:r.decision?.selected?.action??'wait',before:{tick:i,location:'b322-pulse',energy:.8,attention:.8,uncertainty:.4,facts:[],objects:[],events:[]},after:{tick:i+1,location:'b322-pulse',energy:reward>.5?.86:.7,attention:.79,uncertainty:reward>.5?.22:.78,facts:[`pulse-${i}`],objects:[],events:['verified-transition']},reward,surprise:reward>.5?.08:.64,at:900000+i}});
    pulseMs.push(performance.now()-t);
  }
  await core.flush();
  const coreBefore=core.cognitiveDomainClosureDiagnostics();
  const learningBefore=core.b296NeuralPersonalityAgencyDiagnostics().learningUpdates;
  const p39CoreBefore=core.p39Diagnostics();
  const resumed=new OrganismCore(new FileStateStore(stateFile,{backupEverySaves:2,directoryFsyncEverySaves:1}),{performanceProfile:'mobile',cycleResultMode:'operational',enableTemporalResolutionGovernor:true,operationalPulseEvery:2,checkpointMaxDirtyCycles:6,checkpointMinIntervalMs:0});
  await resumed.init();
  const restoredTick=resumed.snapshot().state.tick;
  const learningLoaded=resumed.b296NeuralPersonalityAgencyDiagnostics().learningUpdates;
  const t=performance.now();
  const rr=await resumed.observeOperational({...obs,text:'b322 post-restart pulse'});
  await resumed.feedback({success:.93,reward:.86,surprise:.08,evidenceSource:'device',worldTransition:{action:rr.decision?.selected?.action??'wait',before:{tick:restoredTick,location:'b322-restart',energy:.8,attention:.8,uncertainty:.4,facts:[],objects:[],events:[]},after:{tick:restoredTick+1,location:'b322-restart',energy:.86,attention:.8,uncertainty:.2,facts:['restart-recovered'],objects:[],events:['verified-transition']},reward:.86,surprise:.08,at:900999}});
  await resumed.flush();
  const resumedMs=performance.now()-t;
  const coreAfter=resumed.cognitiveDomainClosureDiagnostics();
  const learningAfter=resumed.b296NeuralPersonalityAgencyDiagnostics().learningUpdates;
  const p39CoreAfter=resumed.p39Diagnostics();
  const pulseSorted=[...pulseMs].sort((a,b)=>a-b); const p95=pulseSorted[Math.min(pulseSorted.length-1,Math.floor(pulseSorted.length*.95))];
  const report={gate:'B322_LONG_HORIZON_DEVICE_LIFE',version:'35.6.1',verdict:'HOST_LONG_HORIZON',endurance:{cycles:enduranceCycles,p39:lifeBefore,research:researchBefore,researchCycles:researchSnapshot.cycles,phaseCounts},corePulses:{cycles:corePulses,meanMs:pulseMs.reduce((a,b)=>a+b,0)/pulseMs.length,p95Ms:p95,maxMs:Math.max(...pulseMs),learningBefore,learningAfter,learningDelta:learningAfter-learningBefore,closureBefore:coreBefore.totalCycles,closureAfter:coreAfter.totalCycles},restart:{restoredTick,
  learningLoaded,learningAfter,restartCycleMs:resumedMs,continuedLearning:learningAfter>=learningLoaded,continuedClosure:coreAfter.totalCycles>coreBefore.totalCycles},p39:{before:p39CoreBefore,after:p39CoreAfter},note:'Full core is exercised in bounded cognitive pulses; endurance is proven on the live P39 life engine and ResearchGradeOrganismEngine to avoid confounding phone-lifecycle proof with expensive full-core replay.'};
  assert.ok(lifeBefore.lifeTicks===enduranceCycles,'B322 P39 endurance ticks mismatch');
  assert.ok(researchSnapshot.cycles===enduranceCycles,'B322 research endurance cycles mismatch');
  assert.ok(coreAfter.totalCycles>coreBefore.totalCycles,'B322 core closure did not continue after durable reload');
  assert.ok(learningAfter>learningBefore,'B322 learning did not continue after durable reload');
  assert.ok(p95<2000,'B322 cognitive pulse p95 exceeded host threshold');
  assert.ok(lifeBefore.continuityGaps===0,'B322 endurance continuity gaps detected');
  await writeFile(join(OUT_DIR,'report.json'),JSON.stringify(report,null,2));
  console.log('BIG_PASS_322_LONG_HORIZON_DEVICE_LIFE=PASS',JSON.stringify({enduranceCycles,corePulses,p95Ms:p95,learningDelta:learningAfter-learningBefore,p39Ticks:lifeBefore.lifeTicks,continuityGaps:lifeBefore.continuityGaps,restoredTick}));
} finally { await rm(dir,{recursive:true,force:true}); }
