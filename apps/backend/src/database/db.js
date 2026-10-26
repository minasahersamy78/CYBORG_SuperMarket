/**
 * Cyborg Supermarket - Database Layer
 * Provides clean, parameterized SQL access to the local database.
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

function resolveSqliteBin() {
  if (process.env.SQLITE_BIN && fs.existsSync(process.env.SQLITE_BIN)) {
    return process.env.SQLITE_BIN;
  }
  const lookupCmd = process.platform === 'win32' ? 'where.exe' : 'which';
  try {
    const lookup = spawnSync(lookupCmd, ['sqlite3'], { encoding: 'utf-8' });
    if (lookup.status === 0 && lookup.stdout) {
      const found = lookup.stdout.split(/[\r\n]+/)[0].trim();
      if (found && fs.existsSync(found)) return found;
    }
  } catch (e) {}

  const candidates = [
    'C:\\Program Files\\platform-tools\\sqlite3.exe',
    'C:\\sqlite\\sqlite3.exe',
    '/usr/bin/sqlite3',
    '/usr/local/bin/sqlite3',
    '/bin/sqlite3'
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return 'sqlite3';
}

function resolveDbPath() {
  if (process.env.DB_PATH) {
    return path.resolve(process.env.DB_PATH);
  }
  let cur = __dirname;
  for (let i = 0; i < 6; i++) {
    const candidate = path.join(cur, 'data', 'cyborg_supermarket.db');
    if (fs.existsSync(candidate)) return candidate;
    cur = path.dirname(cur);
  }
  return path.resolve(process.cwd(), 'data', 'cyborg_supermarket.db');
}

const SQLITE_BIN = resolveSqliteBin();
const DB_PATH = resolveDbPath();

function formatParam(val) {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'number') return String(val);
  if (typeof val === 'boolean') return val ? '1' : '0';
  return "'" + String(val).replace(/'/g, "''") + "'";
}

function substituteParams(sql, params = []) {
  if (!params || params.length === 0) return sql;
  let idx = 0;
  return sql.replace(/\?/g, () => {
    if (idx < params.length) {
      return formatParam(params[idx++]);
    }
    return '?';
  });
}

function normalizeSql(sql) {
  if (!sql) return sql;
  return sql
    .replace(/datetime\("now"\)/gi, "datetime('now')")
    .replace(/=\s*"([^"]+)"/g, "= '$1'");
}

function executeRaw(sqlWithDirectives) {
  const sanitized = normalizeSql(sqlWithDirectives);
  const res = spawnSync(SQLITE_BIN, [DB_PATH], {
    input: sanitized,
    encoding: 'utf-8',
    maxBuffer: 64 * 1024 * 1024
  });
  if (res.error) throw res.error;
  if (res.status !== 0) throw new Error(res.stderr || 'Database execution failed');
  return res.stdout;
}

const db = {
  getSqliteBin() {
    return SQLITE_BIN;
  },

  getDbPath() {
    return DB_PATH;
  },

  query(sql, params = []) {
    const finalSql = substituteParams(sql, params);
    const directive = `.mode json\n${finalSql};`;
    const out = executeRaw(directive).trim();
    if (!out) return [];
    try {
      return JSON.parse(out);
    } catch (e) {
      // If sqlite returns non-json or multiple outputs, parse fallback
      return [];
    }
  },

  getOne(sql, params = []) {
    const rows = this.query(sql, params);
    return rows && rows.length > 0 ? rows[0] : null;
  },

  queryOne(sql, params = []) {
    return this.getOne(sql, params);
  },

  run(sql, params = []) {
    const finalSql = substituteParams(sql, params);
    executeRaw(`${finalSql};`);
    return { success: true };
  },

  insert(table, data) {
    const keys = Object.keys(data);
    const placeholders = keys.map(() => '?').join(', ');
    const sql = `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${placeholders});`;
    this.run(sql, keys.map(k => data[k]));
    return this.getOne('SELECT last_insert_rowid() as id;');
  }
};

module.exports = db;
module.exports.db = db;
