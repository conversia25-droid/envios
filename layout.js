// layout.js — protege páginas e injeta a sidebar
(function () {
  const isLogin = /(^|\/)login(\.html)?(\?|#|$)/i.test(location.pathname);

  // Espera AUTH (se existir) no máximo 1s
  function waitForAUTH(maxMs = 1000) {
    return new Promise(resolve => {
      const t0 = Date.now();
      (function tick() {
        if (window.AUTH && (AUTH.isLoggedIn || AUTH.waitForAuth)) return resolve(true);
        if (Date.now() - t0 > maxMs) return resolve(false);
        setTimeout(tick, 40);
      })();
    });
  }

  async function guard() {
    if (isLogin) return mount();

    // 1) Se AUTH existir e tiver waitForAuth, espera decidir
    if (window.AUTH && typeof AUTH.waitForAuth === "function") {
      try { await AUTH.waitForAuth(); } catch {}
    } else {
      // 2) Caso AUTH ainda não exista, aguarda um pouco
      await waitForAUTH(1000);
    }

    // 3) Checagem de login (via AUTH ou via localStorage)
    const logged =
      (window.AUTH && typeof AUTH.isLoggedIn === "function" && AUTH.isLoggedIn()) ||
      !!localStorage.getItem("userEmail");

    if (!logged) {
      // redireciona para login da MESMA pasta (compatível com GitHub Pages)
      const here = location.pathname;
      const base = here.slice(0, here.lastIndexOf("/") + 1);
      const next = here.split("/").pop() || "index.html";
      location.replace(base + "login.html?next=" + encodeURIComponent(next));
      return;
    }

    mount();
  }

  function mount() {
    if (isLogin) return;               // login.html não injeta layout
    if (window.__LAYOUT_APPLIED__) return;
    if (document.querySelector(".app-shell")) return;
    window.__LAYOUT_APPLIED__ = true;

    // cria container
    const shell = document.createElement("div");
    shell.className = "app-shell";

    const main = document.createElement("main");
    main.className = "main-content";
    while (document.body.firstChild) main.appendChild(document.body.firstChild);

    const aside = document.createElement("aside");
    aside.className = "sidebar-app";

    const userEmail = (window.AUTH && AUTH.getUser && (AUTH.getUser()?.email)) || localStorage.getItem("userEmail") || "Usuário";
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
          <div style="opacity:.8; font-size:.9rem; margin-bottom:8px;">${userEmail}</div>
          <button id="logout-btn" class="btn btn-outline" style="width:100%;">Sair</button>
          <div style="margin-top:10px; opacity:.65; font-size:.85rem;">© 2025 Paiva Advogados</div>
        </div>
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

    // sair
    const out = aside.querySelector('#logout-btn');
    if (out) out.addEventListener('click', () => {
      if (window.AUTH && typeof AUTH.logout === "function") AUTH.logout();
      localStorage.removeItem("userEmail");
      // volta para login da MESMA pasta
      const here = location.pathname;
      const base = here.slice(0, here.lastIndexOf("/") + 1);
      location.href = base + "login.html";
    });

    // CSS mínimo de layout (mantém página em altura inteira)
    const css = document.createElement("style");
    css.textContent = `
      html, body { height:auto; min-height:100%; margin:0; padding:0; }
      :root { --vh:100vh; --dvh:100dvh; --svh:100svh; }
      body { background: var(--fundo-geral, #f8fafc); }

      .app-shell{
        display:grid; grid-template-columns:260px 1fr;
        min-height: var(--dvh, 100dvh);
        min-height: var(--svh, 100svh);
        min-height: var(--vh, 100vh);
        min-height: 100vh;
        align-items:stretch;
      }
      @media (max-width: 980px){ .app-shell{ grid-template-columns:1fr; } }

      .sidebar-card{
        background:#1b1b4d; color:#fff;
        min-height: var(--dvh, 100dvh);
        min-height: 100vh;
        padding:20px 16px; border-right:1px solid rgba(255,255,255,.1);
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
        min-height: 100vh;
        box-sizing:border-box;
      }

      .btn{cursor:pointer}
      .btn-outline{background:transparent; color:#fff; border:1px solid rgba(255,255,255,.35); padding:8px 10px; border-radius:10px;}
      .btn-outline:hover{background:rgba(255,255,255,.1);}
    `;
    document.head.appendChild(css);
  }

  guard();
})();

})();

