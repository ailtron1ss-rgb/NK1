from __future__ import annotations
from typing import Any, Dict
from .quantization_lab import report

def model_compression_report(model)->Dict[str,Any]:
    r=report(model); r['compression_vs_fp32']={'int8':4.0,'int4':8.0}; return r
