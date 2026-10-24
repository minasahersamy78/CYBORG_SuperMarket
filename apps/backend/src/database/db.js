/**
 * Cyborg Supermarket - Database Layer
 * Provides clean, parameterized SQL access to the local database.
 */

const path = require('path');
const { spawnSync } = require('child_process');

const SQLITE_BIN = 'C:\\Program Files\\platform-tools\\sqlite3.exe';
const DB_PATH = path.resolve(__dirname, '../../../../data/cyborg_supermarket.db');

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

function executeRaw(sqlWithDirectives) {
  const res = spawnSync(SQLITE_BIN, [DB_PATH], {
    input: sqlWithDirectives,
    encoding: 'utf-8',
    maxBuffer: 64 * 1024 * 1024
  });
  if (res.error) throw res.error;
  if (res.status !== 0) throw new Error(res.stderr || 'Database execution failed');
  return res.stdout;
}

const db = {
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
