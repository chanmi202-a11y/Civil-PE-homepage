const router = require('express').Router();
const { all, get, run }         = require('../db');
const { auth, adminOnly }       = require('../middleware/auth');

const wrap = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

router.get('/', wrap(async (req, res) => {
  const { category, limit = 50 } = req.query;
  let sql = 'SELECT id,category,emoji,thumb_class,title,excerpt,published,sample,created_at FROM blog_posts WHERE published=1';
  const params = [];
  let p = 1;
  if (category && category !== 'all') { sql += ` AND category=$${p++}`; params.push(category); }
  sql += ` ORDER BY id DESC LIMIT $${p}`;
  params.push(Number(limit));
  res.json(await all(sql, params));
}));

router.get('/drafts', auth, adminOnly, wrap(async (req, res) => {
  res.json(await all('SELECT id,category,emoji,thumb_class,title,excerpt,published,sample,created_at FROM blog_posts ORDER BY id DESC'));
}));

router.get('/:id/preview', auth, adminOnly, wrap(async (req, res) => {
  const row = await get('SELECT * FROM blog_posts WHERE id=$1', [req.params.id]);
  if (!row) return res.status(404).json({ error: '없습니다.' });
  res.json(row);
}));

router.get('/:id', wrap(async (req, res) => {
  const row = await get('SELECT * FROM blog_posts WHERE id=$1', [req.params.id]);
  if (!row || !row.published) return res.status(404).json({ error: '게시물을 찾을 수 없습니다.' });
  res.json(row);
}));

router.post('/', auth, adminOnly, wrap(async (req, res) => {
  const { category, emoji = '📖', thumb_class = 'c1', title, excerpt, content = '' } = req.body;
  if (!category || !title || !excerpt) return res.status(400).json({ error: '필수 항목을 입력해주세요.' });

  const r = await run(
    `INSERT INTO blog_posts (category,emoji,thumb_class,title,excerpt,content,published,sample)
     VALUES ($1,$2,$3,$4,$5,$6,0,0) RETURNING id`,
    [category, emoji, thumb_class, title, excerpt, content]
  );
  res.json({ id: r.id, message: '초안으로 저장되었습니다.' });
}));

router.put('/:id', auth, adminOnly, wrap(async (req, res) => {
  const { category, emoji, thumb_class, title, excerpt, content } = req.body;
  await run(
    `UPDATE blog_posts SET category=$1,emoji=$2,thumb_class=$3,title=$4,excerpt=$5,content=$6,updated_at=CURRENT_TIMESTAMP WHERE id=$7`,
    [category, emoji, thumb_class, title, excerpt, content, req.params.id]
  );
  res.json({ message: '수정되었습니다.' });
}));

router.post('/:id/publish', auth, adminOnly, wrap(async (req, res) => {
  await run('UPDATE blog_posts SET published=1,updated_at=CURRENT_TIMESTAMP WHERE id=$1', [req.params.id]);
  res.json({ message: '발행되었습니다.' });
}));

router.post('/:id/unpublish', auth, adminOnly, wrap(async (req, res) => {
  await run('UPDATE blog_posts SET published=0,updated_at=CURRENT_TIMESTAMP WHERE id=$1', [req.params.id]);
  res.json({ message: '발행이 취소되었습니다.' });
}));

router.delete('/:id', auth, adminOnly, wrap(async (req, res) => {
  await run('DELETE FROM blog_posts WHERE id=$1', [req.params.id]);
  res.json({ message: '삭제되었습니다.' });
}));

module.exports = router;
