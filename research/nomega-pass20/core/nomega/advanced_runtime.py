from __future__ import annotations
from typing import Any, Dict, Optional
import torch
from .research_brain import ResearchBrain, text_ids
from .mobile_compiler_v2 import MobileCompilerV2

class AdvancedRuntimeGate:
    """Safe adapter: uses the trained research brain only when explicitly armed."""
    def __init__(self, brain: Optional[ResearchBrain]=None):
        self.brain=brain or ResearchBrain()
        self.armed=False
        self.mobile=MobileCompilerV2()
    def arm(self, checkpoint=None):
        if checkpoint is not None:
            blob=torch.load(checkpoint,map_location='cpu',weights_only=False)
            state=blob['model']
            token_weight=state.get('token.weight')
            family_weight=state.get('family_head.weight')
            if token_weight is not None and family_weight is not None:
                hidden=int(token_weight.shape[1])
                latent=int(family_weight.shape[1])
                vocab=int(token_weight.shape[0])
                self.brain=ResearchBrain(latent_dim=latent, hidden=hidden, vocab=vocab)
            self.brain.load_state_dict(state,strict=True)
        self.brain.eval(); self.armed=True
    @torch.no_grad()
    def assess(self, text:str, family_hint:Optional[str]=None)->Dict[str,Any]:
        if not self.armed:
            return {"armed":False}
        out=self.brain(torch.stack([text_ids(text)]))
        probs=torch.softmax(out.family_logits,-1)[0]
        pred=int(probs.argmax())
        return {"armed":True,"predicted_family":pred,"family_confidence":float(probs.max()),"value":float(out.value[0]),"novelty":float(out.novelty[0]),"uncertainty":float(out.uncertainty[0])}
