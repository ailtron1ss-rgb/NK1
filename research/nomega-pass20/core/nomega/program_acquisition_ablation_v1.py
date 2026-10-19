from __future__ import annotations
from pathlib import Path
from typing import Any, Dict, Sequence
import time
from .program_acquisition_v2 import ProgramAcquisitionCoreV2
from .neural_program_acquisition_v1 import NeuralProgramAcquisitionV1

class ProgramAcquisitionAblationV1:
    """Small controlled comparison: template/mutation baseline vs learned neural proposals vs repair-enabled loop."""
    def __init__(self, root: Path, seed: int=1888): self.root=Path(root); self.seed=seed

    def _baseline(self, families: Sequence[str]) -> Dict[str,Any]:
        acq=ProgramAcquisitionCoreV2(self.root,self.seed)
        rep=acq.acquire(families,seed=self.seed+10,max_candidates=8)
        return {'coverage':rep['coverage'],'verified':rep['verified_families'],'families':len(families)}

    def run(self, families: Sequence[str]=('sum3','xor3','mul2','minmax3','clamp_sum','sequence_inc'))->Dict[str,Any]:
        t=time.perf_counter(); fams=list(families)
        base=self._baseline(fams)
        neural=NeuralProgramAcquisitionV1(self.root,self.seed+1)
        train=neural.train_from_bank(epochs=4,max_examples=48)
        gen=neural.acquire(fams,train_epochs=0,candidates_per_family=1,max_train_examples=48,bootstrap_rounds=1)
        out={'version':'1.8.0','families':fams,'baseline':base,'neural':{'coverage':gen['coverage'],'verified':gen['verified_families'],'novel_structures':gen['novel_structures']},'repair':{'counterexamples':gen['replay_stats']['counterexamples'],'repaired':gen['repaired_candidates']},'elapsed_s':time.perf_counter()-t}
        return out
