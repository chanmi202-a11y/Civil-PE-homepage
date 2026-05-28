const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function all(sql, params = []) {
  const { rows } = await pool.query(sql, params);
  return rows;
}

async function get(sql, params = []) {
  const { rows } = await pool.query(sql, params);
  return rows[0] ?? null;
}

async function run(sql, params = []) {
  const { rows, rowCount } = await pool.query(sql, params);
  return { id: rows[0]?.id ?? null, rowCount };
}

module.exports = { pool, all, get, run };
