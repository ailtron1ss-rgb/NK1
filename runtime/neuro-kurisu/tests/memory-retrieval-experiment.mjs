const duplicateLabelExamples = structuredClone(examples);
duplicateLabelExamples[0].relevantIds.push(duplicateLabelExamples[0].relevantIds[0]);
const duplicateLabelReport = runMemoryOS2RetrievalBenchmark(snapshot, duplicateLabelExamples, {
  ...options,
  datasetProvenance: { ...provenance, contentSha256: experiment.datasetFingerprint },
});
assert.notEqual(duplicateLabelReport.datasetFingerprint, experiment.datasetFingerprint,
  'the provenance fingerprint must bind duplicate ground-truth labels instead of canonicalizing them away');
assert.equal(duplicateLabelReport.datasetProvenance.contentHashValid, false,
  'a clean dataset hash must not authenticate the duplicate-label input');
assert.equal(duplicateLabelReport.dataIntegrity.duplicateRelevantLabelCount, 1,