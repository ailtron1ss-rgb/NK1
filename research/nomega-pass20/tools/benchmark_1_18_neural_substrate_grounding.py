from __future__ import annotations
import json, statistics, time, sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path: sys.path.insert(0,str(ROOT))
import torch
from core.nomega.execution_guided_program_learning_v1 import ExecutionGuidedProgramLearnerV1
from core.nomega.neural_program_synth_v9 import NeuralProgramSynthesizerV9
from core.nomega.neural_program_synth_v11 import NeuralProgramSynthesizerV11
from core.nomega.neural_program_synth_v12 import NeuralProgramSynthesizerV12
from core.nomega.neural_program_synth_v13 import NeuralProgramSynthesizerV13
from core.nomega.neural_program_trainer_v5 import AtomicProgramTrainerV5
from core.nomega.task_spec_ood_benchmark_v1 import TaskSpecOodBenchmarkV1
from core.nomega.task_spec_v1 import FAMILY_ORDER,CUES,CANONICAL_PROMPT,FAMILY_TO_ID
SEEDS=(15001,15002,15003)
FAMILIES=tuple(FAMILY_ORDER[:10])
HIDDEN=32
STEPS=8

def family_accuracy(model):
    correct=0
    for fam in FAMILIES:
        cue=next((c for c in CUES[fam] if c != CANONICAL_PROMPT[fam]),CANONICAL_PROMPT[fam])
        with torch.no_grad():
            _,logits=model._condition(f'In direct terms, {cue}.',None,None)
        correct += int(int(logits.argmax(-1).item())==FAMILY_TO_ID[fam])
    return correct/len(FAMILIES)

def run(seed, cls):
    torch.manual_seed(seed); torch.set_num_threads(1)
    learner=ExecutionGuidedProgramLearnerV1(ROOT, seed=seed, hidden=HIDDEN)
    rows=learner.training_rows(FAMILIES, condition_mode='typed', include_replay=False)
    m=cls(vocab=2048,hidden=HIDDEN,latent_dim=HIDDEN,max_len=20,max_b=64,layers=1,heads=4,family_count=20)
    trainer=AtomicProgramTrainerV5(m, seed=seed, lr=8e-4)
    t=time.perf_counter()
    rep=trainer.fit(rows,epochs=STEPS,batch_size=8,max_examples=len(rows),scheduled_prefix_start=0.0,scheduled_prefix_end=0.30,scheduled_max_tokens=8)
    bench=TaskSpecOodBenchmarkV1(ROOT)
    ev=bench.evaluate_model(m,seed=seed+800,max_len=20,condition_mode='end_to_end')
    return {'seed':seed,'track':cls.__name__,'steps':int(rep.steps),'family_accuracy':family_accuracy(m),'verified_rate':float(ev['prompt_level_verification']),'holdout':float(ev.get('holdout_verification',0.0)),'adversarial':float(ev.get('adversarial_verification',0.0)),'parameters':sum(p.numel() for p in m.parameters()),'wall_s':time.perf_counter()-t,'loss':float(rep.loss)}

rows=[]
for seed in SEEDS:
    for cls in (NeuralProgramSynthesizerV9,NeuralProgramSynthesizerV11,NeuralProgramSynthesizerV12,NeuralProgramSynthesizerV13):
        r=run(seed,cls); print(r,flush=True); rows.append(r)
summary={}
for track in {r['track'] for r in rows}:
    rr=[r for r in rows if r['track']==track]
    summary[track]={k:statistics.mean(r[k] for r in rr) for k in ('family_accuracy','verified_rate','holdout','adversarial','parameters','wall_s','loss')}
out={'protocol':{'release':'1.18.0-dev','seeds':list(SEEDS),'families':list(FAMILIES),'steps_per_model':STEPS,'hidden':HIDDEN,'tracks':['v9','v11','v12','v13']},'rows':rows,'summary':summary,'interpretation':'research-only; v11 is not promoted unless independent evidence dominates v9 under matched budget.'}
path=ROOT/'runtime'/'neural_substrate_grounding_v11_matched_ablation.json'; path.write_text(json.dumps(out,indent=2),encoding='utf-8'); print(json.dumps(out,indent=2))
