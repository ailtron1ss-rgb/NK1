from __future__ import annotations
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Any, Dict, Sequence
import hashlib, json, time
import torch
from copy import deepcopy

from .neural_program_synth_v2 import NeuralProgramSynthesizerV2
from .neural_program_trainer_v3 import NeuralProgramTrainerV3
from .execution_preference_trainer_v1 import ExecutionPreferenceTrainerV1
from .neural_verified_curriculum_v1 import VerifiedNeuralCurriculumV1
from .verifiable_environment_forge_v1 import VerifiableEnvironmentForgeV1
from .adaptive_environment_forge_v2 import AdaptiveEnvironmentForgeV2
from .continual_learning_controller_v1 import ContinualLearningControllerV1
from .learning_experiment_protocol_v1 import LearningExperimentProtocolV1
from .developmental_bottleneck_detector_v1 import DevelopmentalBottleneckDetectorV1
from .neural_causality_benchmark_v1 import NeuralCausalityBenchmarkV1
from .metaproductivity_v1 import MetaproductivityTrackerV1
from .neural_causal_credit_v1 import NeuralCausalCreditAssignerV1
from .neural_causal_credit_trainer_v1 import NeuralCausalCreditTrainerV1
from .neural_causality_benchmark_v2 import NeuralCausalityBenchmarkV2
from .causal_self_model_v1 import CausalSelfModelV1
from .verifiable_dense_reward_v1 import VerifiableDenseRewardV1

@dataclass(frozen=True)
class LearningLabReportV1:
    version: str
    families: int
    curriculum_rows: int
    supervised_loss: float
    preference_pairs: int
    coverage_before: float
    coverage_after: float
    delta: float
    promoted: bool
    reason: str
    elapsed_s: float
    checkpoint: str = ''
    forged_environment_rows: int = 0
    forged_environment_mean_hardness: float = 0.0
    experiment_id: str = ''
    primary_bottleneck: str = ''
    partitions: Dict[str,int] = None
    neural_milestone: str = 'N0'
    causal_effect: float = 0.0
    metaproductivity: Dict[str,Any] = None
    promotion_decision: Dict[str,Any] = None
    replay_selected: int = 0
    causal_decision_change_rate: float = 0.0
    causal_ablation_effects: Dict[str,float] = None
    causal_train_loss: float = 0.0
    causal_positive_mass: float = 0.0
    causal_negative_mass: float = 0.0
    causal_neural_gain: float = 0.0
    causal_ablation_max_effect: float = 0.0
    causal_verified_holdout_gain: float = 0.0
    def to_dict(self): return asdict(self)

class NeuralExecutionLearningLabV1:
    VERSION='neural-execution-learning-lab-v2'
    def __init__(self,root:Path,seed:int=8801): self.root=Path(root); self.seed=int(seed)
    def run(self,families:Sequence[str],*,hidden:int=64,epochs:int=12,preference_epochs:int=2)->LearningLabReportV1:
        t=time.perf_counter(); families=list(families)
        detector=DevelopmentalBottleneckDetectorV1(self.root); analysis=detector.analyze({'raw_neural_verified_rate':0.0,'repair_verified_rate':0.0,'ood_coverage':0.0,'normalized_search_cost':0.0}); primary=str((analysis.get('primary') or {'name':'neural_grounding'})['name'])
        rows,stats=VerifiedNeuralCurriculumV1(self.root,seed=self.seed).build(families=families,rows_per_family=6,programs_per_family=2)
        model=NeuralProgramSynthesizerV2(hidden=hidden,latent_dim=hidden,max_len=40,max_b=64,layers=2,heads=4,family_count=64)
        supervised=NeuralProgramTrainerV3(model,seed=self.seed+1,lr=5e-4).fit(rows,epochs=epochs,batch_size=16,max_examples=len(rows),family_weight=0.10)
        # Freeze the post-supervised model before causal intervention so later gains
        # can be attributed to the credit-weighted update rather than mere training.
        frozen_model=deepcopy(model).eval()
        causal_assigner=NeuralCausalCreditAssignerV1(self.root,seed=self.seed+6)
        causal_train_rows=[]; causal_weights={}
        rewarder=VerifiableDenseRewardV1(self.root)
        from .program_acquisition_v2 import ProgramAcquisitionCoreV2
        from .task_spec_v1 import FAMILY_TO_ID
        causal_acq=ProgramAcquisitionCoreV2(self.root,seed=self.seed+120)
        row_cursor=0
        for family in families:
            family_rows=[r for r in rows if int(r[2]) == int(FAMILY_TO_ID.get(family,-1))][:2]
            try:
                _, causal_holdout, _ = causal_acq._examples(family,self.seed+200+int(FAMILY_TO_ID.get(family,0)))
            except Exception:
                causal_holdout=[]
            if not family_rows or not causal_holdout:
                continue
            for text, code, fid in family_rows:
                def reward_fn(candidate, _rows=causal_holdout):
                    return float(rewarder.score(list(candidate), _rows).reward)
                credit_report=causal_assigner.program_position_credit(code,reward_fn)
                credit_list=[float(credit_report.credits.get(i,0.0)) for i in range(len(code))]
                causal_train_rows.append((text,code,fid))
                causal_weights[row_cursor]=credit_list
                row_cursor += 1
        causal_trainer=NeuralCausalCreditTrainerV1(self.root,seed=self.seed+7)
        causal_train=causal_trainer.fit(model,causal_train_rows,causal_weights,epochs=max(1,min(2,epochs)),lr=3e-4,batch_size=4) if causal_train_rows else None
        forge=AdaptiveEnvironmentForgeV2(self.root,seed=self.seed+4); reports=[forge.forge_targeted(f,bottleneck_score=.9,uncertainty=.8,count=8) for f in families]; parts={'train':sum(r.train for r in reports),'holdout':sum(r.holdout for r in reports),'ood':sum(r.ood for r in reports)}
        forged_records=[]
        for f in families:
            for part, rows_part in forge.partitions(f).items():
                for i,row in enumerate(rows_part):
                    forged_records.append({'key':f'{f}:{part}:{i}:{row["expected"]}','family':f,'partition':part,'verified':True,'status':'validated','reward':float(row.get('difficulty',0.0)),'confidence':1.0})
        replay_controller=ContinualLearningControllerV1(self.root,seed=self.seed+5); replay_controller.build_partitions(forged_records)
        anchors={r['key'] for r in forged_records if r['partition'] in {'holdout','ood'}}
        replay_selected=len(replay_controller.select_replay(forged_records,current_family=families[0] if families else '',anchor_keys=anchors,max_items=min(8,len(forged_records)))) if forged_records else 0
        env=VerifiableEnvironmentForgeV1(self.root,seed=self.seed+4).forge_many(families,count=8,candidates=6,population=80)
        extra={f:[(row['tape'],row['expected']) for row in env['families'][f]['rows']] for f in env['families']}
        trainer=ExecutionPreferenceTrainerV1(self.root,model,seed=self.seed+2); pref=trainer.fit(families,epochs=preference_epochs,pairs_per_family=4,lr=1e-4,seed=self.seed+3,extra_rows_by_family=extra)
        delta=float(pref.holdout_after-pref.holdout_before); promoted=delta>=0.05
        causal=NeuralCausalityBenchmarkV1(self.root,self.seed+10).compare({'verified_rate':pref.holdout_before},{'verified_rate':pref.holdout_after},{'verified_rate':pref.holdout_before})
        causal_eval=None
        if causal_train_rows:
            eval_rows=causal_train_rows[:min(2,len(causal_train_rows))]
            def decision_fn(candidate):
                signature=[]
                for text,code,fid in eval_rows:
                    with torch.no_grad():
                        out=candidate.forward_teacher(text,code,int(fid))
                        signature.extend(torch.argmax(out['op'],dim=-1).reshape(-1).tolist()[:min(8,candidate.max_len)])
                return tuple(signature)
            def score_fn(candidate):
                scores=[]
                for family in families[:min(2,len(families))]:
                    fid=int(FAMILY_TO_ID.get(family,0))
                    try:
                        _, hold, _ = causal_acq._examples(family,self.seed+300+fid)
                        text=family.replace('_',' ')
                        code=candidate.generate_constrained(text,fid,max_len=min(16,candidate.max_len))
                        scores.append(rewarder.score(code,hold).reward)
                    except Exception:
                        scores.append(0.0)
                return float(sum(scores)/max(1,len(scores)))
            causal_eval=NeuralCausalityBenchmarkV2(self.root,self.seed+11).evaluate_models(neural=model,frozen=frozen_model,decision_fn=decision_fn,score_fn=score_fn,ablation_groups=('op_head',))
        causal_holdout_gain=float(max(0.0,causal_eval.neural_vs_frozen_gain)) if causal_eval else 0.0
        causal_verified_holdout_gain=0.0
        if causal_train_rows:
            def verified_rate(candidate):
                rates=[]
                for family in families[:min(2,len(families))]:
                    fid=int(FAMILY_TO_ID.get(family,0))
                    try:
                        _, hold, _ = causal_acq._examples(family,self.seed+300+fid)
                        text=family.replace('_',' ')
                        code=candidate.generate_constrained(text,fid,max_len=min(16,candidate.max_len))
                        rates.append(float(rewarder.score(code,hold).pass_rate))
                    except Exception:
                        rates.append(0.0)
                return float(sum(rates)/max(1,len(rates)))
            causal_verified_holdout_gain=max(0.0,verified_rate(model)-verified_rate(frozen_model))
        milestone=NeuralCausalityBenchmarkV2(self.root,self.seed+11).milestone(causal=bool(causal_eval and causal_eval.causal),holdout_gain=causal_holdout_gain,verified_holdout_gain=causal_verified_holdout_gain,unseen_gain=0.0,efficiency_gain=0.0,autonomous_cycles=0,rollback_ok=False)
        if causal_eval:
            CausalSelfModelV1(self.root).record(bottleneck=primary,intervention='causal_credit_training',target='verified_holdout_reward',baseline=causal_eval.frozen_score,outcome=causal_eval.neural_score,cycle_id=f'{self.VERSION}:{self.seed}',evidence=causal_eval.to_dict())
        exp=LearningExperimentProtocolV1(self.root); dsfp=hashlib.sha256(json.dumps(parts,sort_keys=True).encode()).hexdigest()[:24]; req=exp.make_request(bottleneck=primary,hypothesis='execution preference improves held-out verified coverage',intervention='execution_preference_learning',seed=self.seed,baseline_hash=hashlib.sha256(str(pref.holdout_before).encode()).hexdigest()[:24],dataset_fingerprint=dsfp)
        ckpt=''; reason='promotion_gate_passed' if promoted else 'no_verified_generalization_gain';
        if promoted:
            path=self.root/'runtime'/'nomega_neural_execution_learning_promoted_v1.pt'; NeuralProgramTrainerV3.save(path,model,supervised); ckpt=str(path)
        mean_h=sum(r.mean_difficulty for r in reports)/max(1,len(reports)); total_env=sum(r.accepted for r in reports)
        out=self.root/'runtime'/'neural_execution_learning_lab_v2.json'; out.parent.mkdir(parents=True,exist_ok=True)
        report=LearningLabReportV1(self.VERSION,len(families),len(rows),supervised.loss,pref.pairs,pref.holdout_before,pref.holdout_after,delta,promoted,reason,time.perf_counter()-t,ckpt,total_env,mean_h,req.id,primary,parts,milestone,float(causal.delta.get('verified_rate',0)),{'descendant_yield':0.0}, {'accepted':promoted,'reason':reason}, replay_selected, float(causal_eval.decision_change_rate) if causal_eval else 0.0, dict(causal_eval.ablation_effects) if causal_eval else {}, float(causal_train.weighted_loss) if causal_train else 0.0, float(causal_train.positive_credit_mass) if causal_train else 0.0, float(causal_train.negative_credit_mass) if causal_train else 0.0, float(causal_eval.neural_vs_frozen_gain) if causal_eval else 0.0, max([abs(float(v)) for v in (causal_eval.ablation_effects.values() if causal_eval else [])] or [0.0]), float(causal_verified_holdout_gain))
        out.write_text(json.dumps(report.to_dict(),indent=2))
        return report
