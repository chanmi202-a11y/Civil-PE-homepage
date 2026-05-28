require('dotenv').config();
const express = require('express');
const https   = require('https');
const path    = require('path');
const fs      = require('fs');
const cors    = require('cors');
const selfsigned = require('selfsigned');
const open    = require('open');
const { initDB } = require('./database');

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use('/api/auth',      require('./routes/auth'));
app.use('/api/questions', require('./routes/questions'));
app.use('/api/blog',      require('./routes/blog'));
app.use('/api/community', require('./routes/community'));
app.use('/api/admin',     require('./routes/admin'));

app.get('*', (req, res) =>
  res.sendFile(path.join(__dirname, 'public', 'index.html'))
);

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: '서버 오류가 발생했습니다.' });
});

// ── SSL 인증서 (자동 생성 & 재사용) ──
function getCerts() {
  const dir     = path.join(__dirname, 'certs');
  const keyFile = path.join(dir, 'key.pem');
  const crtFile = path.join(dir, 'cert.pem');

  if (fs.existsSync(keyFile) && fs.existsSync(crtFile)) {
    return { key: fs.readFileSync(keyFile), cert: fs.readFileSync(crtFile) };
  }

  fs.mkdirSync(dir, { recursive: true });
  const pems = selfsigned.generate([{ name: 'commonName', value: 'localhost' }], {
    days: 3650, algorithm: 'sha256', keySize: 2048,
  });
  fs.writeFileSync(keyFile, pems.private);
  fs.writeFileSync(crtFile, pems.cert);
  console.log('🔑 SSL 인증서 생성 완료 (certs/ 폴더)');
  return { key: pems.private, cert: pems.cert };
}

(async () => {
  await initDB();

  // Railway / Render 등 배포 환경에서는 HTTP (플랫폼이 HTTPS 처리)
  if (process.env.NODE_ENV === 'production' || process.env.HTTP_ONLY === 'true') {
    app.listen(PORT, () =>
      console.log(`\n🚀 서버 시작 — http://localhost:${PORT}`)
    );
    return;
  }

  // 로컬 개발: HTTPS
  const certs = getCerts();
  https.createServer(certs, app).listen(PORT, () => {
    const url = `https://localhost:${PORT}`;
    console.log(`\n🔒 PE Study 서버 시작 — ${url}`);
    console.log(`   관리자: ${process.env.ADMIN_EMAIL || 'chanmi101@naver.com'}`);
    console.log('\n   ⚠️  브라우저에서 "연결이 비공개로 설정되지 않음" 경고가 나오면:');
    console.log('      [고급] → [localhost(으)로 이동] 클릭하면 정상 접속됩니다.\n');

    // 3초 후 브라우저 자동 실행
    setTimeout(() => open(url).catch(() => {}), 3000);
  });
})();
