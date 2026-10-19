import json, statistics, time, torch
from pathlib import Path
from core.nomega.neural_program_synth_v8 import NeuralProgramSynthesizerV8
from core.nomega.neural_program_synth_v4 import AtomicProgramTrainerV4
from core.nomega.neural_program_trainer_v5 import AtomicProgramTrainerV5
from core.nomega.neural_verified_curriculum_v1 import VerifiedNeuralCurriculumV1
from core.nomega.program_acquisition_v2 import ProgramAcquisitionCoreV2
from core.nomega.task_spec_v1 import FAMILY_ORDER, CUES, CANONICAL_PROMPT, FAMILY_TO_ID

def evaluate(model, acq, seed):
    fam=ver=oracle=0
    for family in FAMILY_ORDER:
        cue=next((c for c in CUES[family] if c != CANONICAL_PROMPT[family]), CANONICAL_PROMPT[family])
        text=f"In direct terms, {cue}."
        with torch.no_grad():
            _, fl = model._condition(text, None, None)
            pred=int(fl.argmax(-1).item())
        fam += int(pred == FAMILY_TO_ID[family])
        hold = acq._examples(family, seed+100+FAMILY_TO_ID[family])[1]
        for fid, is_oracle in ((pred, False), (FAMILY_TO_ID[family], True)):
            try:
                code=model.generate(text, family_id=fid, max_len=model.max_len, beam_size=2)
                h,hv,_=acq._eval(code, hold)
                good=int(h>=0.8 and hv>=0.8)
                if is_oracle: oracle += good
                else: ver += good
            except Exception:
                pass
    n=len(FAMILY_ORDER)
    return fam/n, ver/n, oracle/n

results=[]
for seed in (8601,8602,8603):
    rows,_=VerifiedNeuralCurriculumV1(Path('.'),seed=seed).build(rows_per_family=4,programs_per_family=1)
    acq=ProgramAcquisitionCoreV2(Path('.'),seed=seed+31)
    for name,tr_cls in (("v4_teacher",AtomicProgramTrainerV4),("v5_scheduled",AtomicProgramTrainerV5)):
        torch.manual_seed(seed); torch.set_num_threads(1)
        m=NeuralProgramSynthesizerV8(vocab=2048,hidden=32,latent_dim=32,max_len=48,max_b=64,layers=1,heads=4,family_count=20)
        tr=tr_cls(m,seed=seed,lr=8e-4)
        t=time.perf_counter()
        if name=="v5_scheduled":
            rep=tr.fit(rows,epochs=15,batch_size=8,max_examples=len(rows),scheduled_prefix_start=0.0,scheduled_prefix_end=0.35,scheduled_max_tokens=12)
        else:
            rep=tr.fit(rows,epochs=15,batch_size=8,max_examples=len(rows))
        wall=time.perf_counter()-t
        fa,en,orv=evaluate(m,acq,seed)
        r={"seed":seed,"model":name,"params":sum(p.numel() for p in m.parameters()),"steps":rep.steps,"family_accuracy":fa,"end_to_end_verified":en,"oracle_verified":orv,"train_loss":float(rep.loss),"wall_s":wall,"scheduled_tokens":int(getattr(rep,'scheduled_tokens',0))}
        print(r,flush=True); results.append(r)
summary={}
for name in ("v4_teacher","v5_scheduled"):
    rr=[r for r in results if r["model"]==name]
    summary[name]={k:statistics.mean(r[k] for r in rr) for k in ("family_accuracy","end_to_end_verified","oracle_verified","train_loss","wall_s","steps","scheduled_tokens")}
out={"protocol":{"families":20,"rows_per_family":4,"programs_per_family":1,"steps_per_model":15*10,"batch_size":8,"seeds":[8601,8602,8603],"scheduled_max_tokens":12,"scheduled_prefix_end":0.35},"results":results,"summary":summary}
Path('runtime/v8_scheduled_sampling_ablation_v1.json').write_text(json.dumps(out,indent=2))
print('SUMMARY',json.dumps(summary,indent=2),flush=True)
