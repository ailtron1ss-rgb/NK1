from __future__ import annotations
from pathlib import Path
from typing import Any, Dict, Optional, Sequence
import json, time
from .neural_program_acquisition_v1 import NeuralProgramAcquisitionV1
from .program_generalization_v1 import ProgramGeneralizationV1
from .program_acquisition_v2 import ProgramAcquisitionCoreV2

class OmegaDevelopmentCycleV8:
    """Unified 1.8 cycle: learn program generator -> execute -> repair -> skill induction -> multi-seed gate."""
    def __init__(self, root: Path, seed: int=1800): self.root=Path(root); self.seed=seed
    def run(self, families:Optional[Sequence[str]]=None, epochs:int=8, candidates_per_family:int=2, max_train_examples:int=64)->Dict[str,Any]:
        t=time.perf_counter()
        brain=NeuralProgramAcquisitionV1(self.root,self.seed+1)
        neural=brain.acquire(families,train_epochs=epochs,candidates_per_family=candidates_per_family,max_train_examples=max_train_examples)
        fams=list(families or ProgramAcquisitionCoreV2.FAMILIES)
        gen=ProgramGeneralizationV1(self.root,seeds=(self.seed+21,self.seed+22,self.seed+23),max_candidates=8).run(fams)
        promote=neural['coverage']>=0.70 and neural['replay_stats']['counterexamples']>=0 and gen['min_coverage']>=0.90
        out={'version':'1.8.0','elapsed_s':time.perf_counter()-t,'neural_program_acquisition':neural,'multi_seed':gen,'promotion':{'promote':promote,'reason':'requires >=70% neural execution-verified family coverage and >=90% bounded multi-seed template coverage'},'candidate_checkpoint':neural['checkpoint']}
        p=self.root/'runtime'/'nomega_1_8_cycle.json'; p.parent.mkdir(parents=True,exist_ok=True); p.write_text(json.dumps(out,indent=2,ensure_ascii=False,default=str)); return out
