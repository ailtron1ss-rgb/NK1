from __future__ import annotations
"""Deterministic capability curriculum for NΩ research.

The curriculum deliberately separates train/holdout families and increases
reasoning difficulty without requiring a large external dataset.
"""
from dataclasses import dataclass, asdict
from typing import Any, Dict, List, Tuple
import random

@dataclass(frozen=True)
class CurriculumTask:
    task_id: str
    family: str
    difficulty: int
    text: str
    context: Dict[str, Any]
    split: str
    expected: Any = None

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

FAMILIES = ("sum", "xor", "mul", "min", "max", "sub", "program_sum", "program_xor", "program_mul", "general")


def _math_task(family: str, a: int, b: int) -> Tuple[str, Dict[str, Any], Any]:
    if family == "sum": return "calculate sum", {"a": a, "b": b, "op": "sum"}, (a+b) & 255
    if family == "xor": return "calculate xor", {"a": a, "b": b, "op": "xor"}, a ^ b
    if family == "mul": return "calculate multiply", {"a": a, "b": b, "op": "mul"}, (a*b) & 255
    if family == "min": return "calculate min", {"a": a, "b": b, "op": "min"}, min(a,b)
    if family == "max": return "calculate max", {"a": a, "b": b, "op": "max"}, max(a,b)
    if family == "sub": return "calculate subtract", {"a": a, "b": b, "op": "sub"}, (a-b) & 255
    raise ValueError(family)


def generate_curriculum(seed: int = 41, per_family: int = 8) -> List[CurriculumTask]:
    rng = random.Random(seed)
    rows: List[CurriculumTask] = []
    # Train and holdout use different deterministic seeds and value ranges.
    for split, offset, count in (("train", 0, per_family), ("holdout", 100_000, max(4, per_family // 2))):
        for family in FAMILIES:
            for i in range(count):
                local = random.Random(seed + offset + i*97 + sum(map(ord, family)))
                if family.startswith("program_"):
                    op = family.removeprefix("program_")
                    text = f"write a program to {op}"
                    context = {"program_kind": op, "task_seed": local.randrange(1_000_000), "task_count": 8, "program_candidates": 6}
                    difficulty = 2 if op != "mul" else 3
                    rows.append(CurriculumTask(f"{split}:{family}:{i}", family, difficulty, text, context, split))
                elif family == "general":
                    prompts = [
                        "reason about an unfamiliar concept",
                        "plan a safe solution to an unknown task",
                        "explain why a proposed method may fail",
                    ]
                    rows.append(CurriculumTask(f"{split}:{family}:{i}", family, 3, prompts[i % len(prompts)], {}, split))
                else:
                    a = local.randrange(0, 256); b = local.randrange(0, 256)
                    if split == "holdout":
                        a = 128 + local.randrange(128); b = 128 + local.randrange(128)
                    text, context, expected = _math_task(family, a, b)
                    context["expected"] = expected
                    difficulty = 1 if family in {"sum","xor","min","max"} else 2
                    rows.append(CurriculumTask(f"{split}:{family}:{i}", family, difficulty, text, context, split, expected))
    rng.shuffle(rows)
    return rows


def curriculum_stats(tasks: List[CurriculumTask]) -> Dict[str, Any]:
    out: Dict[str, Any] = {"n": len(tasks), "by_split": {}, "by_family": {}, "by_difficulty": {}}
    for t in tasks:
        out["by_split"][t.split] = out["by_split"].get(t.split, 0) + 1
        out["by_family"][t.family] = out["by_family"].get(t.family, 0) + 1
        out["by_difficulty"][str(t.difficulty)] = out["by_difficulty"].get(str(t.difficulty), 0) + 1
    return out
