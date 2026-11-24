from __future__ import annotations
import json,statistics,sys,time
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]; sys.path.insert(0,str(ROOT))
import torch
from core.nomega.execution_guided_program_learning_v1 import ExecutionGuidedProgramLearnerV1
from core.nomega.neural_program_synth_v9 import NeuralProgramSynthesizerV9
from core.nomega.neural_program_trainer_v5 import AtomicProgramTrainerV5
from core.nomega.neural_skill_retrieval_v1 import NeuralSkillRetrievalV1
from core.nomega.neural_skill_retrieval_v2 import NeuralSkillRetrievalV2
from core.nomega.task_spec_v1 import CUES,CANONICAL_PROMPT
SEEDS=(18501,18502,18503); FAMILIES=("sum3","xor3","mul2","sub_offset","minmax3","parity_mix"); STEPS=8; H=32

def run(seed):
 torch.manual_seed(seed); torch.set_num_threads(1)
 learner=ExecutionGuidedProgramLearnerV1(ROOT,seed=seed,hidden=H); rows=learner.training_rows(FAMILIES,condition_mode='typed',include_replay=False)
 m=NeuralProgramSynthesizerV9(vocab=2048,hidden=H,latent_dim=H,max_len=20,max_b=64,layers=1,heads=4,family_count=20)
 AtomicProgramTrainerV5(m,seed=seed,lr=8e-4).fit(rows,epochs=STEPS,batch_size=8,max_examples=len(rows),scheduled_prefix_start=0.0,scheduled_prefix_end=.30,scheduled_max_tokens=8)
 p1=[]; p2=[]
 for i,f in enumerate(FAMILIES):
  cue=next((c for c in CUES[f] if c!=CANONICAL_PROMPT[f]),CANONICAL_PROMPT[f]); prompt=f"In direct terms, {cue}."; code=m.generate(prompt,family_id=None,max_len=20,beam_size=1,family_beam=3)
  a=NeuralSkillRetrievalV1(ROOT,seed=seed+i+1).search(code,f,max_candidates=16)
  b=NeuralSkillRetrievalV2(ROOT,seed=seed+i+1).search(code,f,max_candidates=48,active_queries=8)
  p1.append(a.to_dict()); p2.append(b.to_dict())
 def agg(rows,field): return statistics.mean(float(r[field]) for r in rows)
 return {'seed':seed,'v1':{'verified':agg(p1,'selected_verified'),'holdout':agg(p1,'selected_holdout'),'adv':agg(p1,'selected_adversarial'),'hvm':agg(p1,'selected_hvm'),'retrieved':agg(p1,'candidates_tested')},'v2':{'verified':agg(p2,'selected_verified'),'holdout':agg(p2,'selected_holdout'),'adv':agg(p2,'selected_adversarial'),'hvm':agg(p2,'selected_hvm'),'retrieved':agg(p2,'candidates_retrieved'),'after_filter':agg(p2,'candidates_after_filter'),'active_tests':agg(p2,'active_tests')}}

rows=[]; t=time.perf_counter()
for s in SEEDS:
 r=run(s); print(r,flush=True); rows.append(r)
summary={}
for track in ('v1','v2'):
 summary[track]={k:statistics.mean(float(r[track][k]) for r in rows) for k in rows[0][track]}
summary['delta']={k:summary['v2'][k]-summary['v1'][k] for k in summary['v1'] if k in summary['v2']}
out={'protocol':{'release':'1.17.0-dev','track':'ACTIVE_TEST_TIME_RETRIEVAL','families':list(FAMILIES),'seeds':list(SEEDS),'steps':STEPS,'hidden':H,'interpretation':'research_only; active test selection uses benchmark holdout/adversarial expected outputs and is not a production oracle.'},'results':rows,'summary':summary,'elapsed_s':time.perf_counter()-t}
path=ROOT/'runtime'/'nomega_1_17_active_retrieval.json'; path.write_text(json.dumps(out,indent=2,ensure_ascii=False),encoding='utf-8')
print(json.dumps(summary,indent=2,ensure_ascii=False))
