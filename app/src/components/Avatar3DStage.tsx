import { type ChangeEvent, useCallback, useEffect, useRef, useState } from "react";
import type { ActionKind, EmotionLabel } from "@/organism/types";
import type { MouthPose } from "./avatar/embodimentTimeline";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { VRMLoaderPlugin, VRMUtils } from "@pixiv/three-vrm";
import { createVRMAnimationClip, VRMAnimationLoaderPlugin, VRMLookAtQuaternionProxy } from "@pixiv/three-vrm-animation";
import { clearStoredAvatarAnimation, clearStoredAvatarModel, loadStoredAvatarAnimation, loadStoredAvatarModel, MAX_AVATAR_ANIMATION_BYTES, MAX_AVATAR_MODEL_BYTES, saveAvatarAnimation, saveAvatarModel } from "./avatar/avatarModelStore";
import { inspectSelfContainedGlb } from "./avatar/avatarModelValidation";
import { buildHumanoidRoleMap, canonicalizeHumanoidBoneName } from "./avatar/humanoidBoneMap";
import { summarizeVrmLicenseMetadata } from "./avatar/vrmLicenseMetadata";
import { inspectVrmModelCapabilities, summarizeVrmModelCapabilities } from "./avatar/vrmModelCapabilities";
import { selectAvatarMotionClip } from "./avatar/avatarMotionClipSelector";
import {
 applyVrmMorphTargetWeights,
 bindVrmExpressionTargets,
 buildVrmExpressionMap,
 deriveVrmExpressionWeights,
 type VrmExpressionDefinition,
 type VrmMorphTargetGroup,
} from "./avatar/vrmExpressionMap";
import * as THREE from "three";

type Props = { emotion: EmotionLabel; action: ActionKind; arousal: number; valence: number; dominance: number; energy: number; cognitiveLoad: number; uncertainty: number; socialNeed: number; novelty: number; goalPressure: number; curiosity: number; predictionError: number; traits: Record<string, number>; gazeX: number; gazeY: number; speaking: boolean; mouthPose: MouthPose; thinking: boolean; awake: boolean };
type Bone = { node: any; name: string; x: number; y: number; z: number };
type Runtime = { scene:any; camera:any; renderer:any; body:any; loaded:any; vrm:any; vrmExpressionKeys:string[]; lookAtTarget:any; lookAtProxy:any; mixer:any; clips:any[]; modelClips:any[]; vrmaClips:any[]; vrmaDefaultClip:any; activeAction:any; vrmaExpressionKeysByClip:Record<string,string[]>; vrmaLookAtClipNames:string[]; activeExpressionKeys:string[]; transitionExpressionKeys:string[]; expressionTransitionRemaining:number; activeLookAtClip:boolean; clipName:string; bones:Bone[]; vrmExpressionDefinitions:VrmExpressionDefinition[]; vrmMorphTargets:VrmMorphTargetGroup[]; yaw:number; dragX:number|null; mood:any; last:number };
const clamp=(n:number,a:number,b:number)=>Math.max(a,Math.min(b,Number.isFinite(n)?n:0));
const material=(color:number,roughness=0.7,metalness=0)=>new THREE.MeshStandardMaterial({color,roughness,metalness});
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
function disposeTree(root:any){root?.traverse?.((node:any)=>{node.geometry?.dispose?.();for(const mat of(Array.isArray(node.material)?node.material:node.material?[node.material]:[])){for(const value of Object.values(mat)){if(value&&typeof value==="object"&&(value as any).isTexture)(value as any).dispose?.();}mat.dispose?.();}});}
function bonesOf(root:any,gltf?:any,vrm?:any):Bone[]{const out:Bone[]=[],seen=new Set<any>(),normalizedRoles=new Set<string>(),roleMap=buildHumanoidRoleMap(gltf?.parser?.json?.extensions),associations=gltf?.parser?.associations;const add=(node:any,name:string)=>{if(!node?.rotation||seen.has(node))return;seen.add(node);out.push({node,name,x:node.rotation.x,y:node.rotation.y,z:node.rotation.z});};const normalized:[string,string][]=[["head","head"],["neck","neck"],["leftUpperArm","leftupperarm"],["rightUpperArm","rightupperarm"],["leftLowerArm","leftlowerarm"],["rightLowerArm","rightlowerarm"]];for(const [boneName,role]of normalized){const node=vrm?.humanoid?.getNormalizedBoneNode?.(boneName);if(node){normalizedRoles.add(role);add(node,role);}}root.traverse((node:any)=>{if(node.isBone){const nodeIndex=associations?.get?.(node)?.nodes,mapped=Number.isSafeInteger(nodeIndex)?roleMap.get(nodeIndex):undefined,name=mapped??canonicalizeHumanoidBoneName(node.name);if(!normalizedRoles.has(name))add(node,name);}});return out;}
function transitionClip(rt:Runtime,clip:any,timeScale:number,fadeSeconds=.22):void{
 if(!rt.mixer)return;
 if(!clip){
  if(rt.activeAction){
   rt.transitionExpressionKeys=[...rt.activeExpressionKeys];
   rt.expressionTransitionRemaining=fadeSeconds;
   rt.activeExpressionKeys=[];
   rt.activeLookAtClip=false;
   rt.activeAction.fadeOut(fadeSeconds);rt.activeAction=null;rt.clipName="";
  }
  return;
 }
 if(rt.activeAction&&rt.clipName===clip.name)return;
 const next=rt.mixer.clipAction(clip);
 if(rt.activeAction&&rt.activeAction!==next)rt.activeAction.fadeOut(fadeSeconds);
 const previousKeys=rt.activeExpressionKeys??[];
 const nextKeys=rt.vrmaExpressionKeysByClip[String(clip.name??"")]??[];
 rt.transitionExpressionKeys=Array.from(new Set([...previousKeys,...nextKeys]));
 rt.expressionTransitionRemaining=fadeSeconds;
 rt.activeExpressionKeys=nextKeys;
 rt.activeLookAtClip=rt.vrmaLookAtClipNames.includes(String(clip.name??""));
 next.reset();next.enabled=true;next.setEffectiveTimeScale(clamp(timeScale,.1,2));
 next.setEffectiveWeight(1);next.fadeIn(fadeSeconds).play();
 rt.activeAction=next;rt.clipName=String(clip.name??"");
}
export function Avatar3DStage(props:Props){
 const host=useRef<HTMLDivElement>(null),fileInput=useRef<HTMLInputElement>(null),animationInput=useRef<HTMLInputElement>(null),runtime=useRef<Runtime|null>(null),latest=useRef(props),loadToken=useRef(0),animationToken=useRef(0);
 const [ready,setReady]=useState(false),[modelName,setModelName]=useState(""),[modelRevision,setModelRevision]=useState(0),[state,setState]=useState<"procedural"|"loading"|"loaded"|"error"|"webgl-unavailable">("procedural"),[message,setMessage]=useState(""),[storageMessage,setStorageMessage]=useState("Реальная лицензированная модель Курису не включена в текущий репозиторий.");
 latest.current=props;
 const loadModel=useCallback(async(blob:Blob,name:string,persist:boolean)=>{
  const failLoad=(reason:string)=>{const active=runtime.current;setState(active?.loaded?"loaded":active?"error":"webgl-unavailable");setMessage(`${reason}${active?.loaded?" Предыдущая модель остаётся активной.":" Процедурное тело остаётся активным."}`);};
  if(!blob.size||blob.size>MAX_AVATAR_MODEL_BYTES){failLoad("Файл должен быть непустым и не больше 90 МБ.");return;}
  const rt=runtime.current;if(!rt){setState("error");setMessage("3D-сцена ещё запускается; повторите загрузку.");return;}
  animationToken.current++;const token=++loadToken.current;setState("loading");setMessage("Загрузка локальной модели…");
  try{const data=await blob.arrayBuffer();if(token!==loadToken.current)return;inspectSelfContainedGlb(data,MAX_AVATAR_MODEL_BYTES);const loader=new GLTFLoader();loader.register((parser:any)=>new VRMLoaderPlugin(parser));loader.register((parser:any)=>new VRMAnimationLoaderPlugin(parser));loader.parse(data,"",(gltf:any)=>{
   if(token!==loadToken.current||runtime.current!==rt){if(gltf.userData?.vrm)VRMUtils.deepDispose(gltf.userData.vrm.scene);else disposeTree(gltf.scene);return;}
   try{const vrm=gltf.userData?.vrm??null;if(vrm)VRMUtils.rotateVRM0(vrm);const root=vrm?.scene??gltf.scene;if(!root)throw new Error("В файле нет glTF-сцены.");const bounds=new THREE.Box3().setFromObject(root),size=new THREE.Vector3(),center=new THREE.Vector3();bounds.getSize(size);bounds.getCenter(center);const max=Math.max(size.x,size.y,size.z);if(!Number.isFinite(max)||max<.0001)throw new Error("У модели нет видимой геометрии.");const scale=3.15/max;root.scale.setScalar(scale);root.position.set(-center.x*scale,-bounds.min.y*scale+.04,-center.z*scale);const pivot=new THREE.Group();pivot.name="NK1AvatarMotionPivot";pivot.add(root);root.traverse((n:any)=>{if(n.isMesh){for(const m of(Array.isArray(n.material)?n.material:n.material?[n.material]:[])){if("roughness"in m)m.roughness=clamp(Number(m.roughness??.8),.18,1);}}});
    if(rt.loaded){rt.scene.remove(rt.loaded);if(rt.vrm)VRMUtils.deepDispose(rt.loaded);else disposeTree(rt.loaded);}rt.mixer?.stopAllAction();rt.loaded=pivot;rt.vrm=vrm;rt.lookAtProxy=vrm?.lookAt?new VRMLookAtQuaternionProxy(vrm.lookAt):null;if(rt.lookAtProxy){rt.lookAtProxy.name="lookAtQuaternionProxy";root.add(rt.lookAtProxy);}rt.scene.add(pivot);rt.body.root.visible=false;rt.bones=bonesOf(root,gltf,vrm);rt.modelClips=Array.isArray(gltf.animations)?gltf.animations:[];rt.vrmaClips=[];rt.vrmaDefaultClip=null;rt.vrmaExpressionKeysByClip={};rt.vrmaLookAtClipNames=[];rt.activeExpressionKeys=[];rt.transitionExpressionKeys=[];rt.expressionTransitionRemaining=0;rt.activeLookAtClip=false;rt.clips=[...rt.modelClips];rt.mixer=new THREE.AnimationMixer(root);rt.activeAction=null;rt.clipName="";rt.vrmExpressionDefinitions=buildVrmExpressionMap(gltf.parser?.json?.extensions);rt.vrmMorphTargets=bindVrmExpressionTargets(rt.vrmExpressionDefinitions,gltf.parser?.associations?.entries?.()??[]);const expressionManager=vrm?.expressionManager;rt.vrmExpressionKeys=expressionManager?["happy","angry","sad","relaxed","surprised","aa","ih","ou","ee","oh","blink","blinkLeft","blinkRight","lookUp","lookDown","lookLeft","lookRight"].filter((key)=>!(vrm?.lookAt&&key.startsWith("look"))&&expressionManager.getValue(key)!==null):[];const capabilities=inspectVrmModelCapabilities(vrm,rt.modelClips.length);setModelName(name);setModelRevision((revision)=>revision+1);setState("loaded");setMessage(`${rt.vrm?.expressionManager&&rt.vrmExpressionKeys.length?"VRM ExpressionManager подключён.":rt.vrmMorphTargets.length?"VRM morphTargetBinds подключены.":rt.bones.length?"Модель загружена; доступны распознанные кости.":"Геометрия загружена; скелет не найден."} ${summarizeVrmModelCapabilities(capabilities)}${capabilities.warnings.length?` · Внимание: ${capabilities.warnings[0]}`:""}`);
    const licenseNotice=summarizeVrmLicenseMetadata(vrm?.meta,name).summary;
    if(persist)void saveAvatarModel(blob,name).then(()=>setStorageMessage(`${licenseNotice} Модель сохранена локально в браузере; файл не отправляется на сервер.`)).catch(()=>setStorageMessage(`${licenseNotice} Модель загружена, но браузер не разрешил сохранить её между сессиями.`));else setStorageMessage(`${licenseNotice} Восстановлена локальная модель из хранилища браузера.`);
   }catch(e){if(gltf.userData?.vrm)VRMUtils.deepDispose(gltf.userData.vrm.scene);else disposeTree(gltf.scene);failLoad(e instanceof Error?e.message:"Не удалось подготовить модель.");}
  },(error:any)=>{if(token!==loadToken.current)return;failLoad(error instanceof Error?error.message:"Не прочитан бинарный VRM/GLB. Используйте самодостаточный GLB/VRM с геометрией и текстурами внутри.");});
  }catch(e){if(token!==loadToken.current)return;failLoad(e instanceof Error?e.message:"Ошибка чтения модели.");}
 },[]);
 useEffect(()=>{
  const el=host.current;if(!el)return;let renderer:any;let raf=0;let observer:ResizeObserver|null=null;let disposed=false;
  try{
   renderer=new THREE.WebGLRenderer({alpha:true,antialias:true,powerPreference:"low-power"});renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));renderer.setSize(Math.max(el.clientWidth,1),Math.max(el.clientHeight,1),false);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.08;renderer.shadowMap.enabled=false;renderer.domElement.style.cssText="display:block;width:100%;height:100%;touch-action:none;cursor:grab";renderer.domElement.setAttribute("aria-label","3D-модель Курису, потяните для поворота");el.appendChild(renderer.domElement);
   const scene=new THREE.Scene();const camera=new THREE.PerspectiveCamera(31,Math.max(el.clientWidth,1)/Math.max(el.clientHeight,1),.1,100);camera.position.set(0,1.78,6.65);camera.lookAt(0,1.69,0);
   scene.add(new THREE.HemisphereLight(0xd8e9ff,0x352432,2.15));const key=new THREE.DirectionalLight(0xffe2d0,3);key.position.set(-3.5,5.5,4.5);scene.add(key);const fill=new THREE.DirectionalLight(0x82d8f4,1.25);fill.position.set(4,3,2.5);scene.add(fill);const rim=new THREE.DirectionalLight(0xbca3ff,1.15);rim.position.set(.5,3,-4);scene.add(rim);const mood=new THREE.PointLight(0x76c8e6,.58,7.5);mood.position.set(0,2.2,1.2);scene.add(mood);
   const body=makeBody(scene);const lookAtTarget=new THREE.Group();camera.add(lookAtTarget);lookAtTarget.position.set(0,1.7,-5);const rt:Runtime={scene,camera,renderer,body,loaded:null,vrm:null,vrmExpressionKeys:[],lookAtTarget,lookAtProxy:null,mixer:null,clips:[],modelClips:[],vrmaClips:[],vrmaDefaultClip:null,activeAction:null,vrmaExpressionKeysByClip:{},vrmaLookAtClipNames:[],activeExpressionKeys:[],transitionExpressionKeys:[],expressionTransitionRemaining:0,activeLookAtClip:false,clipName:"",bones:[],vrmExpressionDefinitions:[],vrmMorphTargets:[],yaw:0,dragX:null,mood,last:performance.now()};runtime.current=rt;
   const resize=()=>{if(disposed)return;const w=Math.max(el.clientWidth,1),h=Math.max(el.clientHeight,1);camera.aspect=w/h;camera.updateProjectionMatrix();renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));renderer.setSize(w,h,false);};observer=typeof ResizeObserver!=="undefined"?new ResizeObserver(resize):null;observer?.observe(el);window.addEventListener("resize",resize);
   const down=(e:PointerEvent)=>{rt.dragX=e.clientX;renderer.domElement.style.cursor="grabbing";try{renderer.domElement.setPointerCapture(e.pointerId);}catch{}};const move=(e:PointerEvent)=>{if(rt.dragX===null)return;rt.yaw+=(e.clientX-rt.dragX)*.008;rt.dragX=e.clientX;};const up=()=>{rt.dragX=null;renderer.domElement.style.cursor="grab";};renderer.domElement.addEventListener("pointerdown",down);renderer.domElement.addEventListener("pointermove",move);renderer.domElement.addEventListener("pointerup",up);renderer.domElement.addEventListener("pointercancel",up);
   const animate=(now:number)=>{if(disposed||runtime.current!==rt)return;raf=requestAnimationFrame(animate);const dt=Math.min(.05,Math.max(0,(now-rt.last)/1000));rt.last=now;const t=now/1000,p=latest.current,b=rt.body,active=p.awake?1:.22,energy=clamp(p.energy,0,1),load=clamp(p.cognitiveLoad,0,1),uncertainty=clamp(p.uncertainty,0,1),social=clamp(p.socialNeed,0,1),novelty=clamp(p.novelty,0,1),curiosity=clamp(p.curiosity,0,1),goal=clamp(p.goalPressure,0,1),error=clamp(p.predictionError,0,1),dominance=clamp(p.dominance,0,1),valence=clamp(p.valence,0,1),warmth=clamp(p.traits.warmth??.5,0,1),sarcasm=clamp(p.traits.sarcasm??.5,0,1),guarded=clamp(p.traits.guardedness??.5,0,1),composure=clamp(p.traits.composure??.5,0,1);b.root.position.y=Math.sin(t*(p.awake?1.5+.5*energy:.45))*(.004+.018*energy);b.root.rotation.y=rt.yaw+Math.sin(t*.29)*(.006+.014*uncertainty);b.root.rotation.x=(p.action==="explore"?-.016:p.action==="verify"||p.action==="reflect"?-.026:p.action==="rest"?.035:0)+(goal-.35)*.045+load*.022-dominance*.018+(1-energy)*.035;b.head.rotation.x=-clamp(p.gazeY,-1,1)*.1+(p.thinking?-.035:0)-load*.045+(1-energy)*.05;b.head.rotation.y=clamp(p.gazeX,-1,1)*(.2-social*.075)+Math.sin(t*.6)*(.014*active+uncertainty*.025+novelty*.012+curiosity*.012);b.head.rotation.z=(p.emotion==="sadness"?.055:p.emotion==="anxiety"?-.035:p.emotion==="anger"||p.emotion==="frustration"?-.04:p.emotion==="curiosity"?.035:Math.sin(t*.75)*.009*active)+(0.5-valence)*.055+(0.5-composure)*.018;
    const pose:Record<ActionKind,[number,number]>={respond:[p.speaking?-.25:-.08,p.speaking?.42:.1],explore:[-.23,-.45],verify:[.08,-.68],rest:[.08,-.08],reflect:[-.1,.18],wait:[0,0]};let l=pose[p.action][0],r=pose[p.action][1];if(p.emotion==="anger"||p.emotion==="frustration"){l=-.64;r=.64;}else if(p.emotion==="protective"){l-=.12;r-=.12;}l+=guarded*.08-load*.06;r-=guarded*.08;if(social>.68&&p.speaking){l-=.08;r+=.1;}if(!p.awake){l*=.25;r*=.25;}b.leftArm.rotation.z+=(l-b.leftArm.rotation.z)*Math.min(1,dt*4.5);b.rightArm.rotation.z+=(r-b.rightArm.rotation.z)*Math.min(1,dt*4.5);
    b.mouth.scale.y=.014+clamp(p.speaking?p.mouthPose.open:0,0,1)*.07;b.mouth.scale.x=.045+clamp(p.speaking?Math.abs(p.mouthPose.form):0,0,1)*.035;b.mouth.rotation.z=(valence-.5)*.22+sarcasm*.025;const baseEye=p.emotion==="sadness"?.76:p.emotion==="anger"||p.emotion==="frustration"?.68:p.emotion==="curiosity"||p.emotion==="anxiety"?1.12:1;const eye=baseEye*(.76+energy*.24)*(1-load*.12)*(1+error*.1);b.eyeWhites.forEach((e:any)=>{e.scale.y=.101*eye;e.position.y=.035-clamp(p.gazeY,-1,1)*.018;});b.irises.forEach((e:any,i:number)=>{e.position.x=(i===0?-.126:.126)+clamp(p.gazeX,-1,1)*.024;e.position.y=.026-clamp(p.gazeY,-1,1)*.018;});b.brows.forEach((e:any,i:number)=>{const side=i===0?-1:1;e.rotation.z=(p.emotion==="anger"||p.emotion==="frustration"?(i===0?-.22:.22):p.emotion==="sadness"||p.emotion==="anxiety"?(i===0?.12:-.12):p.thinking?(i===0?-.06:.06):0)+side*(load*.1+(uncertainty-.5)*.05-sarcasm*.025);});
    b.ringMat.opacity=.28+clamp(p.arousal,0,1)*.25+error*.12+goal*.08;const hue:Record<EmotionLabel,number>={curiosity:0x68d9ed,calm:0x76c8e6,joy:0xffa7bd,anxiety:0x858bd6,frustration:0xf27c6f,sadness:0x6e83c7,anger:0xff525e,protective:0xd9a4f5};rt.mood.color.setHex(hue[p.emotion]);rt.mood.intensity=.24+clamp(p.arousal,0,1)*.42+error*.16+uncertainty*.08;
    if(rt.loaded){rt.loaded.rotation.y=rt.yaw+Math.sin(t*.29)*(.006+.014*uncertainty);const clip=selectAvatarMotionClip({vrmaClips:rt.vrmaClips,modelClips:rt.modelClips,vrmaDefaultClip:rt.vrmaDefaultClip,action:p.action});transitionClip(rt,clip,p.awake?.55+energy*.45:.3);/* Reset to bind pose before the mixer so offsets do not accumulate; then add motor intent on top of the clip. */rt.bones.forEach((bone)=>{bone.node.rotation.set(bone.x,bone.y,bone.z);});rt.mixer?.update(dt);rt.bones.forEach((bone)=>{const n=bone.name;if(n.includes("head")||n.includes("neck")){bone.node.rotation.x+=-clamp(p.gazeY,-1,1)*.12-load*.035+(1-energy)*.04;bone.node.rotation.y+=clamp(p.gazeX,-1,1)*(.22-social*.05)+uncertainty*.025;bone.node.rotation.z+=p.emotion==="sadness"?.055:p.emotion==="anger"||p.emotion==="frustration"?-.04:0;}else if(n.includes("leftupperarm")||n.includes("leftshoulder"))bone.node.rotation.z+=p.action==="explore"?-.14:0;else if(n.includes("rightupperarm")||n.includes("rightshoulder"))bone.node.rotation.z+=p.action==="respond"&&p.speaking?-.26:p.action==="verify"?-.18:0;});const expressionWeights=deriveVrmExpressionWeights(rt.vrmExpressionDefinitions,{
     emotion:p.emotion,valence:p.valence,arousal:p.arousal,curiosity,warmth,
     speaking:p.speaking,awake:p.awake,mouthPose:p.mouthPose,
     gazeX:p.gazeX,gazeY:p.gazeY,
     blink:p.awake&&Math.sin(t*.83)>.994?.92:0,
    },{applyVrmOverrides:!(rt.vrm?.expressionManager&&rt.vrmExpressionKeys.length>0)});
    if(rt.vrm?.expressionManager&&rt.vrmExpressionKeys.length){
      const protectedKeys=new Set(rt.expressionTransitionRemaining>0?[...rt.activeExpressionKeys,...rt.transitionExpressionKeys]:rt.activeExpressionKeys);
      const speechVisemeKeys=p.speaking?new Set(["aa","ih","ou","ee","oh"]):null;
      for(const key of rt.vrmExpressionKeys){
        // Speech articulation is time-critical: while NK1 is speaking, its
        // grapheme-timeline visemes own the vowel presets even if a VRMA clip
        // also contains mouth tracks. Emotion/other facial tracks remain intact.
        if(speechVisemeKeys?.has(key))rt.vrm.expressionManager.setValue(key,expressionWeights[key]??0);
        else if(!protectedKeys.has(key))rt.vrm.expressionManager.setValue(key,expressionWeights[key]??0);
      }
      if(rt.expressionTransitionRemaining>0){rt.expressionTransitionRemaining=Math.max(0,rt.expressionTransitionRemaining-dt);if(rt.expressionTransitionRemaining===0)rt.transitionExpressionKeys=[];}
    }else if(rt.vrmMorphTargets.length){
      applyVrmMorphTargetWeights(rt.vrmMorphTargets,expressionWeights);
    }else{
      rt.loaded.traverse((node:any)=>{if(!node.isMesh||!node.morphTargetDictionary||!node.morphTargetInfluences)return;for(const [key,index]of Object.entries(node.morphTargetDictionary)){const k=String(key).toLowerCase().replace(/[^a-z0-9]/g,"");let value:number|null=null;if(/happy|joy|smile/.test(k))value=p.emotion==="joy"?.75:p.emotion==="protective"?.22:p.emotion==="calm"?warmth*.16:0;else if(/sad|sorrow|cry/.test(k))value=p.emotion==="sadness"||p.emotion==="anxiety"?.62:0;else if(/angry|anger|frown/.test(k))value=p.emotion==="anger"||p.emotion==="frustration"?.7:0;else if(/mouthopen|jawopen|visemeaa|phonemeaa/.test(k))value=p.speaking?clamp(p.mouthPose.open,0,1):0;else if(/visemeoh|phonemeoh/.test(k))value=p.speaking&&p.mouthPose.form<-.25?clamp(p.mouthPose.open,0,1):0;else if(/blink|eyeclose/.test(k))value=Math.sin(t*.83)>.994&&p.awake?.92:0;if(value!==null)node.morphTargetInfluences[Number(index)]=value;}});
    }}
    if(rt.vrm?.lookAt){
      if(rt.activeLookAtClip)rt.vrm.lookAt.target=null;
      else{rt.lookAtTarget.position.set(clamp(p.gazeX,-1,1)*0.65,1.7-clamp(p.gazeY,-1,1)*0.45,-5);rt.vrm.lookAt.target=rt.lookAtTarget;}
    }
    rt.vrm?.update(dt);
    renderer.render(scene,camera);
   };raf=requestAnimationFrame(animate);setReady(true);setState("procedural");setMessage("");setStorageMessage("Процедурное 3D-тело готово; загрузите локальную VRM/GLB-модель для замены.");
   return()=>{disposed=true;cancelAnimationFrame(raf);observer?.disconnect();window.removeEventListener("resize",resize);renderer.domElement.removeEventListener("pointerdown",down);renderer.domElement.removeEventListener("pointermove",move);renderer.domElement.removeEventListener("pointerup",up);renderer.domElement.removeEventListener("pointercancel",up);rt.mixer?.stopAllAction();if(rt.vrm){VRMUtils.deepDispose(rt.vrm.scene);disposeTree(rt.body.root);}else disposeTree(scene);renderer.dispose();renderer.domElement.remove();runtime.current=null;setReady(false);};
  }catch(e){setState("webgl-unavailable");setMessage("WebGL недоступен. Включите аппаратное ускорение или используйте браузер с поддержкой WebGL.");setStorageMessage(e instanceof Error?e.message.slice(0,160):"Ошибка запуска 3D-рендерера");return()=>renderer?.dispose?.();}
 },[]);
 const loadVrma=useCallback(async(blob:Blob,name:string,persist:boolean)=>{
  const rt=runtime.current;
  const fail=(reason:string)=>setMessage(`VRMA: ${reason}`);
  if(!rt?.vrm||!rt.mixer){fail("сначала загрузите VRM-персонажа.");return;}
  if(!blob.size||blob.size>MAX_AVATAR_ANIMATION_BYTES){fail("файл пуст или превышает 90 МиБ.");return;}
  const token=++animationToken.current;
  setMessage("Проверка и загрузка VRMA-анимации…");
  try{
   const data=await blob.arrayBuffer();
   if(token!==animationToken.current||runtime.current!==rt)return;
   inspectSelfContainedGlb(data,MAX_AVATAR_MODEL_BYTES);
   const loader=new GLTFLoader();
   loader.register((parser:any)=>new VRMAnimationLoaderPlugin(parser));
   loader.parse(data,"",(gltf:any)=>{
    if(token!==animationToken.current||runtime.current!==rt){disposeTree(gltf.scene);return;}
    try{
     const animations=Array.isArray(gltf.userData?.vrmAnimations)?gltf.userData.vrmAnimations:[];
     if(!animations.length)throw new Error("в файле не найдено расширение VRMC_vrm_animation.");
     if(animations.length>20)throw new Error("файл содержит больше 20 анимаций.");
     const fileBase=name.replace(/\.vrma$/iu,"").slice(0,96)||"vrma";
     const expressionKeysByClip:Record<string,string[]>={};
     const lookAtClipNames:string[]=[];
     const clips=animations.map((animation:any,index:number)=>{
      const clip=createVRMAnimationClip(animation,rt.vrm);
      const sourceName=typeof animation?.name==="string"?animation.name:"";
      clip.name=`${fileBase}_${sourceName.trim().slice(0,72)||`clip${index+1}`}`.slice(0,120);
      expressionKeysByClip[clip.name]=[
       ...Array.from(animation?.expressionTracks?.preset?.keys?.()??[],(key:any)=>String(key)),
       ...Array.from(animation?.expressionTracks?.custom?.keys?.()??[],(key:any)=>String(key)),
      ];
      if(animation?.lookAtTrack)lookAtClipNames.push(clip.name);
      return clip;
     });
     rt.mixer?.stopAllAction();
     rt.activeAction=null;rt.clipName="";rt.activeExpressionKeys=[];rt.transitionExpressionKeys=[];rt.expressionTransitionRemaining=0;rt.activeLookAtClip=false;
     rt.vrmaExpressionKeysByClip=expressionKeysByClip;rt.vrmaLookAtClipNames=lookAtClipNames;
     rt.vrmaClips=clips;
     rt.vrmaDefaultClip=clips[0]??null;
     disposeTree(gltf.scene);
     rt.clips=[...rt.modelClips,...rt.vrmaClips];
     rt.clipName="";
     setMessage(`VRMA подключена: ${clips.map((clip:any)=>clip.name).join(", ")}. Для автоматического выбора используйте имена idle, respond, explore, verify, reflect или rest.`);
     if(persist)void saveAvatarAnimation(blob,name).then(()=>setStorageMessage("VRMA сохранена локально в IndexedDB браузера.")).catch(()=>setStorageMessage("VRMA подключена, но браузер не разрешил её сохранить."));
    }catch(error){
     disposeTree(gltf.scene);
     fail(error instanceof Error?error.message:"не удалось преобразовать VRMA в клип.");
    }
   },(error:any)=>{if(token!==animationToken.current)return;fail(error instanceof Error?error.message:"не удалось разобрать VRMA GLB.");});
  }catch(error){if(token!==animationToken.current)return;fail(error instanceof Error?error.message:"ошибка чтения VRMA.");}
 },[]);
 useEffect(()=>{
  if(state!=="loaded"||!modelName||!runtime.current?.vrm)return;
  let cancelled=false;
  void loadStoredAvatarAnimation().then((saved)=>{if(!cancelled&&saved)void loadVrma(saved.blob,saved.name,false);}).catch(()=>{if(!cancelled)setStorageMessage("VRMA IndexedDB недоступна; используйте ручную загрузку .vrma.");});
  return()=>{cancelled=true;};
 },[state,modelName,modelRevision,loadVrma]);
 useEffect(()=>{if(!ready)return;let cancelled=false;void loadStoredAvatarModel().then((saved)=>{if(!cancelled&&saved)void loadModel(saved.blob,saved.name,false);}).catch(()=>{if(!cancelled)setStorageMessage("IndexedDB недоступна; процедурное тело остаётся рабочим.");});return()=>{cancelled=true;};},[ready,loadModel]);
 const onFile=(event:ChangeEvent<HTMLInputElement>)=>{const file=event.currentTarget.files?.[0];event.currentTarget.value="";if(!file)return;const ext=file.name.toLowerCase().split(".").pop();if(ext!=="vrm"&&ext!=="glb"){const hasModel=Boolean(runtime.current?.loaded);setState(hasModel?"loaded":"error");setMessage(`Поддерживаются бинарные модели .vrm и .glb.${hasModel?" Предыдущая модель остаётся активной.":" Процедурное тело остаётся активным."}`);return;}void loadModel(file,file.name,true);};
 const onAnimationFile=(event:ChangeEvent<HTMLInputElement>)=>{const file=event.currentTarget.files?.[0];event.currentTarget.value="";if(!file)return;if(!file.name.toLowerCase().endsWith(".vrma")){setMessage("Для отдельной анимации выберите файл .vrma; GLB персонажа загружается через VRM/GLB.");return;}void loadVrma(file,file.name,true);};
 const reset=async()=>{loadToken.current++;animationToken.current++;const rt=runtime.current;if(rt?.loaded){rt.scene.remove(rt.loaded);if(rt.vrm)VRMUtils.deepDispose(rt.loaded);else disposeTree(rt.loaded);rt.loaded=null;}if(rt){rt.mixer?.stopAllAction();rt.mixer=null;rt.clips=[];rt.modelClips=[];rt.vrmaClips=[];rt.vrmaDefaultClip=null;rt.activeAction=null;rt.vrmaExpressionKeysByClip={};rt.vrmaLookAtClipNames=[];rt.activeExpressionKeys=[];rt.transitionExpressionKeys=[];rt.expressionTransitionRemaining=0;rt.activeLookAtClip=false;rt.clipName="";rt.bones=[];rt.vrm=null;rt.lookAtProxy=null;rt.vrmExpressionKeys=[];rt.vrmExpressionDefinitions=[];rt.vrmMorphTargets=[];rt.body.root.visible=true;}setModelName("");setState(rt?"procedural":"webgl-unavailable");setMessage("");try{await Promise.all([clearStoredAvatarModel(),clearStoredAvatarAnimation()]);setStorageMessage("Используется процедурное 3D-тело; VRM и VRMA удалены из локального хранилища.");}catch{setStorageMessage("Тело сброшено, но браузер не разрешил удалить сохранённый файл.");}};
 return <section className="relative min-h-[320px] overflow-hidden bg-[radial-gradient(ellipse_at_50%_23%,rgba(68,126,158,.22),transparent_48%),radial-gradient(ellipse_at_50%_88%,rgba(114,78,157,.16),transparent_44%),#070d16] md:min-h-[420px]" aria-label="3D-тело Neuro-Kurisu">
  <div ref={host} className="absolute inset-0"/>
  {state==="webgl-unavailable"?<div className="absolute inset-0 z-10 grid place-items-center p-6"><div className="max-w-sm rounded-xl border border-white/15 bg-black/70 p-4 text-center text-white"><p className="text-sm font-semibold">3D-рендерер недоступен</p><p className="mt-2 text-xs text-white/70">{message}</p></div></div>:null}
  <div className="absolute right-3 top-3 z-20 flex max-w-[75%] flex-wrap justify-end gap-1.5"><button type="button" onClick={()=>fileInput.current?.click()} disabled={!ready} className="rounded-md border border-cyan-100/25 bg-slate-950/75 px-2.5 py-1.5 text-[10px] font-mono text-cyan-50 hover:border-cyan-100/55">Загрузить VRM/GLB</button><button type="button" onClick={()=>animationInput.current?.click()} disabled={!ready||!modelName} className="rounded-md border border-violet-100/25 bg-slate-950/75 px-2.5 py-1.5 text-[10px] font-mono text-violet-50 hover:border-violet-100/55">Загрузить VRMA</button>{modelName?<button type="button" onClick={()=>void reset()} className="rounded-md border border-white/15 bg-slate-950/75 px-2.5 py-1.5 text-[10px] font-mono text-white/80">Сбросить</button>:null}<input ref={fileInput} type="file" accept=".vrm,.glb,model/gltf-binary" onChange={onFile} className="hidden" aria-label="Выберите локальную VRM или GLB модель"/><input ref={animationInput} type="file" accept=".vrma,model/gltf-binary" onChange={onAnimationFile} className="hidden" aria-label="Выберите локальную VRMA-анимацию"/></div>
  <div className="pointer-events-none absolute inset-x-3 bottom-3 z-20 flex items-end justify-between gap-2"><div className="max-w-[80%] rounded-lg border border-white/10 bg-slate-950/70 px-2.5 py-2 backdrop-blur"><p className="text-[11px] font-semibold tracking-wide text-slate-100">{modelName||"NK1 · TRUE 3D BODY"}</p><p className="mt-0.5 text-[10px] leading-relaxed text-slate-300/80">{state==="loaded"?"3D-модель · эмоция, действие, взгляд и речь связаны с состоянием NK1":state==="loading"?"Подготовка модели…":state==="error"?"Модель не загружена · процедурное тело сохраняется":state==="webgl-unavailable"?"Требуется WebGL":"Процедурный 3D-концепт · эмоции и движение от состояния NK1"}</p></div><div className="rounded-full border border-cyan-200/20 bg-slate-950/70 px-2 py-1 text-[9px] uppercase tracking-wider text-cyan-100/80">{props.awake?(props.thinking?"thinking":props.speaking?"speaking":props.emotion):"sleep"}</div></div>
  {message?<p role="status" className="absolute bottom-[4.6rem] left-3 z-20 max-w-[78%] rounded bg-slate-950/80 px-2 py-1.5 text-[10px] text-amber-100/90">{message}</p>:null}
  <p className="absolute right-3 bottom-[4.6rem] z-20 max-w-[42%] text-right text-[9px] text-white/45">Потяните тело, чтобы повернуть. {storageMessage}</p>
 </section>;
}
