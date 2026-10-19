from __future__ import annotations
from dataclasses import dataclass, asdict
import hashlib, random, re
from typing import Any, Dict, List, Tuple

@dataclass(frozen=True)
class TaskV4:
    task_id: str
    family: str
    text: str
    context: Dict[str, Any]
    expected: Any
    difficulty: float
    split: str
    compositional: bool = False
    adversarial: bool = False
    transformation: str = 'canonical'
    tags: Tuple[str, ...] = ()
    paired_id: str = ''
    def to_dict(self):
        d=asdict(self); d['tags']=list(self.tags); return d

FAMILIES = [
    'sum3','xor3','mul2','sub_offset','minmax3','parity_mix','clamp_sum',
    'dot2_mod','nested3','sequence_inc','sequence_diff','program_sum',
    'compose_sum_xor','compose_min_max','compose_affine','compose_mod_chain',
    'compose_clamp_offset','compose_nested_parity','inverse_sum','invariant_xor',
]

_WORD = {
    'sum3': ['add three values','total the three numbers','combine all three values'],
    'xor3': ['xor the three integers','apply xor across all three numbers','combine with exclusive-or'],
    'mul2': ['multiply the two values','take the product of the pair','multiply the inputs'],
    'sub_offset': ['subtract the first value from the second then add the offset','find the directed difference and shift it'],
    'minmax3': ['take the larger of the three pairwise minima','compare the lower pairs and keep the largest'],
}

def _stable(seed, text):
    return int(hashlib.blake2b(f'{seed}:{text}'.encode(),digest_size=8).hexdigest(),16)&0x7fffffff

def _calc(f,a,b,c,k,m,lo,hi):
    if f=='sum3': return a+b+c
    if f=='xor3': return a^b^c
    if f=='mul2': return a*b
    if f=='sub_offset': return b-a+k
    if f=='minmax3': return max(min(a,b),min(b,c))
    if f=='parity_mix': return ((a^b^c).bit_count()&1)
    if f=='clamp_sum': return min(max(a+b,lo),hi)
    if f=='dot2_mod': return (a*b+c*k)%m
    if f=='nested3': return (a-b)*c+k
    if f=='sequence_inc': return a+len(range(b))
    if f=='sequence_diff': return c-b
    if f=='program_sum': return a+b+c
    if f=='compose_sum_xor': return (a+b)^c
    if f=='compose_min_max': return max(min(a,b),c)
    if f=='compose_affine': return (a*k)+b+c
    if f=='compose_mod_chain': return ((a+b)%m)^c
    if f=='compose_clamp_offset': return min(max(a+b+k,lo),hi)
    if f=='compose_nested_parity': return (((a-b)*c+k).bit_count()&1)
    if f=='inverse_sum': return a+b
    if f=='invariant_xor': return (a^b)^a^b
    raise KeyError(f)

def _transform(text, rng, mode):
    if mode=='paraphrase':
        replacements=[('three values','three signed numbers'),('two values','the pair'),('numbers','quantities'),('then','and then')]
        for a,b in replacements: text=text.replace(a,b)
        return text
    if mode=='scramble':
        parts=[p for p in re.split(r'(\s+)',text) if p.strip()]
        rng.shuffle(parts); return ''.join(parts)
    if mode=='instruction':
        return 'Solve this computationally, verify the result, and return the exact value: '+text
    return text

def make_tasks_v4(seed=401, train_per=6, holdout_per=4, adversarial_per=2):
    rng=random.Random(seed); rows=[]
    for fam in FAMILIES:
        total=train_per+holdout_per+adversarial_per
        for i in range(total):
            split='train' if i<train_per else ('holdout' if i<train_per+holdout_per else 'adversarial')
            a,b,c=[rng.randrange(-48,129) for _ in range(3)]; k=rng.randrange(-9,10); m=rng.randrange(3,19); lo,hi=sorted((rng.randrange(-10,40),rng.randrange(50,180)))
            if fam in _WORD:
                text=_WORD[fam][i%len(_WORD[fam])]
            else:
                text={
                    'parity_mix':'compute the parity of xor across three integers',
                    'clamp_sum':f'add the first two values and clamp the result to [{lo},{hi}]',
                    'dot2_mod':f'compute a two-pair dot product modulo {m}',
                    'nested3':f'compute (first minus second) times third plus {k}',
                    'sequence_inc':'start at the first value and advance once for each of the next count entries',
                    'sequence_diff':'return the difference between the third and second value',
                    'program_sum':'write a program that returns the sum of three inputs',
                    'compose_sum_xor':'add the first two values, then xor with the third',
                    'compose_min_max':'take min(first,second), then max with the third',
                    'compose_affine':f'multiply the first value by {k}, then add the other two',
                    'compose_mod_chain':f'add the first two, reduce modulo {m}, then xor with the third',
                    'compose_clamp_offset':f'add the first two plus offset {k}, then clamp to [{lo},{hi}]',
                    'compose_nested_parity':f'take parity of ((first-second)*third+{k})',
                    'inverse_sum':'recover the total represented by two additive components',
                    'invariant_xor':'apply xor cancellation to the same two values and return the invariant',
                    'minmax3':'find the larger of the pairwise minima for three integers',
                    'xor3':'apply xor to three integers', 'sum3':'sum three values', 'mul2':'multiply two values', 'sub_offset':f'subtract first from second and add {k}',
                    'sequence_inc':'advance a starting value by a count', 'sequence_diff':'take the difference of the last two values'
                }[fam]
            exp=_calc(fam,a,b,c,k,m,lo,hi)
            ctx={'a':a,'b':b,'c':c,'k':k,'m':m,'lo':lo,'hi':hi,'op':fam,'expected':exp}
            transformation='canonical'
            if split=='adversarial':
                transformation=rng.choice(['paraphrase','scramble','instruction']); text=_transform(text,rng,transformation)
            elif i%3==1:
                transformation='paraphrase'; text=_transform(text,rng,transformation)
            task_id=f'v4:{fam}:{split}:{i}'
            rows.append(TaskV4(task_id,fam,text,ctx,exp,0.8+0.14*list(FAMILIES).index(fam)+(0.55 if fam.startswith('compose') else 0),split,fam.startswith('compose') or fam in {'parity_mix','clamp_sum','nested3'},split=='adversarial',transformation,('v4',fam,transformation),task_id))
    return rows

def split_v4(rows):
    return ([x for x in rows if x.split=='train'],[x for x in rows if x.split=='holdout'],[x for x in rows if x.split=='adversarial'])

def pair_tasks(rows):
    by={r.task_id:r for r in rows}; pairs=[]
    for r in rows:
        if r.transformation!='canonical':
            base_id=r.task_id.rsplit(':',1)[0]+':'+r.task_id.rsplit(':',1)[1]
    # Pairing is implicit through family/context; return canonical/adversarial matches by index.
    for r in rows:
        candidates=[x for x in rows if x.family==r.family and x.context==r.context and x.split==r.split]
        if candidates:
            pairs.append((candidates[0],r))
    return pairs
