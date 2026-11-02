import type { AvatarBrainProjection, AvatarRenderProfile } from './AvatarBrainAffectBridge.ts';

export interface AvatarRendererCapabilities {
  /** Renderer selected by the UI; it must match the projection's profile. */
  profile: AvatarRenderProfile;
  /** Exact model parameter IDs discovered from the loaded renderer/model. */
  parameterIds?: readonly string[];
  /** Expression IDs actually present in the loaded rig/model. */
  expressionIds?: readonly string[];
  /** Renderer-specific control IDs explicitly implemented by the active rig. */
  controlIds?: readonly string[];
}

export interface AvatarRendererCommand {
  target: 'parameter' | 'expression' | 'control';
  id: string;
  value: number;
}

export interface AvatarRendererMapping {
  profile: AvatarRenderProfile;
  compatible: boolean;
  commands: AvatarRendererCommand[];
  skipped: number;
}

type Range = readonly [number, number];
const LIVE2D_RANGES: Record<string, Range> = {
  ParamEyeLOpen: [0, 1], ParamEyeROpen: [0, 1],
  ParamEyeBallX: [-1, 1], ParamEyeBallY: [-1, 1],
  ParamBrowLY: [-1, 1], ParamBrowRY: [-1, 1],
  ParamMouthForm: [-1, 1], ParamMouthOpenY: [0, 1],
  ParamAngleX: [-30, 30], ParamAngleY: [-30, 30], ParamAngleZ: [-30, 30],
};
const LAYERED_CONTROLS: Record<string, keyof AvatarBrainProjection['rendererHints']['layered2d'] | 'gazeX' | 'gazeY'> = {
  parallaxX: 'gazeX', parallaxY: 'gazeY',
  depthBreath01: 'depthBreath01', faceRig01: 'faceRig01',
};
const SPATIAL_CONTROLS: Record<string, keyof AvatarBrainProjection['rendererHints']['spatial3d']> = {
  headPitch: 'headPitch', headYaw: 'headYaw',
  gazeDistance01: 'gazeDistance01', shoulderRelax01: 'shoulderRelax01',
};
const clamp=(value:number,min:number,max:number)=>Math.max(min,Math.min(max,value));
const finite=(value:unknown):value is number=>typeof value==='number'&&Number.isFinite(value);

/**
 * Convert the shared organism projection into an allow-listed command batch.
 * This is deliberately an adapter, not a renderer: it never assumes a model
 * contains a parameter/expression and never calls a vendor SDK.
 */
export function mapAvatarProjectionToRenderer(
  projection: AvatarBrainProjection,
  capabilities: AvatarRendererCapabilities,
): AvatarRendererMapping {
  const compatible=projection.profile===capabilities.profile;
  const result:AvatarRendererMapping={profile:capabilities.profile,compatible,commands:[],skipped:0};
  if(!compatible) return result;

  const parameters=new Set(capabilities.parameterIds??[]);
  const expressions=new Set(capabilities.expressionIds??[]);
  const controls=new Set(capabilities.controlIds??[]);
  const push=(target:AvatarRendererCommand['target'],id:string,value:unknown,range:Range)=>{
    if(!finite(value)){result.skipped++;return;}
    if(!(target==='parameter'?parameters.has(id):target==='expression'?expressions.has(id):controls.has(id))){
      result.skipped++;return;
    }
    result.commands.push({target,id,value:clamp(value,range[0],range[1])});
  };

  if(projection.profile==='2d'){
    for(const [id,range] of Object.entries(LIVE2D_RANGES))
      push('parameter',id,projection.rendererHints.live2d[id],range);
    return result;
  }
  if(projection.profile==='2.5d'){
    for(const [id,source] of Object.entries(LAYERED_CONTROLS)){
      const value=source==='gazeX'?projection.channels.gazeX:
        source==='gazeY'?projection.channels.gazeY:projection.rendererHints.layered2d[source];
      push('control',id,value,source==='gazeX'||source==='gazeY'?[-1,1]:[0,1]);
    }
    return result;
  }

  for(const [id,source] of Object.entries(SPATIAL_CONTROLS))
    push('control',id,projection.rendererHints.spatial3d[source],
      id==='headPitch'||id==='headYaw'?[-1,1]:[0,1]);
  // Expression IDs are model-authored names. Unsupported expressions are skipped,
  // never silently translated into a different emotion.
  push('expression',projection.expression,projection.expressionWeight,[0,1]);
  return result;
}
