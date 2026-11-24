import fs from 'node:fs';
import path from 'node:path';
const root=process.cwd();
const modelPath=path.join(root,'public/live2d/Kurisu/Kurisu.model3.json');
const manifestPath=path.join(root,'public/sprites/manifest.json');
if(!fs.existsSync(modelPath)) { console.error('Live2D model3 missing'); process.exit(1); }
const model=JSON.parse(fs.readFileSync(modelPath,'utf8'));
const refs=model.FileReferences||{};
const base=path.dirname(modelPath);
const referenced=[refs.Moc,refs.Physics,refs.DisplayInfo,...(refs.Textures||[]),...Object.values(refs.Motions||{}).flat().map(x=>x.File),...(refs.Expressions||[]).map(x=>x.File)].filter(Boolean);
const missing=referenced.filter(f=>!fs.existsSync(path.join(base,f)));
if (missing.length) { console.error('Missing Live2D assets:',missing); process.exit(1); }
if (fs.existsSync(manifestPath)) {
  try {
    const legacy=JSON.parse(fs.readFileSync(manifestPath,'utf8'));
    if (Array.isArray(legacy.cells) && legacy.cells.length) {
      console.error('Runtime static sprite manifest must be empty when canonical Live2D assets are used without sprite files.');
      process.exit(1);
    }
  } catch (e) { console.error('Sprite manifest invalid:', e?.message || e); process.exit(1); }
}
console.log(`Live2D verification: PASS referenced=${referenced.length} missing=0 motionGroups=${Object.keys(refs.Motions||{}).length} expressions=${(refs.Expressions||[]).length}`);
