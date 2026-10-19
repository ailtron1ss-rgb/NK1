from __future__ import annotations

"""Reproducible component ablation for semantic transfer-selective replay."""

from pathlib import Path
from typing import Any, Dict, List
import json

from .adaptive_experience_memory_v3 import AdaptiveExperienceMemoryV3
from .replay_scheduler_v1 import TransferAwareReplaySchedulerV1


class TransferSelectiveReplayAblationV1:
    VERSION = '1.9.9'

    def __init__(self, root: Path):
        self.root=Path(root)

    def run(self) -> Dict[str, Any]:
        m=AdaptiveExperienceMemoryV3(self.root / 'memory')
        # Fixed, disjoint source pool. Targets are evaluated by semantic compatibility,
        # while identical records are presented to both policies.
        sources=[
            ('sum3', .95), ('program_sum', .90), ('compose_sum_xor', .88),
            ('xor3', .92), ('mul2', .94), ('clamp_sum', .86),
        ]
        for fam, reward in sources:
            m.store_verified(family=fam,text=fam,code=[(1,0,0),(14,0,0)],reward=reward,source='ablation',cycle_id='fixed',status='validated',confidence=.9)
        for _ in range(4):
            m.observe_transfer('xor3','sum3',-0.5,cycle_id='fixed-negative')
        records=m.state['records']
        static=TransferAwareReplaySchedulerV1(self.root / 'static')
        target='sum3'
        static_out=static.rank(records,current_family=target,families=[x[0] for x in sources],anchor_families=('sum3',),max_items=4,transfer_state=m.state['transfer'],per_family_cap=2)
        selective=m.transfer_selective.rank(records,target_family=target,max_items=4,anchor_families=('sum3',),per_family_cap=2,transfer_state=m.state['transfer'])
        static_keys=[x.key for x in static_out]; selective_keys=[x.key for x in selective]
        static_comp={x.key:x.score for x in static_out}
        selective_comp={x.key:x.score for x in selective}
        # Ground truth for this component benchmark is semantic family compatibility,
        # not neural success: sum3/program_sum are exact arithmetic-addition analogues.
        preferred_families={'sum3','program_sum','compose_sum_xor'}
        index={r['key']:r for r in records}
        static_preferred=sum(1 for k in static_keys if index[k]['family'] in preferred_families)
        selective_preferred=sum(1 for k in selective_keys if index[k]['family'] in preferred_families)
        out={
            'version':self.VERSION,'target_family':target,'candidate_pool_size':len(records),
            'static':{'keys':static_keys,'preferred_count':static_preferred,'scores':static_comp},
            'selective':{'keys':selective_keys,'preferred_count':selective_preferred,'scores':selective_comp},
            'negative_guard_present': all(index[k]['family'] != 'xor3' for k in selective_keys),
            'component_gain': (selective_preferred-static_preferred)/4.0,
            'interpretation':'component-selection only; no downstream neural gain claim',
        }
        p=self.root/'runtime'/'nomega_transfer_selective_ablation_v1.json'; p.parent.mkdir(parents=True,exist_ok=True); p.write_text(json.dumps(out,ensure_ascii=False,indent=2),encoding='utf-8')
        return out
