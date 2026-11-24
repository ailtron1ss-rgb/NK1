#!/usr/bin/env node
/**
 * Evaluate a sequential held-out task history from JSON.
 *
 * Usage:
 *   node --experimental-strip-types scripts/evaluate-learning-history-workpass74.mjs input.json [report.json]
 *
 * Exit codes: 0 = report written; 1 = invalid input or execution error.
 * This command measures retention/transfer and never promotes a learner.
 */
import { readFile, writeFile } from "node:fs/promises";
import { evaluateContinualLearningHistory } from "../src/learning/continual-learning-history-workpass74.mjs";

const [inputPath, outputPath] = process.argv.slice(2);
if (inputPath === "--help" || inputPath === "-h") {
  process.stdout.write("Usage: evaluate-learning-history-workpass74.mjs input.json [report.json]" + String.fromCharCode(10));
} else if (!inputPath || process.argv.length > 4) {
  process.stderr.write("Usage: evaluate-learning-history-workpass74.mjs input.json [report.json]" + String.fromCharCode(10));
  process.exitCode = 1;
} else {
  try {
    const document = JSON.parse(await readFile(inputPath, "utf8"));
    const report = evaluateContinualLearningHistory(document);
    const serialized = JSON.stringify(report, null, 2) + "\n";
    if (outputPath) await writeFile(outputPath, serialized, "utf8");
    else process.stdout.write(serialized);
  } catch (error) {
    process.stderr.write(`Continual-learning history evaluation failed: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
