from __future__ import annotations
"""Expanded synthetic task generator for mobile-friendly continual learning."""
from dataclasses import dataclass
import random
from typing import Any, Dict, List

@dataclass(frozen=True)
class GeneratedTask:
    task_id:str; family:str; text:str; context:Dict[str,Any]; expected:Any=None; difficulty:int=1

FAMILIES=('sum3','xor3','dot2','clamp','parity','max3','min3','sequence_inc','sequence_diff','program_sum','program_xor','program_mul')

def make_tasks(seed=91,n=6):
    rows=[]; rng=random.Random(seed)
    for fam in FAMILIES:
        for i in range(n):
            a=rng.randrange(256); b=rng.randrange(256); c=rng.randrange(256)
            if fam=='sum3': text='calculate sum of three numbers'; ctx={'a':a,'b':b,'c':c,'op':'sum3'}; exp=(a+b+c)&255; d=1
            elif fam=='xor3': text='calculate xor of three numbers'; ctx={'a':a,'b':b,'c':c,'op':'xor3'}; exp=a^b^c; d=1
            elif fam=='dot2': text='calculate dot product of two pairs'; ctx={'a':a,'b':b,'c':c,'d':rng.randrange(256),'op':'dot2'}; exp=(a*b+ c*ctx['d'])&255; d=2
            elif fam=='clamp': text='clamp value to range'; ctx={'a':a,'b':64,'c':192,'op':'clamp'}; exp=min(max(a,64),192); d=2
            elif fam=='parity': text='calculate parity'; ctx={'a':a,'op':'parity'}; exp=bin(a).count('1')&1; d=2
            elif fam=='max3': text='maximum of three'; ctx={'a':a,'b':b,'c':c,'op':'max3'}; exp=max(a,b,c); d=1
            elif fam=='min3': text='minimum of three'; ctx={'a':a,'b':b,'c':c,'op':'min3'}; exp=min(a,b,c); d=1
            elif fam=='sequence_inc': text='continue increasing sequence'; ctx={'a':a,'b':a+2,'c':a+4,'op':'next_inc2'}; exp=a+6; d=2
            elif fam=='sequence_diff': text='find sequence difference'; ctx={'a':a,'b':a+7,'c':a+14,'op':'diff'}; exp=7; d=2
            else:
                op=fam.removeprefix('program_'); text=f'write a program to {op}'; ctx={'program_kind':op,'task_seed':rng.randrange(1_000_000),'task_count':6,'program_candidates':4}; exp=None; d=3
            rows.append(GeneratedTask(f'{fam}:{i}',fam,text,ctx,exp,d))
    return rows
