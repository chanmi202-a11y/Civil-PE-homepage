const router = require('express').Router();
const { getDB }             = require('../database');
const { auth, adminOnly }   = require('../middleware/auth');

// 모든 라우트에 관리자 인증 적용
router.use(auth, adminOnly);

// GET /api/admin/stats
router.get('/stats', (req, res) => {
  const db = getDB();
  res.json({
    users: {
      total:    db.prepare("SELECT COUNT(*) AS c FROM users WHERE role != 'admin'").get().c,
      pending:  db.prepare("SELECT COUNT(*) AS c FROM users WHERE role = 'pending'").get().c,
      approved: db.prepare("SELECT COUNT(*) AS c FROM users WHERE role = 'approved'").get().c,
    },
    questions: {
      total:     db.prepare('SELECT COUNT(*) AS c FROM questions').get().c,
      published: db.prepare('SELECT COUNT(*) AS c FROM questions WHERE published=1').get().c,
      drafts:    db.prepare('SELECT COUNT(*) AS c FROM questions WHERE published=0').get().c,
    },
    blog: {
      total:     db.prepare('SELECT COUNT(*) AS c FROM blog_posts').get().c,
      published: db.prepare('SELECT COUNT(*) AS c FROM blog_posts WHERE published=1').get().c,
      drafts:    db.prepare('SELECT COUNT(*) AS c FROM blog_posts WHERE published=0').get().c,
    },
    community: {
      answers:  db.prepare('SELECT COUNT(*) AS c FROM community_answers').get().c,
      comments: db.prepare('SELECT COUNT(*) AS c FROM comments').get().c,
    },
  });
});

// ── User management ──

// GET /api/admin/users
router.get('/users', (req, res) => {
  const { role } = req.query;
  let sql = 'SELECT id,email,name,nickname,role,memo,created_at FROM users ORDER BY created_at DESC';
  const params = [];
  if (role) { sql = 'SELECT id,email,name,nickname,role,memo,created_at FROM users WHERE role=? ORDER BY created_at DESC'; params.push(role); }
  res.json(getDB().prepare(sql).all(...params));
});

// PUT /api/admin/users/:id/approve
router.put('/users/:id/approve', (req, res) => {
  getDB().prepare("UPDATE users SET role='approved' WHERE id=?").run(req.params.id);
  res.json({ message: '승인되었습니다.' });
});

// PUT /api/admin/users/:id/reject
router.put('/users/:id/reject', (req, res) => {
  getDB().prepare("UPDATE users SET role='rejected' WHERE id=?").run(req.params.id);
  res.json({ message: '거절되었습니다.' });
});

// PUT /api/admin/users/:id/role
router.put('/users/:id/role', (req, res) => {
  const { role } = req.body;
  if (!['pending','approved','rejected'].includes(role))
    return res.status(400).json({ error: '유효하지 않은 역할입니다.' });
  getDB().prepare('UPDATE users SET role=? WHERE id=?').run(role, req.params.id);
  res.json({ message: '역할이 변경되었습니다.' });
});

// DELETE /api/admin/users/:id
router.delete('/users/:id', (req, res) => {
  if (Number(req.params.id) === req.user.id)
    return res.status(400).json({ error: '자기 자신은 삭제할 수 없습니다.' });
  getDB().prepare('DELETE FROM users WHERE id=?').run(req.params.id);
  res.json({ message: '삭제되었습니다.' });
});

// ── Pending content ──

// GET /api/admin/pending  (미발행 문제 + 블로그)
router.get('/pending', (req, res) => {
  const db = getDB();
  res.json({
    questions: db.prepare('SELECT * FROM questions WHERE published=0 ORDER BY id DESC').all().map(r => {
      r.tags = JSON.parse(r.tags || '[]'); return r;
    }),
    blog: db.prepare('SELECT * FROM blog_posts WHERE published=0 ORDER BY id DESC').all(),
  });
});

// ── Community moderation ──

// DELETE /api/admin/community/:id
router.delete('/community/:id', (req, res) => {
  getDB().prepare('DELETE FROM community_answers WHERE id=?').run(req.params.id);
  res.json({ message: '삭제되었습니다.' });
});

// DELETE /api/admin/comments/:id
router.delete('/comments/:id', (req, res) => {
  getDB().prepare('DELETE FROM comments WHERE id=?').run(req.params.id);
  res.json({ message: '삭제되었습니다.' });
});

module.exports = router;
