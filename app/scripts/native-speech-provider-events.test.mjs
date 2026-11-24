import assert from "node:assert/strict";
import { test } from "node:test";
import {
  connectNativeSpeechProviderEvents,
  describeNativeSpeechProviderStatus,
  NativeSpeechProviderEventTracker,
  NATIVE_SPEECH_HOST_EVENT,
} from "../src/components/avatar/nativeSpeechProviderEvents.ts";

function envelope(overrides = {}, eventOverrides = {}) {
  return {
    type: NATIVE_SPEECH_HOST_EVENT,
    protocol: "nk1.native-speech-host-envelope",
    version: 1,
    event: {
      protocol: "nk1.native-speech-provider-event",
      version: 1,
      eventId: "native-speech-1",
      operationId: "operation-1",
      sequence: 1,
      provider: "termux-tts-speak",
      monotonicTimeMs: 10,
      phase: "process-spawned",
      playbackVerified: false,
      ...eventOverrides,
    },
    ...overrides,
  };
}

class FakeMessageEvent extends Event {
  constructor(data) {
    super(NATIVE_SPEECH_HOST_EVENT);
    this.data = data;
  }
}

class FakeEventSource extends EventTarget {
  constructor() {
    super();
    this.closed = false;
    this.onopen = null;
    this.onerror = null;
  }
  close() { this.closed = true; }
  open() { this.onopen?.(new Event("open")); }
  fail() { this.onerror?.(new Event("error")); }
  send(value) {
    this.dispatchEvent(new FakeMessageEvent(typeof value === "string" ? value : JSON.stringify(value)));
  }
}

test("tracker accepts ordered provider process telemetry and rejects duplicate, stale or playback claims", () => {
  const tracker = new NativeSpeechProviderEventTracker();
  const first = tracker.accept(envelope());
  assert.equal(first?.phase, "process-spawned");
  assert.equal(first?.playbackVerified, false);

  assert.equal(tracker.accept(envelope()), null);
  assert.equal(tracker.accept(envelope({}, { eventId: "native-speech-2", sequence: 1, monotonicTimeMs: 11 })), null);
  assert.equal(tracker.accept(envelope({}, { eventId: "native-speech-3", sequence: 2, monotonicTimeMs: 9 })), null);
  assert.equal(tracker.accept(envelope({}, { eventId: "native-speech-4", sequence: 2, monotonicTimeMs: 12, playbackVerified: true })), null);
  assert.equal(tracker.accept({ ...envelope(), version: 2 }), null);
});

test("UI EventSource bridge validates envelopes, exposes connection state and unsubscribes", () => {
  const source = new FakeEventSource();
  const events = [];
  const connections = [];
  const dispose = connectNativeSpeechProviderEvents({
    url: "/api/organism/voice/events",
    createEventSource: (url, init) => {
      assert.equal(url, "/api/organism/voice/events");
      assert.equal(init.withCredentials, true);
      return source;
    },
    onEvent: (event) => events.push(event),
    onConnection: (state) => connections.push(state),
  });

  source.open();
  source.send(envelope());
  source.send(envelope());
  source.send("{bad json");
  source.send(envelope({}, { eventId: "native-speech-2", sequence: 2, monotonicTimeMs: 11, phase: "process-exited" }));
  source.fail();

  assert.deepEqual(events.map((event) => event.phase), ["process-spawned", "process-exited"]);
  assert.deepEqual(connections, ["connecting", "connected", "reconnecting"]);

  dispose();
  assert.equal(source.closed, true);
  assert.equal(connections.at(-1), "closed");
});

test("provider process completion never becomes a claim of audible playback", () => {
  const tracker = new NativeSpeechProviderEventTracker();
  const event = tracker.accept(envelope({}, { phase: "process-exited" }));
  assert.equal(describeNativeSpeechProviderStatus(event), "процесс Termux завершился; факт слышимого воспроизведения не подтверждён");
});
