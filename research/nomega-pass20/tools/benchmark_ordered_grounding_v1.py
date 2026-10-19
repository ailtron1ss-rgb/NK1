from pathlib import Path
import json, random, statistics, time
import torch
from core.nomega.neural_program_synth_v2 import NeuralProgramSynthesizerV2
from core.nomega.neural_program_synth_v7 import NeuralProgramSynthesizerV7
from core.nomega.neural_program_trainer_v4 import NeuralProgramTrainerV4
from core.nomega.neural_verified_curriculum_v1 import VerifiedNeuralCurriculumV1
from core.nomega.program_acquisition_v2 import ProgramAcquisitionCoreV2
from core.nomega.task_spec_v1 import FAMILY_ORDER, CUES, CANONICAL_PROMPT, FAMILY_TO_ID

def eval_model(model, acq, seed):
    family_ok=verified=oracle=0; n=len(FAMILY_ORDER)
    rows=[]
    for fam in FAMILY_ORDER:
        cue=next((c for c in CUES[fam] if c != CANONICAL_PROMPT[fam]), CUES[fam][0])
        text=f'In direct terms, {cue}.'
        with torch.no_grad():
            _, fl=model._condition_with_family(text,None,None); pred=int(fl.argmax(-1).item())
        family_ok += int(pred==FAMILY_TO_ID[fam])
        holdout=acq._examples(fam,seed+100+FAMILY_TO_ID[fam])[1]
        try:
            code=model.generate_constrained_beam(text,family_id=pred,max_len=model.max_len,beam_size=2)
            h, hv,_=acq._eval(code,holdout); verified += int(h>=0.8 and hv>=0.8)
        except Exception:
            pass
        try:
            code=model.generate_constrained_beam(text,family_id=FAMILY_TO_ID[fam],max_len=model.max_len,beam_size=2)
            h, hv,_=acq._eval(code,holdout); oracle += int(h>=0.8 and hv>=0.8)
        except Exception:
            pass
        rows.append((fam,pred))
    return {'family_accuracy':family_ok/n,'end_to_end_verified':verified/n,'oracle_verified':oracle/n,'n':n}

def main():
    root=Path('.')
    results=[]
    for seed in (7201,7202,7203):
        curriculum, stats=VerifiedNeuralCurriculumV1(root,seed=seed).build(rows_per_family=24,programs_per_family=2)
        acq=ProgramAcquisitionCoreV2(root,seed=seed+31)
        for name, cls in [('v2_orderless',NeuralProgramSynthesizerV2),('v7_ordered_subword',NeuralProgramSynthesizerV7)]:
            torch.manual_seed(seed); torch.set_num_threads(1)
            model=cls(vocab=2048,hidden=32,latent_dim=32,max_len=48,max_b=64,layers=1,heads=4,family_count=20)
            params=sum(p.numel() for p in model.parameters())
            trainer=NeuralProgramTrainerV4(model,seed=seed,lr=8e-4)
            t=time.perf_counter(); report=trainer.fit(curriculum,epochs=10,batch_size=32,max_examples=len(curriculum)); wall=time.perf_counter()-t
            ev=eval_model(model,acq,seed)
            result={'seed':seed,'model':name,'params':params,'steps':report.steps,'train_loss':report.loss,'train_wall_s':wall,'curriculum_rows':len(curriculum),'curriculum_fp':stats.fingerprint,**ev}
            results.append(result); print(result,flush=True)
    out={'protocol':{'families':20,'rows_per_family':24,'programs_per_family':2,'epochs':10,'batch_size':32,'hidden':32,'max_len':48,'seeds':[7201,7202,7203]},'results':results}
    for name in ('v2_orderless','v7_ordered_subword'):
        rr=[x for x in results if x['model']==name]
        out[name+'_mean']={k:statistics.mean(x[k] for x in rr) for k in ('params','family_accuracy','end_to_end_verified','oracle_verified','train_loss','train_wall_s','steps')}
    path=root/'runtime'/'ordered_grounding_benchmark_v1.json'; path.write_text(json.dumps(out,indent=2)); print('WROTE',path)
if __name__=='__main__': main()
