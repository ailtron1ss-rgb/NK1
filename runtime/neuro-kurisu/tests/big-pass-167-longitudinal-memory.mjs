import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FileStateStore } from '../src/organism/persistence/FileStateStore.ts';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { MemoryCausalEconomy } from '../src/organism/system/MemoryCausalEconomy.ts';
import { IdentityTrajectoryEngine, defaultIdentityTrajectory } from '../src/organism/cognition/evolution/IdentityTrajectoryEngine.ts';

const dir=await mkdtemp(join(tmpdir(),'nk167-life-')); const file=join(dir,'state.json');
const opts={enableLanguage:false,performanceProfile:'mobile',checkpointMinIntervalMs:0,checkpointMaxDirtyCycles:4};
try{
  const core=new OrganismCore(new FileStateStore(file),opts); await core.init();
  const coreDays=[];
  for(let day=1;day<=30;day++){
    const success=day<11?.82:day<21?.36:.76;
    const surprise=day<11?.22:day<21?.68:.28;
    const novelty=day<11?.78:day<21?.42:.62;
    const r=await core.observe({text:`big-pass-167 real-core-day-${day}`,worldContext:{location:'life-sim',facts:[day<11?'safe-exploration':day<21?'failure-learning':'recovery-integration'],objects:['context'],events:[`day-${day}`],energy:.74,attention:.62,uncertainty:Math.min(.82,.2+surprise*.35)},novelty});
    await core.feedback({success,reward:success-.5,surprise,evidenceSource:day%3===0?'device':'user'});
    if(day===7||day===30){coreDays.push({day,tick:r.state.tick,identity:core.snapshot().facets.evolution.identityTrajectory,path:core.memoryCausalEconomySnapshot()});await core.flush();}
  }
  assert.equal(coreDays.length,2);
  assert.ok(coreDays[1].identity.outcomeSamples>=30);
  assert.ok(coreDays[1].path.totalObservations>=30);
  const beforeRestart=core.memoryCausalEconomySnapshot(); const coreIdentity=core.snapshot().facets.evolution.identityTrajectory; core.stop?.();
  const resumed=new OrganismCore(new FileStateStore(file),opts); await resumed.init();
  const restored=resumed.memoryCausalEconomySnapshot();
  assert.equal(restored.totalObservations,beforeRestart.totalObservations);
  assert.equal(restored.totalOutcomes,beforeRestart.totalOutcomes);
  assert.equal(restored.totalEffects,beforeRestart.totalEffects);
  resumed.stop?.();

  // 90-day causal-equivalent uses the same production MemoryCausalEconomy + IdentityTrajectoryEngine,
  // without pretending that 90 calendar days have elapsed in the test sandbox.
  const mem=new MemoryCausalEconomy(); const identity=new IdentityTrajectoryEngine(); identity.restore(defaultIdentityTrajectory());
  const epochs=[{start:1,end:30,success:.82,surprise:.2},{start:31,end:60,success:.35,surprise:.68},{start:61,end:90,success:.77,surprise:.28}];
  const eq=[];
  for(const e of epochs){
    for(let day=e.start;day<=e.end;day++){
      const source=day%3===0?'device':'user';
      const row=mem.observeMemory({memoryId:`eq-${day}`,content:`causal-equivalent day ${day} ${day<31?'explore':day<61?'failure':'recovery'}`,tick:day,sourceClass:source,sourceKey:`${source}-${day%4}`,confidence01:.72+(day%5)*.03});
      mem.observeOutcome({memoryId:row.observation.memoryId,decisionId:`eq-decision-${day}`,tick:day,action:day%2?'explore':'verify',success01:e.success,surprise01:e.surprise,sourceClass:source,causalPrior01:.6});
      identity.observeOutcome({action:day%2?'explore':'verify',success01:e.success,surprise01:e.surprise,trust01:.8,phase:day<31?'exploring':day<61?'repairing':'integrating',attractor:day<31?'curiosity':day<61?'truthfulness':'autonomy',identityPressure01:day<61?.55:.24,predictionError01:e.surprise});
    }
    eq.push({day:e.end,identity:identity.snapshot(),memory:mem.summary()});
  }
  assert.equal(eq.length,3);
  assert.ok(eq[2].identity.outcomeSamples===90);
  assert.ok(eq[2].memory.totalObservations===90);
  assert.ok(eq[2].identity.pathDependence01!==eq[0].identity.pathDependence01);
  const report = {
    pass: 167,
    status: 'PASS',
    core30: {
      checkpoints: coreDays.map(x => ({
        day: x.day, tick: x.tick,
        identitySamples: x.identity.samples,
        outcomeSamples: x.identity.outcomeSamples,
        pathDependence01: x.identity.pathDependence01,
        memoryObservations: x.path.totalObservations,
        memoryOutcomes: x.path.totalOutcomes,
        memoryEffects: x.path.totalEffects,
      })),
      restart: {
        observations: restored.totalObservations,
        outcomes: restored.totalOutcomes,
        effects: restored.totalEffects,
      },
      identityPathDependence01: coreIdentity.pathDependence01,
    },
    causalEquivalent90: {
      warning: '90 simulated causal days, not 90 real calendar days',
      checkpoints: eq.map(x => ({
        day: x.day,
        identityOutcomeSamples: x.identity.outcomeSamples,
        pathDependence01: x.identity.pathDependence01,
        dominantDirection: x.identity.dominantDirection,
        memoryObservations: x.memory.totalObservations,
        memoryOutcomes: x.memory.totalOutcomes,
      })),
    },
  };
  console.log(JSON.stringify(report, null, 2));
} finally {await rm(dir,{recursive:true,force:true});}
