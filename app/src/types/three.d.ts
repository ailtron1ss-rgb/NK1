/** Minimal typed surface for the pinned Three.js JS runtime used by the private avatar canvas. */
declare module "three" {
 export type Object3D = any; export type AnimationClip = any; export type KeyframeTrack = any;
 export const Quaternion:any; export const QuaternionKeyframeTrack:any; export const VectorKeyframeTrack:any; export const AnimationClip:any; export const Bone:any; export const Matrix4:any;
 export const ACESFilmicToneMapping:any; export const AnimationMixer:any; export const Box3:any; export const BoxGeometry:any; export const DirectionalLight:any; export const Group:any; export const HemisphereLight:any; export const Mesh:any; export const MeshStandardMaterial:any; export const PerspectiveCamera:any; export const PointLight:any; export const SRGBColorSpace:any; export const Scene:any; export const SphereGeometry:any; export const TorusGeometry:any; export const Vector3:any; export const WebGLRenderer:any;
}
declare module "three/addons/loaders/GLTFLoader.js" { export const GLTFLoader:any; }
