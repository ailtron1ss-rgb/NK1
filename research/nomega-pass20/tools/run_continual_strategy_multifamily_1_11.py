from __future__ import annotations
import copy, json, time
from pathlib import Path
import torch
from core.nomega.execution_guided_program_learning_v1 import ExecutionGuidedProgramLearnerV1
from core.nomega.neural_program_synth_v2 import NeuralProgramSynthesizerV2, NeuralProgramTrainerV2
from core.nomega.continual_strategy_portfolio_v1 import EWCPenaltyV1, AGEMConstraintV1

ROOT=Path(__file__).resolve().parents[1]
PAIRS=(('sum3','mul2'),('xor3','minmax3'),('compose_sum_xor','compose_min_max'))
SEEDS=(11201,11202,11203)

def rows(root,fam,seed):
    l=ExecutionGuidedProgramLearnerV1(root,seed=seed,hidden=10)
    return l.training_rows((fam,),condition_mode='typed',include_replay=False)[:3]

def make_model():
    return NeuralProgramSynthesizerV2(vocab=2048,hidden=10,latent_dim=10,max_len=8,max_b=16,layers=1,heads=2)

def score(m,rs):
    with torch.no_grad(): return sum(m.score_program(t,c,f) for t,c,f in rs)/max(1,len(rs))

def one(root,src_fam,tgt_fam,seed):
    src=rows(root,src_fam,seed); tgt=rows(root,tgt_fam,seed+100); ref=src[:2]
    base=make_model(); NeuralProgramTrainerV2(base,seed=seed+1,lr=8e-4).fit(src,epochs=2,max_examples=3)
    src0=score(base,ref); tgt0=score(base,tgt)
    out={}
    for name,strategy in [('naive',None),('replay',None),('ewc',EWCPenaltyV1(strength=1.0)),('agem',AGEMConstraintV1())]:
        m=make_model(); m.load_state_dict(copy.deepcopy(base.state_dict()))
        tr=NeuralProgramTrainerV2(m,seed=seed+2,lr=8e-4)
        fit_rows=tgt if name!='replay' else [tgt[0],tgt[1],ref[0]]
        tr.fit(fit_rows,epochs=2,max_examples=3,continual_strategy=strategy,continual_reference_rows=ref)
        out[name]={'target_gain':float(score(m,tgt)-tgt0),'retention':float(score(m,ref)-src0),'steps':tr.steps}
    return {'pair':f'{src_fam}->{tgt_fam}','seed':seed,'results':out}

def main():
    root=ROOT/'runtime'/'ablation_1_11_multifamily'; root.mkdir(parents=True,exist_ok=True)
    t=time.perf_counter(); runs=[one(root,a,b,s) for a,b in PAIRS for s in SEEDS]
    agg={}
    for name in ('naive','replay','ewc','agem'):
        vals=[r['results'][name] for r in runs]
        agg[name]={
          'mean_target_gain':sum(v['target_gain'] for v in vals)/len(vals),
          'mean_retention':sum(v['retention'] for v in vals)/len(vals),
          'positive_target':sum(v['target_gain']>0 for v in vals),
          'nonnegative_retention':sum(v['retention']>=0 for v in vals),
          'n':len(vals),
          'steps_equal':len({v['steps'] for v in vals})==1,
        }
    report={'version':'1.11.0','pairs':[f'{a}->{b}' for a,b in PAIRS],'seeds':list(SEEDS),'runs':runs,'aggregate':agg,'elapsed_s':time.perf_counter()-t,'promotion':'research-only','reason':'three task pairs and three seeds are stronger evidence than the single-pair smoke but still insufficient for global promotion/OOD/device claims'}
    p=root/'continual_strategy_multifamily_1_11.json'; p.write_text(json.dumps(report,indent=2,ensure_ascii=False),encoding='utf-8')
    print(json.dumps({'aggregate':agg,'elapsed_s':report['elapsed_s'],'out':str(p)},indent=2))
if __name__=='__main__': main()
