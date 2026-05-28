# 토목PE 스터디 — 작업 진행 기록

## 배포 정보

| 항목 | 내용 |
|------|------|
| 사이트 주소 | https://civil-pe-homepage.onrender.com |
| 서버 호스팅 | Render.com (무료) |
| 데이터베이스 | Neon PostgreSQL (무료, 영구 보존) |
| GitHub | https://github.com/chanmi202-a11y/Civil-PE-homepage |
| 관리자 이메일 | chanmi101@naver.com |

> ⚠️ 관리자 비밀번호는 관리자 패널 → 🔑 비밀번호 변경 에서 설정하세요.

---

## 완료된 작업

### 1. 프로젝트 초기 구성
- Node.js + Express 서버
- SQLite (로컬 개발용) 기반 구축
- JWT 인증, bcrypt 비밀번호 암호화
- 로컬 HTTPS 자동 인증서 (selfsigned)

### 2. 구현된 기능
- **회원 시스템**: 가입 신청 → 관리자 승인/거절
- **문제 관리**: 초안 저장 → 발행 워크플로우 (관리자)
- **블로그**: 카테고리별 포스트 작성/발행 (관리자)
- **커뮤니티**: 답안 작성, 댓글, 좋아요, 우수 답안 선정
- **파일 첨부**: 답안/댓글에 파일 업로드 (최대 10MB)
- **관리자 패널**: 현황 대시보드, 회원·콘텐츠·커뮤니티 관리

### 3. Railway → Render + Neon 이전
- Railway 무료 플랜 크레딧 소진으로 대안 플랫폼으로 이전
- SQLite → PostgreSQL 전체 마이그레이션
  - `db.js` 신규 생성 (pg Pool 기반 헬퍼)
  - `database.js` PostgreSQL 테이블 생성 + 시드 데이터로 재작성
  - 모든 라우트 파일 async/await + `$1, $2...` 파라미터로 전환
  - `middleware/auth.js` async 전환
- Neon PostgreSQL 연결 (ap-southeast-1, Singapore)
- Render.com 배포 완료

### 4. 관리자 패널 개선
- 비밀번호 변경 메뉴 추가 (🔑 비밀번호 변경)

---

## 알려진 제한사항 및 향후 작업

### 현재 제한사항
| 항목 | 내용 |
|------|------|
| 서버 절전 | Render 무료 플랜 — 15분 미접속 시 절전, 첫 요청 30~50초 지연 |
| 파일 첨부 | Render 재배포 시 `uploads/` 폴더 초기화 (파일 소실) |

### 향후 작업 예정
- [ ] **Cloudinary 연결** — 파일 첨부 영구 저장 (재배포 시 소실 문제 해결)

---

## 로컬 개발 환경 실행

```bash
# 의존성 설치
npm install

# 개발 서버 시작 (HTTPS, 포트 3000)
npm run dev
```

로컬 실행 시 `https://localhost:3000` 접속
브라우저 경고 → [고급] → [localhost로 이동] 클릭

로컬 환경에서는 PostgreSQL 대신 `.env`의 `DATABASE_URL`이 필요합니다.
Neon 연결 문자열을 `.env`에 설정하거나 로컬 PostgreSQL을 사용하세요.

---

## 환경변수 목록

| 변수명 | 설명 |
|--------|------|
| `NODE_ENV` | `production` (배포) / 미설정 (로컬) |
| `DATABASE_URL` | Neon PostgreSQL 연결 문자열 |
| `JWT_SECRET` | JWT 서명 비밀키 (32자 이상 권장) |
| `ADMIN_EMAIL` | 관리자 계정 이메일 |
| `ADMIN_PASSWORD` | 관리자 초기 비밀번호 (최초 실행 후 변경) |
| `MAX_FILE_MB` | 파일 업로드 크기 제한 (기본값: 10) |
| `PORT` | 서버 포트 (기본값: 3000) |
