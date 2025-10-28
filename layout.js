// layout.js — injeta sidebar + main-content, protege as páginas e expira por inatividade
(function () {
  // === Proteção: exige login em todas as páginas, menos login.html ===
  const isLoginPage = /(^|\/)login\.html(\?|#|$)/i.test(location.pathname);
  // auth.js precisa estar carregado antes (inclua <script src="auth.js"></script> ANTES deste arquivo).
  if (!isLoginPage && window.AUTH && !window.AUTH.isLoggedIn()) {
    const next = location.pathname.split('/').pop() || 'index.html';
    location.replace(`login.html?next=${encodeURIComponent(next)}`);
    return;
  }

  // ======== Logout automático por inatividade + aviso com contagem ========
  (function setupInactivityGuard() {
    if (isLoginPage) return;                          // não roda no login
    if (!window.AUTH || !AUTH.isLoggedIn()) return;   // só quando logado

    const INATIVIDADE_MINUTOS = 10; // tempo total até logout por inatividade
    const AVISO_SEGUNDOS = 60;      // segundos antes do logout para exibir o aviso

    let idleTimer = null;     // timer principal (logout)
    let warnTimer = null;     // timer que dispara o modal de aviso
    let warnTicker = null;    // contador regressivo no modal
    let remaining = AVISO_SEGUNDOS;

    function ensureWarningModal() {
      if (document.getElementById('idle-warning-modal')) return;

      const css = document.createElement('style');
      css.id = 'idle-warning-styles';
      css.textContent = `
        #idle-warning-modal{position:fixed;inset:0;display:none;align-items:center;justify-content:center;background:rgba(0,0,0,.45);z-index:9999}
        #idle-warning-box{background:#fff;border-radius:12px;max-width:420px;width:92%;padding:20px;box-shadow:0 10px 30px rgba(0,0,0,.2);text-align:center}
        #idle-warning-title{font-weight:800;font-size:1.1rem;margin-bottom:6px}
        #idle-warning-text{color:#444;margin:6px 0 14px}
        #idle-warning-count{font-weight:800;font-size:1.6rem}
        #idle-warning-actions{display:flex;gap:10px;justify-content:center;margin-top:8px}
        #idle-stay-btn,#idle-logout-btn{padding:10px 14px;border-radius:10px;border:none;cursor:pointer;font-weight:700}
        #idle-stay-btn{background:#0a8f83;color:#fff}
        #idle-stay-btn:hover{filter:brightness(.95)}
        #idle-logout-btn{background:#e0e0e0}
      `;
      document.head.appendChild(css);

      const modal = document.createElement('div');
      modal.id = 'idle-warning-modal';
      modal.innerHTML = `
        <div id="idle-warning-box">
          <div id="idle-warning-title">Sessão prestes a expirar</div>
          <div id="idle-warning-text">Sem atividade recente. Você será desconectado em:</div>
          <div id="idle-warning-count">—</div>
          <div id="idle-warning-actions">
            <button id="idle-stay-btn">Continuar logado</button>
            <button id="idle-logout-btn">Sair agora</button>
          </div>
        </div>
      `;
      document.body.appendChild(modal);

      document.getElementById('idle-stay-btn').onclick = () => {
        hideWarning();
        resetIdleTimer();
      };
      document.getElementById('idle-logout-btn').onclick = () => {
        doLogout();
      };
    }

    function showWarning() {
      ensureWarningModal();
      remaining = AVISO_SEGUNDOS;
      const modal = document.getElementById('idle-warning-modal');
      const count = document.getElementById('idle-warning-count');
      const render = () => { if (count) count.textContent = `${remaining}s`; };
      render();
      modal.style.display = 'flex';

      clearInterval(warnTicker);
      warnTicker = setInterval(() => {
        remaining -= 1;
        render();
        if (remaining <= 0) {
          clearInterval(warnTicker);
          doLogout();
        }
      }, 1000);
    }

    function hideWarning() {
      const modal = document.getElementById('idle-warning-modal');
      if (modal) modal.style.display = 'none';
      clearInterval(warnTicker);
      warnTicker = null;
    }

    function doLogout() {
      hideWarning();
      clearTimeouts();
      try { AUTH.logout(); } catch {}
    }

    function clearTimeouts() {
      clearTimeout(idleTimer); idleTimer = null;
      clearTimeout(warnTimer); warnTimer = null;
    }

    function resetIdleTimer() {
      clearTimeouts();
      hideWarning();

      const avisoMs = Math.max(0, (INATIVIDADE_MINUTOS * 60 - AVISO_SEGUNDOS) * 1000);
      warnTimer = setTimeout(showWarning, avisoMs);
      idleTimer = setTimeout(doLogout, INATIVIDADE_MINUTOS * 60 * 1000);
    }

    const eventos = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'click'];
    const onActivity = () => resetIdleTimer();

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) return;
      resetIdleTimer();
    });

    eventos.forEach(evt => document.addEventListener(evt, onActivity, { passive: true }));

    ensureWarningModal();
    resetIdleTimer();
  })();

  if (window.__LAYOUT_APPLIED__) return;
  if (document.querySelector('.app-shell')) return;
  window.__LAYOUT_APPLIED__ = true;

  // Cria o contêiner principal
  const shell = document.createElement('div');
  shell.className = 'app-shell';

  // Move conteúdo existente para <main>
  const main = document.createElement('main');
  main.className = 'main-content';
  while (document.body.firstChild) main.appendChild(document.body.firstChild);

  // Sidebar
  const aside = document.createElement('aside');
  aside.className = 'sidebar-app';
  aside.innerHTML = `
    <div class="sidebar-card">
      <div class="brand">Paiva Dashboard</div>
      <nav class="side-nav">
        <a href="index.html"><span>🏠</span> Início</a>
        <a href="instancias.html"><span>⚙️</span> Instâncias</a>
        <a href="disparos.html"><span>🗂️</span> Disparos</a>
        <a href="relatorios.html"><span>📊</span> Relatórios</a>
        <a href="adm.html"><span>⚙️</span> Administrativo</a>
      </nav>
      <div class="side-footer">
        <button id="logout-btn" class="btn btn-outline" style="width:100%;margin-top:10px;">Sair</button>
        <div style="margin-top:10px; opacity:.65; font-size:.85rem;">© 2025 Paiva Advogados</div>
      </div>
    </div>
  `;

  // Monta o layout
  shell.appendChild(aside);
  shell.appendChild(main);
  document.body.appendChild(shell);

  // Ativa link atual
  const path = (location.pathname || '').split('/').pop().toLowerCase();
  document.querySelectorAll('.side-nav a').forEach(a => {
    const href = (a.getAttribute('href') || '').toLowerCase();
    if (href && path && href.endsWith(path)) a.classList.add('active');
  });

  // Botão Sair
  const out = aside.querySelector('#logout-btn');
  if (out) {
    out.addEventListener('click', () => {
      if (window.AUTH) AUTH.logout();
      location.href = 'login.html';
    });
  }

  // CSS — altura total e layout
  const css = document.createElement('style');
  css.textContent = `
    html, body { height: auto; min-height: 100%; margin: 0; padding: 0; }
    :root { --vh: 100vh; --dvh: 100dvh; --svh: 100svh; }
    body { background: var(--fundo-geral, #f8fafc); }

    .app-shell{
      display: grid;
      grid-template-columns: 260px 1fr;
      min-height: var(--dvh, 100dvh);
      min-height: var(--svh, 100svh);
      min-height: var(--vh, 100vh);
      min-height: 100vh;
      align-items: stretch;
    }
    @media (max-width: 980px) { .app-shell{ grid-template-columns: 1fr; } }

    .sidebar-card{
      background: #1b1b4d; color: #fff;
      min-height: var(--dvh, 100dvh);
      min-height: var(--svh, 100svh);
      min-height: var(--vh, 100vh);
      min-height: 100vh;
      padding: 20px 16px; border-right: 1px solid rgba(255,255,255,.1);
      display:flex; flex-direction:column; position:sticky; top:0;
    }
    @media (max-width:980px){
      .sidebar-card{ position:static; min-height:auto; border-right:none; border-bottom:1px solid rgba(0,0,0,.08); }
    }

    .brand{ font-weight:800; font-size:1.3rem; margin-bottom:16px; }
    .side-nav{ display:flex; flex-direction:column; gap:8px; }
    .side-nav a{
      display:flex; align-items:center; gap:10px; color:#fff; text-decoration:none;
      padding:10px 12px; border-radius:10px; font-weight:600; transition:background .2s;
    }
    .side-nav a:hover{ background:rgba(255,255,255,.1); }
    .side-nav a.active{ background:#0a8f83; }

    .main-content{
      padding:24px; background: var(--fundo-claro, #f8fafc);
      min-height: var(--dvh, 100dvh);
      min-height: var(--svh, 100svh);
      min-height: var(--vh, 100vh);
      min-height: 100vh;
      box-sizing: border-box;
    }
  `;
  document.head.appendChild(css);

  // (opcional) badge do tenant na sidebar
  try {
    const t = (window.AUTH && AUTH.getTenant && AUTH.getTenant()) || null;
    if (t) {
      const brand = document.querySelector('.brand');
      if (brand) {
        const tag = document.createElement('div');
        tag.style.cssText = "margin-top:6px;font-size:.85rem;opacity:.8";
        tag.textContent = `Ambiente: ${t.label || t.id}`;
        brand.insertAdjacentElement('afterend', tag);
      }
    }
  } catch {}
})();
