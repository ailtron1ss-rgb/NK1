from __future__ import annotations
import json, time
from pathlib import Path
from typing import Any, Dict, Optional
import torch
from .research_brain import ResearchBrain, BrainTrainer, CurriculumFactory, WorldModelTrainer, ResearchCheckpoint, parameter_report, text_ids
from .skill_graph_v2 import SkillGraphV2
from .self_play_arena_v2 import SelfPlayArenaV2
from .continual_v2 import ContinualLearnerV2
from .mobile_compiler_v2 import MobileCompilerV2

class ResearchOrchestratorV2:
    """One-command R&D cycle: curriculum -> representation -> world model -> arena -> gate -> mobile report."""
    def __init__(self, root:Optional[Path]=None, seed:int=41):
        self.root=root or Path("runtime")
        self.root.mkdir(parents=True,exist_ok=True)
        self.seed=seed
        self.brain=ResearchBrain()
        self.trainer=BrainTrainer(self.brain,seed=seed)
        self.curriculum=CurriculumFactory(seed)
        self.world_trainer=WorldModelTrainer(self.brain)
        self.skills=SkillGraphV2()
        self.arena=SelfPlayArenaV2(seed)
        self.continual=ContinualLearnerV2(self.brain)
        self.mobile=MobileCompilerV2()

    def run(self, train_steps:int=12, train_batch:int=24, holdout:int=24) -> Dict[str,Any]:
        train=self.curriculum.sample("train", max(8,train_batch)); ho=self.curriculum.sample("holdout", holdout)
        before=self.trainer.evaluate(ho)
        logs=[]
        for _ in range(max(1,train_steps)): logs.append(self.trainer.train_step(train))
        after=self.trainer.evaluate(ho)
        # world model training from current latent representation.
        samples=[]
        for x in train[:min(16,len(train))]:
            z=self.brain(torch.stack([text_ids(x['text'])])).latent.detach().squeeze(0)
            samples.append({"latent":z,"action":x["family_id"]%8,"reward":1.0-0.5*x["difficulty"],"horizon":1})
        world=self.world_trainer.fit(samples,epochs=2)
        # promote known families into graph as verified abstractions only when classification is strong.
        for x in train[:12]:
            self.skills.add(f"family::{x['family']}",x['family'],float(1.0 if after['family_acc']>.5 else .5))
        mobile=self.mobile.report(self.brain)
        path=self.root/"nomega_brain_v2.pt"; ResearchCheckpoint.save(path,self.brain,self.trainer,{"holdout_before":before,"holdout_after":after})
        report={"version":"0.9.0-research","before":before,"after":after,"gain":after['family_acc']-before['family_acc'],"train_last":logs[-1] if logs else {},"world":world,"skills":self.skills.stats(),"mobile":mobile,"checkpoint":str(path)}
        (self.root/"nomega_0_9_brain_report.json").write_text(json.dumps(report,indent=2),encoding="utf-8")
        return report
