// ════════════════════════════════════════════════
//  공통 JS  — API / Auth / Utils
// ════════════════════════════════════════════════

const API = {
  async req(method, path, body, needAuth = true) {
    const headers = { 'Content-Type': 'application/json' };
    if (needAuth) {
      const t = localStorage.getItem('pe_token');
      if (t) headers['Authorization'] = 'Bearer ' + t;
    }
    const res = await fetch('/api' + path, {
      method,
      headers,
      body: body != null ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || '오류가 발생했습니다.');
    return data;
  },
  get:    (p, a)    => API.req('GET',    p, null, a),
  post:   (p, b, a) => API.req('POST',   p, b, a),
  put:    (p, b, a) => API.req('PUT',    p, b, a),
  delete: (p, a)    => API.req('DELETE', p, null, a),
};

const Auth = {
  getUser()  { try { return JSON.parse(localStorage.getItem('pe_user')); } catch { return null; } },
  getToken() { return localStorage.getItem('pe_token'); },
  isAdmin()  { return this.getUser()?.role === 'admin'; },
  isApproved() { return ['admin','approved'].includes(this.getUser()?.role); },

  save(data) {
    localStorage.setItem('pe_token', data.token);
    localStorage.setItem('pe_user', JSON.stringify(data.user));
    this.updateUI();
  },
  logout() {
    localStorage.removeItem('pe_token');
    localStorage.removeItem('pe_user');
    location.href = '/';
  },
  updateUI() {
    const u = this.getUser();
    document.getElementById('loginBtn')?.classList.toggle('hidden', !!u);
    document.getElementById('signupBtn')?.classList.toggle('hidden', !!u);
    document.getElementById('userArea')?.classList.toggle('hidden', !u);
    const el = document.getElementById('userName');
    if (el && u) el.textContent = u.nickname || u.name;
    document.querySelectorAll('.admin-only').forEach(e =>
      e.classList.toggle('hidden', !this.isAdmin())
    );
  },
};

function showModal(title, body, actions) {
  document.getElementById('__modal')?.remove();
  const el = document.createElement('div');
  el.id = '__modal';
  el.style.cssText = 'position:fixed;inset:0;z-index:9000;background:rgba(0,0,0,.4);display:flex;align-items:center;justify-content:center;padding:1rem;';
  el.innerHTML = `<div style="background:#fff;border-radius:14px;box-shadow:0 20px 40px rgba(0,0,0,.12);max-width:400px;width:100%;padding:1.75rem;">
    <h3 style="font-size:1.02rem;font-weight:800;margin-bottom:.55rem;">${title}</h3>
    <div style="font-size:.88rem;color:#7A8394;line-height:1.7;margin-bottom:1.3rem;">${body}</div>
    <div id="__mact" style="display:flex;gap:.45rem;justify-content:flex-end;"></div>
  </div>`;
  (actions || [{ label: '확인', primary: true }]).forEach(a => {
    const b = document.createElement('button');
    b.textContent = a.label;
    b.className   = a.primary ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm';
    b.onclick = () => { el.remove(); a.fn?.(); };
    el.querySelector('#__mact').appendChild(b);
  });
  el.addEventListener('click', e => { if (e.target === el) el.remove(); });
  document.body.appendChild(el);
}

function toast(msg, type = 'info') {
  const colors = { info: '#3A7BF7', success: '#137333', error: '#B91C1C' };
  const el = document.createElement('div');
  el.style.cssText = `position:fixed;bottom:1.5rem;right:1.5rem;z-index:9999;background:${colors[type]||colors.info};
    color:#fff;padding:.65rem 1.1rem;border-radius:8px;font-size:.87rem;font-weight:600;
    box-shadow:0 4px 16px rgba(0,0,0,.15);animation:fadeIn .2s;max-width:300px;`;
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3000);
}

function requireApproved(cb) {
  if (!Auth.getUser()) {
    showModal('로그인이 필요합니다', '답안 업로드와 댓글 작성은 로그인 후 이용하실 수 있습니다.', [
      { label: '취소' },
      { label: '로그인', primary: true, fn: () => location.href = '/login.html' },
    ]);
    return;
  }
  if (!Auth.isApproved()) {
    showModal('승인 대기 중', '관리자 승인 완료 후 답안 업로드 및 댓글 작성이 가능합니다.<br>승인까지 보통 1~2일 소요됩니다.', [
      { label: '확인', primary: true },
    ]);
    return;
  }
  cb?.();
}

function fmtDate(str) {
  if (!str) return '';
  const d = new Date(str);
  if (isNaN(d)) return str;
  return `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')}`;
}

function relDate(str) {
  if (!str) return '';
  const diff = Math.floor((Date.now() - new Date(str)) / 86400000);
  if (diff === 0) return '오늘';
  if (diff === 1) return '어제';
  if (diff < 7)  return `${diff}일 전`;
  return fmtDate(str);
}

function initNav() {
  const page = location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-links a').forEach(a => {
    if (a.getAttribute('href').split('/').pop() === page) a.classList.add('active');
  });
}

document.addEventListener('DOMContentLoaded', () => {
  initNav();
  Auth.updateUI();
  document.getElementById('logoutBtn')?.addEventListener('click', () => {
    showModal('로그아웃', '정말 로그아웃 하시겠습니까?', [
      { label: '취소' },
      { label: '로그아웃', primary: true, fn: () => Auth.logout() },
    ]);
  });

  if (Auth.getUser()) {
    API.get('/auth/me').then(d => {
      localStorage.setItem('pe_user', JSON.stringify(d));
      Auth.updateUI();
    }).catch(() => {});
  }
});
