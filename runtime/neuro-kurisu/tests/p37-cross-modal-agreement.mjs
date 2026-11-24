import { P37EmbodiedSensoriumEngine } from '../src/organism/body/P37EmbodiedSensorium.ts';
const p=new P37EmbodiedSensoriumEngine();
const a=p.ingest({vision:{sceneLabel:'room',confidence01:.8,objects:[{label:'cup',confidence01:.8}]},worldContext:{location:'room',objects:[{id:'1',label:'cup',location:'room',value:1,visible:true,collected:false}]},at:1});
if((a.crossModalAgreement01??0)<.7) throw new Error('cross-modal overlap not detected');
console.log('PASS p37 cross-modal agreement');
