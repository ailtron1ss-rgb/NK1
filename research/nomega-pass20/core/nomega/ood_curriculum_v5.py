from __future__ import annotations
from dataclasses import dataclass
from typing import List, Sequence, Tuple
import random

@dataclass(frozen=True)
class OODTask:
    text: str
    family: str
    expected: float
    difficulty: int
    split: str
    compositional: bool=True
    relation: str='arithmetic'

_BASE=[
 ('sum_then_mod', lambda a,b,c: float((a+b+c)%7)),
 ('product_then_clamp', lambda a,b,c: float(max(-5,min(5,a*b-c)))),
 ('abs_diff_plus_min', lambda a,b,c: float(abs(a-b)+min(a,b))),
 ('nested_mix', lambda a,b,c: float(((a+b)*(c-a))%11)),
 ('parity_chain', lambda a,b,c: float(((a+b)&1) ^ ((b+c)&1))),
 ('dot_then_offset', lambda a,b,c: float(a*b + b*c - a)),
 ('minmax_chain', lambda a,b,c: float(max(min(a,b),c)-min(a,max(b,c)))),
 ('invariant_mix', lambda a,b,c: float((a+b+c)-min(a,b,c)-max(a,b,c))),
]

_TEMPLATES=[
 'Compute {f} for a={a}, b={b}, c={c}.',
 'Given a={a}, b={b}, c={c}, first apply the relevant operations and return the final scalar.',
 'Evaluate the chained transformation on the triple ({a},{b},{c}) using rule {f}.',
 'A hidden calculator applies rule {f} to {a}, {b}, {c}. What scalar remains?',
]

def make_tasks_v5(seed:int=41, per_family:int=8)->List[OODTask]:
    rng=random.Random(seed); rows=[]
    for fi,(family,fn) in enumerate(_BASE):
        for i in range(per_family):
            a,b,c=[rng.randint(-5,7) for _ in range(3)]
            split='train' if i < per_family//2 else ('holdout' if i < per_family-1 else 'adversarial')
            tpl=_TEMPLATES[(i+fi)%len(_TEMPLATES)]
            text=tpl.format(f=family,a=a,b=b,c=c)
            if split=='adversarial':
                text=text.replace('Compute','Work out').replace('Given','Starting with').replace('Evaluate','Determine').replace('hidden calculator','unknown operator')
            rows.append(OODTask(text,family,fn(a,b,c),2+fi%4,split,True,'compositional'))
    return rows

def split_v5(rows:Sequence[OODTask])->Tuple[List[OODTask],List[OODTask],List[OODTask]]:
    return [r for r in rows if r.split=='train'],[r for r in rows if r.split=='holdout'],[r for r in rows if r.split=='adversarial']
