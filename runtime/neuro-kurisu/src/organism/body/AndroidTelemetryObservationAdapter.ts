import type { BodyTelemetry } from './EmbodiedBody.ts';
export function buildAndroidTelemetryObservation(_input: {
  telemetry: BodyTelemetry;
  previousSampledAt: number;
  requestedSensors: readonly string[];
  consentGranted: boolean;
  sessionId: string;
}): null {
  return null;
}
