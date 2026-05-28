require('dotenv').config();
const bcrypt = require('bcryptjs');
const { pool, get, run } = require('./db');

async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id            SERIAL PRIMARY KEY,
      email         TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name          TEXT NOT NULL,
      nickname      TEXT NOT NULL,
      role          TEXT NOT NULL DEFAULT 'pending',
      memo          TEXT,
      created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS questions (
      id           SERIAL PRIMARY KEY,
      type         TEXT NOT NULL,
      score        INTEGER NOT NULL,
      topic        TEXT NOT NULL,
      question     TEXT NOT NULL,
      tags         TEXT NOT NULL DEFAULT '[]',
      published    INTEGER NOT NULL DEFAULT 0,
      publish_date TEXT,
      sample       INTEGER NOT NULL DEFAULT 0,
      created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS blog_posts (
      id           SERIAL PRIMARY KEY,
      category     TEXT NOT NULL,
      emoji        TEXT NOT NULL DEFAULT '📖',
      thumb_class  TEXT NOT NULL DEFAULT 'c1',
      title        TEXT NOT NULL,
      excerpt      TEXT NOT NULL,
      content      TEXT NOT NULL DEFAULT '',
      published    INTEGER NOT NULL DEFAULT 0,
      sample       INTEGER NOT NULL DEFAULT 0,
      created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS community_answers (
      id          SERIAL PRIMARY KEY,
      question_id INTEGER NOT NULL,
      user_id     INTEGER NOT NULL,
      title       TEXT NOT NULL,
      content     TEXT NOT NULL,
      verified    INTEGER NOT NULL DEFAULT 0,
      likes       INTEGER NOT NULL DEFAULT 0,
      sample      INTEGER NOT NULL DEFAULT 0,
      created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS comments (
      id         SERIAL PRIMARY KEY,
      answer_id  INTEGER NOT NULL,
      user_id    INTEGER NOT NULL,
      content    TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS answer_likes (
      answer_id INTEGER NOT NULL,
      user_id   INTEGER NOT NULL,
      PRIMARY KEY (answer_id, user_id)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS attachments (
      id            SERIAL PRIMARY KEY,
      answer_id     INTEGER,
      comment_id    INTEGER,
      filename      TEXT NOT NULL,
      original_name TEXT NOT NULL,
      size          INTEGER NOT NULL,
      created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await seedAdmin();
  await seedSampleData();
  console.log('✅ DB 초기화 완료');
}

async function seedAdmin() {
  const email = process.env.ADMIN_EMAIL || 'chanmi101@naver.com';
  const pw    = process.env.ADMIN_PASSWORD || 'Admin1234!';

  const existing = await get('SELECT id FROM users WHERE email = $1', [email]);
  if (existing) return;

  await run(
    `INSERT INTO users (email, password_hash, name, nickname, role) VALUES ($1, $2, '관리자', '관리자', 'admin')`,
    [email, bcrypt.hashSync(pw, 10)]
  );
  console.log(`✅ 관리자 계정 생성: ${email}`);
  console.log(`   기본 비밀번호: ${pw}  ← 반드시 변경하세요!`);
}

async function seedSampleData() {
  const { rows } = await pool.query('SELECT COUNT(*) AS c FROM questions');
  if (Number(rows[0].c) > 0) return;

  const today     = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const day2      = new Date(Date.now() - 172800000).toISOString().slice(0, 10);

  const questions = [
    ['term',     10, '흙막이 공법',     '(예) 흙막이 공법의 종류를 3가지 이상 열거하고, 각 공법의 특징과 적용 조건을 비교 설명하시오.',                                    '["토공사","가시설"]',    today],
    ['term',     10, '콘크리트 크리프', '(예) 콘크리트 크리프(Creep)의 정의, 발생 원인 및 구조물에 미치는 영향을 설명하시오.',                                            '["콘크리트"]',          today],
    ['advanced', 25, 'NATM 공법',       '(예) 터널 시공에서 NATM 공법의 기본 원리와 시공 순서를 설명하고, 재래식 공법과의 차이점 및 적용 시 유의사항을 기술하시오.',         '["터널","NATM"]',        today],
    ['term',     10, '슬럼프 시험',     '(예) 콘크리트 슬럼프 시험의 목적, 시험 방법 및 슬럼프 값이 시공에 미치는 영향을 설명하시오.',                                     '["콘크리트","품질관리"]', yesterday],
    ['advanced', 25, '연약지반 처리',   '(예) 연약지반 처리 공법의 종류를 분류하고 각 공법의 원리와 적용 기준을 설명하시오. 시공 시 주의사항과 품질관리 방법을 기술하시오.', '["지반공학","연약지반"]', yesterday],
    ['term',     10, 'PSC 공법',        '(예) 프리스트레스트 콘크리트(PSC)의 원리와 프리텐션·포스트텐션 방식의 차이점을 설명하시오.',                                       '["콘크리트","PSC"]',     yesterday],
    ['term',     10, 'CPM / PERT',      '(예) CPM과 PERT의 개념을 비교 설명하고 건설 현장에서의 활용 방법을 기술하시오.',                                                '["공정관리"]',           day2],
    ['advanced', 25, '교량 기초 공법',  '(예) 교량 기초 공법(직접기초·말뚝기초·케이슨기초)을 비교 설명하고 지반 조건에 따른 적용 기준 및 시공 주의사항을 기술하시오.',      '["교량","기초"]',        day2],
  ];

  for (const [type, score, topic, question, tags, publish_date] of questions) {
    await run(
      `INSERT INTO questions (type, score, topic, question, tags, published, publish_date, sample)
       VALUES ($1, $2, $3, $4, $5, 1, $6, 1)`,
      [type, score, topic, question, tags, publish_date]
    );
  }

  const blogPosts = [
    ['토공사',    '🏗️', 'c1', '(예) 흙막이 공법 완전 정복 — 엄지말뚝·CIP·SCW 비교',        '흙막이 공법의 종류와 각 공법의 특징, 적용 조건을 체계적으로 정리했습니다.',      '<h2>1. 흙막이 공법이란?</h2><p>흙막이 공법은 지반 굴착 시 인접 지반의 붕괴를 방지하기 위해 설치하는 가시설 구조물입니다.</p><h2>2. 공법 종류</h2><ul><li><strong>엄지말뚝+토류판:</strong> 가장 경제적, 차수성 없음</li><li><strong>CIP:</strong> 현장타설 콘크리트, 차수성 양호</li><li><strong>SCW:</strong> 시멘트 벽체, 차수성 우수</li><li><strong>Top-down:</strong> 대심도 굴착, 공기 단축</li></ul>'],
    ['콘크리트',  '🧱', 'c2', '(예) 콘크리트 배합설계 핵심 — W/C비와 강도의 관계',            '물-시멘트비와 압축강도의 관계, 슬럼프·크리프 메커니즘을 실무 중심으로 설명합니다.', '<h2>1. 배합설계 목적</h2><p>소요 강도, 내구성, 워커빌리티를 동시에 만족시키는 배합을 결정하는 과정입니다.</p><h2>2. W/C비와 강도</h2><p>물-시멘트비(W/C)가 작을수록 압축강도는 커집니다.</p>'],
    ['터널',      '🚇', 'c3', '(예) NATM 공법 완전 이해 — 기본 원리부터 계측 관리까지',      '지반 아치 효과, 록볼트·숏크리트 역할, 계측 항목과 관리 기준까지 정리합니다.',     '<h2>1. NATM이란?</h2><p>지반 자체의 지지력을 최대한 활용하는 공법으로, 1960년대 오스트리아에서 개발되었습니다.</p><h2>2. 시공 순서</h2><ul><li>굴착 → 숏크리트 1차 → 록볼트 → 와이어메쉬 → 숏크리트 2차 → 계측</li></ul>'],
    ['지반공학',  '⛏️', 'c4', '(예) 연약지반 처리 공법 총정리 — 치환·탈수·다짐 공법',        '연약지반 처리를 위한 공법들을 체계적으로 분류하고 적용 사례를 정리했습니다.',     '<h2>1. 연약지반이란?</h2><p>N값 4 이하 또는 일축압축강도 0.4kgf/cm² 이하인 지반을 말합니다.</p><h2>2. 처리 공법 분류</h2><ul><li><strong>치환공법:</strong> 연약토를 직접 제거</li><li><strong>탈수공법:</strong> 배수재 설치로 압밀 촉진</li><li><strong>다짐공법:</strong> 진동·충격으로 밀도 증가</li></ul>'],
    ['교량',      '🌉', 'c5', '(예) 교량 상부구조의 종류와 특징 — 형교·아치교·사장교 비교',   '구조적 특징과 경간에 따른 선택 기준을 설명합니다.',                            '<h2>1. 교량의 분류</h2><p>거더교, 트러스교, 아치교, 사장교, 현수교로 분류됩니다.</p><h2>2. 경간별 적용</h2><ul><li>단경간(~50m): 거더교</li><li>중경간(50~200m): 트러스·아치교</li><li>장경간(200m~): 사장교·현수교</li></ul>'],
    ['PSC',       '🔩', 'c6', '(예) PSC의 원리와 프리텐션·포스트텐션 방식 비교',               '프리텐션·포스트텐션 차이점, PS 손실 요인 및 대책을 설계 사례와 함께 설명합니다.', '<h2>1. PSC의 개념</h2><p>사용 하중에 의한 인장응력을 상쇄하기 위해 미리 압축력을 도입한 콘크리트입니다.</p><h2>2. 공법 비교</h2><ul><li><strong>프리텐션:</strong> 타설 전 긴장 → 공장 제작에 유리</li><li><strong>포스트텐션:</strong> 타설 후 긴장 → 현장 시공에 유리</li></ul>'],
  ];

  for (const [category, emoji, thumb_class, title, excerpt, content] of blogPosts) {
    await run(
      `INSERT INTO blog_posts (category, emoji, thumb_class, title, excerpt, content, published, sample)
       VALUES ($1, $2, $3, $4, $5, $6, 1, 1)`,
      [category, emoji, thumb_class, title, excerpt, content]
    );
  }

  console.log('✅ 샘플 데이터 입력 완료 (예시 — (예) 표시)');
}

module.exports = { initDB };
