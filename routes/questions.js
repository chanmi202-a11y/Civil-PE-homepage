const router = require('express').Router();
const { getDB }                       = require('../database');
const { auth, adminOnly, approvedOnly } = require('../middleware/auth');

// GET /api/questions  (공개 — published only)
router.get('/', (req, res) => {
  const { type, date, limit = 50 } = req.query;
  const db = getDB();
  let sql = 'SELECT * FROM questions WHERE published = 1';
  const params = [];
  if (type && type !== 'all') { sql += ' AND type = ?'; params.push(type); }
  if (date === 'today') {
    sql += ' AND publish_date = ?';
    params.push(new Date().toISOString().slice(0, 10));
  }
  sql += ' ORDER BY publish_date DESC, id DESC LIMIT ?';
  params.push(Number(limit));

  const rows = db.prepare(sql).all(...params);
  rows.forEach(r => { r.tags = JSON.parse(r.tags || '[]'); });
  res.json(rows);
});

// GET /api/questions/drafts  (관리자용 — 미발행 포함 전체)
router.get('/drafts', auth, adminOnly, (req, res) => {
  const db   = getDB();
  const rows = db.prepare('SELECT * FROM questions ORDER BY id DESC').all();
  rows.forEach(r => { r.tags = JSON.parse(r.tags || '[]'); });
  res.json(rows);
});

// GET /api/questions/:id
router.get('/:id', (req, res) => {
  const db  = getDB();
  const row = db.prepare('SELECT * FROM questions WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: '문제를 찾을 수 없습니다.' });
  row.tags = JSON.parse(row.tags || '[]');
  res.json(row);
});

// POST /api/questions  (관리자만)
router.post('/', auth, adminOnly, (req, res) => {
  const { type, score, topic, question, tags = [], publish_date } = req.body;
  if (!type || !score || !topic || !question)
    return res.status(400).json({ error: '필수 항목을 입력해주세요.' });

  const db = getDB();
  const r  = db.prepare(`
    INSERT INTO questions (type, score, topic, question, tags, published, publish_date, sample)
    VALUES (?, ?, ?, ?, ?, 0, ?, 0)
  `).run(type, score, topic, question, JSON.stringify(tags), publish_date || null);

  res.json({ id: r.lastInsertRowid, message: '문제가 초안으로 저장되었습니다.' });
});

// PUT /api/questions/:id  (관리자만)
router.put('/:id', auth, adminOnly, (req, res) => {
  const { type, score, topic, question, tags, publish_date } = req.body;
  const db = getDB();
  db.prepare(`
    UPDATE questions
    SET type=?, score=?, topic=?, question=?, tags=?, publish_date=?, updated_at=CURRENT_TIMESTAMP
    WHERE id=?
  `).run(type, score, topic, question, JSON.stringify(tags || []), publish_date || null, req.params.id);
  res.json({ message: '수정되었습니다.' });
});

// POST /api/questions/:id/publish  (관리자 컨펌 → 발행)
router.post('/:id/publish', auth, adminOnly, (req, res) => {
  const { publish_date } = req.body;
  const today = publish_date || new Date().toISOString().slice(0, 10);
  const db    = getDB();
  db.prepare('UPDATE questions SET published=1, publish_date=?, updated_at=CURRENT_TIMESTAMP WHERE id=?')
    .run(today, req.params.id);
  res.json({ message: '문제가 발행되었습니다.' });
});

// POST /api/questions/:id/unpublish  (발행 취소)
router.post('/:id/unpublish', auth, adminOnly, (req, res) => {
  getDB().prepare('UPDATE questions SET published=0, updated_at=CURRENT_TIMESTAMP WHERE id=?')
         .run(req.params.id);
  res.json({ message: '발행이 취소되었습니다.' });
});

// DELETE /api/questions/:id  (관리자만)
router.delete('/:id', auth, adminOnly, (req, res) => {
  getDB().prepare('DELETE FROM questions WHERE id=?').run(req.params.id);
  res.json({ message: '삭제되었습니다.' });
});

module.exports = router;
