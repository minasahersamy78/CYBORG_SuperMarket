/**
 * Cyborg Supermarket - Backup & Restore Isolated Verification Runner
 * Validates Section H: Automated database backup, retention policy, and isolated restore integrity.
 */

const assert = require('assert');
const { backupService } = require('../apps/backend/src/modules/backup/backup.service');

console.log('================================================================');
console.log('CYBORG SUPERMARKET — BACKUP & RESTORE VERIFICATION');
console.log('================================================================\n');

try {
  // 1. Create Hot Backup
  console.log('1. Initiating SQLite Hot Online Backup...');
  const backupRes = backupService.createBackup('commercial_readiness_gate');
  assert(backupRes.success, 'Backup creation must report success');
  console.log(`[OK] Backup successfully generated at: ${backupRes.backupPath}`);
  console.log(`     Size: ${(backupRes.sizeBytes / 1024).toFixed(2)} KB`);

  // 2. Run Isolated Restore & Integrity Verification
  console.log('\n2. Executing Isolated Restore & PRAGMA Integrity Check...');
  const restoreRes = backupService.verifyRestore(backupRes.backupPath);
  assert(restoreRes.success, 'Restore verification must pass');
  assert.strictEqual(restoreRes.integrityCheck, 'ok', 'PRAGMA integrity_check must return "ok"');
  assert.strictEqual(restoreRes.verifiedProductRows, 1000, 'Restored database must contain exact 1000 product catalog rows');

  console.log(`[OK] Isolated Restore Test PASSED!`);
  console.log(`     Integrity Check: ${restoreRes.integrityCheck}`);
  console.log(`     Verified Product Rows: ${restoreRes.verifiedProductRows}`);
  console.log(`     Verification Timestamp: ${restoreRes.verifiedAt}`);

  // 3. Verify Structured Logging with Sensitive Data Redaction
  console.log('\n3. Testing Structured Logging & Sensitive Data Redaction...');
  const logSample = backupService.logStructured('info', 'Customer login event', {
    userId: 'usr-admin-01',
    email: 'admin@cyborg.eg',
    password: 'SuperSecretPassword123!',
    token: 'jwt.token.string.secret',
    card_number: '4242424242424242',
    cvv: '123'
  });

  assert.strictEqual(logSample.context.password, '[REDACTED]', 'Password must be redacted');
  assert.strictEqual(logSample.context.token, '[REDACTED]', 'Token must be redacted');
  assert.strictEqual(logSample.context.card_number, '[REDACTED]', 'Card number must be redacted');
  assert.strictEqual(logSample.context.cvv, '[REDACTED]', 'CVV must be redacted');
  assert.strictEqual(logSample.context.userId, 'usr-admin-01', 'Non-sensitive fields must be preserved');
  console.log('[OK] Structured Logging with PCI-DSS sensitive data redaction verified!');

  console.log('\n================================================================');
  console.log('ALL BACKUP, RESTORE & OPERATIONAL CHECKS PASSED SUCCESSFULLY!');
  console.log('================================================================\n');
  process.exit(0);
} catch (err) {
  console.error('[FAIL] Backup & Restore verification failed:', err);
  process.exit(1);
}
