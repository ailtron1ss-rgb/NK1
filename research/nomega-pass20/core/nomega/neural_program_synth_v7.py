from __future__ import annotations
from typing import Optional
import torch
from .neural_program_synth_v2 import NeuralProgramSynthesizerV2, Program
from .neural_text_encoder_v1 import OrderedSubwordTextEncoderV1
from .task_spec_v1 import FAMILY_ORDER


class NeuralProgramSynthesizerV7(NeuralProgramSynthesizerV2):
    """Order-aware raw-language neural grounding decoder.

    Same causal program decoder and parameter budget class as V2, but replaces the
    mean-pooled hash encoder with a learned ordered subword encoder. No TaskSpec or
    executor is injected into inference.
    """
    version='ordered-subword-grounding-v7'

    def __init__(self, vocab:int=2048, hidden:int=64, latent_dim:int=64, max_len:int=48,
                 max_b:int=64, layers:int=2, heads:int=4, family_count:int=len(FAMILY_ORDER)):
        super().__init__(vocab=vocab,hidden=hidden,latent_dim=latent_dim,max_len=max_len,max_b=max_b,
                         layers=layers,heads=heads,family_count=family_count)
        self.ordered_text=OrderedSubwordTextEncoderV1(hidden=hidden,vocab=vocab,max_tokens=24,
                                                       char_buckets=1024,layers=1,heads=max(1,min(heads,4)))
        # Keep legacy text embedding for backward-compatible checkpoints but do not use it.

    def encode_text_batch(self, texts):
        return self.ordered_text(list(texts))

    def _condition_with_family(self,text:str,family_id:Optional[int]=0,latent:Optional[torch.Tensor]=None):
        base=self.encode_text_batch([text])
        family_logits=self.family_head(base)
        if family_id is None:
            weights=torch.softmax(family_logits,dim=-1)
            fam_vec=weights @ self.family.weight
        else:
            fid=int(family_id)%self.family_count
            fam_vec=self.family(torch.tensor([fid],device=base.device))
        z=base+fam_vec
        if latent is not None:
            if latent.dim()==1: latent=latent.unsqueeze(0)
            z=z+self.latent_proj(latent.float().to(z.device))
        return z.unsqueeze(1),family_logits
