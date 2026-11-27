import { type ChangeEvent, useCallback, useEffect, useRef, useState } from "react";
import type { ActionKind, EmotionLabel, AvatarBrainProjectionV1 } from "@/organism/types";
import type { MouthPose } from "./avatar/embodimentTimeline";
import type { AvatarMotorIntentPlan } from "./avatar/motorIntent.ts";
import { resolveVrmArmIntent } from "./avatar/rendererMotorAdapters.ts";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { VRMLoaderPlugin, VRMUtils } from "@pixiv/three-vrm";
import { clearStoredAvatarModel, loadStoredAvatarModel, MAX_AVATAR_MODEL_BYTES, saveAvatarModel } from "./avatar/avatarModelStore";
import * as THREE from "three";
import { auditHumanoidRig } from "./avatar/vrmHumanoidRigAudit";
import { buildVrmHumanoidAuditNodes, parseVrmHumanoidNodeMap } from "./avatar/vrmHumanoidNodeMap";
import { applyVrmExpressionFrame, applyVrmFullBodyChannels, applyVrmNormalizedMotorFrame, configureVrmForNk1NormalizedMotorDrive, resolveVrmLookAtTargetOffset, updateVrmForNk1Frame } from "./avatar/vrmRuntimeAdapter";
import { fingerprintAvatarModel } from "./avatar/avatarModelFingerprint";
import { preflightAvatarModel } from "./avatar/avatarModelPreflight";
import { disposeThreeObjectTree } from "./avatar/threeResourceDisposal";
import { applyAnimeToonMaterials, createProceduralToonMaterial, getSharedAnimeGradientTexture } from "./avatar/threeToonMaterials";
import { KURISU_HYBRID_MODEL } from "./avatar/avatarModelCatalog";
import { resolveGlbMouthMorphWeights } from "./avatar/glbMouthMorphAdapter";
import { resolveGlbFacialMorphWeights } from "./avatar/glbFacialMorphAdapter";
import { resolveGlbSecondaryBoneRotation } from "./avatar/glbSecondaryMotionAdapter";
import { resolveGlbBodyBoneRotation } from "./avatar/glbBodyChannelAdapter";
import { AvatarNeuroAdaptiveDynamics, isAvatarSecondaryDynamicsBoneCandidate, resolveNeuroAdaptiveMorphWeights, resolveNeuroAdaptiveNeuralMultiplier, type AvatarDynamicsQuality, type AvatarNeuroAdaptiveFrame } from "./avatar/avatarNeuroAdaptiveDynamics";
import { auditAvatarSecondaryScene, hasAvatarNeuralFabricEmission, isAvatarNeuralFabricMaterialTagged, type AvatarSecondaryAssetAudit } from "./avatar/avatarSecondaryAssetAudit";
import { attachAvatarSecondaryVertexDynamics, disposeAvatarSecondaryVertexDynamics, updateAvatarSecondaryVertexDynamics, type AvatarSecondaryVertexBinding } from "./avatar/avatarSecondaryVertexDynamics";
import { resolveAvatarCameraFraming } from "./avatar/avatarCameraFraming";
import { fetchRemoteAvatarModel } from "./avatar/remoteAvatarSource";
import { applyAvatarAnimationFrame } from "./avatar/avatarAnimationRuntime";
import { createAvatarPresentationReceipt, type AvatarPresentationReceiptV1 } from "./avatar/avatarPresentationReceipt.ts";
import { createAvatarFrameBudgetController, resolveAvatarFrameBudget, shouldRenderAvatarFrame, shouldRunAvatarRenderLoop } from "./avatar/avatarFrameBudget.ts";

type Props = { frameTick: number; onFrameReceipt?: (receipt: AvatarPresentationReceiptV1) => void; emotion: EmotionLabel; action: ActionKind; motorPlan: AvatarMotorIntentPlan; arousal: number; valence: number; dominance: number; energy: number; cognitiveLoad: number; uncertainty: number; socialNeed: number; novelty: number; goalPressure: number; curiosity: number; predictionError: number; traits: Record<string, number>; gazeX: number; gazeY: number; speaking: boolean; mouthPose: MouthPose; thinking: boolean; awake: boolean; bodyChannels?: Record<string, number>; avatarBrainFrame?: AvatarBrainProjectionV1; onReturnTo2D?: () => void };
type Bone = { node: any; name: string; x: number; y: number; z: number };
type NeuralMaterialBinding = { material: any; baseIntensity: number };
type Runtime = { scene:any; camera:any; renderer:any; cameraBounds:any; body:any; loaded:any; vrm:any; vrmLookAtTarget:any; vrmLookAtFaceFront:any; vrmLookAtOffset:any; mixer:any; clips:any[]; clipName:string; activeClipAction:any; bones:Bone[]; adaptiveDynamics:AvatarNeuroAdaptiveDynamics; secondaryVertexBindings:AvatarSecondaryVertexBinding[]; neuralMaterials:NeuralMaterialBinding[]; yaw:number; dragX:number|null; mood:any; last:number };
function applyAvatarCameraFit(rt:Runtime,bounds:any){
 if(!bounds)return null;
 const fit=resolveAvatarCameraFraming(bounds,rt.camera.fov,Math.max(rt.camera.aspect,0.01),1.18);
 if(!fit)return null;
 rt.cameraBounds=bounds;
 rt.camera.position.set(fit.center.x,fit.center.y,fit.center.z+fit.distance);
 rt.camera.lookAt(fit.center.x,fit.center.y,fit.center.z);
 rt.camera.updateProjectionMatrix();rt.camera.updateMatrixWorld(true);
 return fit;
}
const clamp=(n:number,a:number,b:number)=>Math.max(a,Math.min(b,Number.isFinite(n)?n:0));
const material = createProceduralToonMaterial;
const BODY_PITCH_BY_MOTOR_ACTION: Record<AvatarMotorIntentPlan["action"], number> = {
  rest: 0.035, listen: 0, reflect: -0.026, inspect: -0.016,
  explain: -0.026, comfort: 0.01, respond: 0,
};

function ellipsoid(parent:any,mat:any,pos:[number,number,number],scale:[number,number,number],name:string){
 const m=new THREE.Mesh(new THREE.SphereGeometry(1,24,18),mat);m.name=name;m.position.set(...pos);m.scale.set(...scale);parent.add(m);return m;
}
function box(parent:any,mat:any,pos:[number,number,number],scale:[number,number,number],rz=0,name="part"){
 const m=new THREE.Mesh(new THREE.BoxGeometry(1,1,1),mat);m.name=name;m.position.set(...pos);m.scale.set(...scale);m.rotation.z=rz;parent.add(m);return m;
}
function makeArm(root:any,side:number,skin:any,coat:any){
 const g=new THREE.Group();g.name=side<0?"leftArm":"rightArm";g.position.set(side*.36,1.98,.02);root.add(g);
 ellipsoid(g,coat,[side*.08,-.17,0],[.14,.25,.14],"sleeveUpper");ellipsoid(g,coat,[side*.16,-.42,.035],[.12,.23,.12],"sleeveLower");ellipsoid(g,skin,[side*.18,-.625,.06],[.08,.1,.08],"hand");return g;
}
function makeBody(scene:any){
 const root=new THREE.Group();root.name="NK1Procedural3DBody";scene.add(root);
 const skin=material(0xf4d7c8),skinShade=material(0xdba99f),hair=material(0x87352c,.48),hairLite=material(0xb94d39,.48),hairDark=material(0x55232a),coat=material(0xe9edf2,.88),coatShade=material(0xb9c5d4),shirt=material(0x9aa9b9),tie=material(0xa92339,.5),skirt=material(0x272e3f),tights=material(0x272630),shoes=material(0x171b26),white=material(0xfff8f2,.28),iris=material(0x8069b7,.3),iris2=material(0x44376f,.34),pupil=material(0x1a1b2b,.24),brow=material(0x77322f),mouthMat=material(0x713047),clipMat=material(0xbd3448,.35,.16),cyan=material(0x6ed8ee,.38,.28);
 for(const side of [-1,1]){ellipsoid(root,tights,[side*.155,.57,0],[.125,.51,.14],"leg");ellipsoid(root,shoes,[side*.16,.095,.075],[.13,.085,.24],"shoe");ellipsoid(root,coatShade,[side*.16,.17,.03],[.128,.06,.13],"bootTrim");}
 ellipsoid(root,skirt,[0,1.05,0],[.34,.25,.22],"skirt");ellipsoid(root,coat,[0,1.68,0],[.405,.67,.265],"labCoat");ellipsoid(root,shirt,[0,1.91,.218],[.19,.37,.045],"shirtFront");ellipsoid(root,coatShade,[0,1.23,.005],[.37,.18,.24],"coatHem");
 box(root,coat,[-.105,2.005,.238],[.13,.49,.035],-.22,"leftLapel");box(root,coat,[.105,2.005,.238],[.13,.49,.035],.22,"rightLapel");ellipsoid(root,tie,[0,2.03,.277],[.047,.055,.024],"tieKnot");ellipsoid(root,tie,[0,1.87,.277],[.052,.19,.025],"redTie");
 box(root,coatShade,[-.27,1.56,.211],[.095,.13,.025],-.035,"leftPocket");box(root,coatShade,[.27,1.56,.211],[.095,.13,.025],.035,"rightPocket");
 const leftArm=makeArm(root,-1,skin,coat),rightArm=makeArm(root,1,skin,coat);ellipsoid(root,skin,[0,2.3,0],[.105,.17,.105],"neck");
 const head=new THREE.Group();head.name="headIntent";head.position.set(0,2.69,0);root.add(head);
 ellipsoid(head,hairDark,[0,-.03,-.105],[.38,.465,.335],"backHair");ellipsoid(head,skin,[0,0,.015],[.326,.416,.285],"face");ellipsoid(head,hair,[0,.265,-.015],[.377,.245,.32],"hairCap");ellipsoid(head,hairLite,[-.13,.19,.235],[.17,.13,.105],"leftBangs");ellipsoid(head,hair,[.015,.215,.245],[.17,.16,.09],"centerBangs");ellipsoid(head,hairLite,[.16,.17,.205],[.14,.17,.09],"rightBangs");ellipsoid(head,hair,[-.30,-.20,-.045],[.105,.38,.115],"leftLongLock");ellipsoid(head,hairLite,[.30,-.19,-.035],[.10,.39,.115],"rightLongLock");
 const eyeWhites:any[]=[],irises:any[]=[],brows:any[]=[];
 for(const side of [-1,1]){eyeWhites.push(ellipsoid(head,white,[side*.126,.035,.258],[.072,.101,.034],"eyeWhite"));irises.push(ellipsoid(head,iris,[side*.126,.026,.289],[.043,.071,.025],"iris"));ellipsoid(head,iris2,[side*.126,.014,.309],[.028,.047,.013],"irisShade");ellipsoid(head,pupil,[side*.126,.029,.313],[.019,.045,.012],"pupil");ellipsoid(head,white,[side*.139,.054,.324],[.011,.017,.008],"eyeSpark");brows.push(ellipsoid(head,brow,[side*.128,.159,.267],[.077,.017,.018],"eyebrow"));}
 const mouth=ellipsoid(head,mouthMat,[0,-.112,.286],[.052,.018,.018],"mouthViseme");ellipsoid(head,skinShade,[0,-.055,.291],[.018,.025,.014],"nose");ellipsoid(head,skinShade,[-.205,-.06,.205],[.052,.063,.035],"leftEar");ellipsoid(head,skinShade,[.205,-.06,.205],[.052,.063,.035],"rightEar");box(head,clipMat,[.228,.255,.282],[.10,.035,.028],-.34,"redHairClip");box(head,cyan,[.228,.255,.301],[.056,.008,.008],-.34,"clipHighlight");
 const ringMat=new THREE.MeshStandardMaterial({color:0x2d8198,roughness:.4,metalness:.42,transparent:true,opacity:.5}),ring=new THREE.Mesh(new THREE.TorusGeometry(.62,.012,8,80),ringMat);ring.name="bodyPlatform";ring.rotation.x=Math.PI/2;ring.position.y=.035;root.add(ring);
 return {root,head,leftArm,rightArm,mouth,eyeWhites,irises,brows,ringMat};
}
function disposeTree(root:any){const gradient=getSharedAnimeGradientTexture();disposeThreeObjectTree(root,gradient?[gradient]:[]);}
function bonesOf(root:any):Bone[]{const out:Bone[]=[];root.traverse((node:any)=>{if(node.isBone)out.push({node,name:String(node.name||"").toLowerCase().replace(/[^a-z0-9]/g,""),x:node.rotation.x,y:node.rotation.y,z:node.rotation.z});});return out;}
function createAvatarNeuroAdaptiveFrame(p:Props,deltaSeconds:number,quality:AvatarDynamicsQuality):AvatarNeuroAdaptiveFrame{
 return {deltaSeconds,awake:p.awake,energy:clamp(p.energy,0,1),arousal:clamp(p.arousal,0,1),cognitiveLoad:clamp(p.cognitiveLoad,0,1),uncertainty:clamp(p.uncertainty,0,1),curiosity:clamp(p.curiosity,0,1),novelty:clamp(p.novelty,0,1),predictionError:clamp(p.predictionError,0,1),action:p.action,quality,bodyChannels:p.bodyChannels??{}};
}
function collectAvatarNeuralMaterials(root:any):NeuralMaterialBinding[]{
 const result:NeuralMaterialBinding[]=[];const seen=new Set<any>();
 root.traverse((node:any)=>{
  if(!node.isMesh)return;
  const materials=Array.isArray(node.material)?node.material:node.material?[node.material]:[];
  for(const material of materials){
   if(!material||seen.has(material))continue;
   if(!isAvatarNeuralFabricMaterialTagged(material)||!hasAvatarNeuralFabricEmission(material))continue;
   seen.add(material);
   const baseIntensity=Number.isFinite(material.emissiveIntensity)?material.emissiveIntensity:1;
   result.push({material,baseIntensity});
  }
 });
 return result;
}
function updateAvatarNeuralMaterials(materials:readonly NeuralMaterialBinding[],frame:AvatarNeuroAdaptiveFrame):void{
 const multiplier=resolveNeuroAdaptiveNeuralMultiplier(frame);
 for(const binding of materials){
  if(!binding.material||!Number.isFinite(binding.baseIntensity))continue;
  binding.material.emissiveIntensity=clamp(binding.baseIntensity*multiplier,0,3);
 }
}
export function Avatar3DStage(props:Props){
 const host=useRef<HTMLDivElement>(null),fileInput=useRef<HTMLInputElement>(null),runtime=useRef<Runtime|null>(null),latest=useRef(props),loadToken=useRef(0),lastFrameReceiptKey=useRef("");
 const remoteLoadAbort=useRef<AbortController|null>(null);
 const [remoteModelUrl,setRemoteModelUrl]=useState("");
 const [ready,setReady]=useState(false),[modelName,setModelName]=useState(""),[modelFingerprint,setModelFingerprint]=useState(""),[state,setState]=useState<"empty"|"loading"|"loaded"|"error"|"webgl-unavailable">("empty"),[message,setMessage]=useState(""),[storageMessage,setStorageMessage]=useState("3D-модель не загружена. Процедурная геометрия намеренно скрыта.");
 const [secondaryAudit,setSecondaryAudit]=useState<AvatarSecondaryAssetAudit|null>(null);
 const [secondaryVertexMeshCount,setSecondaryVertexMeshCount]=useState(0);
 const [secondaryParticleMeshCount,setSecondaryParticleMeshCount]=useState(0);
 latest.current=props;
 const loadModel=useCallback(async(blob:Blob,name:string,persist:boolean)=>{
  if(!blob.size||blob.size>MAX_AVATAR_MODEL_BYTES){setState("error");setMessage("Файл должен быть непустым и не больше 90 МБ.");return;}
  const rt=runtime.current;if(!rt){setState("error");setMessage("3D-сцена ещё запускается; повторите загрузку.");return;}
  const token=++loadToken.current;setState("loading");setMessage("Проверка GLB/VRM и загрузка локальной модели…");
  try{const data=await blob.arrayBuffer();if(token!==loadToken.current)return;const preflight=preflightAvatarModel(data,name);if(token!==loadToken.current)return;setMessage(preflight.format==="vrm"?"Проверен контейнер VRM; загрузка…":"Проверен контейнер GLB; загрузка…");const fingerprint=await fingerprintAvatarModel(data);if(token!==loadToken.current)return;setModelFingerprint(fingerprint??"");const loader=new GLTFLoader();loader.register((parser:any)=>new VRMLoaderPlugin(parser, { autoUpdateHumanBones: true }));loader.parse(data,"",(gltf:any)=>{
   if(token!==loadToken.current||runtime.current!==rt){const staleVrm=gltf.userData?.vrm??null;if(staleVrm)VRMUtils.deepDispose(staleVrm.scene);else disposeTree(gltf.scene);return;}
   try{const vrm=gltf.userData?.vrm??null;const fileName=name;if (fileName.toLowerCase().endsWith(".vrm") && !vrm)throw new Error("VRM runtime не распознал humanoid/VRM extension этого файла.");const root=vrm?.scene??gltf.scene;if(!root)throw new Error("В файле нет glTF-сцены.");
    const vrmNodeMap=parseVrmHumanoidNodeMap(gltf.parser?.json?.extensions,gltf.parser?.json?.nodes?.length??0);
    let humanoidAudit:any;
    if(vrmNodeMap.status==="valid"){
      const activeSceneNodes:any[]=[];root.traverse((node:any)=>activeSceneNodes.push(node));
      const mapped=buildVrmHumanoidAuditNodes(activeSceneNodes,gltf.parser?.associations,vrmNodeMap);
      const mappingWarnings=[...vrmNodeMap.unsupportedRoles.map((role)=>"Unsupported VRM humanoid role: "+role),...mapped.unresolvedRoles.map((role)=>"VRM node index was not found in the active loaded scene: "+role)];
      humanoidAudit=auditHumanoidRig(mapped.nodes,{vrmVersion:vrmNodeMap.version,allowNameHeuristic:false,mappingWarnings});
    }else if(vrmNodeMap.status==="invalid"){
      const sceneBones:any[]=[];root.traverse((node:any)=>{if(node.isBone)sceneBones.push({name:node.name,parent:node.parent,isBone:true});});
      humanoidAudit=auditHumanoidRig(sceneBones,{allowNameHeuristic:false,mappingWarnings:["VRM humanoid extension rejected: "+vrmNodeMap.reason]});
    }else{
      const sceneNodes:any[]=[];root.traverse((node:any)=>sceneNodes.push({name:node.name,parent:node.parent,isBone:node.isBone===true}));
      humanoidAudit=auditHumanoidRig(sceneNodes);
    }
    if(vrm){configureVrmForNk1NormalizedMotorDrive(vrm);VRMUtils.rotateVRM0(vrm);VRMUtils.removeUnnecessaryVertices(gltf.scene);VRMUtils.combineSkeletons(gltf.scene);VRMUtils.combineMorphs(vrm);}if(!vrm)applyAnimeToonMaterials(root);const bounds=new THREE.Box3().setFromObject(root),size=new THREE.Vector3(),center=new THREE.Vector3();bounds.getSize(size);bounds.getCenter(center);const max=Math.max(size.x,size.y,size.z);if(!Number.isFinite(max)||max<.0001)throw new Error("У модели нет видимой геометрии.");const scale=3.15/max;root.scale.setScalar(scale);root.position.set(-center.x*scale,-bounds.min.y*scale+.04,-center.z*scale);
    root.updateMatrixWorld(true);
    const normalizedBounds=new THREE.Box3().setFromObject(root);
    const cameraBounds={
      min:{x:normalizedBounds.min.x,y:normalizedBounds.min.y,z:normalizedBounds.min.z},
      max:{x:normalizedBounds.max.x,y:normalizedBounds.max.y,z:normalizedBounds.max.z},
    };
    const framing=applyAvatarCameraFit(rt,cameraBounds);
    if(!framing)throw new Error("Не удалось рассчитать безопасное кадрирование модели.");
    // Capture asset-space geometry and humanoid up-axis before normalization.
    // This distinguishes a Z-up/sideways export from a camera-framing regression.
    root.updateMatrixWorld(true);
    const sourceBounds = new THREE.Box3().setFromObject(root);
    const sourceSize = new THREE.Vector3();
    sourceBounds.getSize(sourceSize);
    const sourceHeadToHips = (() => {
      let headNode: any = null;
      let hipsNode: any = null;
      root.traverse((node: any) => {
        if (!node.isBone || typeof node.name !== "string") return;
        const name = node.name.toLowerCase().replace(/[^a-z0-9]/g, "");
        if (!headNode && name.endsWith("head")) headNode = node;
        if (!hipsNode && (name.endsWith("hips") || name.endsWith("pelvis"))) hipsNode = node;
      });
      if (!headNode || !hipsNode) return null;
      const head = root.worldToLocal(headNode.getWorldPosition(new THREE.Vector3()));
      const hips = root.worldToLocal(hipsNode.getWorldPosition(new THREE.Vector3()));
      const direction = head.sub(hips);
      const magnitude = direction.length();
      if (!Number.isFinite(magnitude) || magnitude < 1e-6) return null;
      direction.normalize();
      return { x: direction.x, y: direction.y, z: direction.z };
    })();
    const sourceAxisDiagnostics = {
      boundsSize: { x: sourceSize.x, y: sourceSize.y, z: sourceSize.z },
      headToHips: sourceHeadToHips,
      dominantBoundsAxis: sourceSize.x >= sourceSize.y && sourceSize.x >= sourceSize.z
        ? "x" : sourceSize.y >= sourceSize.z ? "y" : "z",
      sourceMaxDimension: Math.max(sourceSize.x, sourceSize.y, sourceSize.z),
    };
    rt.renderer.domElement.dataset.avatarModelAxisDiagnostics = JSON.stringify(sourceAxisDiagnostics);
    let modelMeshCount=0,visibleModelMeshCount=0,skinnedModelMeshCount=0;
    root.traverse((n:any)=>{
      if(!n.isMesh)return;
      modelMeshCount++;
      if(n.isSkinnedMesh)skinnedModelMeshCount++;
      const materials=Array.isArray(n.material)?n.material:n.material?[n.material]:[];
      if(n.visible!==false&&materials.some((material:any)=>material&&material.visible!==false))visibleModelMeshCount++;
      if(vrm)n.frustumCulled=false;
      for(const material of materials){if(material&&"roughness"in material)material.roughness=clamp(Number(material.roughness??.8),.18,1);}
    });
    if(modelMeshCount===0||visibleModelMeshCount===0)throw new Error("GLB загружен, но в активной сцене нет видимых mesh-узлов.");
    const projectedCenter=new THREE.Vector3(framing.center.x,framing.center.y,framing.center.z).project(rt.camera);
    rt.renderer.domElement.dataset.avatarModelMeshCount=String(modelMeshCount);
    rt.renderer.domElement.dataset.avatarVisibleMeshCount=String(visibleModelMeshCount);
    rt.renderer.domElement.dataset.avatarSkinnedMeshCount=String(skinnedModelMeshCount);
    rt.renderer.domElement.dataset.avatarCameraDistance=String(framing.distance);
    rt.renderer.domElement.dataset.avatarProjectedCenterX=String(projectedCenter.x);
    rt.renderer.domElement.dataset.avatarProjectedCenterY=String(projectedCenter.y);
    if(rt.loaded){disposeAvatarSecondaryVertexDynamics(rt.secondaryVertexBindings);rt.secondaryVertexBindings=[];rt.scene.remove(rt.loaded);if(rt.vrm){if(rt.vrm.lookAt?.target===rt.vrmLookAtTarget)rt.vrm.lookAt.target=null;rt.vrmLookAtTarget=null;rt.vrmLookAtFaceFront=null;rt.vrmLookAtOffset=null;VRMUtils.deepDispose(rt.loaded);}else disposeTree(rt.loaded);}rt.mixer?.stopAllAction();rt.activeClipAction=null;rt.loaded=root;rt.vrm=vrm;rt.vrmLookAtTarget=null;rt.vrmLookAtFaceFront=null;rt.vrmLookAtOffset=null;rt.scene.add(root);if(vrm?.lookAt&&typeof vrm.humanoid?.getRawBoneNode==="function"&&typeof vrm.lookAt.getFaceFrontQuaternion==="function"){const rawHead=vrm.humanoid.getRawBoneNode("head");if(rawHead?.add){const target=new THREE.Object3D();target.name="NK1VrmEyeGazeTarget";const faceFront=vrm.lookAt.getFaceFrontQuaternion(new THREE.Quaternion());const offset=resolveVrmLookAtTargetOffset(0,0);target.position.set(offset.x,offset.y,offset.z).applyQuaternion(faceFront);rawHead.add(target);vrm.lookAt.target=target;vrm.lookAt.autoUpdate=true;rt.vrmLookAtTarget=target;rt.vrmLookAtFaceFront=faceFront;rt.vrmLookAtOffset=new THREE.Vector3();}}rt.body.root.visible=false;rt.bones=bonesOf(root);rt.adaptiveDynamics.reset();rt.secondaryVertexBindings=attachAvatarSecondaryVertexDynamics(root,scale);setSecondaryVertexMeshCount(rt.secondaryVertexBindings.length);setSecondaryParticleMeshCount(rt.secondaryVertexBindings.filter((binding)=>!!binding.particleState).length);rt.renderer.domElement.dataset.avatarSecondaryParticleMeshCount=String(rt.secondaryVertexBindings.filter((binding)=>!!binding.particleState).length);rt.neuralMaterials=collectAvatarNeuralMaterials(root);setSecondaryAudit(auditAvatarSecondaryScene(root));rt.clips=Array.isArray(gltf.animations)?gltf.animations:[];rt.mixer=!vrm&&rt.clips.length?new THREE.AnimationMixer(root):null;rt.clipName="";setModelName(name);setState("loaded");const caps=humanoidAudit.capabilities;const capabilitySummary=[caps.torso?"торс":"без торса",caps.head?"голова":"без головы",caps.bilateralArms?"две руки":"неполные руки",caps.bilateralHands?"две кисти":"без двух кистей",caps.bilateralLegs?"две ноги":"неполные ноги",caps.bilateralFeet?"две стопы":"неполные стопы",caps.fingerArticulation?"пальцы артикулируются":"артикуляция пальцев не подтверждена"];const leftArmAvailable=!!humanoidAudit.nodes.leftUpperArm&&!!humanoidAudit.nodes.leftLowerArm;const rightArmAvailable=!!humanoidAudit.nodes.rightUpperArm&&!!humanoidAudit.nodes.rightLowerArm;const hasAuditedRig=Object.keys(humanoidAudit.nodes).length>0||rt.bones.length>0;const mappingDescription=humanoidAudit.mappingMethod==="conservative-name-heuristic"?"по именам Bone (эвристика)":`по glTF node index (VRM ${vrmNodeMap.status==="valid"?vrmNodeMap.version:"metadata"})`;const completeness=caps.fullBodyHumanoid?(humanoidAudit.mappingMethod==="conservative-name-heuristic"?"полная иерархия по именам Bone; не подтверждает VRM runtime":`обязательная иерархия VRM ${vrmNodeMap.status==="valid"?vrmNodeMap.version:""} подтверждена по glTF node index и ancestry; IK/retargeting не подтверждены`):(vrmNodeMap.status==="invalid"?"VRM metadata отклонены; эвристический fallback заблокирован":"полный Humanoid Rig не подтверждён");setMessage(hasAuditedRig?`Модель загружена. Rig audit ${mappingDescription}: ${capabilitySummary.join(" · ")}. ${completeness}. Цепи рук: ${leftArmAvailable?"левая":""}${leftArmAvailable&&rightArmAvailable?" и ":""}${rightArmAvailable?"правая":""}${!leftArmAvailable&&!rightArmAvailable?"не распознаны":""}. IK не включается этим аудитом.`:"Геометрия загружена; humanoid-узлы и Bone-скелет не подтверждены, движения тела ограничены.");
    if(persist)void saveAvatarModel(blob,name).then(()=>setStorageMessage("Модель сохранена в IndexedDB; следующие запуски используют локальную копию.")).catch(()=>setStorageMessage("Модель загружена, но браузер не разрешил сохранить её между сессиями."));else setStorageMessage("Восстановлена локальная модель из хранилища браузера.");
   }catch(e){const failedVrm=gltf.userData?.vrm??null;if(failedVrm)VRMUtils.deepDispose(failedVrm.scene);else disposeTree(gltf.scene);setState("error");setMessage(e instanceof Error?e.message:"Не удалось подготовить модель.");}
  },()=>{if(token!==loadToken.current)return;setState("error");setMessage("Не прочитан бинарный VRM/GLB. Нужен самодостаточный файл с геометрией и текстурами внутри.");});
  }catch(e){if(token!==loadToken.current)return;setState("error");setMessage(e instanceof Error?e.message:"Ошибка чтения модели.");}
 },[]);
 const loadBundledModel=useCallback(async()=>{
  const token=++loadToken.current;
  setState("loading");setMessage("Загрузка закреплённой онлайн-модели Курису v5 и проверка SHA-256…");
  try{
   const response=await fetch(KURISU_HYBRID_MODEL.url,{mode:"cors",credentials:"omit",cache:"force-cache",signal:AbortSignal.timeout(25_000)});
   if(token!==loadToken.current)return;
   if(!response.ok)throw new Error(`Не удалось получить модель Курису (HTTP ${response.status}).`);
   const contentType=(response.headers.get("content-type")??"").split(";")[0].trim().toLowerCase();
   if(contentType!=="model/gltf-binary")throw new Error("CDN вернул неожиданный тип содержимого; GLB не будет передан парсеру.");
   const declaredLength=Number(response.headers.get("content-length"));
   if(Number.isFinite(declaredLength)&&declaredLength>0&&declaredLength!==KURISU_HYBRID_MODEL.sizeBytes)throw new Error("Content-Length модели не совпадает с закреплённым манифестом.");
   const blob=await response.blob();
   if(token!==loadToken.current)return;
   if(blob.size!==KURISU_HYBRID_MODEL.sizeBytes)throw new Error("Размер онлайн-модели не совпадает с закреплённым манифестом.");
   const data=await blob.arrayBuffer();
   const fingerprint=await fingerprintAvatarModel(data);
   if(token!==loadToken.current)return;
   if(fingerprint!==KURISU_HYBRID_MODEL.sha256)throw new Error("SHA-256 модели не совпадает; загрузка заблокирована.");
   await loadModel(blob,KURISU_HYBRID_MODEL.filename,true);
  }catch(error){
   if(token!==loadToken.current)return;
   setState("error");setMessage(error instanceof Error?error.message:"Не удалось загрузить онлайн-модель Курису v5.");
  }
 },[loadModel]);
 useEffect(()=>{
  const el=host.current;if(!el)return;let renderer:any;let raf=0;let scheduleTimer:number|null=null;let observer:ResizeObserver|null=null;let intersectionObserver:IntersectionObserver|null=null;let disposed=false;
  const browserNavigator=navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };
  const baseBudget=resolveAvatarFrameBudget({
   reducedMotion:typeof window.matchMedia==="function"&&window.matchMedia("(prefers-reduced-motion: reduce)").matches,
   saveData:browserNavigator.connection?.saveData===true,
   deviceMemoryGiB:browserNavigator.deviceMemory,
   hardwareConcurrency:browserNavigator.hardwareConcurrency,
  });
  const frameBudget=createAvatarFrameBudgetController(baseBudget);
  let pageVisible=document.visibilityState!=="hidden";let intersectsViewport=true;let webglContextLost=false;let lastRenderedAt:number|null=null;
  const cancelScheduledFrame=()=>{if(raf){cancelAnimationFrame(raf);raf=0;}if(scheduleTimer!==null){window.clearTimeout(scheduleTimer);scheduleTimer=null;}};
  try{
   renderer=new THREE.WebGLRenderer({alpha:true,antialias:true,powerPreference:"low-power"});renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,frameBudget.snapshot().maxPixelRatio,2));renderer.setSize(Math.max(el.clientWidth,1),Math.max(el.clientHeight,1),false);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.08;renderer.shadowMap.enabled=false;renderer.domElement.style.cssText="display:block;width:100%;height:100%;touch-action:none;cursor:grab";renderer.domElement.setAttribute("aria-label","3D-модель Курису, потяните для поворота");el.appendChild(renderer.domElement);
   const scene=new THREE.Scene();const camera=new THREE.PerspectiveCamera(31,Math.max(el.clientWidth,1)/Math.max(el.clientHeight,1),.1,100);camera.position.set(0,1.78,6.65);camera.lookAt(0,1.69,0);
   scene.add(new THREE.HemisphereLight(0xd8e9ff,0x352432,2.15));const key=new THREE.DirectionalLight(0xffe2d0,3);key.position.set(-3.5,5.5,4.5);scene.add(key);const fill=new THREE.DirectionalLight(0x82d8f4,1.25);fill.position.set(4,3,2.5);scene.add(fill);const rim=new THREE.DirectionalLight(0xbca3ff,1.15);rim.position.set(.5,3,-4);scene.add(rim);const mood=new THREE.PointLight(0x76c8e6,.58,7.5);mood.position.set(0,2.2,1.2);scene.add(mood);
   const body=makeBody(scene);body.root.visible=false;const rt:Runtime={scene,camera,renderer,cameraBounds:null,body,loaded:null,vrm:null,vrmLookAtTarget:null,vrmLookAtFaceFront:null,vrmLookAtOffset:null,mixer:null,clips:[],clipName:"",activeClipAction:null,bones:[],adaptiveDynamics:new AvatarNeuroAdaptiveDynamics(),secondaryVertexBindings:[],neuralMaterials:[],yaw:0,dragX:null,mood,last:performance.now()};runtime.current=rt;
   const resize=()=>{if(disposed)return;const w=Math.max(el.clientWidth,1),h=Math.max(el.clientHeight,1);camera.aspect=w/h;camera.updateProjectionMatrix();if(rt.cameraBounds){const fit=applyAvatarCameraFit(rt,rt.cameraBounds);if(fit&&rt.loaded){renderer.domElement.dataset.avatarCameraDistance=String(fit.distance);}}renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,frameBudget.snapshot().maxPixelRatio,2));renderer.setSize(w,h,false);};observer=typeof ResizeObserver!=="undefined"?new ResizeObserver(resize):null;observer?.observe(el);window.addEventListener("resize",resize);
  let animate:(now:number)=>void;
  const canRender=()=>!disposed&&runtime.current===rt&&(shouldRunAvatarRenderLoop(pageVisible,intersectsViewport,!webglContextLost)||(pageVisible&&!webglContextLost&&renderer.domElement.dataset.avatarPixelAuditRequested==="true"));
  const scheduleNextFrame=()=>{if(!canRender()||raf!==0||scheduleTimer!==null)return;const budget=frameBudget.snapshot();if(lastRenderedAt!==null){const remaining=1000/budget.targetFps-(performance.now()-lastRenderedAt);if(remaining>1){scheduleTimer=window.setTimeout(()=>{scheduleTimer=null;if(canRender())raf=requestAnimationFrame(animate);},Math.ceil(remaining));return;}}raf=requestAnimationFrame(animate);};
  const syncRenderActivity=()=>{if(!canRender())cancelScheduledFrame();else scheduleNextFrame();};
  const onWebGlContextLost=(event:Event)=>{event.preventDefault();if(webglContextLost)return;webglContextLost=true;cancelScheduledFrame();setState("webgl-unavailable");setMessage("Графический контекст потерян; 3D-рендер приостановлен до восстановления браузером.");setStorageMessage("Модель сохранена в памяти сцены. При восстановлении WebGL рендер попробует продолжиться без повторной загрузки файла.");};
  const onWebGlContextRestored=()=>{if(!webglContextLost||disposed||runtime.current!==rt)return;webglContextLost=false;resize();setState(rt.loaded?"loaded":"empty");setMessage(rt.loaded?"3D-модель восстановлена после потери графического контекста.":"Графический контекст восстановлен; ожидается проверенная модель.");setStorageMessage(rt.loaded?"Рендер возобновлён; повторная загрузка модели не требуется.":"3D-сцена восстановлена.");syncRenderActivity();};
  renderer.domElement.addEventListener("webglcontextlost",onWebGlContextLost,false);
  renderer.domElement.addEventListener("webglcontextrestored",onWebGlContextRestored,false);const onPixelAuditRequest=()=>{if(canRender())scheduleNextFrame();};renderer.domElement.addEventListener("nk1:avatar-pixel-audit-request",onPixelAuditRequest);
  const onVisibilityChange=()=>{pageVisible=document.visibilityState!=="hidden";syncRenderActivity();};document.addEventListener("visibilitychange",onVisibilityChange);
  intersectionObserver=typeof IntersectionObserver!=="undefined"?new IntersectionObserver((entries)=>{const entry=entries.find((item)=>item.target===el);if(!entry)return;intersectsViewport=entry.isIntersecting&&entry.intersectionRatio>0;syncRenderActivity();}):null;intersectionObserver?.observe(el);
   const down=(e:PointerEvent)=>{rt.dragX=e.clientX;renderer.domElement.style.cursor="grabbing";try{renderer.domElement.setPointerCapture(e.pointerId);}catch{}};const move=(e:PointerEvent)=>{if(rt.dragX===null)return;rt.yaw+=(e.clientX-rt.dragX)*.008;rt.dragX=e.clientX;};const up=()=>{rt.dragX=null;renderer.domElement.style.cursor="grab";};renderer.domElement.addEventListener("pointerdown",down);renderer.domElement.addEventListener("pointermove",move);renderer.domElement.addEventListener("pointerup",up);renderer.domElement.addEventListener("pointercancel",up);
   animate=(now:number)=>{raf=0;if(!canRender())return;const budget=frameBudget.snapshot();if(!shouldRenderAvatarFrame(now,lastRenderedAt,budget)){scheduleNextFrame();return;}const renderStartedAt=performance.now();const dt=lastRenderedAt===null?0:Math.min(.05,Math.max(0,(now-lastRenderedAt)/1000));rt.last=now;const t=now/1000,p=latest.current,b=rt.body,brainFrame=p.avatarBrainFrame,brain=brainFrame?.channels,brainAffect=brainFrame?.affect,active=p.awake?1:.22,energy=clamp(p.energy,0,1),load=clamp(p.cognitiveLoad,0,1),uncertainty=clamp(p.uncertainty,0,1),social=clamp(p.socialNeed,0,1),novelty=clamp(p.novelty,0,1),curiosity=clamp(p.curiosity,0,1),goal=clamp(p.goalPressure,0,1),error=clamp(p.predictionError,0,1),dominance=clamp(p.dominance,0,1),valence=clamp(p.valence,0,1),warmth=clamp(p.traits.warmth??.5,0,1),sarcasm=clamp(p.traits.sarcasm??.5,0,1),guarded=clamp(p.traits.guardedness??.5,0,1),composure=clamp(p.traits.composure??.5,0,1);const armIntent=resolveVrmArmIntent(p.motorPlan,{emotion:p.emotion,speaking:p.speaking,awake:p.awake,cognitiveLoad:load,socialNeed:social,guardedness:guarded});if(b.root.visible){b.root.position.y=Math.sin(t*(p.awake?1.5+.5*energy:.45))*(.004+.018*energy);b.root.rotation.y=rt.yaw+Math.sin(t*.29)*(.006+.014*uncertainty);b.root.rotation.x=BODY_PITCH_BY_MOTOR_ACTION[p.motorPlan.action]+(goal-.35)*.045+load*.022-dominance*.018+(1-energy)*.035;b.head.rotation.x=-clamp(p.gazeY,-1,1)*.1+(p.thinking?-.035:0)-load*.045+(1-energy)*.05;b.head.rotation.y=clamp(p.gazeX,-1,1)*(.2-social*.075)+(brain?.headYaw??0)*.08+Math.sin(t*.6)*(.014*active+uncertainty*.025+novelty*.012+curiosity*.012);b.head.rotation.z=p.motorPlan.headTilt;
    b.leftArm.rotation.z+=(armIntent.leftArmIntent-b.leftArm.rotation.z)*Math.min(1,dt*4.5);b.rightArm.rotation.z+=(armIntent.rightArmIntent-b.rightArm.rotation.z)*Math.min(1,dt*4.5);
    b.mouth.scale.y=.014+clamp(p.speaking?p.mouthPose.open:0,0,1)*.07;b.mouth.scale.x=.045+clamp(p.speaking?Math.abs(p.mouthPose.form):0,0,1)*.035;b.mouth.rotation.z=(valence-.5)*.22+sarcasm*.025+(brain?.mouthSmile??0)*.12;const baseEye=p.emotion==="sadness"?.76:p.emotion==="anger"||p.emotion==="frustration"?.68:p.emotion==="curiosity"||p.emotion==="anxiety"?1.12:1;const eye=baseEye*(.76+energy*.24)*(1-load*.12)*(1+error*.1)*(.78+(brain?.eyeOpen??1)*.22);b.eyeWhites.forEach((e:any)=>{e.scale.y=.101*eye;e.position.y=.035-clamp(p.gazeY,-1,1)*.018;});b.irises.forEach((e:any,i:number)=>{e.position.x=(i===0?-.126:.126)+clamp(p.gazeX,-1,1)*.024;e.position.y=.026-clamp(p.gazeY,-1,1)*.018;});b.brows.forEach((e:any,i:number)=>{const side=i===0?-1:1;e.rotation.z=(p.emotion==="anger"||p.emotion==="frustration"?(i===0?-.22:.22):p.emotion==="sadness"||p.emotion==="anxiety"?(i===0?.12:-.12):p.thinking?(i===0?-.06:.06):0)+side*(load*.1+(uncertainty-.5)*.05-sarcasm*.025+(brain?.browRaise??0)*.05-(brain?.browFurrow??0)*.1);});
    b.ringMat.opacity=.28+clamp(p.arousal,0,1)*.25+error*.12+goal*.08;}const hue:Record<EmotionLabel,number>={curiosity:0x68d9ed,calm:0x76c8e6,joy:0xffa7bd,anxiety:0x858bd6,frustration:0xf27c6f,sadness:0x6e83c7,anger:0xff525e,protective:0xd9a4f5};rt.mood.color.setHex(hue[p.emotion]);rt.mood.intensity=.24+clamp(p.arousal,0,1)*.42+error*.16+uncertainty*.08;
    if(rt.loaded){const adaptiveFrame=createAvatarNeuroAdaptiveFrame(p,dt,frameBudget.snapshot().tier);updateAvatarSecondaryVertexDynamics(rt.secondaryVertexBindings,adaptiveFrame,t);if(rt.mixer){const animation=applyAvatarAnimationFrame({mixer:rt.mixer,clips:rt.clips,action:p.action,previousAction:rt.activeClipAction,previousClipName:rt.clipName,awake:p.awake,energy});rt.activeClipAction=animation.activeAction;rt.clipName=animation.clipName;}/* Reset to bind pose before the mixer so offsets do not accumulate; then add motor intent on top of the clip. */rt.bones.forEach((bone)=>{bone.node.rotation.set(bone.x,bone.y,bone.z);});rt.mixer?.update(dt);if(rt.vrm){if(rt.vrmLookAtTarget){const targetOffset=resolveVrmLookAtTargetOffset(p.gazeX,p.gazeY);const desiredOffset=rt.vrmLookAtOffset.set(targetOffset.x,targetOffset.y,targetOffset.z).applyQuaternion(rt.vrmLookAtFaceFront);const gazeBlend=1-Math.exp(-dt*14);rt.vrmLookAtTarget.position.lerp(desiredOffset,gazeBlend);}applyVrmNormalizedMotorFrame(rt.vrm,{action:p.action,emotion:p.emotion,gazeX:p.gazeX,gazeY:p.gazeY,gazeViaLookAt:Boolean(rt.vrmLookAtTarget),cognitiveLoad:load,energy,socialNeed:social,uncertainty,speaking:p.speaking,headTilt:p.motorPlan.headTilt,headYaw:p.bodyChannels?.headYaw??brain?.headYaw??0,headPitch:p.bodyChannels?.headPitch,headRoll:p.bodyChannels?.headRoll,leftArmIntent:p.bodyChannels?.leftShoulder??armIntent.leftArmIntent,rightArmIntent:p.bodyChannels?.rightShoulder??armIntent.rightArmIntent});applyVrmFullBodyChannels(rt.vrm,p.bodyChannels??{});}else{rt.bones.forEach((bone)=>{const n=bone.name;if(n.includes("head")||n.includes("neck")){bone.node.rotation.x+=-clamp(p.gazeY,-1,1)*.12-load*.035+(1-energy)*.04;bone.node.rotation.y+=clamp(p.gazeX,-1,1)*(.22-social*.05)+uncertainty*.025;bone.node.rotation.z+=p.motorPlan.headTilt;}const bodyRotation=resolveGlbBodyBoneRotation(n,p.bodyChannels??{});bone.node.rotation.x+=bodyRotation.x;bone.node.rotation.y+=bodyRotation.y;bone.node.rotation.z+=bodyRotation.z;const secondaryMetadata=bone.node?.userData?.nk1Secondary;if(!isAvatarSecondaryDynamicsBoneCandidate(n,secondaryMetadata)){const secondary=resolveGlbSecondaryBoneRotation(n,{timeSeconds:t,awake:p.awake,energy,action:p.action,bodyChannels:p.bodyChannels??{}});if(secondary){bone.node.rotation.x+=secondary.x;bone.node.rotation.y+=secondary.y;bone.node.rotation.z+=secondary.z;}}});rt.loaded.traverse((node:any)=>{if(!node.isMesh||!node.morphTargetDictionary||!node.morphTargetInfluences)return;const mouthWeights=resolveGlbMouthMorphWeights(node.morphTargetDictionary,p.mouthPose,p.speaking);for(const target of mouthWeights)node.morphTargetInfluences[target.index]=target.value;for(const [key,index]of Object.entries(node.morphTargetDictionary)){const k=String(key).toLowerCase().replace(/[^a-z0-9]/g,"");let value:number|null=null;if(/happy|joy|smile/.test(k))value=p.emotion==="joy"?.75:p.emotion==="protective"?.22:p.emotion==="calm"?warmth*.16:0;else if(/sad|sorrow|cry/.test(k))value=p.emotion==="sadness"||p.emotion==="anxiety"?.62:0;else if(/angry|anger|frown/.test(k))value=p.emotion==="anger"||p.emotion==="frustration"?.7:0;else if(/blink|eyeclose/.test(k))value=Math.sin(t*.83)>.994&&p.awake?.92:0;if(value!==null)node.morphTargetInfluences[Number(index)]=value;}const facialWeights=resolveGlbFacialMorphWeights(node.morphTargetDictionary,{emotion:p.emotion,gazeX:p.gazeX,gazeY:p.gazeY,energy,cognitiveLoad:load,uncertainty,novelty,curiosity,valence,sarcasm,speaking:p.speaking,mouthOpen:p.mouthPose.open,thinking:p.thinking,awake:p.awake,blink:Math.sin(t*.83)>.994&&p.awake,browRaise:brain?.browRaise??0,browFurrow:brain?.browFurrow??0});for(const target of facialWeights)node.morphTargetInfluences[target.index]=target.value;const secondaryMorphWeights=resolveNeuroAdaptiveMorphWeights(node.morphTargetDictionary,adaptiveFrame);for(const target of secondaryMorphWeights)node.morphTargetInfluences[target.index]=target.value;});}if(rt.vrm){applyVrmExpressionFrame(rt.vrm,{emotion:p.emotion,speaking:p.speaking,mouthOpen:p.mouthPose.open,mouthForm:p.mouthPose.form,blink:Math.sin(t*.83)>.994&&p.awake,arousal:brainAffect?.arousal01??p.arousal,valence:brainAffect?.valence01??valence,dominance:brainAffect?.dominance01??dominance,energy,cognitiveLoad:load,uncertainty,socialNeed:social,novelty,curiosity,warmth,composure,guardedness:guarded});updateVrmForNk1Frame(rt.vrm,dt);}
    const adaptiveOffsets=rt.adaptiveDynamics.step(rt.bones.map((bone,index)=>({key:String(index),name:String(bone.node?.name??bone.name),metadata:bone.node?.userData?.nk1Secondary})),adaptiveFrame);
    rt.bones.forEach((bone,index)=>{const offset=adaptiveOffsets.get(String(index));if(!offset)return;bone.node.rotation.x+=offset.x;bone.node.rotation.y+=offset.y;bone.node.rotation.z+=offset.z;});
    updateAvatarNeuralMaterials(rt.neuralMaterials,adaptiveFrame);
    }
    renderer.render(scene,camera);
    // One-shot acceptance-only GPU readback. Normal animation frames never read pixels.
    if(rt.loaded&&renderer.domElement.dataset.avatarPixelAuditRequested==="true"){
     const canvas=renderer.domElement;
     let gl:any=null;
     try{
      gl=renderer.getContext();
      const width=gl.drawingBufferWidth,height=gl.drawingBufferHeight;
      if(width<=0||height<=0)throw new Error("empty-webgl-drawing-buffer");
      const pixels=new Uint8Array(width*height*4);
      gl.finish();
      gl.readPixels(0,0,width,height,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
      let opaquePixelCount=0,minX=width,maxX=-1,minY=height,maxY=-1;
      const uniqueColors=new Set<number>();
      for(let y=0;y<height;y+=1){
       const row=y*width*4;
       for(let x=0;x<width;x+=1){
        const offset=row+x*4,alpha=pixels[offset+3];
        if(alpha<=16)continue;
        opaquePixelCount+=1;
        if(x<minX)minX=x;if(x>maxX)maxX=x;
        if(y<minY)minY=y;if(y>maxY)maxY=y;
        if((x&3)===0&&(y&3)===0){
         const key=((pixels[offset]<<24)|(pixels[offset+1]<<16)|(pixels[offset+2]<<8)|alpha)>>>0;
         uniqueColors.add(key);
        }
       }
      }
      const audit={
       width,height,opaquePixelCount,uniqueColorCount:uniqueColors.size,
       bounds:opaquePixelCount?{x:minX,y:height-1-maxY,width:maxX-minX+1,height:maxY-minY+1}:null,
       defaultFramebuffer:gl.getParameter(gl.FRAMEBUFFER_BINDING)===null,
       glError:gl.getError(),
      };
      const imageCanvas=document.createElement("canvas");
      imageCanvas.width=width;imageCanvas.height=height;
      const imageContext=imageCanvas.getContext("2d");
      if(imageContext){
       const imageData=imageContext.createImageData(width,height);
       for(let y=0;y<height;y+=1){
        const sourceStart=y*width*4,destinationStart=(height-1-y)*width*4;
        imageData.data.set(pixels.subarray(sourceStart,sourceStart+width*4),destinationStart);
       }
       imageContext.putImageData(imageData,0,0);
       canvas.dataset.avatarPixelAuditPng=imageCanvas.toDataURL("image/png");
      }
      canvas.dataset.avatarPixelAudit=JSON.stringify(audit);
     }catch(error){
      canvas.dataset.avatarPixelAudit=JSON.stringify({
       width:gl?.drawingBufferWidth??0,height:gl?.drawingBufferHeight??0,
       opaquePixelCount:0,uniqueColorCount:0,bounds:null,
       error:error instanceof Error?error.message:String(error),
      });
     }finally{
      canvas.dataset.avatarPixelAuditRequested="false";
     }
    }
    if(rt.loaded){renderer.domElement.dataset.avatarRenderCalls=String(renderer.info.render.calls);renderer.domElement.dataset.avatarRenderedTriangles=String(renderer.info.render.triangles);}
    const renderCostMs=Math.max(0,performance.now()-renderStartedAt);lastRenderedAt=now;
    const changedBudget=frameBudget.recordFrameCost(renderCostMs);
    if(changedBudget){renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,changedBudget.maxPixelRatio,2));renderer.setSize(Math.max(el.clientWidth,1),Math.max(el.clientHeight,1),false);}
    // This receipt means a loaded model produced a WebGL draw call for this canonical tick.
    // It deliberately does not claim GPU completion or that the browser displayed the pixels.
    const frame = latest.current;
    if (rt.loaded && frame.onFrameReceipt && Number.isSafeInteger(frame.frameTick)
      && frame.frameTick >= 0 && renderer.info.render.calls > 0) {
      const receiptKey = `${loadToken.current}:${frame.frameTick}`;
      if (lastFrameReceiptKey.current !== receiptKey) {
        const receipt = createAvatarPresentationReceipt("webgl3d", frame.frameTick, "webgl-render-submitted");
        if (receipt) {
          lastFrameReceiptKey.current = receiptKey;
          frame.onFrameReceipt(receipt);
        }
      }
    }
   };scheduleNextFrame();setReady(true);setState("empty");setMessage("Ожидается проверенная 3D-модель. Геометрическая заглушка скрыта.");setStorageMessage("3D-сцена запущена; персонаж появится только после успешной загрузки и проверки VRM/GLB.");
   return()=>{disposed=true;pageVisible=false;cancelScheduledFrame();remoteLoadAbort.current?.abort();remoteLoadAbort.current=null;loadToken.current++;observer?.disconnect();intersectionObserver?.disconnect();document.removeEventListener("visibilitychange",onVisibilityChange);renderer.domElement.removeEventListener("webglcontextlost",onWebGlContextLost,false);renderer.domElement.removeEventListener("webglcontextrestored",onWebGlContextRestored,false);renderer.domElement.removeEventListener("nk1:avatar-pixel-audit-request",onPixelAuditRequest);window.removeEventListener("resize",resize);renderer.domElement.removeEventListener("pointerdown",down);renderer.domElement.removeEventListener("pointermove",move);renderer.domElement.removeEventListener("pointerup",up);renderer.domElement.removeEventListener("pointercancel",up);rt.mixer?.stopAllAction();rt.activeClipAction=null;if(rt.vrm){if(rt.vrm.lookAt?.target===rt.vrmLookAtTarget)rt.vrm.lookAt.target=null;rt.vrmLookAtTarget=null;rt.vrmLookAtFaceFront=null;rt.vrmLookAtOffset=null;rt.scene.remove(rt.vrm.scene);VRMUtils.deepDispose(rt.vrm.scene);rt.vrm=null;}disposeAvatarSecondaryVertexDynamics(rt.secondaryVertexBindings);rt.secondaryVertexBindings=[];disposeTree(scene);renderer.dispose();renderer.domElement.remove();if(runtime.current){runtime.current.adaptiveDynamics.reset();disposeAvatarSecondaryVertexDynamics(runtime.current.secondaryVertexBindings);runtime.current.secondaryVertexBindings=[];runtime.current.neuralMaterials=[];}runtime.current=null;setReady(false);};
  }catch(e){setState("webgl-unavailable");setMessage("WebGL недоступен. Включите аппаратное ускорение или используйте браузер с поддержкой WebGL.");setStorageMessage(e instanceof Error?e.message.slice(0,160):"Ошибка запуска 3D-рендерера");return()=>renderer?.dispose?.();}
 },[]);
 useEffect(()=>{
  if(!ready)return;
  let cancelled=false;
  void loadStoredAvatarModel().then((saved)=>{
   if(cancelled)return;
   if(saved)void loadModel(saved.blob,saved.name,false);
   else{setStorageMessage("Локальной модели ещё нет; загружается закреплённая онлайн-модель Курису v5.");void loadBundledModel();}
  }).catch(()=>{
   if(cancelled)return;
   setStorageMessage("IndexedDB недоступна; пробуем онлайн-модель. При ошибке загрузки заглушка останется скрытой.");
   void loadBundledModel();
  });
  return()=>{cancelled=true;loadToken.current++;};
 },[ready,loadModel,loadBundledModel]);
 const onFile=(event:ChangeEvent<HTMLInputElement>)=>{const file=event.currentTarget.files?.[0];event.currentTarget.value="";if(!file)return;const ext=file.name.toLowerCase().split(".").pop();if(ext!=="vrm"&&ext!=="glb"){setState("error");setMessage("Поддерживаются бинарные модели .vrm и .glb.");return;}void loadModel(file,file.name,true);};
 const onRemoteModel=async()=>{
  remoteLoadAbort.current?.abort();
  const controller=new AbortController();remoteLoadAbort.current=controller;
  const token=++loadToken.current;
  setState("loading");setMessage("Проверка HTTPS-ссылки и загрузка модели…");
  try{
   const downloaded=await fetchRemoteAvatarModel(remoteModelUrl,{signal:controller.signal});
   if(token!==loadToken.current||controller.signal.aborted)return;
   await loadModel(downloaded.blob,downloaded.filename,true);
   setRemoteModelUrl("");
  }catch(error){
   if(token!==loadToken.current||controller.signal.aborted)return;
   setState("error");setMessage(error instanceof Error?error.message:"Не удалось загрузить модель по HTTPS.");
  }finally{if(remoteLoadAbort.current===controller)remoteLoadAbort.current=null;}
 };
 const reset=async()=>{remoteLoadAbort.current?.abort();remoteLoadAbort.current=null;loadToken.current++;const rt=runtime.current;if(rt?.loaded){disposeAvatarSecondaryVertexDynamics(rt.secondaryVertexBindings);rt.secondaryVertexBindings=[];rt.scene.remove(rt.loaded);if(rt.vrm)VRMUtils.deepDispose(rt.loaded);else disposeTree(rt.loaded);rt.loaded=null;}if(rt){rt.mixer?.stopAllAction();rt.mixer=null;rt.vrm=null;rt.clips=[];rt.clipName="";rt.activeClipAction=null;rt.bones=[];rt.cameraBounds=null;rt.camera.position.set(0,1.78,6.65);rt.camera.lookAt(0,1.69,0);rt.camera.updateProjectionMatrix();rt.adaptiveDynamics.reset();disposeAvatarSecondaryVertexDynamics(rt.secondaryVertexBindings);rt.secondaryVertexBindings=[];rt.neuralMaterials=[];rt.body.root.visible=false;}setSecondaryAudit(null);setSecondaryVertexMeshCount(0);setSecondaryParticleMeshCount(0);setModelName("");setModelFingerprint("");setState(rt?"empty":"webgl-unavailable");setMessage("Модель удалена. Выберите проверенный VRM/GLB или повторите загрузку онлайн-модели v5.");try{await clearStoredAvatarModel();setStorageMessage("Локальная модель удалена; процедурная заглушка скрыта.");}catch{setStorageMessage("Сцена очищена, но браузер не разрешил удалить сохранённый файл.");}};
 return <section className="relative min-h-[320px] overflow-hidden bg-[radial-gradient(ellipse_at_50%_23%,rgba(68,126,158,.22),transparent_48%),radial-gradient(ellipse_at_50%_88%,rgba(114,78,157,.16),transparent_44%),#070d16] md:min-h-[420px]" aria-label="3D-тело Neuro-Kurisu">
  <div ref={host} className="absolute inset-0"/>
  {state==="webgl-unavailable"?<div className="absolute inset-0 z-10 grid place-items-center p-6"><div className="max-w-sm rounded-xl border border-white/15 bg-black/70 p-4 text-center text-white"><p className="text-sm font-semibold">3D-рендерер недоступен</p><p className="mt-2 text-xs text-white/70">{message}</p>{props.onReturnTo2D?<button type="button" onClick={props.onReturnTo2D} className="mt-3 rounded-md border border-white/20 px-3 py-2 text-xs">Открыть Live2D</button>:null}</div></div>:null}
  {state!=="webgl-unavailable"&&!modelName&&(state==="empty"||state==="loading"||state==="error")?<div className="absolute inset-0 z-10 grid place-items-center p-5"><div className="w-full max-w-md rounded-2xl border border-cyan-100/20 bg-slate-950/90 p-5 text-center text-white shadow-2xl backdrop-blur" role="status" aria-live="polite"><p className="text-[10px] font-mono uppercase tracking-[.22em] text-cyan-200/80">NeuroCore · 3D embodiment</p><h3 className="mt-2 text-base font-semibold">{state==="loading"?"Загрузка 3D-модели":state==="error"?"Модель не прошла загрузку":"3D-модель не выбрана"}</h3><p className="mt-2 text-xs leading-relaxed text-white/70">{state==="loading"?"Проверяем контейнер, размер, отпечаток и совместимость модели…":state==="error"?message:"Пока нет проверенной модели VRM/GLB. Здесь не показывается грубая процедурная геометрия вместо Курису."}</p>{state!=="loading"?<div className="mt-4 flex flex-wrap justify-center gap-2"><button type="button" onClick={()=>void loadBundledModel()} disabled={!ready} className="rounded-lg border border-cyan-200/30 bg-cyan-950/80 px-3 py-2 text-xs text-cyan-50 disabled:opacity-40">Повторить загрузку модели v5 (онлайн)</button><button type="button" onClick={()=>void fileInput.current?.click()} disabled={!ready} className="rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-xs text-white disabled:opacity-40">Выбрать VRM / GLB</button>{props.onReturnTo2D?<button type="button" onClick={props.onReturnTo2D} className="rounded-lg border border-white/10 px-3 py-2 text-xs text-white/75">Открыть Live2D</button>:null}</div>:null}<p className="mt-4 text-[10px] text-white/40">Показываем 3D-тело только после успешной загрузки и preflight.</p></div></div>:null}
  <div className="absolute right-3 top-3 z-20 flex max-w-[90%] flex-wrap justify-end gap-1.5">
   <button type="button" onClick={()=>void loadBundledModel()} disabled={!ready||state==="loading"} className="rounded-md border border-cyan-100/25 bg-slate-950/75 px-2.5 py-1.5 text-[10px] font-mono text-cyan-50 hover:border-cyan-100/55">Загрузить модель v5 (онлайн)</button>
   <button type="button" onClick={()=>void fileInput.current?.click()} disabled={!ready||state==="loading"} className="rounded-md border border-cyan-100/25 bg-slate-950/75 px-2.5 py-1.5 text-[10px] font-mono text-cyan-50 hover:border-cyan-100/55">Загрузить VRM/GLB</button>
   {modelName?<button type="button" onClick={()=>void reset()} className="rounded-md border border-white/15 bg-slate-950/75 px-2.5 py-1.5 text-[10px] font-mono text-white/80">Сбросить</button>:null}
   <input ref={fileInput} type="file" accept=".vrm,.glb,model/gltf-binary" onChange={onFile} className="hidden" aria-label="Выберите локальную VRM или GLB модель"/>
  </div>
  <div className="absolute right-3 top-14 z-20 flex w-[min(24rem,calc(100%-1.5rem))] items-center gap-1.5 rounded-lg border border-cyan-100/15 bg-slate-950/85 p-1.5 backdrop-blur">
   <input type="url" value={remoteModelUrl} onChange={(event)=>setRemoteModelUrl(event.currentTarget.value)} placeholder="https://…/kurisu.vrm" autoComplete="off" spellCheck={false} aria-label="HTTPS-ссылка на удалённую VRM или GLB модель" className="min-w-0 flex-1 bg-transparent px-2 py-1 text-[10px] text-white outline-none placeholder:text-white/40"/>
   <button type="button" onClick={()=>void onRemoteModel()} disabled={!ready||state==="loading"||!remoteModelUrl.trim()} className="shrink-0 rounded-md border border-cyan-100/25 bg-cyan-950/70 px-2.5 py-1.5 text-[10px] font-mono text-cyan-50 disabled:opacity-40">Импорт по HTTPS</button>
  </div>
  {modelName&&secondaryAudit?<details aria-label="Диагностика вторичной физики аватара" className="pointer-events-auto absolute left-3 top-3 z-20 w-[min(19rem,calc(100%-1.5rem))] overflow-hidden rounded-xl border border-cyan-100/20 bg-slate-950/90 text-white shadow-xl backdrop-blur"><summary className="cursor-pointer list-none px-3 py-2 text-[10px] font-mono text-cyan-100">Аудит вторичных слоёв · {secondaryAudit.recognizedBoneCount}/{secondaryAudit.totalBoneCount} Bone · {secondaryAudit.secondaryPhysicsReady?"bone/morph готовы":"bone/morph не размечены"}</summary><div className="space-y-2 border-t border-white/10 px-3 py-2 text-[10px] leading-relaxed text-slate-200"><p className={secondaryAudit.secondaryPhysicsReady?"text-emerald-100/90":"text-amber-100/90"}>{secondaryAudit.secondaryPhysicsReady?"Размеченные вторичные кости и дополнительные morph-каналы обнаружены.":secondaryParticleMeshCount>0?`Работает XPBD-симуляция частиц поверхности на ${secondaryParticleMeshCount} мешах; общий вторичный runtime подключён к ${secondaryVertexMeshCount} мешам.`:secondaryVertexMeshCount>0?`Работает ограниченный GPU sway на ${secondaryVertexMeshCount} мешах; XPBD-частицы ждут подходящей топологии.`:"Вторичная динамика не подключена: нужны поддерживаемые модульные meshes."}</p><div className="grid grid-cols-2 gap-x-3 gap-y-1"><span>Волосы: {secondaryAudit.byRole.hair.boneCount} / цепей {secondaryAudit.byRole.hair.chainRoots}</span><span>Одежда: {secondaryAudit.byRole.garment.boneCount} / цепей {secondaryAudit.byRole.garment.chainRoots}</span><span>Рукава: {secondaryAudit.byRole.sleeve.boneCount}</span><span>Отдельные meshes волос: {secondaryAudit.byMeshRole.hair.meshNodeCount}</span><span>Части костюма: {secondaryAudit.byMeshRole.garment.meshNodeCount}</span><span>Meshes рукавов: {secondaryAudit.byMeshRole.sleeve.meshNodeCount}</span><span>XPBD surface particles: {secondaryParticleMeshCount} mesh</span><span>All secondary meshes: {secondaryVertexMeshCount}</span><span>Нейронные волокна: {secondaryAudit.byRole.neuralFiber.boneCount}</span><span>Морфы: {secondaryAudit.morphTargetCount}</span><span>Меши со skin: {secondaryAudit.skinnedMeshCount}</span></div><p>Каналы: {secondaryAudit.morphChannels.length?secondaryAudit.morphChannels.map(item=>item.targetName).join(", "):"не найдены"}</p><p>Нейронные emissive-материалы: {secondaryAudit.taggedNeuralMaterialCount}</p>{secondaryAudit.unclassifiedBoneNames.length?<p className="border-t border-white/10 pt-1 text-slate-300/70">Кости без semantic-разметки: {secondaryAudit.unclassifiedBoneNames.join(", ")}</p>:null}{secondaryAudit.warnings.length?<div className="space-y-0.5 border-t border-amber-200/15 pt-1 text-amber-100/80">{secondaryAudit.warnings.map(warning=><p key={warning}>{warning==="no-secondary-bone-chains"?"Нет размеченных костных цепочек вторичной физики":warning==="no-hair-secondary-bones"?"Не найдены отдельные цепочки волос":warning==="no-garment-secondary-bones"?"Не найдены отдельные цепочки одежды":warning==="no-neuroadaptive-morphs"?"Не найдены специальные morph-каналы":warning==="no-tagged-neural-fabric"?"Нет размеченных нейронных материалов":"Аудит ограничен безопасным лимитом сцены"}</p>)}</div>:<p className="border-t border-emerald-200/15 pt-1 text-emerald-100/80">Все обнаруженные слои вторичной физики доступны.</p>}</div></details>:null}
  <div className="pointer-events-none absolute inset-x-3 bottom-3 z-20 flex items-end justify-between gap-2"><div className="max-w-[80%] rounded-lg border border-white/10 bg-slate-950/70 px-2.5 py-2 backdrop-blur"><p className="text-[11px] font-semibold tracking-wide text-slate-100">{modelName||"NK1 · TRUE 3D BODY"}</p><p className="mt-0.5 text-[10px] leading-relaxed text-slate-300/80">{state==="loaded"?"3D-модель · эмоция, действие, взгляд и речь связаны с состоянием NK1":state==="loading"?"Подготовка модели…":state==="error"?(modelName?"Новая модель отклонена · предыдущая модель сохранена":"Модель не загружена · геометрическая заглушка скрыта"):state==="webgl-unavailable"?"Требуется WebGL":"Ожидается проверенный 3D-ресурс · геометрическая заглушка скрыта"}</p></div><div className="rounded-full border border-cyan-200/20 bg-slate-950/70 px-2 py-1 text-[9px] uppercase tracking-wider text-cyan-100/80">{props.awake?(props.thinking?"thinking":props.speaking?"speaking":props.emotion):"sleep"}</div></div>
  {message?<p role="status" className="absolute bottom-[4.6rem] left-3 z-20 max-w-[78%] rounded bg-slate-950/80 px-2 py-1.5 text-[10px] text-amber-100/90">{message}</p>:null}
  <p className="absolute right-3 bottom-[4.6rem] z-20 max-w-[42%] text-right text-[9px] text-white/45">Потяните тело, чтобы повернуть. {modelFingerprint ? `SHA-256 ${modelFingerprint.slice(7, 23)}… · идентичность модели зафиксирована` : state === "loaded" ? "SHA-256 недоступен · калибровка этой модели заблокирована" : ""} {storageMessage}</p>
 </section>;
}