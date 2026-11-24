from __future__ import annotations
from dataclasses import dataclass, asdict
import random, re, hashlib
from typing import Any, Dict, List, Tuple

@dataclass(frozen=True)
class TaskV3:
    task_id: str
    family: str
    text: str
    context: Dict[str, Any]
    expected: Any = None
    difficulty: float = 0.0
    split: str = 'train'
    compositional: bool = False
    adversarial: bool = False
    tags: Tuple[str, ...] = ()

    def to_dict(self):
        d = asdict(self); d['tags'] = list(self.tags); return d

BASE_OPS = ('sum','xor','and','or','sub','mul','min','max')
COMPOSED = ('sum_then_clamp','xor_then_parity','diff_then_offset','dot_then_mod','minmax_mix','nested_arithmetic')
WORD_SHAPES = {
    'sum': ('add','sum','combine','total'),
    'xor': ('xor','exclusive-or','bitwise xor'),
    'min': ('minimum','smallest','lower value'),
    'max': ('maximum','largest','higher value'),
}

def _hash_seed(seed:int, text:str) -> int:
    return int(hashlib.blake2b(f'{seed}:{text}'.encode(),digest_size=8).hexdigest(),16) & 0x7fffffff

def _calc(op,a,b):
    return {'sum':a+b,'xor':a^b,'and':a&b,'or':a|b,'sub':a-b,'mul':a*b,'min':min(a,b),'max':max(a,b)}[op]

def make_tasks_v3(seed:int=101, train_per_family:int=8, holdout_per_family:int=4, adversarial_per_family:int=2) -> List[TaskV3]:
    rng = random.Random(seed); rows: List[TaskV3]=[]
    families = list(BASE_OPS)+list(COMPOSED)
    for fam in families:
        total = train_per_family + holdout_per_family + adversarial_per_family
        for i in range(total):
            split = 'train' if i < train_per_family else ('holdout' if i < train_per_family+holdout_per_family else 'adversarial')
            a,b,c = [rng.randrange(-64,256) for _ in range(3)]
            if fam in BASE_OPS:
                op=fam
                phr = WORD_SHAPES.get(op,(op,))[i % len(WORD_SHAPES.get(op,(op,)))]
                text = f'{phr} two integers without assuming the wording is canonical'
                ctx={'a':a,'b':b,'op':op}
                exp=_calc(op,a,b)
                d=1.0 + (0.7 if split!='train' else 0) + (0.4 if op in {'mul','xor','and','or'} else 0)
                tags=('base',op)
                comp=False
            elif fam=='sum_then_clamp':
                lo,hi=sorted((rng.randrange(0,64),rng.randrange(160,256)))
                exp=min(max(a+b,lo),hi); text=f'add two values then clamp the result between {lo} and {hi}'
                ctx={'a':a,'b':b,'lo':lo,'hi':hi,'op':fam}; d=2.3; tags=('composite','arithmetic','clamp'); comp=True
            elif fam=='xor_then_parity':
                x=a^b; exp=x.bit_count()&1; text='xor two integers and return the parity of the resulting bits'; ctx={'a':a,'b':b,'op':fam}; d=2.6; tags=('composite','bit','parity'); comp=True
            elif fam=='diff_then_offset':
                k=rng.randrange(-20,21); exp=(b-a)+k; text=f'find the difference from the first value to the second, then add offset {k}'; ctx={'a':a,'b':b,'k':k,'op':fam}; d=2.2; tags=('composite','difference'); comp=True
            elif fam=='dot_then_mod':
                dval=rng.randrange(-64,64); mod=rng.randrange(3,17); exp=(a*b+c*dval)%mod; text=f'compute a two-pair dot product and reduce it modulo {mod}'; ctx={'a':a,'b':b,'c':c,'d':dval,'mod':mod,'op':fam}; d=2.8; tags=('composite','dot','mod'); comp=True
            elif fam=='minmax_mix':
                exp=max(min(a,b),min(b,c)); text='take the minimum of the first two and of the last two, then take the larger minimum'; ctx={'a':a,'b':b,'c':c,'op':fam}; d=2.4; tags=('composite','minmax'); comp=True
            else:
                k=rng.randrange(-7,8); exp=((a-b)*c)+k; text=f'compute (first minus second) times third and add {k}'; ctx={'a':a,'b':b,'c':c,'k':k,'op':fam}; d=3.0; tags=('nested','arithmetic'); comp=True
            if split=='adversarial':
                text = _adversarial_rephrase(text, rng)
            rows.append(TaskV3(f'v3:{fam}:{split}:{i}',fam,text,ctx,exp,d,split,comp,split=='adversarial',tuple(tags)))
    return rows

def _adversarial_rephrase(text:str, rng:random.Random)->str:
    # Remove lexical anchors and shuffle innocuous phrasing while preserving semantics.
    pieces=[p for p in re.split(r'([,;])',text) if p]
    rng.shuffle(pieces)
    return ' '.join(pieces).replace('two integers','two signed numbers').replace('the','a')

def split_v3(tasks):
    return ([t for t in tasks if t.split=='train'], [t for t in tasks if t.split=='holdout'], [t for t in tasks if t.split=='adversarial'])
