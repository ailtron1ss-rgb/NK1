from __future__ import annotations

"""Lightweight prompt grounding for the executable spine.

This is intentionally conservative.  It extracts only patterns that can be mapped to
the project's canonical TaskSpec semantics.  Ambiguous prompts are rejected rather
than guessed, which lets the higher-level planner take over.
"""
from dataclasses import dataclass, field
import re
from typing import Any, Dict, Optional, Tuple

from .task_spec_v1 import parse_task_spec, TaskSpecV1, CANONICAL_PROMPT, FAMILY_TO_ID


@dataclass(frozen=True)
class GroundedPromptV2:
    original: str
    normalized: str
    spec: Optional[TaskSpecV1]
    confidence: float
    variables: Dict[str, int] = field(default_factory=dict)
    reason: str = ""

    @property
    def grounded(self) -> bool:
        return self.spec is not None and self.spec.semantic_valid and self.confidence >= 0.98


_PATTERNS = (
    ("sum3", re.compile(r"(?:add|sum|plus)\s+(?:the\s+)?first\s+three\s+(?:values|numbers|inputs)", re.I)),
    ("xor3", re.compile(r"(?:xor|exclusive\s+or)\s+(?:the\s+)?first\s+three\s+(?:values|numbers|inputs)", re.I)),
    ("mul2", re.compile(r"(?:multiply|product)\s+(?:the\s+)?(?:first\s+)?two\s+(?:values|numbers|inputs)", re.I)),
    ("sequence_inc", re.compile(r"start(?:ing)?\s+at\s+(?:a|the\s+)?(?:start|first)\b.*(?:increase|increment)\s+.*(?:count|times)", re.I)),
)


def _norm(text: str) -> str:
    return re.sub(r"\s+", " ", str(text).strip().lower())


def _context_variables(context: Dict[str, Any]) -> Dict[str, int]:
    out: Dict[str, int] = {}
    for key in ("a", "b", "c", "d", "k", "m", "lo", "hi", "start", "count"):
        if key in context:
            try:
                out[key] = int(context[key])
            except (TypeError, ValueError):
                continue
    tape = context.get("tape")
    if isinstance(tape, (list, tuple)):
        names = ("a", "b", "c", "k", "m", "lo", "hi")
        for i, key in enumerate(names):
            if i < len(tape) and key not in out:
                try:
                    out[key] = int(tape[i])
                except (TypeError, ValueError):
                    continue
    return out


def _canonical_for_family(family: str) -> Optional[TaskSpecV1]:
    prompt = CANONICAL_PROMPT.get(family)
    if not prompt:
        return None
    spec = parse_task_spec(prompt)
    return spec if spec.semantic_valid else None


def ground_prompt(text: str, context: Optional[Dict[str, Any]] = None) -> GroundedPromptV2:
    context = dict(context or {})
    normalized = _norm(text)
    variables = _context_variables(context)

    # Explicit family/op metadata is the strongest grounding source.
    op = str(context.get("op", "")).lower().strip()
    family_hint = str(context.get("family", "")).strip()
    if family_hint in FAMILY_TO_ID:
        spec = _canonical_for_family(family_hint)
        if spec is not None:
            return GroundedPromptV2(text, normalized, spec, 1.0, variables, "explicit_family")
    if op in FAMILY_TO_ID:
        spec = _canonical_for_family(op)
        if spec is not None:
            return GroundedPromptV2(text, normalized, spec, 1.0, variables, "explicit_op_family")

    # Existing semantic parser gets first chance; it is deterministic and tested.
    spec = parse_task_spec(text)
    if spec.semantic_valid:
        return GroundedPromptV2(text, normalized, spec, float(spec.confidence), variables, "task_spec_v1")

    # Conservative natural-language aliases cover the main failure mode found in the
    # runtime audit: the user asks for a canonical arithmetic operation without giving
    # an `op` field, causing the route to fall through to planner.
    for family, pattern in _PATTERNS:
        if pattern.search(text):
            cspec = _canonical_for_family(family)
            if cspec is not None:
                return GroundedPromptV2(text, normalized, cspec, 0.995, variables, "alias_pattern")

    return GroundedPromptV2(text, normalized, None, 0.0, variables, "unresolved")
