const router = require('express').Router();
const { all, get, run }       = require('../db');
const { auth, adminOnly }     = require('../middleware/auth');

const wrap = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

router.use(auth, adminOnly);

router.get('/stats', wrap(async (req, res) => {
  const [users, questions, blog, community] = await Promise.all([
    Promise.all([
      get("SELECT COUNT(*) AS c FROM users WHERE role != 'admin'"),
      get("SELECT COUNT(*) AS c FROM users WHERE role = 'pending'"),
      get("SELECT COUNT(*) AS c FROM users WHERE role = 'approved'"),
    ]),
    Promise.all([
      get('SELECT COUNT(*) AS c FROM questions'),
      get('SELECT COUNT(*) AS c FROM questions WHERE published=1'),
      get('SELECT COUNT(*) AS c FROM questions WHERE published=0'),
    ]),
    Promise.all([
      get('SELECT COUNT(*) AS c FROM blog_posts'),
      get('SELECT COUNT(*) AS c FROM blog_posts WHERE published=1'),
      get('SELECT COUNT(*) AS c FROM blog_posts WHERE published=0'),
    ]),
    Promise.all([
      get('SELECT COUNT(*) AS c FROM community_answers'),
      get('SELECT COUNT(*) AS c FROM comments'),
    ]),
  ]);

  res.json({
    users:     { total: Number(users[0].c),     pending:   Number(users[1].c),     approved: Number(users[2].c) },
    questions: { total: Number(questions[0].c), published: Number(questions[1].c), drafts:   Number(questions[2].c) },
    blog:      { total: Number(blog[0].c),      published: Number(blog[1].c),      drafts:   Number(blog[2].c) },
    community: { answers: Number(community[0].c), comments: Number(community[1].c) },
  });
}));

router.get('/users', wrap(async (req, res) => {
  const { role } = req.query;
  let sql = 'SELECT id,email,name,nickname,role,memo,created_at FROM users';
  const params = [];
  if (role) { sql += ' WHERE role = $1'; params.push(role); }
  sql += ' ORDER BY created_at DESC';
  res.json(await all(sql, params));
}));

router.put('/users/:id/approve', wrap(async (req, res) => {
  await run("UPDATE users SET role='approved' WHERE id=$1", [req.params.id]);
  res.json({ message: '승인되었습니다.' });
}));

router.put('/users/:id/reject', wrap(async (req, res) => {
  await run("UPDATE users SET role='rejected' WHERE id=$1", [req.params.id]);
  res.json({ message: '거절되었습니다.' });
}));

router.put('/users/:id/role', wrap(async (req, res) => {
  const { role } = req.body;
  if (!['pending', 'approved', 'rejected'].includes(role))
    return res.status(400).json({ error: '유효하지 않은 역할입니다.' });
  await run('UPDATE users SET role=$1 WHERE id=$2', [role, req.params.id]);
  res.json({ message: '역할이 변경되었습니다.' });
}));

router.delete('/users/:id', wrap(async (req, res) => {
  if (Number(req.params.id) === req.user.id)
    return res.status(400).json({ error: '자기 자신은 삭제할 수 없습니다.' });
  await run('DELETE FROM users WHERE id=$1', [req.params.id]);
  res.json({ message: '삭제되었습니다.' });
}));

router.get('/pending', wrap(async (req, res) => {
  const [questions, blog] = await Promise.all([
    all('SELECT * FROM questions WHERE published=0 ORDER BY id DESC'),
    all('SELECT * FROM blog_posts WHERE published=0 ORDER BY id DESC'),
  ]);
  questions.forEach(r => { r.tags = JSON.parse(r.tags || '[]'); });
  res.json({ questions, blog });
}));

router.delete('/community/:id', wrap(async (req, res) => {
  await run('DELETE FROM community_answers WHERE id=$1', [req.params.id]);
  res.json({ message: '삭제되었습니다.' });
}));

router.delete('/comments/:id', wrap(async (req, res) => {
  await run('DELETE FROM comments WHERE id=$1', [req.params.id]);
  res.json({ message: '삭제되었습니다.' });
}));

module.exports = router;
