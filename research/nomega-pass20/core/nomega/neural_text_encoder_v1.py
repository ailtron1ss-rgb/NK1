from __future__ import annotations
from typing import List, Tuple
import hashlib
import torch
import torch.nn as nn


def stable_bucket(text: str, buckets: int) -> int:
    return int(hashlib.blake2b(text.encode('utf-8'), digest_size=8).hexdigest(), 16) % buckets


class OrderedSubwordTextEncoderV1(nn.Module):
    """Small order-aware text encoder with deterministic word/character hashing.

    Unlike the legacy mean-hash encoder, this preserves word order through a
    Transformer and adds character n-gram features without relying on external data.
    """
    def __init__(self, hidden: int, vocab: int = 2048, max_tokens: int = 24,
                 char_buckets: int = 1024, layers: int = 1, heads: int = 4):
        super().__init__()
        self.hidden=hidden; self.vocab=vocab; self.max_tokens=max_tokens; self.char_buckets=char_buckets
        self.word=nn.Embedding(vocab,hidden,padding_idx=0)
        self.char=nn.Embedding(char_buckets,hidden,padding_idx=0)
        self.pos=nn.Embedding(max_tokens+1,hidden)
        self.cls=nn.Parameter(torch.zeros(1,1,hidden))
        layer=nn.TransformerEncoderLayer(d_model=hidden,nhead=heads,dim_feedforward=hidden*3,
                                         batch_first=True,activation='gelu')
        self.encoder=nn.TransformerEncoder(layer,num_layers=layers)
        self.norm=nn.LayerNorm(hidden)
        self.char_gate=nn.Sequential(nn.Linear(hidden*2,hidden),nn.GELU(),nn.Linear(hidden,hidden),nn.Sigmoid())

    def _char_ids(self, word: str, device: torch.device) -> torch.Tensor:
        text=f'<{word.lower()}>'
        grams=[]
        for n in (2,3,4,5):
            for i in range(max(0,len(text)-n+1)):
                grams.append(stable_bucket(text[i:i+n], self.char_buckets))
        if not grams:
            grams=[0]
        return torch.tensor(grams[:16],dtype=torch.long,device=device)

    def _tokenize(self, texts: List[str], device: torch.device) -> Tuple[torch.Tensor, torch.Tensor]:
        B=len(texts); T=self.max_tokens
        word_ids=torch.zeros(B,T,dtype=torch.long,device=device)
        char_feats=torch.zeros(B,T,self.hidden,dtype=torch.float32,device=device)
        mask=torch.ones(B,T,dtype=torch.bool,device=device)
        for b,text in enumerate(texts):
            words=str(text).lower().split()[:T]
            for i,w in enumerate(words):
                word_ids[b,i]=stable_bucket(w,self.vocab)
                cids=self._char_ids(w,device)
                char_feats[b,i]=self.char(cids).mean(0)
                mask[b,i]=False
        return word_ids,char_feats,mask

    def encode_sequence_batch(self, texts: List[str]) -> Tuple[torch.Tensor, torch.Tensor]:
        """Return ordered contextual token states and a valid-token mask.

        The returned sequence includes CLS at position 0, followed by up to
        ``max_tokens`` contextualized word states.  Padding positions are masked.
        This is intentionally exposed separately from ``forward`` so downstream
        components can operate on the full ordered signal instead of collapsing
        the input to CLS before recurrent processing.
        """
        device = next(self.parameters()).device
        word_ids, char_feats, mask = self._tokenize(list(texts), device)
        w = self.word(word_ids)
        gate = self.char_gate(torch.cat([w, char_feats], dim=-1))
        tok = w + gate * char_feats
        cls = self.cls.expand(len(texts), -1, -1)
        x = torch.cat([cls, tok], dim=1)
        pos = self.pos(torch.arange(x.size(1), device=device)).unsqueeze(0)
        full_mask = torch.cat(
            [torch.zeros(len(texts), 1, dtype=torch.bool, device=device), mask], dim=1
        )
        h = self.encoder(x + pos, src_key_padding_mask=full_mask)
        return self.norm(h), ~full_mask

    def forward(self, texts: List[str]) -> torch.Tensor:
        h, _ = self.encode_sequence_batch(texts)
        return h[:, 0]
