const router  = require('express').Router();
const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');
const { getDB }                         = require('../database');
const { auth, adminOnly, approvedOnly } = require('../middleware/auth');

const uploadDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename:    (req, file, cb) => {
    const ext  = path.extname(file.originalname);
    const name = Date.now() + '-' + Math.round(Math.random() * 1e6) + ext;
    cb(null, name);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: (Number(process.env.MAX_FILE_MB) || 10) * 1024 * 1024 },
});

// ── Answers ──

// GET /api/community  (공개)
router.get('/', (req, res) => {
  const { qId, limit = 50 } = req.query;
  const db     = getDB();
  let sql      = `
    SELECT ca.*, u.nickname, u.role AS user_role,
           (SELECT COUNT(*) FROM comments c WHERE c.answer_id = ca.id) AS comment_count,
           (SELECT COUNT(*) FROM attachments a WHERE a.answer_id = ca.id) AS attachment_count
    FROM community_answers ca
    JOIN users u ON u.id = ca.user_id
  `;
  const params = [];
  if (qId) { sql += ' WHERE ca.question_id = ?'; params.push(qId); }
  sql += ' ORDER BY ca.created_at DESC LIMIT ?';
  params.push(Number(limit));
  res.json(db.prepare(sql).all(...params));
});

// GET /api/community/:id
router.get('/:id', (req, res) => {
  const db  = getDB();
  const row = db.prepare(`
    SELECT ca.*, u.nickname, u.role AS user_role
    FROM community_answers ca JOIN users u ON u.id = ca.user_id
    WHERE ca.id = ?
  `).get(req.params.id);
  if (!row) return res.status(404).json({ error: '없습니다.' });

  const comments = db.prepare(`
    SELECT c.*, u.nickname FROM comments c JOIN users u ON u.id = c.user_id
    WHERE c.answer_id = ? ORDER BY c.created_at ASC
  `).all(row.id);

  const attachments = db.prepare(
    'SELECT * FROM attachments WHERE answer_id = ?'
  ).all(row.id);

  res.json({ ...row, comments, attachments });
});

// POST /api/community  (승인 회원)
router.post('/', auth, approvedOnly, upload.array('files', 5), (req, res) => {
  const { question_id, title, content } = req.body;
  if (!question_id || !title || !content)
    return res.status(400).json({ error: '필수 항목을 입력해주세요.' });

  const db = getDB();
  const r  = db.prepare(`
    INSERT INTO community_answers (question_id, user_id, title, content)
    VALUES (?, ?, ?, ?)
  `).run(question_id, req.user.id, title, content);

  if (req.files?.length) {
    const ins = db.prepare(
      'INSERT INTO attachments (answer_id, filename, original_name, size) VALUES (?,?,?,?)'
    );
    req.files.forEach(f => ins.run(r.lastInsertRowid, f.filename, f.originalname, f.size));
  }
  res.json({ id: r.lastInsertRowid, message: '답안이 등록되었습니다.' });
});

// PUT /api/community/:id  (본인 또는 관리자)
router.put('/:id', auth, approvedOnly, (req, res) => {
  const db  = getDB();
  const row = db.prepare('SELECT * FROM community_answers WHERE id=?').get(req.params.id);
  if (!row) return res.status(404).json({ error: '없습니다.' });
  if (row.user_id !== req.user.id && req.user.role !== 'admin')
    return res.status(403).json({ error: '수정 권한이 없습니다.' });

  const { title, content } = req.body;
  db.prepare('UPDATE community_answers SET title=?, content=?, updated_at=CURRENT_TIMESTAMP WHERE id=?')
    .run(title, content, req.params.id);
  res.json({ message: '수정되었습니다.' });
});

// DELETE /api/community/:id  (본인 또는 관리자)
router.delete('/:id', auth, (req, res) => {
  const db  = getDB();
  const row = db.prepare('SELECT * FROM community_answers WHERE id=?').get(req.params.id);
  if (!row) return res.status(404).json({ error: '없습니다.' });
  if (row.user_id !== req.user.id && req.user.role !== 'admin')
    return res.status(403).json({ error: '삭제 권한이 없습니다.' });
  db.prepare('DELETE FROM community_answers WHERE id=?').run(req.params.id);
  res.json({ message: '삭제되었습니다.' });
});

// POST /api/community/:id/verify  (관리자 — 우수 답안 선정)
router.post('/:id/verify', auth, adminOnly, (req, res) => {
  const db  = getDB();
  const row = db.prepare('SELECT verified FROM community_answers WHERE id=?').get(req.params.id);
  if (!row) return res.status(404).json({ error: '없습니다.' });
  db.prepare('UPDATE community_answers SET verified=? WHERE id=?').run(row.verified ? 0 : 1, req.params.id);
  res.json({ message: row.verified ? '선정 취소되었습니다.' : '우수 답안으로 선정되었습니다.' });
});

// POST /api/community/:id/like  (승인 회원)
router.post('/:id/like', auth, approvedOnly, (req, res) => {
  const db  = getDB();
  const row = db.prepare('SELECT id FROM community_answers WHERE id=?').get(req.params.id);
  if (!row) return res.status(404).json({ error: '없습니다.' });

  const already = db.prepare('SELECT 1 FROM answer_likes WHERE answer_id=? AND user_id=?')
                    .get(req.params.id, req.user.id);
  if (already) {
    db.prepare('DELETE FROM answer_likes WHERE answer_id=? AND user_id=?').run(req.params.id, req.user.id);
    db.prepare('UPDATE community_answers SET likes=MAX(0,likes-1) WHERE id=?').run(req.params.id);
    return res.json({ liked: false });
  }
  db.prepare('INSERT INTO answer_likes (answer_id, user_id) VALUES (?,?)').run(req.params.id, req.user.id);
  db.prepare('UPDATE community_answers SET likes=likes+1 WHERE id=?').run(req.params.id);
  res.json({ liked: true });
});

// ── Comments ──

// GET /api/community/:id/comments
router.get('/:id/comments', (req, res) => {
  const rows = getDB().prepare(`
    SELECT c.*, u.nickname FROM comments c JOIN users u ON u.id = c.user_id
    WHERE c.answer_id = ? ORDER BY c.created_at ASC
  `).all(req.params.id);
  res.json(rows);
});

// POST /api/community/:id/comments  (승인 회원)
router.post('/:id/comments', auth, approvedOnly, upload.array('files', 3), (req, res) => {
  const { content } = req.body;
  if (!content) return res.status(400).json({ error: '댓글 내용을 입력해주세요.' });

  const db = getDB();
  const r  = db.prepare(
    'INSERT INTO comments (answer_id, user_id, content) VALUES (?,?,?)'
  ).run(req.params.id, req.user.id, content);

  if (req.files?.length) {
    const ins = db.prepare(
      'INSERT INTO attachments (comment_id, filename, original_name, size) VALUES (?,?,?,?)'
    );
    req.files.forEach(f => ins.run(r.lastInsertRowid, f.filename, f.originalname, f.size));
  }
  res.json({ id: r.lastInsertRowid, message: '댓글이 등록되었습니다.' });
});

// DELETE /api/community/:id/comments/:cid
router.delete('/:id/comments/:cid', auth, (req, res) => {
  const db  = getDB();
  const row = db.prepare('SELECT * FROM comments WHERE id=?').get(req.params.cid);
  if (!row) return res.status(404).json({ error: '없습니다.' });
  if (row.user_id !== req.user.id && req.user.role !== 'admin')
    return res.status(403).json({ error: '삭제 권한이 없습니다.' });
  db.prepare('DELETE FROM comments WHERE id=?').run(req.params.cid);
  res.json({ message: '삭제되었습니다.' });
});

module.exports = router;
