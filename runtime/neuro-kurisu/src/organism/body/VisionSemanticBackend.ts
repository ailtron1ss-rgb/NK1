export type VisionBackendEvidenceKind='model-output'|'external';

export interface VisionBoundingBox {
  /** Normalized image-space coordinates in [0, 1], origin at top-left. */
  x:number;
  y:number;
  width:number;
  height:number;
}

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
  objects?:Array<{label:string;kind?:'person'|'object'|'place'|'event'|'concept'|'body'|'unknown';confidence01?:number;trackId?:string;sourceId?:string;coordinateFrameId?:string;x?:number;y?:number;z?:number;bbox?:VisionBoundingBox;bboxConfidence01?:number;trackingStatus?:'provider'|'associated'|'new'|'ambiguous'|'untracked'}>;
  relations?:Array<{from:string;relation:string;to:string;confidence01?:number;fromTrackId?:string;toTrackId?:string;fromSourceId?:string;toSourceId?:string}>;
  events?:Array<{label:string;confidence01?:number}>;
  backend:string;
  latencyMs:number;
  evidenceKind:VisionBackendEvidenceKind;
}

export interface VisionSemanticBackend {
  readonly id:string;
  analyze(input:VisionSemanticInput):Promise<VisionSemanticResult>;
}
