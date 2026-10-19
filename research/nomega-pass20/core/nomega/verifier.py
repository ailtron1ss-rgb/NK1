from __future__ import annotations
import ast, operator
from typing import Any, Dict, Optional
from .types import VerificationResult

_ALLOWED_BIN = {ast.Add: operator.add, ast.Sub: operator.sub, ast.Mult: operator.mul,
                ast.BitXor: operator.xor, ast.BitAnd: operator.and_, ast.BitOr: operator.or_}

class SafeVerifier:
    """Small deterministic verifier for structured candidate answers.

    It deliberately does not execute arbitrary Python. It can validate direct
    arithmetic candidates and structured expert outputs. Nullseed HVM integration
    can be added as a separate bounded verifier because HVM is already sandboxed.
    """
    def verify(self, candidate: Any, context: Dict[str, Any]) -> VerificationResult:
        expected = context.get("expected")
        if expected is not None:
            value = candidate.get("result") if isinstance(candidate, dict) and "result" in candidate else candidate
            ok = value == expected
            return VerificationResult(ok, 1.0 if ok else 0.0, "exact", {"expected": expected})
        if isinstance(candidate, dict):
            if candidate.get("verified_candidate"):
                return VerificationResult(True, 0.98, "program_fitness", {
                    "fitness": candidate.get("candidate_score"),
                    "hvm_supported": candidate.get("hvm_supported", False),
                })
            if candidate.get("result") is not None and context.get("expected") is not None:
                ok = candidate.get("result") == context.get("expected")
                return VerificationResult(ok, 1.0 if ok else 0.0, "structured_exact", {})
        return VerificationResult(False, 0.0, "none", {"reason": "no verifier rule"})
