from __future__ import annotations

"""Causal, evidence-oriented developmental bottleneck analysis."""

from pathlib import Path
from typing import Any, Dict, Sequence
import json, time

class DevelopmentalBottleneckDetectorV1:
    VERSION='1.9.9'
    def __init__(self, root: Path):
        self.root=Path(root); self.path=self.root/'runtime'/'nomega_bottleneck_history_v1.json'; self.state=self._load()

    def _load(self):
        default={'version':self.VERSION,'cycles':[],'events':[]}
        if not self.path.exists():return default
        try:
            blob=json.loads(self.path.read_text(encoding='utf-8'))
            if not isinstance(blob,dict):return default
            for k,v in default.items():blob.setdefault(k,v)
            blob['version']=self.VERSION; return blob
        except Exception:return default

    def observe(self, metrics: Dict[str,Any], cycle_id: str) -> Dict[str,Any]:
        row={'cycle_id':str(cycle_id),'ts':time.time(),'metrics':metrics}
        self.state['cycles'].append(row); self.state['cycles']=self.state['cycles'][-512:]
        analysis=self.analyze(metrics)
        self.state['events'].append({'kind':'observe','cycle_id':cycle_id,'analysis':analysis}); self.state['events']=self.state['events'][-512:]
        self._save(); return analysis

    def analyze(self, metrics: Dict[str,Any]) -> Dict[str,Any]:
        def f(name,default=0.0):
            try:return float(metrics.get(name,default))
            except Exception:return default
        bottlenecks=[]
        neural_gap=max(0.0,1.0-f('raw_neural_verified_rate'))
        repair_gap=max(0.0,1.0-f('repair_verified_rate'))
        ood_gap=max(0.0,1.0-f('ood_coverage'))
        retention=max(0.0,abs(f('restart_delta')))
        search_cost=max(0.0,min(1.0,f('normalized_search_cost')))
        memory_neg=max(0.0,-f('transfer_delta'))
        mobile=max(0.0,f('mobile_budget_overrun'))
        replay_risk=max(0.0,min(1.0,f('replay_interference_risk')))
        transfer_gap=0.0 if 'transfer_generalization' not in metrics else max(0.0,min(1.0,1.0-f('transfer_generalization')))
        generalist_gap=0.0 if 'generalist_unseen_family_future_gain' not in metrics else max(0.0,min(1.0,-f('generalist_unseen_family_future_gain')))
        for name,score,action in [
            ('neural_grounding',neural_gap,'increase_execution-guided_neural_training'),
            ('repair_effectiveness',repair_gap,'improve_operator_portfolio'),
            ('ood_generalization',ood_gap,'expand_paraphrase_and_holdout_families'),
            ('restart_continuity',min(1.0,retention*10),'repair_checkpoint_lineage'),
            ('search_efficiency',search_cost,'learn_candidate_priority_under_equal_budget'),
            ('negative_transfer',min(1.0,memory_neg*5),'quarantine_bad_memories_and_preserve_anchors'),
            ('mobile_efficiency',min(1.0,mobile),'lower_compute_or_quantize_runtime'),
            ('replay_interference',replay_risk,'activate_transfer_selective_replay_and_quarantine'),
            ('causal_self_model',(max(0.0,1.0-f('causal_effect_confidence')) if 'causal_effect_confidence' in metrics else 0.0),'increase_intervention_ablation_and_causal_lineage'),
            ('capability_transfer',transfer_gap,'cross_family_repair_operator_transfer'),
            ('generalist_capability_transfer',generalist_gap,'learn_multi_source_generalist_operator_policy'),
            ('model_time_replay',(max(0.0,-f('model_time_replay_gain')) if 'model_time_replay_gain' in metrics else 0.0),'tune_model_evolution_trigger_and_replay_composition'),
        ]:
            bottlenecks.append({'name':name,'score':round(float(score),6),'action':action})
        bottlenecks.sort(key=lambda x:(-x['score'],x['name']))
        return {'version':self.VERSION,'primary':bottlenecks[0] if bottlenecks else None,'bottlenecks':bottlenecks,'confidence':'measured_inputs_only'}

    def recommend(self, metrics: Dict[str,Any], max_items:int=4)->List[Dict[str,Any]]:
        return self.analyze(metrics)['bottlenecks'][:max(1,int(max_items))]

    def snapshot(self):return json.loads(json.dumps(self.state))
    def _save(self):
        self.path.parent.mkdir(parents=True,exist_ok=True); self.path.write_text(json.dumps(self.state,ensure_ascii=False,indent=2),encoding='utf-8')
