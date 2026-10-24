/**
 * Cyborg Supermarket - Master Test Runner
 * Executes Backend Unit/Integration Tests, POS Logic Tests, and E2E Scenarios A-F
 */

const { spawnSync } = require('child_process');
const path = require('path');

console.log('################################################################');
console.log('CYBORG SUPERMARKET — MASTER AUTOMATED QUALITY GATES');
console.log('################################################################\n');

const testSuites = [
  { name: 'Dataset Integrity Validation', script: 'scripts/validate-dataset.js' },
  { name: 'Backend Services & Core APIs', script: 'apps/backend/src/scripts/run-backend-tests.js' },
  { name: 'POS Hardware & Desktop Calculations', script: 'scripts/run-pos-tests.js' },
  { name: 'End-to-End Retail Scenarios (A to F)', script: 'scripts/run-e2e-scenarios.js' }
];

let totalSuitesPassed = 0;

for (const suite of testSuites) {
  console.log(`>>> Starting: ${suite.name}...`);
  const fullPath = path.resolve(__dirname, '..', suite.script);
  const res = spawnSync(process.execPath, [fullPath], { stdio: 'inherit' });
  if (res.status === 0) {
    totalSuitesPassed++;
    console.log(`>>> Finished: ${suite.name} [PASSED]\n`);
  } else {
    console.error(`>>> Failed: ${suite.name} (Exit code: ${res.status})\n`);
    process.exit(1);
  }
}

console.log('################################################################');
console.log(`MASTER QUALITY GATE RESULT: ALL ${totalSuitesPassed} SUITES PASSED!`);
console.log('################################################################\n');
process.exit(0);
