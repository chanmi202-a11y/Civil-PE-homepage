const jwt = require('jsonwebtoken');
const { get } = require('../db');

const SECRET = process.env.JWT_SECRET || 'pe-study-change-this-secret-key-32chars';

async function auth(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: '로그인이 필요합니다.' });
  try {
    const payload = jwt.verify(token, SECRET);
    const user    = await get('SELECT * FROM users WHERE id = $1', [payload.id]);
    if (!user) return res.status(401).json({ error: '유효하지 않은 토큰입니다.' });
    req.user = user;
    next();
  } catch {
    res.status(401).json({ error: '만료된 토큰입니다. 다시 로그인해주세요.' });
  }
}

function adminOnly(req, res, next) {
  if (req.user?.role !== 'admin')
    return res.status(403).json({ error: '관리자 권한이 필요합니다.' });
  next();
}

function approvedOnly(req, res, next) {
  if (!['admin', 'approved'].includes(req.user?.role))
    return res.status(403).json({ error: '승인된 회원만 이용할 수 있습니다.' });
  next();
}

module.exports = { auth, adminOnly, approvedOnly, SECRET };
