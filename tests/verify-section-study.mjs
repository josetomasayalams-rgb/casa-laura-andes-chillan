import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { analyzeStudyCsv } from '../scripts/analyze-section-theme-study.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const configText = fs.readFileSync(path.join(ROOT, 'research', 'study-config.json'), 'utf8');
const fixtureText = fs.readFileSync(
  path.join(ROOT, 'research', 'fixtures', 'section-theme-study.sample.csv'),
  'utf8'
);
const config = JSON.parse(configText);
const result = analyzeStudyCsv(fixtureText, configText);

assert.equal(config.status, 'preregister-before-data-collection');
assert.equal(config.plannedCompletedParticipants, 72);
assert.equal(config.plannedRecruitment, 80);
assert.equal(config.primary.smallestEffectOfInterest, 0.35);
assert.equal(result.sample.datasetKind, 'synthetic');
assert.equal(result.sample.completeParticipants, 12);
assert.deepEqual(result.sample.sequenceCounts, {
  'uniform-section-adaptive': 6,
  'section-adaptive-uniform': 6
});
assert.equal(result.decision.eligible, false);
assert.equal(result.decision.verdict, 'simulation-only');
assert.equal(result.decision.primaryPass, true);
assert.equal(result.decision.taskSuccessNonInferior, true);
assert.equal(result.decision.errorsNonInferior, true);
assert.match(result.protocol.configSha256, /^[a-f0-9]{64}$/);
assert.equal(result.metrics.visual_aesthetics.estimate, 0.591667);
assert.deepEqual(result.metrics.visual_aesthetics.confidenceInterval, [0.491676, 0.691657]);
assert.equal(result.metrics.task_success_rate.holmAdjustedPValue, 0.020239);

const tooSmallObserved = fixtureText.replaceAll('synthetic,', 'observed,');
const tooSmallResult = analyzeStudyCsv(tooSmallObserved, configText);
assert.equal(tooSmallResult.decision.eligible, false);
assert.equal(tooSmallResult.decision.verdict, 'insufficient-sample');

const excludedRows = fixtureText.split('\n').map((line) => {
  if (!line.startsWith('synthetic,P001,uniform-section-adaptive,2,')) return line;
  return 'synthetic,P001,uniform-section-adaptive,2,section-adaptive,mobile,dark,,,,,no,documented technical failure';
}).join('\n');
const excludedResult = analyzeStudyCsv(excludedRows, configText);
assert.equal(excludedResult.sample.completeParticipants, 11);
assert.equal(excludedResult.sample.excludedRows, 1);
assert.equal(excludedResult.sample.excludedParticipants, 1);

assert.throws(
  () => analyzeStudyCsv(fixtureText.replace('P001,uniform-section-adaptive,2', 'P001,uniform-section-adaptive,1'), configText),
  /periods 1 and 2/
);
assert.throws(
  () => analyzeStudyCsv(fixtureText.replace('P001,uniform-section-adaptive,2,section-adaptive', 'P001,uniform-section-adaptive,2,uniform'), configText),
  /conditions do not match assigned sequence/
);
assert.throws(
  () => analyzeStudyCsv(fixtureText.replace('P001,uniform-section-adaptive,1,uniform,mobile,dark,4.2', 'P001,uniform-section-adaptive,1,uniform,mobile,dark,9.2'), configText),
  /visual_aesthetics/
);
assert.throws(
  () => analyzeStudyCsv(fixtureText.replace('0.875,2,4.3', '0.8,2,4.3'), configText),
  /eight tasks/
);

console.log('  PASS (preregistered study contract, crossover analysis and synthetic-data guard)');
