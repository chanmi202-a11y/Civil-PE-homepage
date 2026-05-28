const router  = require('express').Router();
const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');
const { all, get, run }                         = require('../db');
const { auth, adminOnly, approvedOnly }         = require('../middleware/auth');

const wrap = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

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

router.get('/', wrap(async (req, res) => {
  const { qId, limit = 50 } = req.query;
  let sql = `
    SELECT ca.*, u.nickname, u.role AS user_role,
           (SELECT COUNT(*) FROM comments c WHERE c.answer_id = ca.id) AS comment_count,
           (SELECT COUNT(*) FROM attachments a WHERE a.answer_id = ca.id) AS attachment_count
    FROM community_answers ca
    JOIN users u ON u.id = ca.user_id
  `;
  const params = [];
  let p = 1;
  if (qId) { sql += ` WHERE ca.question_id = $${p++}`; params.push(qId); }
  sql += ` ORDER BY ca.created_at DESC LIMIT $${p}`;
  params.push(Number(limit));
  res.json(await all(sql, params));
}));

router.get('/:id', wrap(async (req, res) => {
  const row = await get(`
    SELECT ca.*, u.nickname, u.role AS user_role
    FROM community_answers ca JOIN users u ON u.id = ca.user_id
    WHERE ca.id = $1
  `, [req.params.id]);
  if (!row) return res.status(404).json({ error: '없습니다.' });

  const comments = await all(`
    SELECT c.*, u.nickname FROM comments c JOIN users u ON u.id = c.user_id
    WHERE c.answer_id = $1 ORDER BY c.created_at ASC
  `, [row.id]);

  const attachments = await all('SELECT * FROM attachments WHERE answer_id = $1', [row.id]);

  res.json({ ...row, comments, attachments });
}));

router.post('/', auth, approvedOnly, upload.array('files', 5), wrap(async (req, res) => {
  const { question_id, title, content } = req.body;
  if (!question_id || !title || !content)
    return res.status(400).json({ error: '필수 항목을 입력해주세요.' });

  const r = await run(
    'INSERT INTO community_answers (question_id, user_id, title, content) VALUES ($1, $2, $3, $4) RETURNING id',
    [question_id, req.user.id, title, content]
  );

  if (req.files?.length) {
    for (const f of req.files) {
      await run(
        'INSERT INTO attachments (answer_id, filename, original_name, size) VALUES ($1,$2,$3,$4)',
        [r.id, f.filename, f.originalname, f.size]
      );
    }
  }
  res.json({ id: r.id, message: '답안이 등록되었습니다.' });
}));

router.put('/:id', auth, approvedOnly, wrap(async (req, res) => {
  const row = await get('SELECT * FROM community_answers WHERE id=$1', [req.params.id]);
  if (!row) return res.status(404).json({ error: '없습니다.' });
  if (row.user_id !== req.user.id && req.user.role !== 'admin')
    return res.status(403).json({ error: '수정 권한이 없습니다.' });

  const { title, content } = req.body;
  await run(
    'UPDATE community_answers SET title=$1, content=$2, updated_at=CURRENT_TIMESTAMP WHERE id=$3',
    [title, content, req.params.id]
  );
  res.json({ message: '수정되었습니다.' });
}));

router.delete('/:id', auth, wrap(async (req, res) => {
  const row = await get('SELECT * FROM community_answers WHERE id=$1', [req.params.id]);
  if (!row) return res.status(404).json({ error: '없습니다.' });
  if (row.user_id !== req.user.id && req.user.role !== 'admin')
    return res.status(403).json({ error: '삭제 권한이 없습니다.' });
  await run('DELETE FROM community_answers WHERE id=$1', [req.params.id]);
  res.json({ message: '삭제되었습니다.' });
}));

router.post('/:id/verify', auth, adminOnly, wrap(async (req, res) => {
  const row = await get('SELECT verified FROM community_answers WHERE id=$1', [req.params.id]);
  if (!row) return res.status(404).json({ error: '없습니다.' });
  await run('UPDATE community_answers SET verified=$1 WHERE id=$2', [row.verified ? 0 : 1, req.params.id]);
  res.json({ message: row.verified ? '선정 취소되었습니다.' : '우수 답안으로 선정되었습니다.' });
}));

router.post('/:id/like', auth, approvedOnly, wrap(async (req, res) => {
  const row = await get('SELECT id FROM community_answers WHERE id=$1', [req.params.id]);
  if (!row) return res.status(404).json({ error: '없습니다.' });

  const already = await get(
    'SELECT 1 FROM answer_likes WHERE answer_id=$1 AND user_id=$2',
    [req.params.id, req.user.id]
  );
  if (already) {
    await run('DELETE FROM answer_likes WHERE answer_id=$1 AND user_id=$2', [req.params.id, req.user.id]);
    await run('UPDATE community_answers SET likes=GREATEST(0,likes-1) WHERE id=$1', [req.params.id]);
    return res.json({ liked: false });
  }
  await run('INSERT INTO answer_likes (answer_id, user_id) VALUES ($1,$2)', [req.params.id, req.user.id]);
  await run('UPDATE community_answers SET likes=likes+1 WHERE id=$1', [req.params.id]);
  res.json({ liked: true });
}));

router.get('/:id/comments', wrap(async (req, res) => {
  res.json(await all(`
    SELECT c.*, u.nickname FROM comments c JOIN users u ON u.id = c.user_id
    WHERE c.answer_id = $1 ORDER BY c.created_at ASC
  `, [req.params.id]));
}));

router.post('/:id/comments', auth, approvedOnly, upload.array('files', 3), wrap(async (req, res) => {
  const { content } = req.body;
  if (!content) return res.status(400).json({ error: '댓글 내용을 입력해주세요.' });

  const r = await run(
    'INSERT INTO comments (answer_id, user_id, content) VALUES ($1,$2,$3) RETURNING id',
    [req.params.id, req.user.id, content]
  );

  if (req.files?.length) {
    for (const f of req.files) {
      await run(
        'INSERT INTO attachments (comment_id, filename, original_name, size) VALUES ($1,$2,$3,$4)',
        [r.id, f.filename, f.originalname, f.size]
      );
    }
  }
  res.json({ id: r.id, message: '댓글이 등록되었습니다.' });
}));

router.delete('/:id/comments/:cid', auth, wrap(async (req, res) => {
  const row = await get('SELECT * FROM comments WHERE id=$1', [req.params.cid]);
  if (!row) return res.status(404).json({ error: '없습니다.' });
  if (row.user_id !== req.user.id && req.user.role !== 'admin')
    return res.status(403).json({ error: '삭제 권한이 없습니다.' });
  await run('DELETE FROM comments WHERE id=$1', [req.params.cid]);
  res.json({ message: '삭제되었습니다.' });
}));

module.exports = router;
