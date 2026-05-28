# 토목PE 스터디 — 토목시공기술사 합격 플랫폼

## 로컬 실행 방법

```bash
# 1. 의존성 설치 (처음 한 번만)
npm install

# 2. 서버 시작
npm start

# 개발 모드 (자동 재시작)
npm run dev
```

서버 시작 후 → **http://localhost:3000** 접속

---

## 관리자 계정

| 항목 | 값 |
|------|-----|
| 이메일 | chanmi101@naver.com |
| 기본 비밀번호 | Admin1234! |

> ⚠️ **반드시 처음 로그인 후 비밀번호를 변경하세요!**
> 관리자 페이지 → 우측 상단 로그인 → 비밀번호 변경

---

## 운영 방법

### 문제 업로드 순서
1. `/admin.html` → **문제 작성**
2. 내용 입력 후 **초안 저장** (사용자에게 미노출)
3. 확인 후 **발행** → 즉시 메인/문제 페이지에 노출

### 블로그 작성 순서
1. `/admin.html` → **블로그 작성**
2. HTML 본문 입력 후 **초안 저장**
3. **발행** → 블로그 페이지에 노출

### 회원 승인 순서
1. `/admin.html` → **승인 대기** 탭
2. 가입 동기 확인 후 **승인 / 거절**

---

## 외부 배포 (Railway)

1. [railway.app](https://railway.app) 가입
2. **New Project → Deploy from GitHub** 선택
3. 이 폴더를 GitHub에 업로드 후 연결
4. **Variables** 탭에서 `.env` 내용 그대로 입력
5. 자동 배포 완료 → 제공되는 URL로 접속

---

## 파일 구조

```
Professional Engineer/
├── public/          ← 프론트엔드 (HTML/CSS/JS)
│   ├── index.html
│   ├── questions.html
│   ├── community.html
│   ├── blog.html
│   ├── login.html
│   ├── admin.html   ← 관리자 전용 (로그인 후 자동 권한 확인)
│   ├── style.css
│   └── main.js
├── routes/          ← API 라우트
├── middleware/      ← JWT 인증 미들웨어
├── uploads/         ← 업로드된 파일
├── server.js        ← Express 서버
├── database.js      ← SQLite 설정 + 초기 데이터
├── .env             ← 환경변수 (비공개)
└── package.json
```
