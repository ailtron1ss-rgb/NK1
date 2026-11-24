from __future__ import annotations

"""Stable canonical facade for program synthesis.

The implementation remains independently versioned for rollback/research; callers
should import the facade rather than a numbered implementation.
"""

from .neural_program_synth_v13 import NeuralProgramSynthesizerV13

NeuralProgramSynthesizer = NeuralProgramSynthesizerV13
CANONICAL_SOURCE = "neural_program_synth_v13"
VERSION = "neural-program-synth-canonical-v1"

__all__ = ["NeuralProgramSynthesizer", "NeuralProgramSynthesizerV13", "CANONICAL_SOURCE", "VERSION"]
