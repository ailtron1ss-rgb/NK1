#!/usr/bin/env node
/**
 * Run a reproducible paired-holdout evaluation from a JSON evidence document.
 *
 * Usage:
 *   node --experimental-strip-types scripts/evaluate-learning-holdout-workpass72.mjs input.json [report.json]
 *
 * Exit codes: 0 = all evaluation gates eligible; 2 = evidence evaluated but gates failed;
 * 1 = invalid input or execution error. No model/policy is promoted by this command.
 */
import { readFile, writeFile } from "node:fs/promises";
import { evaluateLearningDocument } from "../src/learning/learning-evaluation-document-workpass72.mjs";

const [inputPath, outputPath] = process.argv.slice(2);
if (!inputPath || process.argv.length > 4) {
  process.stderr.write("Usage: evaluate-learning-holdout-workpass72.mjs input.json [report.json]\n");
  process.exitCode = 1;
} else {
  try {
    const document = JSON.parse(await readFile(inputPath, "utf8"));
    const report = evaluateLearningDocument(document);
    const serialized = JSON.stringify(report, null, 2) + "\n";
    if (outputPath) await writeFile(outputPath, serialized, "utf8");
    else process.stdout.write(serialized);
    if (!report.evaluation.promotionEligible) process.exitCode = 2;
  } catch (error) {
    process.stderr.write(`Learning evaluation failed: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
