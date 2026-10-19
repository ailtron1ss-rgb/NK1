import time,json,statistics,torch
from pathlib import Path
from core.nomega.neural_program_synth_v7 import NeuralProgramSynthesizerV7
from core.nomega.neural_program_synth_v8 import NeuralProgramSynthesizerV8
from core.nomega.neural_program_trainer_v4 import NeuralProgramTrainerV4
from core.nomega.neural_program_synth_v4 import AtomicProgramTrainerV4
from core.nomega.neural_verified_curriculum_v1 import VerifiedNeuralCurriculumV1
from core.nomega.task_spec_v1 import FAMILY_ORDER,CUES,CANONICAL_PROMPT,FAMILY_TO_ID
from core.nomega.program_acquisition_v2 import ProgramAcquisitionCoreV2

def eval_model(m,acq,seed):
 fam=ver=oracle=0
 for f in FAMILY_ORDER:
  cue=next((c for c in CUES[f] if c!=CANONICAL_PROMPT[f]),CANONICAL_PROMPT[f]); text=f"In direct terms, {cue}."
  with torch.no_grad():
   if hasattr(m,'_condition_with_family'): _,fl=m._condition_with_family(text,None,None)
   else: _,fl=m._condition(text,None,None)
   pred=int(fl.argmax(-1).item())
  fam+=int(pred==FAMILY_TO_ID[f]); hold=acq._examples(f,seed+100+FAMILY_TO_ID[f])[1]
  for fid,which in ((pred,0),(FAMILY_TO_ID[f],1)):
   try:
    code=m.generate(text,family_id=fid,max_len=m.max_len,beam_size=2); h,hv,_=acq._eval(code,hold); good=int(h>=.8 and hv>=.8); ver+=good if which==0 else 0; oracle+=good if which==1 else 0
   except Exception: pass
 return fam/20,ver/20,oracle/20

results=[]
for seed in (7501,7502,7503):
 rows,_=VerifiedNeuralCurriculumV1(Path('.'),seed=seed).build(rows_per_family=24,programs_per_family=2); acq=ProgramAcquisitionCoreV2(Path('.'),seed=seed+31)
 for name,cls,tr_cls in (("v7_factorized",NeuralProgramSynthesizerV7,NeuralProgramTrainerV4),("v8_atomic",NeuralProgramSynthesizerV8,AtomicProgramTrainerV4)):
  torch.manual_seed(seed); torch.set_num_threads(1); m=cls(vocab=2048,hidden=32,latent_dim=32,max_len=48,max_b=64,layers=1,heads=4,family_count=20); tr=tr_cls(m,seed=seed,lr=8e-4); t=time.perf_counter(); rep=tr.fit(rows,epochs=10,batch_size=32,max_examples=len(rows)); wall=time.perf_counter()-t; fa,en,orv=eval_model(m,acq,seed)
  r={"seed":seed,"model":name,"params":sum(p.numel() for p in m.parameters()),"steps":rep.steps,"family_accuracy":fa,"end_to_end_verified":en,"oracle_verified":orv,"train_loss":rep.loss,"wall_s":wall}; print(r,flush=True); results.append(r)
for n in ("v7_factorized","v8_atomic"):
 rr=[x for x in results if x["model"]==n]; print("mean",n,{k:statistics.mean(x[k] for x in rr) for k in ("params","family_accuracy","end_to_end_verified","oracle_verified","train_loss","wall_s","steps")})
Path("runtime/v7_v8_grounding_benchmark_v1.json").write_text(json.dumps({"results":results},indent=2))
