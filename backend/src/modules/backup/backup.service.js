/**
 * Cyborg Supermarket - Database Backup, Restore & Operational Resilience Service
 * Automated SQLite hot backups, retention enforcement, restore verification,
 * and sensitive data redaction logging.
 */

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const db = require('../../database/db');

const SQLITE_BIN = db.getSqliteBin();
const DB_PATH = db.getDbPath();
const BACKUPS_DIR = path.join(path.dirname(DB_PATH), 'backups');

class BackupService {
  constructor() {
    if (!fs.existsSync(BACKUPS_DIR)) {
      fs.mkdirSync(BACKUPS_DIR, { recursive: true });
    }
    this.maxRetentionDays = 14;
    this.maxBackupsCount = 20;
  }

  // 1. CREATE HOT BACKUP
  createBackup(label = 'manual') {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFileName = `backup_${label}_${timestamp}.db`;
    const targetPath = path.join(BACKUPS_DIR, backupFileName);

    // Use SQLite's online backup command (.backup)
    const backupSql = `.backup '${targetPath.replace(/\\/g, '/')}'`;

    const res = spawnSync(SQLITE_BIN, [DB_PATH], {
      input: backupSql,
      encoding: 'utf-8'
    });

    if (res.error) throw res.error;
    if (res.status !== 0) throw new Error(res.stderr || 'Backup failed');

    const stats = fs.statSync(targetPath);

    // Enforce retention
    this.enforceRetentionPolicy();

    return {
      success: true,
      backupFile: backupFileName,
      backupPath: targetPath,
      sizeBytes: stats.size,
      createdAt: new Date().toISOString()
    };
  }

  // 2. ENFORCE RETENTION POLICY
  enforceRetentionPolicy() {
    const files = fs
      .readdirSync(BACKUPS_DIR)
      .filter(f => f.endsWith('.db'))
      .map(f => {
        const fullPath = path.join(BACKUPS_DIR, f);
        return { name: f, path: fullPath, ctime: fs.statSync(fullPath).ctimeMs };
      })
      .sort((a, b) => b.ctime - a.ctime); // newest first

    // Remove older than maxBackupsCount
    if (files.length > this.maxBackupsCount) {
      const toDelete = files.slice(this.maxBackupsCount);
      toDelete.forEach(file => {
        try {
          fs.unlinkSync(file.path);
        } catch (e) {
          // ignore error
        }
      });
    }
  }

  // 3. RESTORE & VERIFY BACKUP IN ISOLATED ENVIRONMENT
  verifyRestore(backupFilePath) {
    if (!fs.existsSync(backupFilePath)) {
      throw new Error(`Backup file does not exist: ${backupFilePath}`);
    }

    const testDbPath = path.join(BACKUPS_DIR, `test_verification_${Date.now()}.db`);

    // Copy backup to isolated test db
    fs.copyFileSync(backupFilePath, testDbPath);

    // Run SQLite integrity check
    const integrityCheck = spawnSync(SQLITE_BIN, [testDbPath, 'PRAGMA integrity_check;'], {
      encoding: 'utf-8'
    });

    const isIntegrityOk = integrityCheck.stdout.trim() === 'ok';

    // Verify product count matches
    const productCountRes = spawnSync(SQLITE_BIN, [testDbPath, 'SELECT COUNT(*) FROM products;'], {
      encoding: 'utf-8'
    });
    const productCount = parseInt(productCountRes.stdout.trim(), 10);

    // Cleanup isolated verification DB
    try {
      fs.unlinkSync(testDbPath);
    } catch (e) {}

    return {
      success: isIntegrityOk && productCount > 0,
      integrityCheck: integrityCheck.stdout.trim(),
      verifiedProductRows: productCount,
      verifiedAt: new Date().toISOString()
    };
  }

  // 4. STRUCTURED LOGGING WITH SENSITIVE DATA REDACTION
  logStructured(level, message, context = {}) {
    const sensitiveKeys = ['password', 'token', 'cvv', 'card_number', 'secret', 'pan'];
    const sanitizedContext = JSON.parse(
      JSON.stringify(context, (key, value) => {
        if (sensitiveKeys.some(sk => key.toLowerCase().includes(sk))) {
          return '[REDACTED]';
        }
        return value;
      })
    );

    const logEntry = {
      timestamp: new Date().toISOString(),
      level: level.toUpperCase(),
      message,
      context: sanitizedContext
    };

    return logEntry;
  }
}

const backupService = new BackupService();
module.exports = { backupService, BackupService };
