import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const variants=[
  {name:'quality',dir:path.join(root,'public/live2d/Kurisu'),model:'Kurisu.model3.json',texture:path.join('Kurisu.4096','texture_00.png')},
  {name:'mobile',dir:path.join(root,'public/live2d/Kurisu.mobile'),model:'Kurisu-mobile.model3.json',texture:path.join('Kurisu.2048','texture_00_mobile_2048.png')},
];
for(const v of variants){
  const modelPath=path.join(v.dir,v.model);
  assert.ok(fs.existsSync(modelPath),`${v.name}: model missing`);
  const model=JSON.parse(fs.readFileSync(modelPath,'utf8'));
  const refs=model.FileReferences||{};
  const refsList=[refs.Moc,refs.Physics,refs.DisplayInfo,...(refs.Textures||[]),...(Object.values(refs.Motions||{}).flat().map(x=>x.File)),...(refs.Expressions||[]).map(x=>x.File)].filter(Boolean);
  assert.ok(refsList.length>=10,`${v.name}: too few references`);
  for(const rel of refsList) assert.ok(fs.existsSync(path.resolve(v.dir,rel)),`${v.name}: missing ${rel}`);
  assert.ok(fs.existsSync(path.join(v.dir,v.texture)),`${v.name}: texture missing`);
  const tex=JSON.parse(JSON.stringify({size:fs.statSync(path.join(v.dir,v.texture)).size}));
  assert.ok(tex.size>100000,`${v.name}: texture unexpectedly small`);
  assert.ok((refs.Expressions||[]).length>=7,`${v.name}: expression coverage`);
  assert.ok(Object.values(refs.Motions||{}).flat().length>=4,`${v.name}: motion coverage`);
}

const viewer=fs.readFileSync(path.join(root,'public/live2d/viewer.html'),'utf8');
for(const token of ['Kurisu.mobile/Kurisu-mobile.model3.json','Kurisu/Kurisu.model3.json','kurisu_expression','kurisu_embodiment','kurisu_lipsync','kurisu_embodiment_intent','ParamBodyAngleX','ParamBodyAngleY','ParamBodyAngleZ','ParamBreath','TapHead','TapBody']) assert.ok(viewer.includes(token),`viewer missing ${token}`);
assert.ok(viewer.includes('lastAppliedExpression'), 'viewer must cache the last applied expression');
assert.ok(viewer.includes('expressionName===lastAppliedExpression'), 'mouth/embodiment updates must not restart an unchanged expression');
const rootModel=JSON.parse(fs.readFileSync(path.join(root,'public/live2d/Kurisu/Kurisu.model3.json'),'utf8'));
const mobileModel=JSON.parse(fs.readFileSync(path.join(root,'public/live2d/Kurisu.mobile/Kurisu-mobile.model3.json'),'utf8'));
const displayInfo=JSON.parse(fs.readFileSync(path.join(root,'public/live2d/Kurisu/Kurisu.cdi3.json'),'utf8'));
const parameterIds=new Set((displayInfo.Parameters||[]).map(p=>p.Id));
for(const id of ['ParamAngleX','ParamAngleY','ParamBodyAngleX','ParamBodyAngleY','ParamBodyAngleZ','ParamBreath']) assert.ok(parameterIds.has(id),`canonical Live2D model missing parameter ${id}`);
assert.equal((rootModel.FileReferences.Expressions||[]).length,(mobileModel.FileReferences.Expressions||[]).length);
assert.deepEqual(Object.keys(rootModel.FileReferences.Motions||{}),Object.keys(mobileModel.FileReferences.Motions||{}));
console.log(`LIVE2D_INTEGRITY=PASS qualityTextureBytes=${fs.statSync(path.join(root,'public/live2d/Kurisu/Kurisu.4096/texture_00.png')).size} mobileTextureBytes=${fs.statSync(path.join(root,'public/live2d/Kurisu.mobile/Kurisu.2048/texture_00_mobile_2048.png')).size}`);
