from __future__ import annotations
from pathlib import Path
import json, tempfile, torch
from core.nomega.neural_program_synth_v2 import NeuralProgramSynthesizerV2, NeuralProgramTrainerV2, ProgramAugmenterV2
from core.nomega.program_acquisition_v2 import ProgramAcquisitionCoreV2
from core.nomega.task_spec_v1 import CANONICAL_PROMPT, FAMILY_TO_ID, parse_task_spec, typed_model_condition
from core.nomega.model_time_replay_v1 import ModelTimeReplayControllerV1


def rows_for(fam, seed):
    acq=ProgramAcquisitionCoreV2(Path('.'), seed=seed)
    base=acq.templates(fam)[0]
    text=typed_model_condition(parse_task_spec(CANONICAL_PROMPT[fam]))
    return [(text,c,FAMILY_TO_ID[fam]) for c in ProgramAugmenterV2(seed).augment(base,n=2)]

def eval_families(model, fams, seed):
    acq=ProgramAcquisitionCoreV2(Path('.'),seed=seed)
    out={}
    for i,fam in enumerate(fams):
        text=typed_model_condition(parse_task_spec(CANONICAL_PROMPT[fam]))
        prog=model.generate(text,family_id=FAMILY_TO_ID[fam],max_len=10)
        _,hold,_=acq._examples(fam, seed+100+i)
        fit,hvm,_=acq._eval(prog,hold)
        out[fam]={'fitness':fit,'hvm':hvm,'verified':bool(fit>=.8 and hvm>=.8)}
    return out

seed=19911
old=('sum3','xor3')
new=('compose_sum_xor',)
old_rows=rows_for('sum3',seed)+rows_for('xor3',seed+1)
new_rows=rows_for('compose_sum_xor',seed+2)
model0=NeuralProgramSynthesizerV2(vocab=2048,hidden=12,latent_dim=12,max_len=10,max_b=32,layers=1,heads=2)
t0=NeuralProgramTrainerV2(model0,seed=seed)
t0.fit(old_rows,epochs=1,max_examples=4,teacher_forcing_start=1,teacher_forcing_end=1)
initial_state={k:v.detach().clone() for k,v in model0.state_dict().items()}

results={}
for mode in ('static','model_time'):
    model=NeuralProgramSynthesizerV2(vocab=2048,hidden=12,latent_dim=12,max_len=10,max_b=32,layers=1,heads=2)
    model.load_state_dict(initial_state)
    root=Path(tempfile.mkdtemp(prefix='nomega_1_9_9_'))
    trainer=NeuralProgramTrainerV2(model,seed=seed)
    provider=(lambda n: old_rows[:n]) if mode=='model_time' else None
    ctl=ModelTimeReplayControllerV1(root,threshold=0.0,cooldown_steps=0) if mode=='model_time' else None
    report=trainer.fit(new_rows,epochs=2,max_examples=2,teacher_forcing_start=1,teacher_forcing_end=.7,replay_controller=ctl,replay_provider=provider,replay_max_items=2)
    results[mode]={'report':report.__dict__,'old':eval_families(model,old,seed+20),'new':eval_families(model,new,seed+30),'controller':ctl.snapshot() if ctl else None}
print(json.dumps({'initial_state_old':eval_families(model0,old,seed+10),'results':results},indent=2))
