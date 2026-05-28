const router = require('express').Router();
const { all, get, run }                       = require('../db');
const { auth, adminOnly, approvedOnly }       = require('../middleware/auth');

const wrap = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

router.get('/', wrap(async (req, res) => {
  const { type, date, limit = 50 } = req.query;
  let sql = 'SELECT * FROM questions WHERE published = 1';
  const params = [];
  let p = 1;
  if (type && type !== 'all') { sql += ` AND type = $${p++}`; params.push(type); }
  if (date === 'today') {
    sql += ` AND publish_date = $${p++}`;
    params.push(new Date().toISOString().slice(0, 10));
  }
  sql += ` ORDER BY publish_date DESC, id DESC LIMIT $${p}`;
  params.push(Number(limit));

  const rows = await all(sql, params);
  rows.forEach(r => { r.tags = JSON.parse(r.tags || '[]'); });
  res.json(rows);
}));

router.get('/drafts', auth, adminOnly, wrap(async (req, res) => {
  const rows = await all('SELECT * FROM questions ORDER BY id DESC');
  rows.forEach(r => { r.tags = JSON.parse(r.tags || '[]'); });
  res.json(rows);
}));

router.get('/:id', wrap(async (req, res) => {
  const row = await get('SELECT * FROM questions WHERE id = $1', [req.params.id]);
  if (!row) return res.status(404).json({ error: '문제를 찾을 수 없습니다.' });
  row.tags = JSON.parse(row.tags || '[]');
  res.json(row);
}));

router.post('/', auth, adminOnly, wrap(async (req, res) => {
  const { type, score, topic, question, tags = [], publish_date } = req.body;
  if (!type || !score || !topic || !question)
    return res.status(400).json({ error: '필수 항목을 입력해주세요.' });

  const r = await run(
    `INSERT INTO questions (type, score, topic, question, tags, published, publish_date, sample)
     VALUES ($1, $2, $3, $4, $5, 0, $6, 0) RETURNING id`,
    [type, score, topic, question, JSON.stringify(tags), publish_date || null]
  );
  res.json({ id: r.id, message: '문제가 초안으로 저장되었습니다.' });
}));

router.put('/:id', auth, adminOnly, wrap(async (req, res) => {
  const { type, score, topic, question, tags, publish_date } = req.body;
  await run(
    `UPDATE questions
     SET type=$1, score=$2, topic=$3, question=$4, tags=$5, publish_date=$6, updated_at=CURRENT_TIMESTAMP
     WHERE id=$7`,
    [type, score, topic, question, JSON.stringify(tags || []), publish_date || null, req.params.id]
  );
  res.json({ message: '수정되었습니다.' });
}));

router.post('/:id/publish', auth, adminOnly, wrap(async (req, res) => {
  const today = req.body.publish_date || new Date().toISOString().slice(0, 10);
  await run(
    'UPDATE questions SET published=1, publish_date=$1, updated_at=CURRENT_TIMESTAMP WHERE id=$2',
    [today, req.params.id]
  );
  res.json({ message: '문제가 발행되었습니다.' });
}));

router.post('/:id/unpublish', auth, adminOnly, wrap(async (req, res) => {
  await run('UPDATE questions SET published=0, updated_at=CURRENT_TIMESTAMP WHERE id=$1', [req.params.id]);
  res.json({ message: '발행이 취소되었습니다.' });
}));

router.delete('/:id', auth, adminOnly, wrap(async (req, res) => {
  await run('DELETE FROM questions WHERE id=$1', [req.params.id]);
  res.json({ message: '삭제되었습니다.' });
}));

module.exports = router;
