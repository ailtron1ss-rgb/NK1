from __future__ import annotations
from dataclasses import dataclass
@dataclass(frozen=True)
class Stage: name:str; delay:int; noise:float; shift:float
STAGES=(Stage('bootstrap',4,.0,0.),Stage('short_memory',16,.05,.1),Stage('interference',64,.15,.2),Stage('long_memory',256,.25,.35),Stage('adversarial_shift',1024,.4,.6))
def next_stage(index:int)->Stage: return STAGES[min(max(index,0),len(STAGES)-1)]
