import { type ChangeEvent, useCallback, useEffect, useRef, useState } from "react";
import type { ActionKind, EmotionLabel, AvatarBrainProjectionV1 } from "@/organism/types";
import type { MouthPose } from "./avatar/embodimentTimeline";
import type { AvatarMotorIntentPlan } from "./avatar/motorIntent.ts";
import { resolveVrmArmIntent } from "./avatar/rendererMotorAdapters.ts";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { VRMLoaderPlugin, VRMUtils } from "@pixiv/three-vrm";
import { clearStoredAvatarModel, loadStoredAvatarModel, MAX_AVATAR_MODEL_BYTES, saveAvatarModel } from "./avatar/avatarModelStore";
import * as THREE from "three";
import { createProceduralHumanoidRig, updateProceduralHumanoidRig, type ArticulatedParticleFrame } from "./avatar/proceduralHumanoidRig";
import { auditHumanoidRig } from "./avatar/vrmHumanoidRigAudit";
import { buildVrmHumanoidAuditNodes, parseVrmHumanoidNodeMap } from "./avatar/vrmHumanoidNodeMap";
import { applyVrmExpressionFrame, applyVrmFullBodyChannels, applyVrmNormalizedMotorFrame, configureVrmForNk1NormalizedMotorDrive, resolveVrmLookAtTargetOffset, updateVrmForNk1Frame } from "./avatar/vrmRuntimeAdapter";
import { fingerprintAvatarModel } from "./avatar/avatarModelFingerprint";
import { preflightAvatarModel } from "./avatar/avatarModelPreflight";
import { disposeThreeObjectTree } from "./avatar/threeResourceDisposal";
import { applyAnimeToonMaterials, getSharedAnimeGradientTexture } from "./avatar/threeToonMaterials";
import { resolveGlbMouthMorphWeights } from "./avatar/glbMouthMorphAdapter";
import { resolveGlbFacialMorphWeights } from "./avatar/glbFacialMorphAdapter";
import { resolveGlbSecondaryBoneRotation } from "./avatar/glbSecondaryMotionAdapter";
import { resolveGlbBodyBoneRotation } from "./avatar/glbBodyChannelAdapter";
import { fetchRemoteAvatarModel } from "./avatar/remoteAvatarSource";
import { applyAvatarAnimationFrame } from "./avatar/avatarAnimationRuntime";
import { createAvatarPresentationReceipt, type AvatarPresentationReceiptV1 } from "./avatar/avatarPresentationReceipt.ts";
import { createAvatarFrameBudgetController, resolveAvatarFrameBudget, shouldRenderAvatarFrame, shouldRunAvatarRenderLoop } from "./avatar/avatarFrameBudget.ts";

type Props = { frameTick: number; onFrameReceipt?: (receipt: AvatarPresentationReceiptV1) => void; emotion: EmotionLabel; action: ActionKind; motorPlan: AvatarMotorIntentPlan; arousal: number; valence: number; dominance: number; energy: number; cognitiveLoad: number; uncertainty: number; socialNeed: number; novelty: number; goalPressure: number; curiosity: number; predictionError: number; traits: Record<string, number>; gazeX: number; gazeY: number; speaking: boolean; mouthPose: MouthPose; thinking: boolean; awake: boolean; bodyChannels?: Record<string, number>; bodyParticles?: ArticulatedParticleFrame; avatarBrainFrame?: AvatarBrainProjectionV1; onReturnTo2D?: () => void };
type Bone = { node: any; name: string; x: number; y: number; z: number };
type Runtime = { scene:any; camera:any; renderer:any; body:any; loaded:any; vrm:any; vrmLookAtTarget:any; vrmLookAtFaceFront:any; vrmLookAtOffset:any; mixer:any; clips:any[]; clipName:string; activeClipAction:any; bones:Bone[]; yaw:number; dragX:number|null; mood:any; last:number };
const clamp=(n:number,a:number,b:number)=>Math.max(a,Math.min(b,Number.isFinite(n)?n:0));
function disposeTree(root:any){const gradient=getSharedAnimeGradientTexture();disposeThreeObjectTree(root,gradient?[gradient]:[]);}
function bonesOf(root:any):Bone[]{const out:Bone[]=[];root.traverse((node:any)=>{if(node.isBone)out.push({node,name:String(node.name||"").toLowerCase().replace(/[^a-z0-9]/g,""),x:node.rotation.x,y:node.rotation.y,z:node.rotation.z});});return out;}
export function Avatar3DStage(props:Props){
 const host=useRef<HTMLDivElement>(null),fileInput=useRef<HTMLInputElement>(null),runtime=useRef<Runtime|null>(null),latest=useRef(props),loadToken=useRef(0),lastFrameReceiptKey=useRef("");
 const remoteLoadAbort=useRef<AbortController|null>(null);
 const [remoteModelUrl,setRemoteModelUrl]=useState("");
 const [ready,setReady]=useState(false),[modelName,setModelName]=useState(""),[modelFingerprint,setModelFingerprint]=useState(""),[state,setState]=useState<"procedural"|"empty"|"loading"|"loaded"|"error"|"webgl-unavailable">("procedural"),[message,setMessage]=useState(""),[storageMessage,setStorageMessage]=useState("Встроенный скелетно-мышечный rig NeuroCore активен.");
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
    if(vrm){configureVrmForNk1NormalizedMotorDrive(vrm);VRMUtils.rotateVRM0(vrm);VRMUtils.removeUnnecessaryVertices(gltf.scene);VRMUtils.combineSkeletons(gltf.scene);VRMUtils.combineMorphs(vrm);}if(!vrm)applyAnimeToonMaterials(root);const bounds=new THREE.Box3().setFromObject(root),size=new THREE.Vector3(),center=new THREE.Vector3();bounds.getSize(size);bounds.getCenter(center);const max=Math.max(size.x,size.y,size.z);if(!Number.isFinite(max)||max<.0001)throw new Error("У модели нет видимой геометрии.");const scale=3.15/max;root.scale.setScalar(scale);root.position.set(-center.x*scale,-bounds.min.y*scale+.04,-center.z*scale);root.traverse((n:any)=>{if(vrm)n.frustumCulled=false;if(n.isMesh){for(const m of(Array.isArray(n.material)?n.material:n.material?[n.material]:[])){if("roughness"in m)m.roughness=clamp(Number(m.roughness??.8),.18,1);}}});
    if(rt.loaded){rt.scene.remove(rt.loaded);if(rt.vrm){if(rt.vrm.lookAt?.target===rt.vrmLookAtTarget)rt.vrm.lookAt.target=null;rt.vrmLookAtTarget=null;rt.vrmLookAtFaceFront=null;rt.vrmLookAtOffset=null;VRMUtils.deepDispose(rt.loaded);}else disposeTree(rt.loaded);}rt.mixer?.stopAllAction();rt.activeClipAction=null;rt.loaded=root;rt.vrm=vrm;rt.vrmLookAtTarget=null;rt.vrmLookAtFaceFront=null;rt.vrmLookAtOffset=null;rt.scene.add(root);if(vrm?.lookAt&&typeof vrm.humanoid?.getRawBoneNode==="function"&&typeof vrm.lookAt.getFaceFrontQuaternion==="function"){const rawHead=vrm.humanoid.getRawBoneNode("head");if(rawHead?.add){const target=new THREE.Object3D();target.name="NK1VrmEyeGazeTarget";const faceFront=vrm.lookAt.getFaceFrontQuaternion(new THREE.Quaternion());const offset=resolveVrmLookAtTargetOffset(0,0);target.position.set(offset.x,offset.y,offset.z).applyQuaternion(faceFront);rawHead.add(target);vrm.lookAt.target=target;vrm.lookAt.autoUpdate=true;rt.vrmLookAtTarget=target;rt.vrmLookAtFaceFront=faceFront;rt.vrmLookAtOffset=new THREE.Vector3();}}rt.body.root.visible=false;rt.bones=bonesOf(root);rt.clips=Array.isArray(gltf.animations)?gltf.animations:[];rt.mixer=!vrm&&rt.clips.length?new THREE.AnimationMixer(root):null;rt.clipName="";setModelName(name);setState("loaded");const caps=humanoidAudit.capabilities;const capabilitySummary=[caps.torso?"торс":"без торса",caps.head?"голова":"без головы",caps.bilateralArms?"две руки":"неполные руки",caps.bilateralHands?"две кисти":"без двух кистей",caps.bilateralLegs?"две ноги":"неполные ноги",caps.bilateralFeet?"две стопы":"неполные стопы",caps.fingerArticulation?"пальцы артикулируются":"артикуляция пальцев не подтверждена"];const leftArmAvailable=!!humanoidAudit.nodes.leftUpperArm&&!!humanoidAudit.nodes.leftLowerArm;const rightArmAvailable=!!humanoidAudit.nodes.rightUpperArm&&!!humanoidAudit.nodes.rightLowerArm;const hasAuditedRig=Object.keys(humanoidAudit.nodes).length>0||rt.bones.length>0;const mappingDescription=humanoidAudit.mappingMethod==="conservative-name-heuristic"?"по именам Bone (эвристика)":`по glTF node index (VRM ${vrmNodeMap.status==="valid"?vrmNodeMap.version:"metadata"})`;const completeness=caps.fullBodyHumanoid?(humanoidAudit.mappingMethod==="conservative-name-heuristic"?"полная иерархия по именам Bone; не подтверждает VRM runtime":`обязательная иерархия VRM ${vrmNodeMap.status==="valid"?vrmNodeMap.version:""} подтверждена по glTF node index и ancestry; IK/retargeting не подтверждены`):(vrmNodeMap.status==="invalid"?"VRM metadata отклонены; эвристический fallback заблокирован":"полный Humanoid Rig не подтверждён");setMessage(hasAuditedRig?`Модель загружена. Rig audit ${mappingDescription}: ${capabilitySummary.join(" · ")}. ${completeness}. Цепи рук: ${leftArmAvailable?"левая":""}${leftArmAvailable&&rightArmAvailable?" и ":""}${rightArmAvailable?"правая":""}${!leftArmAvailable&&!rightArmAvailable?"не распознаны":""}. IK не включается этим аудитом.`:"Геометрия загружена; humanoid-узлы и Bone-скелет не подтверждены, движения тела ограничены.");
    if(persist)void saveAvatarModel(blob,name).then(()=>setStorageMessage("Модель сохранена в IndexedDB; следующие запуски используют локальную копию.")).catch(()=>setStorageMessage("Модель загружена, но браузер не разрешил сохранить её между сессиями."));else setStorageMessage("Восстановлена локальная модель из хранилища браузера.");
   }catch(e){const failedVrm=gltf.userData?.vrm??null;if(failedVrm)VRMUtils.deepDispose(failedVrm.scene);else disposeTree(gltf.scene);setState("error");setMessage(e instanceof Error?e.message:"Не удалось подготовить модель.");}
  },()=>{if(token!==loadToken.current)return;setState("error");setMessage("Не прочитан бинарный VRM/GLB. Нужен самодостаточный файл с геометрией и текстурами внутри.");});
  }catch(e){if(token!==loadToken.current)return;setState("error");setMessage(e instanceof Error?e.message:"Ошибка чтения модели.");}
 },[]);
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
   renderer=new THREE.WebGLRenderer({alpha:true,antialias:true,powerPreference:"low-power"});renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,frameBudget.snapshot().maxPixelRatio,2));renderer.setSize(Math.max(el.clientWidth,1),Math.max(el.clientHeight,1),false);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.08;renderer.shadowMap.enabled=false;renderer.domElement.style.cssText="display:block;width:100%;height:100%;touch-action:none;cursor:grab";renderer.domElement.setAttribute("aria-label","3D-тело NeuroCore, потяните для поворота");el.appendChild(renderer.domElement);
   const scene=new THREE.Scene();const camera=new THREE.PerspectiveCamera(31,Math.max(el.clientWidth,1)/Math.max(el.clientHeight,1),.1,100);camera.position.set(0,1.5,6.3);camera.lookAt(0,1.24,0);
   scene.add(new THREE.HemisphereLight(0xd8e9ff,0x352432,2.15));const key=new THREE.DirectionalLight(0xffe2d0,3);key.position.set(-3.5,5.5,4.5);scene.add(key);const fill=new THREE.DirectionalLight(0x82d8f4,1.25);fill.position.set(4,3,2.5);scene.add(fill);const rim=new THREE.DirectionalLight(0xbca3ff,1.15);rim.position.set(.5,3,-4);scene.add(rim);const mood=new THREE.PointLight(0x76c8e6,.58,7.5);mood.position.set(0,2.2,1.2);scene.add(mood);
   const body=createProceduralHumanoidRig(scene);body.root.visible=true;const rt:Runtime={scene,camera,renderer,body,loaded:null,vrm:null,vrmLookAtTarget:null,vrmLookAtFaceFront:null,vrmLookAtOffset:null,mixer:null,clips:[],clipName:"",activeClipAction:null,bones:body.skeleton.bones.map((node:any)=>({node,name:String(node.name||"").toLowerCase().replace(/[^a-z0-9]/g,""),x:node.rotation.x,y:node.rotation.y,z:node.rotation.z})),yaw:0,dragX:null,mood,last:performance.now()};runtime.current=rt;
   const resize=()=>{if(disposed)return;const w=Math.max(el.clientWidth,1),h=Math.max(el.clientHeight,1);camera.aspect=w/h;camera.updateProjectionMatrix();renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,frameBudget.snapshot().maxPixelRatio,2));renderer.setSize(w,h,false);};observer=typeof ResizeObserver!=="undefined"?new ResizeObserver(resize):null;observer?.observe(el);window.addEventListener("resize",resize);
  let animate:(now:number)=>void;
  const canRender=()=>!disposed&&runtime.current===rt&&shouldRunAvatarRenderLoop(pageVisible,intersectsViewport,!webglContextLost);
  const scheduleNextFrame=()=>{if(!canRender()||raf!==0||scheduleTimer!==null)return;const budget=frameBudget.snapshot();if(lastRenderedAt!==null){const remaining=1000/budget.targetFps-(performance.now()-lastRenderedAt);if(remaining>1){scheduleTimer=window.setTimeout(()=>{scheduleTimer=null;if(canRender())raf=requestAnimationFrame(animate);},Math.ceil(remaining));return;}}raf=requestAnimationFrame(animate);};
  const syncRenderActivity=()=>{if(!canRender())cancelScheduledFrame();else scheduleNextFrame();};
  const onWebGlContextLost=(event:Event)=>{event.preventDefault();if(webglContextLost)return;webglContextLost=true;cancelScheduledFrame();setState("webgl-unavailable");setMessage("Графический контекст потерян; 3D-рендер приостановлен до восстановления браузером.");setStorageMessage("Модель сохранена в памяти сцены. При восстановлении WebGL рендер попробует продолжиться без повторной загрузки файла.");};
  const onWebGlContextRestored=()=>{if(!webglContextLost||disposed||runtime.current!==rt)return;webglContextLost=false;resize();setState(rt.loaded?"loaded":"procedural");setMessage(rt.loaded?"3D-модель восстановлена после потери графического контекста.":"Встроенное тело NeuroCore восстановлено после потери графического контекста.");setStorageMessage(rt.loaded?"Рендер возобновлён; повторная загрузка модели не требуется.":"3D-сцена восстановлена.");syncRenderActivity();};
  renderer.domElement.addEventListener("webglcontextlost",onWebGlContextLost,false);
  renderer.domElement.addEventListener("webglcontextrestored",onWebGlContextRestored,false);
  const onVisibilityChange=()=>{pageVisible=document.visibilityState!=="hidden";syncRenderActivity();};document.addEventListener("visibilitychange",onVisibilityChange);
  intersectionObserver=typeof IntersectionObserver!=="undefined"?new IntersectionObserver((entries)=>{const entry=entries.find((item)=>item.target===el);if(!entry)return;intersectsViewport=entry.isIntersecting&&entry.intersectionRatio>0;syncRenderActivity();}):null;intersectionObserver?.observe(el);
   const down=(e:PointerEvent)=>{rt.dragX=e.clientX;renderer.domElement.style.cursor="grabbing";try{renderer.domElement.setPointerCapture(e.pointerId);}catch{}};const move=(e:PointerEvent)=>{if(rt.dragX===null)return;rt.yaw+=(e.clientX-rt.dragX)*.008;rt.dragX=e.clientX;};const up=()=>{rt.dragX=null;renderer.domElement.style.cursor="grab";};renderer.domElement.addEventListener("pointerdown",down);renderer.domElement.addEventListener("pointermove",move);renderer.domElement.addEventListener("pointerup",up);renderer.domElement.addEventListener("pointercancel",up);
   animate=(now:number)=>{raf=0;if(!canRender())return;const budget=frameBudget.snapshot();if(!shouldRenderAvatarFrame(now,lastRenderedAt,budget)){scheduleNextFrame();return;}const renderStartedAt=performance.now();const dt=lastRenderedAt===null?0:Math.min(.05,Math.max(0,(now-lastRenderedAt)/1000));rt.last=now;const t=now/1000,p=latest.current,b=rt.body,brainFrame=p.avatarBrainFrame,brain=brainFrame?.channels,brainAffect=brainFrame?.affect,active=p.awake?1:.22,energy=clamp(p.energy,0,1),load=clamp(p.cognitiveLoad,0,1),uncertainty=clamp(p.uncertainty,0,1),social=clamp(p.socialNeed,0,1),novelty=clamp(p.novelty,0,1),curiosity=clamp(p.curiosity,0,1),goal=clamp(p.goalPressure,0,1),error=clamp(p.predictionError,0,1),dominance=clamp(p.dominance,0,1),valence=clamp(p.valence,0,1),warmth=clamp(p.traits.warmth??.5,0,1),sarcasm=clamp(p.traits.sarcasm??.5,0,1),guarded=clamp(p.traits.guardedness??.5,0,1),composure=clamp(p.traits.composure??.5,0,1);const armIntent=resolveVrmArmIntent(p.motorPlan,{emotion:p.emotion,speaking:p.speaking,awake:p.awake,cognitiveLoad:load,socialNeed:social,guardedness:guarded});b.root.position.y=-.055+Math.sin(t*(p.awake?1.5+.5*energy:.45))*(.004+.012*energy);b.root.rotation.y=rt.yaw+clamp(Number(p.bodyChannels?.rootYaw??0),-1,1)*.34+Math.sin(t*.29)*(.006+.01*uncertainty);updateProceduralHumanoidRig(b,{
      awake:p.awake,action:p.action,emotion:p.emotion,arousal:p.arousal,energy,
      cognitiveLoad:load,gazeX:p.gazeX,gazeY:p.gazeY,headTilt:p.motorPlan.headTilt,
      speaking:p.speaking,leftArmIntent:armIntent.leftArmIntent,rightArmIntent:armIntent.rightArmIntent,
      bodyChannels:p.bodyChannels,particles:p.bodyParticles,deltaSeconds:dt,timeSeconds:t
    });
    b.ringMat.opacity=.28+clamp(p.arousal,0,1)*.22+error*.1+goal*.06;
    const hue:Record<EmotionLabel,number>={curiosity:0x68d9ed,calm:0x76c8e6,joy:0xffa7bd,anxiety:0x858bd6,frustration:0xf27c6f,sadness:0x6e83c7,anger:0xff525e,protective:0xd9a4f5};rt.mood.color.setHex(hue[p.emotion]);rt.mood.intensity=.24+clamp(p.arousal,0,1)*.42+error*.16+uncertainty*.08;
    if(rt.loaded){if(rt.mixer){const animation=applyAvatarAnimationFrame({mixer:rt.mixer,clips:rt.clips,action:p.action,previousAction:rt.activeClipAction,previousClipName:rt.clipName,awake:p.awake,energy});rt.activeClipAction=animation.activeAction;rt.clipName=animation.clipName;}/* Reset to bind pose before the mixer so offsets do not accumulate; then add motor intent on top of the clip. */rt.bones.forEach((bone)=>{bone.node.rotation.set(bone.x,bone.y,bone.z);});rt.mixer?.update(dt);if(rt.vrm){if(rt.vrmLookAtTarget){const targetOffset=resolveVrmLookAtTargetOffset(p.gazeX,p.gazeY);const desiredOffset=rt.vrmLookAtOffset.set(targetOffset.x,targetOffset.y,targetOffset.z).applyQuaternion(rt.vrmLookAtFaceFront);const gazeBlend=1-Math.exp(-dt*14);rt.vrmLookAtTarget.position.lerp(desiredOffset,gazeBlend);}applyVrmNormalizedMotorFrame(rt.vrm,{action:p.action,emotion:p.emotion,gazeX:p.gazeX,gazeY:p.gazeY,gazeViaLookAt:Boolean(rt.vrmLookAtTarget),cognitiveLoad:load,energy,socialNeed:social,uncertainty,speaking:p.speaking,headTilt:p.motorPlan.headTilt,headYaw:p.bodyChannels?.headYaw??brain?.headYaw??0,headPitch:p.bodyChannels?.headPitch,headRoll:p.bodyChannels?.headRoll,leftArmIntent:p.bodyChannels?.leftShoulder??armIntent.leftArmIntent,rightArmIntent:p.bodyChannels?.rightShoulder??armIntent.rightArmIntent});applyVrmFullBodyChannels(rt.vrm,p.bodyChannels??{});}else{rt.bones.forEach((bone)=>{const n=bone.name;if(n.includes("head")||n.includes("neck")){bone.node.rotation.x+=-clamp(p.gazeY,-1,1)*.12-load*.035+(1-energy)*.04;bone.node.rotation.y+=clamp(p.gazeX,-1,1)*(.22-social*.05)+uncertainty*.025;bone.node.rotation.z+=p.motorPlan.headTilt;}const bodyRotation=resolveGlbBodyBoneRotation(n,p.bodyChannels??{});bone.node.rotation.x+=bodyRotation.x;bone.node.rotation.y+=bodyRotation.y;bone.node.rotation.z+=bodyRotation.z;const secondary=resolveGlbSecondaryBoneRotation(n,{timeSeconds:t,awake:p.awake,energy,action:p.action,bodyChannels:p.bodyChannels??{}});if(secondary){bone.node.rotation.x+=secondary.x;bone.node.rotation.y+=secondary.y;bone.node.rotation.z+=secondary.z;}});rt.loaded.traverse((node:any)=>{if(!node.isMesh||!node.morphTargetDictionary||!node.morphTargetInfluences)return;const mouthWeights=resolveGlbMouthMorphWeights(node.morphTargetDictionary,p.mouthPose,p.speaking);for(const target of mouthWeights)node.morphTargetInfluences[target.index]=target.value;for(const [key,index]of Object.entries(node.morphTargetDictionary)){const k=String(key).toLowerCase().replace(/[^a-z0-9]/g,"");let value:number|null=null;if(/happy|joy|smile/.test(k))value=p.emotion==="joy"?.75:p.emotion==="protective"?.22:p.emotion==="calm"?warmth*.16:0;else if(/sad|sorrow|cry/.test(k))value=p.emotion==="sadness"||p.emotion==="anxiety"?.62:0;else if(/angry|anger|frown/.test(k))value=p.emotion==="anger"||p.emotion==="frustration"?.7:0;else if(/blink|eyeclose/.test(k))value=Math.sin(t*.83)>.994&&p.awake?.92:0;if(value!==null)node.morphTargetInfluences[Number(index)]=value;}const facialWeights=resolveGlbFacialMorphWeights(node.morphTargetDictionary,{emotion:p.emotion,gazeX:p.gazeX,gazeY:p.gazeY,energy,cognitiveLoad:load,uncertainty,novelty,curiosity,valence,sarcasm,speaking:p.speaking,mouthOpen:p.mouthPose.open,thinking:p.thinking,awake:p.awake,blink:Math.sin(t*.83)>.994&&p.awake,browRaise:brain?.browRaise??0,browFurrow:brain?.browFurrow??0});for(const target of facialWeights)node.morphTargetInfluences[target.index]=target.value;});}if(rt.vrm){applyVrmExpressionFrame(rt.vrm,{emotion:p.emotion,speaking:p.speaking,mouthOpen:p.mouthPose.open,mouthForm:p.mouthPose.form,blink:Math.sin(t*.83)>.994&&p.awake,arousal:brainAffect?.arousal01??p.arousal,valence:brainAffect?.valence01??valence,dominance:brainAffect?.dominance01??dominance,energy,cognitiveLoad:load,uncertainty,socialNeed:social,novelty,curiosity,warmth,composure,guardedness:guarded});updateVrmForNk1Frame(rt.vrm,dt);}}
    renderer.render(scene,camera);
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
   };scheduleNextFrame();setReady(true);setState("procedural");setMessage("Встроенное скелетно-мышечное тело NeuroCore активно. VRM/GLB можно подключить как заменяемую модель.");setStorageMessage("Процедурный humanoid rig загружен: кости, суставные ограничения, мышечные объёмы и моторное управление.");
   return()=>{disposed=true;pageVisible=false;cancelScheduledFrame();remoteLoadAbort.current?.abort();remoteLoadAbort.current=null;loadToken.current++;observer?.disconnect();intersectionObserver?.disconnect();document.removeEventListener("visibilitychange",onVisibilityChange);renderer.domElement.removeEventListener("webglcontextlost",onWebGlContextLost,false);renderer.domElement.removeEventListener("webglcontextrestored",onWebGlContextRestored,false);window.removeEventListener("resize",resize);renderer.domElement.removeEventListener("pointerdown",down);renderer.domElement.removeEventListener("pointermove",move);renderer.domElement.removeEventListener("pointerup",up);renderer.domElement.removeEventListener("pointercancel",up);rt.mixer?.stopAllAction();rt.activeClipAction=null;if(rt.vrm){if(rt.vrm.lookAt?.target===rt.vrmLookAtTarget)rt.vrm.lookAt.target=null;rt.vrmLookAtTarget=null;rt.vrmLookAtFaceFront=null;rt.vrmLookAtOffset=null;rt.scene.remove(rt.vrm.scene);VRMUtils.deepDispose(rt.vrm.scene);rt.vrm=null;}disposeTree(scene);renderer.dispose();renderer.domElement.remove();runtime.current=null;setReady(false);};
  }catch(e){setState("webgl-unavailable");setMessage("WebGL недоступен. Включите аппаратное ускорение или используйте браузер с поддержкой WebGL.");setStorageMessage(e instanceof Error?e.message.slice(0,160):"Ошибка запуска 3D-рендерера");return()=>renderer?.dispose?.();}
 },[]);
 useEffect(()=>{
  if(!ready)return;
  let cancelled=false;
  void loadStoredAvatarModel().then((saved)=>{
   if(cancelled)return;
   if(saved)void loadModel(saved.blob,saved.name,false);
   else setStorageMessage("Локальной VRM/GLB-модели нет. Используется встроенное тело NeuroCore; внешняя модель подключается только вручную.");
  }).catch(()=>{
   if(cancelled)return;
   setStorageMessage("IndexedDB недоступна. Встроенное тело NeuroCore остаётся активным; внешний файл можно подключить вручную.");
  });
  return()=>{cancelled=true;loadToken.current++;};
 },[ready,loadModel]);
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
 const reset=async()=>{remoteLoadAbort.current?.abort();remoteLoadAbort.current=null;loadToken.current++;const rt=runtime.current;if(rt?.loaded){rt.scene.remove(rt.loaded);if(rt.vrm)VRMUtils.deepDispose(rt.loaded);else disposeTree(rt.loaded);rt.loaded=null;}if(rt){rt.mixer?.stopAllAction();rt.mixer=null;rt.vrm=null;rt.clips=[];rt.clipName="";rt.activeClipAction=null;rt.bones=rt.body.skeleton.bones.map((node:any)=>({node,name:String(node.name||"").toLowerCase().replace(/[^a-z0-9]/g,""),x:node.rotation.x,y:node.rotation.y,z:node.rotation.z}));rt.body.root.visible=true;rt.body.resetPose();}setModelName("");setModelFingerprint("");setState(rt?"procedural":"webgl-unavailable");setMessage("Внешняя модель удалена. Встроенное скелетно-мышечное тело NeuroCore снова активно.");try{await clearStoredAvatarModel();setStorageMessage("Локальная VRM/GLB-модель удалена; встроенное тело осталось активным.");}catch{setStorageMessage("Сцена восстановлена, но браузер не разрешил удалить сохранённый файл.");}};
 return <section className="relative min-h-[320px] overflow-hidden bg-[radial-gradient(ellipse_at_50%_23%,rgba(68,126,158,.22),transparent_48%),radial-gradient(ellipse_at_50%_88%,rgba(114,78,157,.16),transparent_44%),#070d16] md:min-h-[420px]" aria-label="3D-тело NeuroCore">
  <div ref={host} className="absolute inset-0"/>
  {state==="webgl-unavailable"?<div className="absolute inset-0 z-10 grid place-items-center p-6"><div className="max-w-sm rounded-xl border border-white/15 bg-black/70 p-4 text-center text-white"><p className="text-sm font-semibold">3D-рендерер недоступен</p><p className="mt-2 text-xs text-white/70">{message}</p>{props.onReturnTo2D?<button type="button" onClick={props.onReturnTo2D} className="mt-3 rounded-md border border-white/20 px-3 py-2 text-xs">Открыть Live2D</button>:null}</div></div>:null}

  <div className="absolute right-3 top-3 z-20 flex max-w-[90%] flex-wrap justify-end gap-1.5">
   <button type="button" onClick={()=>void fileInput.current?.click()} disabled={!ready||state==="loading"} className="rounded-md border border-cyan-100/25 bg-slate-950/75 px-2.5 py-1.5 text-[10px] font-mono text-cyan-50 hover:border-cyan-100/55">Загрузить VRM/GLB</button>
   {modelName?<button type="button" onClick={()=>void reset()} className="rounded-md border border-white/15 bg-slate-950/75 px-2.5 py-1.5 text-[10px] font-mono text-white/80">Сбросить</button>:null}
   <input ref={fileInput} type="file" accept=".vrm,.glb,model/gltf-binary" onChange={onFile} className="hidden" aria-label="Выберите локальную VRM или GLB модель"/>
  </div>
  <div className="absolute right-3 top-14 z-20 flex w-[min(24rem,calc(100%-1.5rem))] items-center gap-1.5 rounded-lg border border-cyan-100/15 bg-slate-950/85 p-1.5 backdrop-blur">
   <input type="url" value={remoteModelUrl} onChange={(event)=>setRemoteModelUrl(event.currentTarget.value)} placeholder="https://…/kurisu.vrm" autoComplete="off" spellCheck={false} aria-label="HTTPS-ссылка на удалённую VRM или GLB модель" className="min-w-0 flex-1 bg-transparent px-2 py-1 text-[10px] text-white outline-none placeholder:text-white/40"/>
   <button type="button" onClick={()=>void onRemoteModel()} disabled={!ready||state==="loading"||!remoteModelUrl.trim()} className="shrink-0 rounded-md border border-cyan-100/25 bg-cyan-950/70 px-2.5 py-1.5 text-[10px] font-mono text-cyan-50 disabled:opacity-40">Импорт по HTTPS</button>
  </div>
  <div className="pointer-events-none absolute inset-x-3 bottom-3 z-20 flex items-end justify-between gap-2"><div className="max-w-[80%] rounded-lg border border-white/10 bg-slate-950/70 px-2.5 py-2 backdrop-blur"><p className="text-[11px] font-semibold tracking-wide text-slate-100">{modelName||"NeuroCore · ARTICULATED BODY"}</p><p className="mt-0.5 text-[10px] leading-relaxed text-slate-300/80">{state==="loaded"?"Внешняя модель · эмоция, действие, взгляд и речь связаны с состоянием NeuroCore":state==="loading"?"Подготовка модели…":state==="error"?(modelName?"Новая модель отклонена · предыдущая модель сохранена":"Встроенное тело сохранено · загрузка внешней модели отклонена"):state==="webgl-unavailable"?"Требуется WebGL":(() => { const stats=runtime.current?.body?.root?.userData?.rigStats; return stats ? `${stats.boneCount} костей · ${stats.jointCount} суставов · ${stats.partCount} частей / ${stats.meshCount} skinned batches · ${stats.particleCount} частиц · ${stats.constraintCount} связей` : "Встроенное скелетно-мышечное тело NeuroCore активно"; })()}</p></div><div className="rounded-full border border-cyan-200/20 bg-slate-950/70 px-2 py-1 text-[9px] uppercase tracking-wider text-cyan-100/80">{props.awake?(props.thinking?"thinking":props.speaking?"speaking":props.emotion):"sleep"}</div></div>
  {message?<p role="status" className="absolute bottom-[4.6rem] left-3 z-20 max-w-[78%] rounded bg-slate-950/80 px-2 py-1.5 text-[10px] text-amber-100/90">{message}</p>:null}
  <p className="absolute right-3 bottom-[4.6rem] z-20 max-w-[42%] text-right text-[9px] text-white/45">Потяните тело, чтобы повернуть. {modelFingerprint ? `SHA-256 ${modelFingerprint.slice(7, 23)}… · идентичность модели зафиксирована` : state === "loaded" ? "SHA-256 недоступен · калибровка этой модели заблокирована" : ""} {storageMessage}</p>
 </section>;
}
