// layout.js — injeta sidebar + main-content e protege as páginas com login
(function () {
  // === Proteção: exige login em todas as páginas, menos login.html ===
  const isLoginPage = /(^|\/)login\.html(\?|#|$)/i.test(location.pathname);
  // auth.js precisa estar carregado antes (inclua <script src="auth.js"></script> ANTES deste arquivo).
  if (!isLoginPage && window.AUTH && !window.AUTH.isLoggedIn()) {
    const next = location.pathname.split('/').pop() || 'index.html';
    location.replace(`login.html?next=${encodeURIComponent(next)}`);
    return;
  }

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
    .btn{cursor:pointer}
    .btn-outline{background:transparent; color:#fff; border:1px solid rgba(255,255,255,.35); padding:8px 10px; border-radius:10px;}
    .btn-outline:hover{background:rgba(255,255,255,.1);}
  `;
  document.head.appendChild(css);
})();
