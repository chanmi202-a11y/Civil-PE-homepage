const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt    = require('jsonwebtoken');
const { get, run }         = require('../db');
const { auth, SECRET }     = require('../middleware/auth');

const wrap = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

router.post('/register', wrap(async (req, res) => {
  const { email, password, name, nickname, memo } = req.body;
  if (!email || !password || !name || !nickname)
    return res.status(400).json({ error: '필수 항목을 모두 입력해주세요.' });
  if (password.length < 8)
    return res.status(400).json({ error: '비밀번호는 8자 이상이어야 합니다.' });

  if (await get('SELECT id FROM users WHERE email = $1', [email]))
    return res.status(409).json({ error: '이미 가입된 이메일입니다.' });

  await run(
    'INSERT INTO users (email, password_hash, name, nickname, memo) VALUES ($1, $2, $3, $4, $5)',
    [email, bcrypt.hashSync(password, 10), name, nickname, memo || null]
  );
  res.json({ message: '가입 신청이 완료되었습니다. 관리자 승인 후 이용 가능합니다.' });
}));

router.post('/login', wrap(async (req, res) => {
  const { email, password } = req.body;
  const user = await get('SELECT * FROM users WHERE email = $1', [email]);

  if (!user || !bcrypt.compareSync(password, user.password_hash))
    return res.status(401).json({ error: '이메일 또는 비밀번호가 올바르지 않습니다.' });

  const token = jwt.sign({ id: user.id, role: user.role }, SECRET, { expiresIn: '7d' });
  res.json({
    token,
    user: { id: user.id, email: user.email, name: user.name, nickname: user.nickname, role: user.role }
  });
}));

router.get('/me', auth, (req, res) => {
  const u = req.user;
  res.json({ id: u.id, email: u.email, name: u.name, nickname: u.nickname, role: u.role });
});

router.put('/change-password', auth, wrap(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const user = await get('SELECT * FROM users WHERE id = $1', [req.user.id]);

  if (!bcrypt.compareSync(currentPassword, user.password_hash))
    return res.status(401).json({ error: '현재 비밀번호가 올바르지 않습니다.' });
  if (newPassword.length < 8)
    return res.status(400).json({ error: '비밀번호는 8자 이상이어야 합니다.' });

  await run('UPDATE users SET password_hash = $1 WHERE id = $2',
    [bcrypt.hashSync(newPassword, 10), req.user.id]);
  res.json({ message: '비밀번호가 변경되었습니다.' });
}));

module.exports = router;
