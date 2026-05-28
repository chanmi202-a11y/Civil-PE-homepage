const router = require('express').Router();
const { getDB }             = require('../database');
const { auth, adminOnly }   = require('../middleware/auth');

// GET /api/blog  (공개 — published only)
router.get('/', (req, res) => {
  const { category, limit = 50 } = req.query;
  const db     = getDB();
  let sql      = 'SELECT id,category,emoji,thumb_class,title,excerpt,published,sample,created_at FROM blog_posts WHERE published=1';
  const params = [];
  if (category && category !== 'all') { sql += ' AND category=?'; params.push(category); }
  sql += ' ORDER BY id DESC LIMIT ?';
  params.push(Number(limit));
  res.json(db.prepare(sql).all(...params));
});

// GET /api/blog/drafts  (관리자)
router.get('/drafts', auth, adminOnly, (req, res) => {
  res.json(getDB().prepare('SELECT id,category,emoji,thumb_class,title,excerpt,published,sample,created_at FROM blog_posts ORDER BY id DESC').all());
});

// GET /api/blog/:id  (본문 포함)
router.get('/:id', (req, res) => {
  const row = getDB().prepare('SELECT * FROM blog_posts WHERE id=?').get(req.params.id);
  if (!row || !row.published) return res.status(404).json({ error: '게시물을 찾을 수 없습니다.' });
  res.json(row);
});

// GET /api/blog/:id/preview  (관리자 — 미발행도 조회)
router.get('/:id/preview', auth, adminOnly, (req, res) => {
  const row = getDB().prepare('SELECT * FROM blog_posts WHERE id=?').get(req.params.id);
  if (!row) return res.status(404).json({ error: '없습니다.' });
  res.json(row);
});

// POST /api/blog  (관리자만)
router.post('/', auth, adminOnly, (req, res) => {
  const { category, emoji = '📖', thumb_class = 'c1', title, excerpt, content = '' } = req.body;
  if (!category || !title || !excerpt) return res.status(400).json({ error: '필수 항목을 입력해주세요.' });

  const r = getDB().prepare(`
    INSERT INTO blog_posts (category,emoji,thumb_class,title,excerpt,content,published,sample)
    VALUES (?,?,?,?,?,?,0,0)
  `).run(category, emoji, thumb_class, title, excerpt, content);
  res.json({ id: r.lastInsertRowid, message: '초안으로 저장되었습니다.' });
});

// PUT /api/blog/:id  (관리자만)
router.put('/:id', auth, adminOnly, (req, res) => {
  const { category, emoji, thumb_class, title, excerpt, content } = req.body;
  getDB().prepare(`
    UPDATE blog_posts SET category=?,emoji=?,thumb_class=?,title=?,excerpt=?,content=?,updated_at=CURRENT_TIMESTAMP WHERE id=?
  `).run(category, emoji, thumb_class, title, excerpt, content, req.params.id);
  res.json({ message: '수정되었습니다.' });
});

// POST /api/blog/:id/publish
router.post('/:id/publish', auth, adminOnly, (req, res) => {
  getDB().prepare('UPDATE blog_posts SET published=1,updated_at=CURRENT_TIMESTAMP WHERE id=?').run(req.params.id);
  res.json({ message: '발행되었습니다.' });
});

// POST /api/blog/:id/unpublish
router.post('/:id/unpublish', auth, adminOnly, (req, res) => {
  getDB().prepare('UPDATE blog_posts SET published=0,updated_at=CURRENT_TIMESTAMP WHERE id=?').run(req.params.id);
  res.json({ message: '발행이 취소되었습니다.' });
});

// DELETE /api/blog/:id
router.delete('/:id', auth, adminOnly, (req, res) => {
  getDB().prepare('DELETE FROM blog_posts WHERE id=?').run(req.params.id);
  res.json({ message: '삭제되었습니다.' });
});

module.exports = router;
