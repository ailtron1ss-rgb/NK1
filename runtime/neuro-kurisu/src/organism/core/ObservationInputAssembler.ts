import type { OrganismObservation } from './types.ts';
import type { P37Input } from '../body/P37EmbodiedSensorium.ts';
import type { OrganismBodyState } from '../body/EmbodiedBody.ts';

export function buildP35BodyInput(observation:OrganismObservation){
  return observation.embodiment ? {
    energy01:observation.embodiment.bodyEnergy01,
    thermal01:observation.embodiment.thermalStrain01,
    capacity01:observation.embodiment.cognitiveCapacity01,
    awake:observation.embodiment.awake,
    sensoryFreshness01:observation.embodiment.sensoryFreshness01,
  } : undefined;
}

export function buildP37Input(observation:OrganismObservation,normalizedObservation:OrganismObservation,at:number):P37Input{
  return {
    text:observation.text,
    vision:observation.vision ? {
      sceneLabel:observation.vision.sceneLabel,
      confidence01:observation.vision.confidence01,
      objects:observation.vision.objects?.map(o=>({...o,kind:o.kind==='body-part'?'body':o.kind})),
      relations:observation.vision.relations,
    } : undefined,
    audio:observation.audio ? {events:observation.audio.events} : undefined,
    worldContext:normalizedObservation.worldContext ? {
      location:normalizedObservation.worldContext.location,
      objects:normalizedObservation.worldContext.objects,
      events:normalizedObservation.worldContext.events,
    } : undefined,
    body:observation.embodiment ? {
      location:normalizedObservation.worldContext?.location,
      energy01:observation.embodiment.bodyEnergy01,
      thermal01:observation.embodiment.thermalStrain01,
      capacity01:observation.embodiment.cognitiveCapacity01,
      awake:observation.embodiment.awake,
      sensoryFreshness01:observation.embodiment.sensoryFreshness01,
    } : undefined,
    at,
  };
}

export function buildPerceptionBody(persistedBody:OrganismBodyState,observation:OrganismObservation,at:number):OrganismBodyState{
  if(!observation.embodiment) return persistedBody;
  return {
    ...persistedBody,
    awake:observation.embodiment.awake,
    bodyEnergy01:observation.embodiment.bodyEnergy01,
    cognitiveCapacity01:observation.embodiment.cognitiveCapacity01,
    thermalStrain01:observation.embodiment.thermalStrain01,
    sensoryFreshness01:observation.embodiment.sensoryFreshness01,
    telemetry:{
      ...persistedBody.telemetry,
      battery01:observation.embodiment.battery01,
      thermalPressure01:observation.embodiment.thermalStrain01,
      cpuLoad01:observation.embodiment.cpuLoad01,
      ramPressure01:observation.embodiment.ramPressure01,
      sampledAt:at,
      staleMs:0,
    },
  };
}
