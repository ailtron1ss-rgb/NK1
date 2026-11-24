from __future__ import annotations
"""Causal component benchmark for gradient-aligned replay selection."""
from pathlib import Path
from typing import Any, Dict, Sequence
import copy, json, time
import torch
import torch.nn.functional as F

from .gradient_alignment_replay_v1 import GradientAlignmentReplayV1
from .neural_program_synth_v2 import NeuralProgramSynthesizerV2, NeuralProgramTrainerV2


class GradientAlignmentAblationV1:
    VERSION='1.10.0'
    def __init__(self, root: Path):
        self.root=Path(root)
        self.aligner=GradientAlignmentReplayV1(self.root)

    @staticmethod
    def loss(model, row):
        return -model.score_program(row[0],row[1],row[2])

    @staticmethod
    def one_update(model, row, lr=.01):
        model.train(); opt=torch.optim.SGD(model.parameters(),lr=lr)
        out=model.forward_teacher(row[0],row[1],row[2])
        lo=F.cross_entropy(out['op'].reshape(-1,out['op'].size(-1)),out['op_y'])
        la=F.cross_entropy(out['a'].reshape(-1,out['a'].size(-1)),out['a_y'])
        lb=F.cross_entropy(out['b'].reshape(-1,out['b'].size(-1)),out['b_y'])
        loss=lo+.5*la+.5*lb
        opt.zero_grad(set_to_none=True); loss.backward(); opt.step()

    def run_fixed(self, seeds=(3101,3102,3103), steps=3):
        rows=[]
        for seed in seeds:
            torch.manual_seed(seed)
            model=NeuralProgramSynthesizerV2(hidden=12,latent_dim=12,max_len=8,max_b=16,layers=1,heads=2)
            trainer=NeuralProgramTrainerV2(model,seed=seed)
            target=('task=sum3 ops=ADD>ADD refs=x0,x1,x2',[(1,0,1),(1,0,2),(14,0,0)],0)
            candidate_good=('task=sum3 ops=ADD>ADD refs=x0,x1,x2',[(1,0,1),(1,1,2),(14,0,0)],0)
            candidate_conflict=('task=xor3 ops=XOR>ADD refs=x0,x1,x2',[(3,0,1),(1,0,2),(14,0,0)],1)
            trainer.fit([target],epochs=steps,max_examples=1)
            candidates=[candidate_good,candidate_conflict]
            before=float(self.loss(model,target))
            selected=self.aligner.rank(model,[target],candidates,limit=1)[0]
            clone=copy.deepcopy(model)
            self.one_update(clone,selected,lr=.01)
            after_selected=float(self.loss(clone,target))
            clone2=copy.deepcopy(model)
            self.one_update(clone2,candidate_conflict if selected is candidate_good else candidate_good,lr=.01)
            after_other=float(self.loss(clone2,target))
            rows.append({'seed':seed,'before_loss':before,'selected_family':selected[0].split()[0], 'after_selected_loss':after_selected,'after_other_loss':after_other,'causal_gain':after_other-after_selected})
        mean=sum(r['causal_gain'] for r in rows)/max(1,len(rows))
        out={'version':self.VERSION,'seeds':list(seeds),'rows':rows,'mean_causal_gain':mean,'positive_seed_count':sum(r['causal_gain']>0 for r in rows),'promotion': 'research-only' if mean<=0 else 'component-only-positive'}
        path=self.root/'runtime'/'nomega_gradient_alignment_ablation_v1.json'; path.parent.mkdir(parents=True,exist_ok=True); path.write_text(json.dumps(out,ensure_ascii=False,indent=2),encoding='utf-8')
        return out
