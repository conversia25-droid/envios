// layout.js — injeta sidebar + main-content (sem duplicar) e garante altura total
(function () {
  if (window.__LAYOUT_APPLIED__) return;
  if (document.querySelector('.app-shell')) return;
  window.__LAYOUT_APPLIED__ = true;

  // cria shell
  const shell = document.createElement('div');
  shell.className = 'app-shell';

  // move tudo que já está no body para o <main>
  const main = document.createElement('main');
  main.className = 'main-content';
  while (document.body.firstChild) {
    main.appendChild(document.body.firstChild);
  }

  // sidebar
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
      <div class="side-footer">© 2025 Paiva Advogados</div>
    </div>
  `;

  shell.appendChild(aside);
  shell.appendChild(main);
  document.body.appendChild(shell);

  // link ativo
  const path = (location.pathname || '').split('/').pop().toLowerCase();
  document.querySelectorAll('.side-nav a').forEach(a => {
    const href = (a.getAttribute('href') || '').toLowerCase();
    if (href && path && href.endsWith(path)) a.classList.add('active');
  });

  // CSS — foco total em altura correta em todos os browsers
  const css = document.createElement('style');
  css.textContent = `
    /* === ALTURA TOTAL SEM CORTE === */
    html, body { height: auto; min-height: 100%; margin: 0; padding: 0; overflow: auto; }
    /* cobre diferentes engines: */
    :root { --vh: 100vh; --dvh: 100dvh; --svh: 100svh; }
    body { background: var(--fundo-geral, #f8fafc); }

    /* container principal */
    .app-shell{
      display: grid;
      grid-template-columns: 260px 1fr;
      /* tenta dvh/svh/vh nessa ordem; cai pra auto se não suportar */
      min-height: var(--dvh, 100dvh);
      min-height: var(--svh, 100svh);
      min-height: var(--vh, 100vh);
      min-height: 100vh;
      height: auto;
      align-items: stretch; /* evita encolher colunas */
    }

    @media (max-width: 980px) {
      .app-shell { grid-template-columns: 1fr; }
    }

    /* sidebar sempre cobrindo a altura visível; não limita verticalmente conteúdo */
    .sidebar-app { position: relative; z-index: 2; }
    .sidebar-card{
      background: #1b1b4d;
      color: #fff;
      /* ocupa pelo menos a viewport, e cresce junto com o conteúdo ao lado */
      min-height: var(--dvh, 100dvh);
      min-height: var(--svh, 100svh);
      min-height: var(--vh, 100vh);
      min-height: 100vh;
      height: 100%;
      padding: 20px 16px;
      border-right: 1px solid rgba(255,255,255,0.1);
      display: flex; flex-direction: column;
      position: sticky; top: 0;
    }

    @media (max-width: 980px) {
      .sidebar-card{
        position: static;
        min-height: auto;
        height: auto;
        border-right: none;
        border-bottom: 1px solid rgba(0,0,0,.08);
      }
    }

    .brand{ font-weight: 800; font-size: 1.3rem; margin-bottom: 16px; }
    .side-nav{ display: flex; flex-direction: column; gap: 8px; }
    .side-nav a{
      display: flex; align-items: center; gap: 10px;
      color: #fff; text-decoration: none;
      padding: 10px 12px; border-radius: 10px; font-weight: 600;
      transition: background .2s;
    }
    .side-nav a:hover{ background: rgba(255,255,255,0.1); }
    .side-nav a.active{ background: #0a8f83; }
    .side-footer{ margin-top: auto; opacity: .65; font-size: .85rem; text-align: center; }

    /* área de conteúdo: puxa a altura toda, mas cresce com o conteúdo */
    .main-content{
      padding: 24px;
      background: var(--fundo-claro, #f8fafc);
      min-height: var(--dvh, 100dvh);
      min-height: var(--svh, 100svh);
      min-height: var(--vh, 100vh);
      min-height: 100vh;
      height: auto;
      box-sizing: border-box;
      overflow: visible; /* evita recorte por overflow em algum reset */
    }

    /* proteção extra contra cortes por max-height herdado */
    .app-shell, .sidebar-app, .sidebar-card, .main-content {
      max-height: none !important;
    }
  `;
  document.head.appendChild(css);
})();
