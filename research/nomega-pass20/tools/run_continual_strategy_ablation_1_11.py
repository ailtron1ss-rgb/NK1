from __future__ import annotations
import copy, json, time
from pathlib import Path
import torch

from core.nomega.execution_guided_program_learning_v1 import ExecutionGuidedProgramLearnerV1
from core.nomega.neural_program_synth_v2 import NeuralProgramSynthesizerV2, NeuralProgramTrainerV2
from core.nomega.continual_strategy_portfolio_v1 import EWCPenaltyV1, AGEMConstraintV1, ContinualStrategyPortfolioV1

ROOT=Path(__file__).resolve().parents[1]
SEEDS=(11111,11112,11113)

def rows(root, family, seed):
    learner=ExecutionGuidedProgramLearnerV1(root,seed=seed,hidden=12)
    return learner.training_rows((family,),condition_mode='typed',include_replay=False)[:3]

def model():
    return NeuralProgramSynthesizerV2(vocab=2048,hidden=12,latent_dim=12,max_len=8,max_b=16,layers=1,heads=2)

def score(m, rs):
    with torch.no_grad():
        return sum(m.score_program(t,c,f) for t,c,f in rs)/max(1,len(rs))

def run_seed(root, seed):
    source=rows(root,'sum3',seed)
    target=rows(root,'mul2',seed+100)
    ref=source[:2]
    base=model(); tr=NeuralProgramTrainerV2(base,seed=seed+1,lr=8e-4)
    tr.fit(source,epochs=2,max_examples=3)
    src_before=score(base,ref)
    initial_target=score(base,target)
    results={}
    strategies={
        'naive':None,
        'ewc':EWCPenaltyV1(strength=1.0),
        'agem':AGEMConstraintV1(),
        'replay':None,
    }
    for name,strategy in strategies.items():
        m=model(); m.load_state_dict(copy.deepcopy(base.state_dict()))
        t=NeuralProgramTrainerV2(m,seed=seed+2,lr=8e-4)
        fit_rows=target if name!='replay' else [target[0],target[1],ref[0]]
        t.fit(fit_rows,epochs=2,max_examples=3,continual_strategy=strategy,continual_reference_rows=ref)
        results[name]={
            'target_gain':float(score(m,target)-initial_target),
            'source_retention_delta':float(score(m,ref)-src_before),
            'steps':int(t.steps),
        }
    return {'seed':seed,'results':results,'initial_target':initial_target,'source_before':src_before}

def main():
    root=ROOT/'runtime'/'ablation_1_11'
    root.mkdir(parents=True,exist_ok=True)
    t0=time.perf_counter(); runs=[run_seed(root,s) for s in SEEDS]
    agg={}
    for name in ('naive','replay','ewc','agem'):
        vals=[r['results'][name] for r in runs]
        agg[name]={
            'mean_target_gain':sum(v['target_gain'] for v in vals)/len(vals),
            'mean_source_retention_delta':sum(v['source_retention_delta'] for v in vals)/len(vals),
            'positive_target_gain_seeds':sum(v['target_gain']>0 for v in vals),
            'nonnegative_retention_seeds':sum(v['source_retention_delta']>=0 for v in vals),
            'steps_equal':len({v['steps'] for v in vals})==1,
        }
    portfolio=ContinualStrategyPortfolioV1(root)
    report={'version':'1.11.0','source':'NOMEGA','baseline_reference':'Avalanche-style EWC/A-GEM/replay baselines',
            'seeds':list(SEEDS),'runs':runs,'aggregate':agg,'elapsed_s':time.perf_counter()-t0,
            'promotion':'research-only','promotion_reason':'small equal-budget continual benchmark; strategy should only be promoted after downstream paired multi-seed wins with retention non-degradation',
            'portfolio':portfolio.snapshot()}
    out=root/'continual_strategy_ablation_1_11.json'; out.write_text(json.dumps(report,indent=2,ensure_ascii=False),encoding='utf-8')
    print(json.dumps({'aggregate':agg,'elapsed_s':report['elapsed_s'],'out':str(out)},indent=2))

if __name__=='__main__': main()
