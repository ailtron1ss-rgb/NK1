"""Offline, privacy-minimal NK1 evidence validation for Inspect AI.

No model calls are made. Inspect AI is used as an independently executed
assessment harness over a bounded evidence projection produced by NK1.
"""
from __future__ import annotations

import hashlib
import hmac
import json
import os
import re
import tempfile
from pathlib import Path
from typing import Any

SCHEMA_VERSION = "nk1.independent-evaluation-evidence.v2"
STAGES = (
    "observation", "prediction", "appraisal", "attention", "memory", "goal",
    "plan", "action", "outcome", "learning", "self-update",
)
REALITY_CLASSES = (
    "external-observation", "device-observation", "simulator", "derived",
    "model-generated", "user-reported",
)
EXTERNAL_CLASSES = {"external-observation", "device-observation", "user-reported"}
DIGEST_RE = re.compile(r"^[a-f0-9]{64}$")
MAX_CYCLES = 256
MAX_EVENTS_PER_CYCLE = 64

# Child -> parent. These are the same full-causal edges required by
# CognitiveEventFabric.verifyOperationalCycle(), independently rechecked here.
FULL_EDGES = (
    ("prediction", "observation", "prediction->observation"),
    ("action", "prediction", "action->prediction"),
    ("action", "observation", "action->observation"),
    ("outcome", "action", "outcome->action"),
    ("learning", "outcome", "learning->outcome"),
    ("self-update", "learning", "self-update->learning"),
    ("appraisal", "observation", "appraisal->observation"),
    ("appraisal", "prediction", "appraisal->prediction"),
    ("attention", "appraisal", "attention->appraisal"),
    ("attention", "prediction", "attention->prediction"),
    ("memory", "attention", "memory->attention"),
    ("memory", "observation", "memory->observation"),
    ("goal", "appraisal", "goal->appraisal"),
    ("goal", "memory", "goal->memory"),
    ("plan", "goal", "plan->goal"),
    ("plan", "prediction", "plan->prediction"),
    ("action", "plan", "action->plan"),
    ("outcome", "prediction", "outcome->prediction"),
    ("learning", "action", "learning->action"),
    ("self-update", "outcome", "self-update->outcome"),
)


def canonical_json(value: Any) -> str:
    """Canonical JSON matching NK1's sorted-key, compact JSON digest."""
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"), allow_nan=False)


def bundle_digest(bundle: dict[str, Any]) -> str:
    payload = {key: value for key, value in bundle.items() if key != "bundleDigest"}
    return hashlib.sha256(canonical_json(payload).encode("utf-8")).hexdigest()


def canonical_sha256(value: Any) -> str:
    return hashlib.sha256(canonical_json(value).encode("utf-8")).hexdigest()


def _non_negative_int(value: Any) -> bool:
    return type(value) is int and value >= 0


def validate_bundle(bundle: Any) -> dict[str, Any]:
    if not isinstance(bundle, dict):
        raise ValueError("evidence bundle must be a JSON object")
    if bundle.get("schemaVersion") != SCHEMA_VERSION:
        raise ValueError("unsupported NK1 evidence schema")
    digest = bundle.get("bundleDigest")
    if not isinstance(digest, str) or not DIGEST_RE.fullmatch(digest):
        raise ValueError("bundle digest is missing or malformed")
    if not hmac.compare_digest(digest, bundle_digest(bundle)):
        raise ValueError("bundle digest mismatch; evidence was altered or truncated")

    cycles = bundle.get("cycles")
    if not isinstance(cycles, list) or len(cycles) > MAX_CYCLES:
        raise ValueError("cycle window is malformed or exceeds the export bound")
    timeline_result = score_timeline({
        "kind": "evidence-timeline",
        "timeline": bundle.get("timeline"),
        "cycles": cycles,
    })
    if timeline_result.get("passed") is not True:
        raise ValueError(f"timeline sequence invalid: {timeline_result.get('reason')}")

    event_window = bundle.get("eventWindow")
    if not isinstance(event_window, dict):
        raise ValueError("event window is missing")
    limit = event_window.get("limit")
    total = event_window.get("total")
    buffered = event_window.get("buffered")
    exported = event_window.get("exportedOperationalEvents")
    if (not _non_negative_int(limit) or limit != MAX_EVENTS
            or not _non_negative_int(total) or not _non_negative_int(buffered)
            or not _non_negative_int(exported) or total < buffered
            or exported > limit or exported > buffered):
        raise ValueError("event window counters are inconsistent")
    observed_events = sum(len(cycle["events"]) for cycle in cycles)
    if exported != observed_events:
        raise ValueError("event window exported count does not match cycle contents")
    expected_oldest = cycles[0]["tick"] if cycles else None
    expected_newest = cycles[-1]["tick"] if cycles else None
    if event_window.get("oldestTick") != expected_oldest or event_window.get("newestTick") != expected_newest:
        raise ValueError("event window tick bounds do not match cycle contents")

    counters = bundle.get("cycleCounters")
    if not isinstance(counters, dict) or counters.get("version") != 2:
        raise ValueError("cycle counters v2 are missing")
    for field in ("cycles", "coreCompleteCycles", "fullCompleteCycles", "incompleteCycles", "brokenLineages"):
        if not _non_negative_int(counters.get(field)):
            raise ValueError(f"cycle counter {field} is invalid")
    if (counters["coreCompleteCycles"] > counters["cycles"]
            or counters["fullCompleteCycles"] > counters["cycles"]
            or counters["incompleteCycles"] > counters["cycles"]
            or counters["cycles"] < len(cycles)):
        raise ValueError("cycle counters are inconsistent with the exported timeline")
    last_tick = counters.get("lastTick")
    if type(last_tick) is not int or last_tick < -1 or (cycles and last_tick < cycles[-1]["tick"]):
        raise ValueError("cycle counter lastTick precedes the exported timeline")
    return bundle


def score_timeline(record: dict[str, Any]) -> dict[str, Any]:
    """Verify ordered multi-tick continuity, per-cycle digests and the hash chain."""
    if not isinstance(record, dict):
        return {"passed": False, "reason": "timeline-record-malformed"}
    cycles = record.get("cycles")
    timeline = record.get("timeline")
    if not isinstance(cycles, list) or len(cycles) > MAX_CYCLES or not isinstance(timeline, dict):
        return {"passed": False, "reason": "timeline-shape-invalid"}
    if (timeline.get("version") != 1
            or timeline.get("algorithm") != "sha256-canonical-json-v1"
            or timeline.get("cycleCount") != len(cycles)):
        return {"passed": False, "reason": "timeline-manifest-invalid"}

    previous_chain_digest: str | None = None
    previous_tick = -1
    seen_cycle_ids: set[str] = set()
    event_ticks: dict[str, int] = {}
    event_rows: list[dict[str, Any]] = []
    for index, cycle in enumerate(cycles):
        if not isinstance(cycle, dict):
            return {"passed": False, "reason": "timeline-cycle-not-object", "index": index}
        tick = cycle.get("tick")
        cycle_id = cycle.get("cycleIdDigest")
        events = cycle.get("events")
        if (not _non_negative_int(tick) or tick <= previous_tick
                or not isinstance(cycle_id, str) or not DIGEST_RE.fullmatch(cycle_id)
                or cycle_id != canonical_sha256(f"nk1-cycle:{tick}")
                or cycle_id in seen_cycle_ids
                or not isinstance(events, list) or len(events) > MAX_EVENTS_PER_CYCLE):
            return {"passed": False, "reason": "timeline-cycle-order-or-identity-invalid", "index": index}
        if cycle.get("sequenceIndex") != index or cycle.get("previousChainDigest") != previous_chain_digest:
            return {"passed": False, "reason": "timeline-linkage-invalid", "index": index}

        cycle_core = {"cycleIdDigest": cycle_id, "tick": tick, "events": events}
        cycle_digest = canonical_sha256(cycle_core)
        if not hmac.compare_digest(str(cycle.get("cycleDigest", "")), cycle_digest):
            return {"passed": False, "reason": "timeline-cycle-digest-mismatch", "index": index}
        chain_record = {
            "sequenceIndex": index,
            "tick": tick,
            "cycleDigest": cycle_digest,
            "previousChainDigest": previous_chain_digest,
        }
        chain_digest = canonical_sha256(chain_record)
        if not hmac.compare_digest(str(cycle.get("chainDigest", "")), chain_digest):
            return {"passed": False, "reason": "timeline-chain-digest-mismatch", "index": index}

        seen_cycle_ids.add(cycle_id)
        for event_index, event in enumerate(events):
            if not isinstance(event, dict):
                return {"passed": False, "reason": "timeline-event-not-object", "index": index, "eventIndex": event_index}
            event_id = event.get("idDigest")
            parent_ids = event.get("parentIdDigests")
            if (not isinstance(event_id, str) or not DIGEST_RE.fullmatch(event_id)
                    or event_id in event_ticks
                    or event.get("tick") != tick
                    or event.get("stage") not in STAGES
                    or not isinstance(parent_ids, list)
                    or not all(isinstance(parent, str) and DIGEST_RE.fullmatch(parent) for parent in parent_ids)):
                return {"passed": False, "reason": "timeline-event-identity-invalid", "index": index, "eventIndex": event_index}
            event_ticks[event_id] = tick
            event_rows.append(event)
        previous_chain_digest = chain_digest
        previous_tick = tick

    for event in event_rows:
        for parent_id in event["parentIdDigests"]:
            parent_tick = event_ticks.get(parent_id)
            if parent_tick is not None and parent_tick > event["tick"]:
                return {"passed": False, "reason": "timeline-parent-points-to-future", "tick": event["tick"]}

    expected_first = cycles[0]["tick"] if cycles else None
    expected_last = cycles[-1]["tick"] if cycles else None
    if (timeline.get("firstTick") != expected_first
            or timeline.get("lastTick") != expected_last
            or timeline.get("headDigest") != previous_chain_digest):
        return {"passed": False, "reason": "timeline-head-or-bounds-mismatch"}
    return {
        "passed": True,
        "reason": "ordered-hash-chain-verified",
        "cycleCount": len(cycles),
        "firstTick": expected_first,
        "lastTick": expected_last,
        "headDigest": previous_chain_digest,
        "uniqueEventIds": len(event_ticks),
    }

def score_cycle(record: dict[str, Any]) -> dict[str, Any]:
    """Independently recompute full 11-stage coverage and all 20 causal edges."""
    events = record.get("events") if isinstance(record, dict) else None
    tick = record.get("tick") if isinstance(record, dict) else None
    if not _non_negative_int(tick) or not isinstance(events, list) or len(events) > MAX_EVENTS_PER_CYCLE:
        return {"passed": False, "reason": "cycle-input-malformed", "stageCoverageBps": 0, "edgeCoverageBps": 0}

    by_stage: dict[str, dict[str, Any]] = {}
    seen_ids: set[str] = set()
    duplicate_ids: list[str] = []
    duplicate_stages: list[str] = []
    invalid_events: list[int] = []
    for index, event in enumerate(events):
        if not isinstance(event, dict):
            invalid_events.append(index)
            continue
        event_id = event.get("idDigest")
        stage = event.get("stage")
        parent_ids = event.get("parentIdDigests")
        event_tick = event.get("tick")
        if (not isinstance(event_id, str) or not DIGEST_RE.fullmatch(event_id)
                or stage not in STAGES or not isinstance(parent_ids, list)
                or not all(isinstance(parent, str) and DIGEST_RE.fullmatch(parent) for parent in parent_ids)
                or not _non_negative_int(event_tick) or event_tick != tick):
            invalid_events.append(index)
            continue
        if event_id in seen_ids:
            duplicate_ids.append(event_id)
        seen_ids.add(event_id)
        if stage in by_stage:
            duplicate_stages.append(stage)
        else:
            by_stage[stage] = event

    missing_stages = [stage for stage in STAGES if stage not in by_stage]
    valid_edges = 0
    missing_edges: list[str] = []
    for child_stage, parent_stage, label in FULL_EDGES:
        child = by_stage.get(child_stage)
        parent = by_stage.get(parent_stage)
        if child is not None and parent is not None and parent["idDigest"] in child["parentIdDigests"]:
            valid_edges += 1
        else:
            missing_edges.append(label)

    stage_coverage_bps = round((len(STAGES) - len(missing_stages)) * 10_000 / len(STAGES))
    edge_coverage_bps = round(valid_edges * 10_000 / len(FULL_EDGES))
    passed = not (missing_stages or missing_edges or duplicate_ids or duplicate_stages or invalid_events)
    return {
        "passed": passed,
        "reason": "full-causal-cycle-verified" if passed else "full-causal-cycle-incomplete",
        "tick": tick,
        "stageCount": len(by_stage),
        "stageCoverageBps": stage_coverage_bps,
        "edgeCount": len(FULL_EDGES),
        "validEdges": valid_edges,
        "edgeCoverageBps": edge_coverage_bps,
        "missingStages": missing_stages,
        "missingEdges": missing_edges,
        "duplicateStageIds": sorted(set(duplicate_stages)),
        "duplicateEventIds": sorted(set(duplicate_ids)),
        "invalidEventIndexes": invalid_events,
    }


def score_reality_ledger(record: dict[str, Any]) -> dict[str, Any]:
    """Check accounting invariants without treating simulator evidence as reality."""
    ledger = record.get("realityEvidence") if isinstance(record, dict) else None
    if not isinstance(ledger, dict):
        return {"passed": False, "reason": "reality-ledger-missing"}
    total = ledger.get("total")
    observed = ledger.get("observedRecent")
    classes = ledger.get("classes")
    independent = ledger.get("independentSourcesByClass")
    external_sources = ledger.get("externalIndependentSources")
    simulator_sources = ledger.get("simulatorIndependentSources")
    if (not _non_negative_int(total) or not _non_negative_int(observed) or observed > total
            or not isinstance(classes, dict) or not isinstance(independent, dict)
            or not _non_negative_int(external_sources) or not _non_negative_int(simulator_sources)):
        return {"passed": False, "reason": "reality-ledger-shape-invalid"}

    counts: dict[str, int] = {}
    sources: dict[str, int] = {}
    for category in REALITY_CLASSES:
        count = classes.get(category)
        source_count = independent.get(category)
        if not _non_negative_int(count) or not _non_negative_int(source_count) or source_count > count:
            return {"passed": False, "reason": "reality-ledger-category-invalid", "category": category}
        counts[category] = count
        sources[category] = source_count
    unknown_categories = (set(classes) | set(independent)) - set(REALITY_CLASSES)
    external_count = sum(counts[name] for name in EXTERNAL_CLASSES)
    source_upper_bound = sum(sources[name] for name in EXTERNAL_CLASSES)
    passed = (
        sum(counts.values()) == observed
        and not unknown_categories
        and external_sources <= source_upper_bound
        and external_sources <= external_count
        and simulator_sources <= counts["simulator"]
        and simulator_sources <= sources["simulator"]
    )
    return {
        "passed": passed,
        "reason": "reality-source-accounting-valid" if passed else "reality-source-accounting-invalid",
        "observedRecent": observed,
        "externalObservations": external_count,
        "simulatorObservations": counts["simulator"],
        "externalIndependentSources": external_sources,
        "simulatorIndependentSources": simulator_sources,
        "unknownCategories": sorted(unknown_categories),
    }


def score_record(record: dict[str, Any]) -> dict[str, Any]:
    if not isinstance(record, dict):
        return {"passed": False, "reason": "sample-not-object"}
    if record.get("kind") == "evidence-timeline":
        return score_timeline(record)
    if record.get("kind") == "cognitive-cycle":
        return score_cycle(record)
    if record.get("kind") == "reality-ledger":
        return score_reality_ledger(record)
    return {"passed": False, "reason": "unknown-sample-kind"}


def samples_from_bundle(bundle: dict[str, Any]) -> list[dict[str, str]]:
    samples: list[dict[str, str]] = [{
        "id": "evidence-timeline",
        "input": canonical_json({
            "kind": "evidence-timeline",
            "timeline": bundle["timeline"],
            "cycles": bundle["cycles"],
        }),
        "target": "ordered-multi-tick-integrity-audit",
    }]
    for cycle in bundle["cycles"]:
        record = {
            "kind": "cognitive-cycle",
            "sampleId": cycle["cycleIdDigest"],
            "tick": cycle["tick"],
            "events": cycle["events"],
        }
        samples.append({
            "id": f"cycle-{cycle['tick']}-{cycle['cycleIdDigest'][:12]}",
            "input": canonical_json(record),
            "target": "independent-structural-audit",
        })
    ledger_record = {"kind": "reality-ledger", "realityEvidence": bundle["realityEvidence"]}
    samples.append({
        "id": "reality-ledger-accounting",
        "input": canonical_json(ledger_record),
        "target": "independent-source-accounting-audit",
    })
    return samples


def export_bundle(source: Path, destination: Path) -> dict[str, int | str]:
    raw = json.loads(source.read_text(encoding="utf-8"))
    if isinstance(raw, dict) and isinstance(raw.get("evidence"), dict):
        raw = raw["evidence"]
    bundle = validate_bundle(raw)
    samples = samples_from_bundle(bundle)
    destination.parent.mkdir(parents=True, exist_ok=True)
    fd, temporary_name = tempfile.mkstemp(prefix=destination.name + ".", suffix=".tmp", dir=str(destination.parent))
    try:
        with os.fdopen(fd, "w", encoding="utf-8", newline="\n") as handle:
            for sample in samples:
                handle.write(canonical_json(sample) + "\n")
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temporary_name, destination)
    except Exception:
        try:
            os.unlink(temporary_name)
        except OSError:
            pass
        raise
    return {"samples": len(samples), "cycles": len(bundle["cycles"]), "digest": bundle["bundleDigest"]}


def main() -> int:
    import argparse

    parser = argparse.ArgumentParser(description="Validate and export NK1 evidence for Inspect AI")
    parser.add_argument("source", nargs="?", default="evaluation/inspect_ai/evidence.json")
    parser.add_argument("--output", default="evaluation/inspect_ai/samples.jsonl")
    args = parser.parse_args()
    result = export_bundle(Path(args.source), Path(args.output))
    print(f"NK1_INSPECT_EXPORT=PASS samples={result['samples']} cycles={result['cycles']} digest={result['digest']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
