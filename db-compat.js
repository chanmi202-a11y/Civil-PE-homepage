// sql.js 위에 better-sqlite3 호환 인터페이스를 제공합니다.
// 라우트 파일들은 변경 없이 그대로 사용 가능합니다.
const initSqlJs = require('sql.js');
const path = require('path');
const fs   = require('fs');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'pe_study.db');
let _raw = null;  // sql.js Database
let _db  = null;  // CompatDB wrapper

async function initSqlDB() {
  const SQL = await initSqlJs();
  if (fs.existsSync(DB_PATH)) {
    _raw = new SQL.Database(fs.readFileSync(DB_PATH));
  } else {
    _raw = new SQL.Database();
  }
  _db = new CompatDB();
}

function _save() {
  const data = _raw.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
}

function _execId() {
  return _raw.exec('SELECT last_insert_rowid(), changes()')[0]?.values[0] || [0, 0];
}

function _flatArgs(args) {
  if (!args.length) return [];
  if (args.length === 1 && Array.isArray(args[0])) return args[0];
  return args;
}

class CompatStmt {
  constructor(sql) { this._sql = sql; }

  run(...args) {
    const params = _flatArgs(args);
    _raw.run(this._sql, params.length ? params : undefined);
    const [lastId, changes] = _execId();
    _save();
    return { lastInsertRowid: typeof lastId === 'bigint' ? Number(lastId) : lastId, changes };
  }

  get(...args) {
    const params = _flatArgs(args);
    const stmt = _raw.prepare(this._sql);
    if (params.length) stmt.bind(params);
    let row;
    if (stmt.step()) {
      const cols = stmt.getColumnNames();
      const vals = stmt.get();
      row = Object.fromEntries(cols.map((c, i) => [c, vals[i]]));
    }
    stmt.free();
    return row;
  }

  all(...args) {
    const params = _flatArgs(args);
    const stmt = _raw.prepare(this._sql);
    if (params.length) stmt.bind(params);
    const rows = [];
    while (stmt.step()) {
      const cols = stmt.getColumnNames();
      const vals = stmt.get();
      rows.push(Object.fromEntries(cols.map((c, i) => [c, vals[i]])));
    }
    stmt.free();
    return rows;
  }
}

class CompatDB {
  prepare(sql) { return new CompatStmt(sql); }

  exec(sql) {
    _raw.exec(sql);  // multi-statement support
    _save();
    return this;
  }

  run(sql) {
    _raw.run(sql);
    return this;
  }
}

function getDB() { return _db; }

module.exports = { initSqlDB, getDB };
