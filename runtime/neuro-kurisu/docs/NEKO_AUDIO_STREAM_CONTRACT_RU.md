# N.E.K.O. streaming audio contract for NeuroCore

**Status:** P2.2 implementation branch. This document describes the code delivered by the streaming-audio contract work; it does not claim that a physical microphone or any model is installed.

## Purpose and ownership

P2.2 adds a single host-owned path for streamed microphone frames to the existing NK1 voice ingress. It does not create a second cognition loop, sidecar runtime, memory owner, or independent conversation history.

The ownership chain is:

`Host consent + ingress token → NekoAudioInputPort → NekoVoiceTurnCoordinator → bounded ASR frame channel → NekoAsrTranscriptAdapter → EmbodimentRuntime.listenDetailed() → OrganismRuntime`

The coordinator owns one capture session and one ordered pump. VAD observes each accepted frame. The ASR provider receives the bounded channel through the existing transcript adapter. The transcript adapter remains the only place where provider final envelopes are validated, deduplicated, and admitted.

## Audio frame contract

Protocol v1 is intentionally narrow:

| Field | Required value |
|---|---|
| Encoding | signed PCM16 little-endian (`s16le`) |
| Sample rate | 16,000 Hz |
| Channels | 1 (mono) |
| Frame duration | 20 ms |
| Samples per frame | 320 |
| Payload size | 640 bytes |
| Sequence | monotonically increasing integer from 0 |
| Timestamp | finite, non-negative capture time in milliseconds |

Each frame carries a host-bound `VoiceTurnToken`: `sessionEpoch`, `connectionId`, `leaseGeneration`, `routeGeneration`, `audioGeneration`, and `turnId`.

`validateNekoPcm16Frame()` rejects malformed envelopes, unsupported format, wrong payload size, invalid IDs/timestamps, non-data properties, proxy/exotic object envelopes, and token mismatches. It creates a defensive copy of the PCM byte payload.

`NekoPcm16FrameSequenceGuard` is bound to one session, turn, and ingress token. An exact duplicate is marked `replayed`; a conflicting duplicate, sequence gap, timestamp regression, old replay outside its bounded digest window, or stale token invalidates the turn. Intermediate audio frames are never silently skipped and then treated as a continuous utterance.

## Bounded transport

`NekoBoundedAudioFrameChannel` is a single-reader async iterable for the ASR consumer.

- Hard pending limits: at most 128 frames and at most 1,000 ms of audio, whichever is reached first. With 20 ms frames, the duration cap is effectively 50 queued frames.
- Backpressure is signalled at 800 ms by default. The input pump waits for capacity before requesting more source frames.
- Overflow invalidates the entire candidate and clears the pending queue.
- Cancellation or invalidation prevents later frames from being admitted.
- The channel rejects a second reader.

The semantic ring buffer is separate from the delivery queue. It retains at most 8 seconds (400 frames) for boundary evaluation and evicts the oldest context; it is not a transcript delivery buffer and is cleared with the session lifecycle.

## Voice activity and turn boundaries

VAD can report only:

- `speech_started`
- `speech_resumed`
- `candidate_pause`
- `none`

VAD cannot emit a final transcript, `TURN_COMPLETE`, or force-commit decision. Its output is only an activity hint.

The coordinator supports three boundary modes:

1. `provider`: a native streaming provider owns endpointing. Smart Turn is bypassed, even if VAD reports `candidate_pause`.
2. `smart-turn`: `candidate_pause` triggers the semantic boundary port with the bounded PCM ring snapshot. Only `status=OK`, `decision=COMPLETE`, and matching `generation` + `activitySeq` close the ASR stream.
3. `host-manual`: the host closes the input stream; EOF is the signal to the ASR provider to finish.

Boundary execution statuses remain separate from semantic decisions: `OK`, `UNAVAILABLE`, `ERROR`, and `STALE` are not collapsed into `INCOMPLETE`. A stale generation/activity result cannot close a turn.

## Authorization, cancellation, and final admission

The host configures streaming input through `EmbodimentRuntime.setNekoStreamingAudioInput()`. At every listen attempt, a host-supplied capture-request provider must return a fresh authorization grant and ingress token. The grant is opaque to the coordinator; the concrete audio host is responsible for validating it before opening a microphone session.

No grant means no input session is opened. If streaming is configured but the ASR provider has no `transcribeStream()` method, the request is rejected as `stream-not-supported`; there is no hidden fallback to the one-shot `captureFinal()` method.

The ASR provider must return one final `neko.asr.transcript` v1 envelope. The existing `NekoAsrTranscriptAdapter` checks final/user role, provider identity, host session ID, expected turn ID, confidence, payload size, and replay/event-ID conflicts. Late results after cancellation are fenced.

An interruption is reported as verified only when both the audio host's `close()` result and the ASR provider's cancel receipt explicitly report `requested=true` and `verified=true`. An abort signal alone is not proof that a physical microphone or provider process stopped.

## Runtime integration

When configured, `EmbodimentRuntime.listenDetailed()` routes final streamed ASR results to the same `VoiceInputResult` shape used by existing callers. `OrganismRuntime.listen()` and `OrganismRuntime.voiceTurn()` remain the existing ingress points; transcript evidence is still written by the existing cognitive runtime.

When no streaming host is configured, the previous N.E.K.O. one-shot ASR provider and Termux STT fallback are unchanged.

## Explicit non-goals of P2.2

The following are not implemented by this pass:

- Android or browser microphone capture implementation and permission UI.
- Audio resampling or conversion from arbitrary device sample formats.
- Silero VAD, RNNoise, Smart Turn model runtime, ONNX model loading, model manifests, or model weights.
- Python sidecar lifecycle, IPC transport, wake-word engine, or speaker diarization.
- Persistent raw audio storage, cloud upload, or a second cognitive runtime.

These belong to the subsequent P2.3 provider/host implementation. Model assets must be separately pinned by source, version, SHA-256 and license review before they are loaded.

## CI coverage

The branch workflow runs focused tests for:

- normalized PCM16 frame validation and sequence/replay integrity;
- bounded queue, backpressure, single-reader behavior, and 8-second ring buffer;
- streaming ASR final admission and stale-session cancellation;
- native versus Smart Turn boundary behavior and stale/failed boundary decisions;
- embodiment streaming wiring, explicit grant handling, one-shot fallback prohibition, and verified interruption;
- existing ASR, multimodal evidence, voice/cognitive context regressions and runtime typecheck.
