from __future__ import annotations

"""Typed semantic program IR used to bridge TaskSpec and program synthesis.

The IR intentionally describes *what* must be computed rather than a concrete
register allocation. It is therefore safe to expose to a neural learner while
still preserving a strict separation between semantic grounding and executable
program synthesis.
"""
from dataclasses import dataclass, field
import hashlib
import json
from typing import Any, Dict, Iterable, Mapping, Sequence, Tuple

_ALLOWED_OPERATORS = {
    "ADD", "SUB", "MUL", "XOR", "MIN", "MAX", "MOD", "CLAMP", "PARITY", "LOOP",
}


@dataclass(frozen=True)
class ProgramSketchV1:
    family: str
    family_id: int
    operators: Tuple[str, ...]
    operand_refs: Tuple[str, ...]
    output: str
    constraints: Mapping[str, Any] = field(default_factory=dict)
    sketch: Tuple[str, ...] = ()
    schema_version: str = "program-sketch-v1"

    def validate(self) -> None:
        if not self.family:
            raise ValueError("program sketch family is empty")
        if int(self.family_id) < 0:
            raise ValueError("program sketch family_id must be non-negative")
        if not self.operators:
            raise ValueError("program sketch must contain at least one operator")
        unknown = sorted(set(self.operators) - _ALLOWED_OPERATORS)
        if unknown:
            raise ValueError(f"unsupported semantic operators: {unknown}")
        if not self.output:
            raise ValueError("program sketch output is empty")
        if not self.sketch:
            raise ValueError("program sketch sequence is empty")

    def canonical_payload(self) -> Dict[str, Any]:
        return {
            "schema_version": self.schema_version,
            "family": self.family,
            "family_id": int(self.family_id),
            "operators": list(self.operators),
            "operand_refs": list(self.operand_refs),
            "output": self.output,
            "constraints": dict(sorted(self.constraints.items(), key=lambda x: x[0])),
            "sketch": list(self.sketch),
        }

    def canonical_json(self) -> str:
        self.validate()
        return json.dumps(self.canonical_payload(), sort_keys=True, separators=(",", ":"), ensure_ascii=False)

    @property
    def signature(self) -> str:
        return hashlib.sha256(self.canonical_json().encode("utf-8")).hexdigest()[:20]

    @property
    def operator_histogram(self) -> Dict[str, int]:
        out: Dict[str, int] = {}
        for op in self.operators:
            out[op] = out.get(op, 0) + 1
        return out

    @property
    def complexity(self) -> float:
        return float(len(self.operators) + 0.5 * len(self.operand_refs) + 0.25 * len(self.sketch))

    def condition_text(self) -> str:
        constraints = ";".join(f"{k}:{self.constraints[k]}" for k in sorted(self.constraints))
        return (
            f"family={self.family} ops={'>'.join(self.operators)} "
            f"refs={','.join(self.operand_refs)} out={self.output} "
            f"constraints={constraints} sketch={'>'.join(self.sketch)}"
        )


class ProgramIRV1(ProgramSketchV1):
    """Canonical compatibility name for the semantic program IR.

    The implementation is intentionally the same semantic sketch representation;
    this named type exists so canonical registry contracts resolve to a real symbol
    without creating a second IR implementation.
    """

    pass


def from_task_spec(spec: Any) -> ProgramSketchV1:
    sketch = ProgramSketchV1(
        family=str(spec.family),
        family_id=int(spec.family_id),
        operators=tuple(str(x) for x in spec.operators),
        operand_refs=tuple(str(x) for x in spec.operand_refs),
        output=str(spec.output),
        constraints=dict(spec.constraints or {}),
        sketch=tuple(str(x) for x in spec.program_sketch),
    )
    sketch.validate()
    return sketch


def parse_text_to_sketch(text: str) -> ProgramSketchV1:
    from .task_spec_v1 import parse_task_spec

    spec = parse_task_spec(text)
    if not spec.semantic_valid:
        raise ValueError(f"cannot build program sketch: {spec.reason}")
    return from_task_spec(spec)


def sketch_distance(a: ProgramSketchV1, b: ProgramSketchV1) -> float:
    """Cheap structural distance for curriculum/retrieval, not semantic equivalence."""
    op_a, op_b = a.operator_histogram, b.operator_histogram
    keys = set(op_a) | set(op_b)
    op_delta = sum(abs(op_a.get(k, 0) - op_b.get(k, 0)) for k in keys)
    ref_delta = abs(len(a.operand_refs) - len(b.operand_refs))
    seq_delta = abs(len(a.sketch) - len(b.sketch))
    family_delta = 0 if a.family == b.family else 1
    return float(op_delta + 0.5 * ref_delta + 0.25 * seq_delta + 2.0 * family_delta)


def batch_sketch_summary(sketches: Iterable[ProgramSketchV1]) -> Dict[str, Any]:
    rows = list(sketches)
    return {
        "count": len(rows),
        "families": sorted({x.family for x in rows}),
        "signatures": sorted({x.signature for x in rows}),
        "mean_complexity": sum(x.complexity for x in rows) / max(1, len(rows)),
    }
