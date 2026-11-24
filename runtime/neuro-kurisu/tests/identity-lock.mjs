import { buildCognitivePrompt } from '../src/organism/language/LanguageOrgan.ts';
const cycle={state:{predictionError:.1,selfPredictionError:.2,needs:{energy:.8,cognitiveLoad:.2,uncertainty:.3}},goals:[],decision:{selected:{action:'verify'},candidates:[],autonomousOverride:false},workspace:{content:{}} ,memories:[]};
const p=buildCognitivePrompt(cycle,[]);
for(const token of ['KURISU CANON LAYER','scientificRigor','truthfulness','autonomous goals']) if(!p.system.includes(token)) throw new Error(`identity-lock:${token}`);
for(const bad of ['[P1 SELF]','[P1 MEMORY]','generic assistant']) if(p.system.includes(bad)) throw new Error(`stale-identity-marker:${bad}`);
console.log('IDENTITY_LOCK=PASS');
