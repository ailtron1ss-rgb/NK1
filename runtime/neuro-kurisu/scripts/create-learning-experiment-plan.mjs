#!/usr/bin/env node
import { randomUUID } from 'node:crypto';
import { mkdir, open, readFile, rename, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createLearningExperimentPlan, validateLearningExperimentPlan, validateResearchGradeLearningExperimentPlan } from '../src/organism/learning/LearningExperimentPlan.ts';

function argument(name, fallback) {
  const index = process.argv.indexOf(name);
  if (index < 0) return fallback;
  const value = process.argv[index + 1];
  if (!value || value.startsWith('--')) throw new Error(`missing value for ${name}`);
  return value;
}
function integerList(value, label) {
  const result = value.split(',').map(part => Number(part.trim()));
  if (!result.length || result.some(number => !Number.isSafeInteger(number))) throw new Error(`${label} must be comma-separated integers`);
  return result;
}
async function main() {
  const manifestPath = argument('--manifest');
  const outputPath = argument('--out');
  if (!manifestPath || !outputPath) throw new Error('usage: node --experimental-strip-types scripts/create-learning-experiment-plan.mjs --manifest tasks.json --out plan.json --seeds 1,2,3 --reset-every 1,4');
  const manifest = JSON.parse(await readFile(path.resolve(manifestPath), 'utf8'));
  if (!Array.isArray(manifest)) throw new Error('manifest file must contain a JSON array');
  const plan = createLearningExperimentPlan(manifest, {
    split: argument('--split', 'holdout'),
    seeds: integerList(argument('--seeds', '1,2,3'), '--seeds'),
    resetEvery: integerList(argument('--reset-every', '1,4'), '--reset-every'),
    priorMethod: argument('--prior-method', 'stateless-prior'),
    continuousMethod: argument('--continuous-method', 'uninterrupted-ceiling'),
    resetMethodPrefix: argument('--reset-method-prefix', 'hard-reset-every-'),
  });
  validateLearningExperimentPlan(plan, manifest);
  const researchGrade = process.argv.includes('--research-grade');
  if (researchGrade) validateResearchGradeLearningExperimentPlan(plan, manifest);
  const target = path.resolve(outputPath);
  const directory = path.dirname(target);
  await mkdir(directory, { recursive: true });
  const temporary = path.join(directory, `.${path.basename(target)}.${randomUUID()}.tmp`);
  let handle;
  try {
    handle = await open(temporary, 'wx', 0o600);
    await handle.writeFile(JSON.stringify(plan, null, 2) + '\n', 'utf8');
    await handle.sync();
    await handle.close();
    handle = undefined;
    await rename(temporary, target);
  } catch (error) {
    if (handle) await handle.close().catch(() => undefined);
    await rm(temporary, { force: true }).catch(() => undefined);
    throw error;
  }
  process.stdout.write(JSON.stringify({ status: 'PLAN_CREATED', output: target, planFingerprint: plan.planFingerprint, researchGrade, counts: plan.counts }) + '\n');
}
main().catch(error => {
  process.stderr.write(`PLAN_CREATION_FAILED: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
