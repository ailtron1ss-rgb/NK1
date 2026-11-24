from __future__ import annotations
from dataclasses import dataclass, asdict, field
from typing import Dict, Optional, Tuple
import re, json

FAMILY_ORDER = (
    'sum3','xor3','mul2','sub_offset','minmax3','parity_mix','clamp_sum','dot2_mod',
    'nested3','sequence_inc','sequence_diff','program_sum','compose_sum_xor','compose_min_max',
    'compose_affine','compose_mod_chain','compose_clamp_offset','compose_nested_parity',
    'inverse_sum','invariant_xor'
)
FAMILY_TO_ID = {name: i for i, name in enumerate(FAMILY_ORDER)}

# Canonical language used during synthesis training. This is an explicit semantic IR,
# not a hidden second program generator.
CANONICAL_PROMPT = {
    'sum3': 'add the first three values',
    'xor3': 'xor three values',
    'mul2': 'multiply the first two values',
    'sub_offset': 'subtract first from second and add offset',
    'minmax3': 'take the larger of the pairwise minima',
    'parity_mix': 'compute xor parity of three values',
    'clamp_sum': 'add two values then clamp to bounds',
    'dot2_mod': 'compute dot product then reduce modulo m',
    'nested3': 'subtract then multiply then add offset',
    'sequence_inc': 'advance the start value by a count',
    'sequence_diff': 'compute the difference of the last values',
    'program_sum': 'return the sum of three inputs',
    'compose_sum_xor': 'sum the first two then xor the third',
    'compose_min_max': 'min the first pair then max with third',
    'compose_affine': 'multiply one value then add two others',
    'compose_mod_chain': 'add, modulo, then xor',
    'compose_clamp_offset': 'add with offset then clamp',
    'compose_nested_parity': 'nested arithmetic then parity',
    'inverse_sum': 'recover an additive total',
    'invariant_xor': 'cancel xor terms to obtain an invariant',
}

# Deliberately compact cue dictionaries. Unmatched/ambiguous prompts are rejected.
CUES = {
    'sum3': (
        'sum three', 'three way addition', 'three-way addition', 'total of three',
        'add the first three', 'first three observations', 'aggregate the first three',
        'compute their total'
    ),
    'xor3': (
        'xor three', 'exclusive bitwise', 'toggle bits across three', 'xor the three',
        'bitwise merge of three'
    ),
    'mul2': (
        'multiply the first two values', 'multiply the first pair', 'multiply the first and second',
        'two-value product', 'product of the first two values', 'product of the first pair',
        'form the product of the first pair'
    ),
    'minmax3': (
        'larger of the pairwise minima', 'minimum pair then compare to the third',
        'nested extrema', 'combine min and max across three', 'minimum pair'
    ),
    'compose_sum_xor': (
        'first add then apply xor with the third', 'sum the pair and xor the remaining',
        'addition followed by xor', 'sum the first two then xor the third', 'first add the pair and then apply xor with the remaining value', 'add the pair then xor the remaining', 'combine two values with addition then xor the third', 'add the first two numbers before xor the last', 'add the pair and then xor the remaining input'
    ),
    'sequence_inc': ('advance the start value by a count',),
    'sequence_diff': ('difference of the last values',),
    'sub_offset': ('subtract first from second and add offset',),
    'parity_mix': ('xor parity of three values',),
    'clamp_sum': ('add two values then clamp to bounds',),
    'dot2_mod': ('dot product then reduce modulo',),
    'nested3': ('subtract then multiply then add offset',),
    'program_sum': ('return the sum of three inputs',),
    'compose_min_max': ('min the first pair then max with third',),
    'compose_affine': ('multiply one value then add two others',),
    'compose_mod_chain': ('add, modulo, then xor',),
    'compose_clamp_offset': ('add with offset then clamp',),
    'compose_nested_parity': ('nested arithmetic then parity',),
    'inverse_sum': ('recover an additive total',),
    'invariant_xor': ('cancel xor terms to obtain an invariant',),
}

# Every canonical prompt is itself a legal parser cue. This prevents a train-time
# family label from disagreeing with the semantic parser used by the end-to-end path.
for _family, _prompt in CANONICAL_PROMPT.items():
    if _prompt not in CUES[_family]:
        CUES[_family] = tuple(CUES[_family]) + (_prompt,)
del _family, _prompt


@dataclass(frozen=True)
class TaskSpecV1:
    family: str
    family_id: int
    canonical_prompt: str
    source_text: str
    parser_version: str = 'taskspec-v1'
    confidence: float = 1.0
    semantic_valid: bool = True
    reason: str = 'matched_canonical_semantics'
    operators: Tuple[str, ...] = ()
    operand_refs: Tuple[str, ...] = ()
    output: str = 'r0'
    constraints: Dict[str, object] = field(default_factory=dict)
    program_sketch: Tuple[str, ...] = ()

    def to_dict(self) -> Dict[str, object]:
        return asdict(self)

    def model_condition(self) -> Tuple[str, int]:
        return self.canonical_prompt, self.family_id

    def typed_model_condition(self) -> Tuple[str, int]:
        return typed_model_condition(self), self.family_id


def _norm(text: str) -> str:
    text = re.sub(r'[^a-z0-9]+', ' ', str(text).lower()).strip()
    return re.sub(r'\s+', ' ', text)


# Typed semantic representation. It intentionally describes operations/constraints,
# not concrete register allocations, so it cannot simply reveal the exact target program.
SEMANTIC_SCHEMA = {
    'sum3': dict(operators=('ADD','ADD'), operand_refs=('x0','x1','x2'), output='r0', constraints={'inputs':3}, sketch=('LOAD x0','LOAD x1','ADD','LOAD x2','ADD','RETURN')),
    'xor3': dict(operators=('XOR','XOR'), operand_refs=('x0','x1','x2'), output='r0', constraints={'inputs':3}, sketch=('LOAD x0','LOAD x1','XOR','LOAD x2','XOR','RETURN')),
    'mul2': dict(operators=('MUL',), operand_refs=('x0','x1'), output='r0', constraints={'inputs':2}, sketch=('LOAD x0','LOAD x1','MUL','RETURN')),
    'sub_offset': dict(operators=('SUB','ADD'), operand_refs=('x0','x1','offset'), output='r0', constraints={'inputs':2,'offset':'x3'}, sketch=('LOAD x1','LOAD x0','SUB','LOAD offset','ADD','RETURN')),
    'minmax3': dict(operators=('MIN','MIN','MAX'), operand_refs=('x0','x1','x2'), output='r0', constraints={'inputs':3}, sketch=('LOAD x0','LOAD x1','MIN','LOAD x2','MIN','MAX','RETURN')),
    'parity_mix': dict(operators=('XOR','XOR','PARITY'), operand_refs=('x0','x1','x2'), output='r0', constraints={'inputs':3,'output':'parity'}, sketch=('LOAD x0','LOAD x1','XOR','LOAD x2','XOR','PARITY','RETURN')),
    'clamp_sum': dict(operators=('ADD','CLAMP'), operand_refs=('x0','x1','lo','hi'), output='r0', constraints={'inputs':2,'bounds':'x5,x6'}, sketch=('LOAD x0','LOAD x1','ADD','CLAMP lo hi','RETURN')),
    'dot2_mod': dict(operators=('MUL','MUL','ADD','MOD'), operand_refs=('x0','x1','x2','k','m'), output='r0', constraints={'modulus':'x4'}, sketch=('MUL x0 x1','MUL x2 k','ADD','MOD m','RETURN')),
    'nested3': dict(operators=('SUB','MUL','ADD'), operand_refs=('x0','x1','x2','offset'), output='r0', constraints={'inputs':3,'offset':'x3'}, sketch=('SUB x0 x1','MUL x2','ADD offset','RETURN')),
    'sequence_inc': dict(operators=('LOOP','ADD'), operand_refs=('start','count'), output='r0', constraints={'count_max':32}, sketch=('INIT start','LOOP count','ADD 1','RETURN')),
    'sequence_diff': dict(operators=('SUB',), operand_refs=('x1','x2'), output='r0', constraints={'inputs':2}, sketch=('LOAD x2','LOAD x1','SUB','RETURN')),
    'program_sum': dict(operators=('ADD','ADD'), operand_refs=('x0','x1','x2'), output='r0', constraints={'inputs':3}, sketch=('LOAD x0','LOAD x1','ADD','LOAD x2','ADD','RETURN')),
    'compose_sum_xor': dict(operators=('ADD','XOR'), operand_refs=('x0','x1','x2'), output='r0', constraints={'inputs':3}, sketch=('ADD x0 x1','XOR x2','RETURN')),
    'compose_min_max': dict(operators=('MIN','MAX'), operand_refs=('x0','x1','x2'), output='r0', constraints={'inputs':3}, sketch=('MIN x0 x1','MAX x2','RETURN')),
    'compose_affine': dict(operators=('MUL','ADD','ADD'), operand_refs=('x0','k','x1','x2'), output='r0', constraints={'inputs':3}, sketch=('MUL x0 k','ADD x1','ADD x2','RETURN')),
    'compose_mod_chain': dict(operators=('ADD','MOD','XOR'), operand_refs=('x0','x1','m','x2'), output='r0', constraints={'modulus':'x4'}, sketch=('ADD x0 x1','MOD m','XOR x2','RETURN')),
    'compose_clamp_offset': dict(operators=('ADD','ADD','CLAMP'), operand_refs=('x0','x1','offset','lo','hi'), output='r0', constraints={'bounds':'x5,x6'}, sketch=('ADD x0 x1','ADD offset','CLAMP lo hi','RETURN')),
    'compose_nested_parity': dict(operators=('SUB','MUL','ADD','PARITY'), operand_refs=('x0','x1','x2','offset'), output='r0', constraints={'inputs':3,'offset':'x3','output':'parity'}, sketch=('SUB','MUL','ADD offset','PARITY','RETURN')),
    'inverse_sum': dict(operators=('ADD',), operand_refs=('x0','x1'), output='r0', constraints={'inverse':'additive_total'}, sketch=('ADD x0 x1','RETURN')),
    'invariant_xor': dict(operators=('XOR','XOR','XOR'), operand_refs=('x0','x1','x2'), output='r0', constraints={'invariant':True}, sketch=('XOR x0 x1','XOR x2','XOR invariant','RETURN')),
}

def typed_model_condition(spec: TaskSpecV1) -> str:
    """Compact typed semantic condition that fits the decoder token window.

    The representation deliberately omits concrete register allocation while keeping
    the operator sequence, operand roles, output and program sketch visible.
    """
    ops='>'.join(spec.operators)
    refs=','.join(spec.operand_refs)
    sketch='>'.join(spec.program_sketch)
    constraints=';'.join(f'{k}:{v}' for k,v in sorted((spec.constraints or {}).items()))
    return f"task={spec.canonical_prompt} ops={ops} refs={refs} out={spec.output} c={constraints} sk={sketch}"

def validate_canonical_task_specs() -> None:
    """Assert every canonical family prompt is self-consistent with FAMILY_TO_ID."""
    for _family in FAMILY_ORDER:
        _spec = parse_task_spec(CANONICAL_PROMPT[_family])
        validate_task_spec(_spec)
        if _spec.family_id != FAMILY_TO_ID[_family]:
            raise ValueError(f'canonical family id mismatch: {_family}')


def parse_task_spec(text: str, *, min_confidence: float = 0.99) -> TaskSpecV1:
    raw = str(text)
    norm = _norm(raw)
    matches = []
    for family, cues in CUES.items():
        hits = sum(1 for cue in cues if _norm(cue) in norm)
        if hits:
            matches.append((family, hits))
    matches.sort(key=lambda x: (-x[1], FAMILY_TO_ID[x[0]]))
    if not matches:
        return TaskSpecV1('', -1, '', raw, confidence=0.0, semantic_valid=False, reason='no_supported_semantic_match')
    top = matches[0]
    tied = [x for x in matches if x[1] == top[1]]
    if len(tied) > 1:
        # Prefer exact/longest single cue only when it is strictly more specific.
        lengths = {fam: max((len(_norm(c)) for c in CUES[fam] if _norm(c) in norm), default=0) for fam, _ in tied}
        best_len = max(lengths.values())
        tied2 = [fam for fam, _ in tied if lengths[fam] == best_len]
        if len(tied2) != 1:
            return TaskSpecV1('', -1, '', raw, confidence=0.0, semantic_valid=False, reason='ambiguous_semantic_match')
        family = tied2[0]
    else:
        family = top[0]
    confidence = 1.0 if top[1] >= 2 else 0.995
    valid = confidence >= min_confidence and family in FAMILY_TO_ID
    meta = SEMANTIC_SCHEMA.get(family, {}) if valid else {}
    return TaskSpecV1(
        family=family if valid else '',
        family_id=FAMILY_TO_ID[family] if valid else -1,
        canonical_prompt=CANONICAL_PROMPT[family] if valid else '',
        source_text=raw,
        confidence=confidence if valid else 0.0,
        semantic_valid=valid,
        reason='matched_canonical_semantics' if valid else 'confidence_below_threshold',
        operators=tuple(meta.get('operators', ())),
        operand_refs=tuple(meta.get('operand_refs', ())),
        output=str(meta.get('output', 'r0')),
        constraints=dict(meta.get('constraints', {})),
        program_sketch=tuple(meta.get('sketch', ())),
    )


def validate_task_spec(spec: TaskSpecV1) -> None:
    if not spec.semantic_valid:
        raise ValueError(f'invalid TaskSpec: {spec.reason}')
    if spec.family not in FAMILY_TO_ID:
        raise ValueError(f'unsupported family: {spec.family}')
    if spec.family_id != FAMILY_TO_ID[spec.family]:
        raise ValueError('family id mismatch')
    if spec.canonical_prompt != CANONICAL_PROMPT[spec.family]:
        raise ValueError('canonical prompt mismatch')
    meta=SEMANTIC_SCHEMA[spec.family]
    if tuple(spec.operators)!=tuple(meta['operators']) or tuple(spec.operand_refs)!=tuple(meta['operand_refs']):
        raise ValueError('typed semantic fields mismatch')
    if tuple(spec.program_sketch)!=tuple(meta['sketch']):
        raise ValueError('program sketch mismatch')
