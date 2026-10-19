from __future__ import annotations
import json, statistics, sys, time
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT))
import torch
from core.nomega.execution_guided_program_learning_v1 import ExecutionGuidedProgramLearnerV1
from core.nomega.neural_program_synth_v9 import NeuralProgramSynthesizerV9
from core.nomega.neural_program_synth_v10 import NeuralProgramSynthesizerV10
from core.nomega.neural_program_trainer_v5 import AtomicProgramTrainerV5
from core.nomega.neural_program_repair_v1 import NeuralProgramRepairV1
from core.nomega.neural_program_repair_v2 import NeuralProgramRepairV2
from core.nomega.task_spec_v1 import CUES, CANONICAL_PROMPT

SEEDS=(18401,18402,18403)
FAMILIES=("sum3","xor3","mul2","sub_offset","minmax3","parity_mix")
STEPS=8
HIDDEN=32
MAX_CANDIDATES=12

def train(seed, model_cls):
    torch.manual_seed(seed); torch.set_num_threads(1)
    learner=ExecutionGuidedProgramLearnerV1(ROOT,seed=seed,hidden=HIDDEN)
    rows=learner.training_rows(FAMILIES,condition_mode='typed',include_replay=False)
    model=model_cls(vocab=2048,hidden=HIDDEN,latent_dim=HIDDEN,max_len=20,max_b=64,layers=1,heads=4,family_count=20)
    trainer=AtomicProgramTrainerV5(model,seed=seed,lr=8e-4)
    report=trainer.fit(rows,epochs=STEPS,batch_size=8,max_examples=len(rows),scheduled_prefix_start=0.0,scheduled_prefix_end=0.30,scheduled_max_tokens=8)
    return model, report

def evaluate(model, Repair):
    rows=[]
    for idx,family in enumerate(FAMILIES):
        cue=next((c for c in CUES[family] if c != CANONICAL_PROMPT[family]),CANONICAL_PROMPT[family])
        prompt=f"In direct terms, {cue}."
        code=model.generate(prompt,family_id=None,max_len=20,beam_size=1,family_beam=3)
        rep=Repair(ROOT,seed=19001+idx).repair(code,family,text=prompt,max_candidates=MAX_CANDIDATES) if Repair is NeuralProgramRepairV2 else Repair(ROOT,seed=19001+idx).repair(code,family,seed_offset=0,max_candidates=MAX_CANDIDATES)
        rows.append({"family":family,"pure_verified":rep.original_verified,"repaired_verified":getattr(rep,'repaired_verified',False),"pure_holdout":rep.original_holdout,"repaired_holdout":rep.repaired_holdout,"pure_adv":rep.original_adversarial,"repaired_adv":rep.repaired_adversarial,"pure_hvm":rep.original_hvm,"repaired_hvm":rep.repaired_hvm})
    return rows

def summarize(rows):
    keys=('pure_verified','repaired_verified','pure_holdout','repaired_holdout','pure_adv','repaired_adv','pure_hvm','repaired_hvm')
    s={k:statistics.mean(float(r[k]) for r in rows) for k in keys}
    s['verified_delta']=s['repaired_verified']-s['pure_verified']; s['holdout_delta']=s['repaired_holdout']-s['pure_holdout']; s['adv_delta']=s['repaired_adv']-s['pure_adv']; s['hvm_delta']=s['repaired_hvm']-s['pure_hvm']
    return s

all_results=[]; t0=time.perf_counter()
for seed in SEEDS:
    v9, rep9=train(seed,NeuralProgramSynthesizerV9); 
    r1=evaluate(v9,NeuralProgramRepairV1); r2=evaluate(v9,NeuralProgramRepairV2)
    row={'seed':seed,'v9_steps':rep9.steps,'v9':summarize(r1),'v2_on_v9':summarize(r2)}
    print(row,flush=True); all_results.append(row)

def agg(which):
    ks=all_results[0][which].keys(); return {k:statistics.mean(float(r[which][k]) for r in all_results) for k in ks}
summary={'v9':agg('v9'),'v2_on_v9':agg('v2_on_v9')}
summary['comparison']={k:summary['v2_on_v9'][k]-summary['v9'][k] for k in summary['v9']}
out={'protocol':{'release':'1.16.0-dev','track':'V10_SEMANTIC_SEARCH_PLUS_TARGETED_REPAIR','families':list(FAMILIES),'seeds':list(SEEDS),'steps_per_model':STEPS,'hidden':HIDDEN,'max_candidates':MAX_CANDIDATES,'interpretation':'research_only; V10 and V2 are hybrid/typed-semantic search experiments; this does not represent pure-neural capability.'},'results':all_results,'summary':summary,'elapsed_s':time.perf_counter()-t0}
path=ROOT/'runtime'/'nomega_1_16_search_and_repair_v2.json'; path.write_text(json.dumps(out,indent=2,ensure_ascii=False),encoding='utf-8')
print(json.dumps(summary,indent=2,ensure_ascii=False))
