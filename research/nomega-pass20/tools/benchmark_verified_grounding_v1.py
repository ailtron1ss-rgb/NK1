from pathlib import Path
import json, random, statistics, time
import torch
from core.nomega.neural_program_synth_v2 import NeuralProgramSynthesizerV2
from core.nomega.neural_program_trainer_v3 import NeuralProgramTrainerV3
from core.nomega.neural_program_trainer_v4 import NeuralProgramTrainerV4
from core.nomega.neural_verified_curriculum_v1 import VerifiedNeuralCurriculumV1
from core.nomega.program_acquisition_v2 import ProgramAcquisitionCoreV2
from core.nomega.task_spec_v1 import FAMILY_ORDER, CUES, FAMILY_TO_ID

def eval_model(model, acq, seed):
    rng=random.Random(seed+9000)
    prompts=[]
    for fam in FAMILY_ORDER:
        cue=next((c for c in CUES[fam] if c != __import__('core.nomega.task_spec_v1',fromlist=['CANONICAL_PROMPT']).CANONICAL_PROMPT[fam]), CUES[fam][0])
        # Wrapper and surface form are deliberately outside the training curriculum wrappers.
        text=f'In direct terms, {cue}.'
        prompts.append((fam,text))
    family_ok=0; verified=0; oracle_verified=0
    for fam,text in prompts:
        with torch.no_grad():
            _, fl=model._condition_with_family(text, None, None)
            pred=int(fl.argmax(-1).item())
        family_ok += int(pred==FAMILY_TO_ID[fam])
        try:
            code=model.generate_constrained_beam(text, family_id=pred, max_len=model.max_len, beam_size=2)
            hold, hvm, _=acq._eval(code, acq._examples(fam, seed+100+FAMILY_TO_ID[fam])[1])
            verified += int(hold>=0.8 and hvm>=0.8)
        except Exception:
            pass
        # oracle-family diagnostic isolates generation from family routing.
        try:
            code=model.generate_constrained_beam(text, family_id=FAMILY_TO_ID[fam], max_len=model.max_len, beam_size=2)
            hold, hvm, _=acq._eval(code, acq._examples(fam, seed+100+FAMILY_TO_ID[fam])[1])
            oracle_verified += int(hold>=0.8 and hvm>=0.8)
        except Exception:
            pass
    n=len(prompts)
    return family_ok/n, verified/n, oracle_verified/n

def run():
    root=Path('.')
    all_results=[]
    for seed in (7101,7102,7103):
        curriculum, stats=VerifiedNeuralCurriculumV1(root,seed=seed).build(rows_per_family=4,programs_per_family=1)
        acq=ProgramAcquisitionCoreV2(root,seed=seed+31)
        # Matched architecture and optimizer budget.
        for name, trainer_cls in (('v3_original',NeuralProgramTrainerV3),('v4_masked_verified',NeuralProgramTrainerV4)):
            torch.manual_seed(seed); torch.set_num_threads(1)
            model=NeuralProgramSynthesizerV2(vocab=2048,hidden=32,latent_dim=32,max_len=48,max_b=64,layers=1,heads=4,family_count=20)
            trainer=trainer_cls(model,seed=seed,lr=8e-4)
            t=time.perf_counter()
            report=trainer.fit(curriculum,epochs=10,batch_size=8,max_examples=len(curriculum))
            elapsed=time.perf_counter()-t
            fam,ver,oracle=eval_model(model,acq,seed)
            all_results.append({'seed':seed,'model':name,'family_accuracy':fam,'end_to_end_verified':ver,'oracle_verified':oracle,'steps':report.steps,'train_wall_s':elapsed,'train_loss':float(report.loss),'curriculum_fp':stats.fingerprint})
            print(all_results[-1], flush=True)
    out={'protocol':{'families':20,'rows_per_family':4,'epochs':10,'batch_size':8,'max_len':48,'hidden':32,'layers':1,'heads':4,'seeds':[7101,7102,7103]},'results':all_results}
    for model_name in ('v3_original','v4_masked_verified'):
        rr=[x for x in all_results if x['model']==model_name]
        out[model_name+'_mean']={k:statistics.mean(x[k] for x in rr) for k in ('family_accuracy','end_to_end_verified','oracle_verified','train_loss','train_wall_s','steps')}
    path=root/'runtime'/'verified_grounding_benchmark_v1.json'; path.write_text(json.dumps(out,indent=2)); print('WROTE',path)
if __name__=='__main__': run()
