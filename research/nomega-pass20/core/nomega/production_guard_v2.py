from __future__ import annotations
from typing import Dict,Any

class ProductionGuardV2:
    """Multi-gate promotion decision; all protected metrics must pass."""
    def __init__(self,min_gain=.0,max_regression=.03,min_verified=.8): self.min_gain=min_gain; self.max_regression=max_regression; self.min_verified=min_verified
    def evaluate(self,baseline:Dict[str,float],candidate:Dict[str,float])->Dict[str,Any]:
        checks={
            'verified_floor': float(candidate.get('verified_rate',0.0)) >= self.min_verified,
            'verified_non_regression': float(candidate.get('verified_rate',0.0)) >= float(baseline.get('verified_rate',0.0))-self.max_regression,
            'family_non_regression': float(candidate.get('family_acc',0.0)) >= float(baseline.get('family_acc',0.0))-self.max_regression,
            'policy_non_regression': float(candidate.get('policy_acc',0.0)) >= float(baseline.get('policy_acc',0.0))-self.max_regression,
            'value_non_regression': float(candidate.get('value_mae',1.0)) <= float(baseline.get('value_mae',1.0))+self.max_regression,
        }
        return {'promote':all(checks.values()),'checks':checks,'passed':sum(checks.values()),'total':len(checks)}
