export type VisionBackendEvidenceKind='model-output'|'external';

export interface VisionSemanticInput {
  imagePath:string;
  at:number;
  cameraId:number;
  context?:{scene?:string;location?:string;uncertainty01?:number};
}

export interface VisionSemanticResult {
  semantic:boolean;
  sceneLabel?:string;
  confidence01?:number;
  objects?:Array<{label:string;kind?:'person'|'object'|'place'|'event'|'concept'|'body'|'unknown';confidence01?:number;trackId?:string;sourceId?:string;x?:number;y?:number;z?:number}>;
  relations?:Array<{from:string;relation:string;to:string;confidence01?:number}>;
  events?:Array<{label:string;confidence01?:number}>;
  backend:string;
  latencyMs:number;
  evidenceKind:VisionBackendEvidenceKind;
}

export interface VisionSemanticBackend {
  readonly id:string;
  analyze(input:VisionSemanticInput):Promise<VisionSemanticResult>;
}
