// =======================================================
// Configurações da Evolution API (MANTIDAS apenas para Instâncias.html)
// =======================================================
const EVOLUTION_API_URL = "https://evoconversia.zapcompany.com.br";
const API_KEY = "429683C4C977415CAAFCCE10F7D57E11";

// Webhook padrão (n8n) - Usado SOMENTE para notificação de CAMPANHA
const DEFAULT_WEBHOOK_URL = "https://conversia-n8n.njuzo4.easypanel.host/webhook/campanhablack";

let connectionIntervalId;

// =======================================================
// Helpers HTTP (Usado apenas para Instâncias.html)
// =======================================================
function api(path, options = {}) {
  const base = EVOLUTION_API_URL.replace(/\/+$/, "");
  const cleanedPath = String(path).replace(/^\/+/, "");
  const url = `${base}/${cleanedPath}`;
  // Headers específicos para a Evolution API
  const headers = { apikey: API_KEY, "Content-Type": "application/json", ...(options.headers || {}) };
  return fetch(url, { mode: "cors", ...options, headers });
}
async function readSafeText(res) { try { return await res.text(); } catch { return ""; } }

// Pequeno helper p/ IDs seguros
function _slugId(name) {
  return 'inst-' + String(name).replace(/[^a-zA-Z0-9_-]/g, '_');
}

// =======================================================
// QR / Pairing helpers (Funções Auxiliares para Instâncias.html)
// [ ... Código Auxiliar Omitido por Brevidade, mas Mantido no Arquivo Real ... ]
// =======================================================
function resolveQrImageFromPayload(payload) {
  if (!payload) return null;
  const candidates = [
    payload?.qrcode?.base64, payload?.qrcode?.data, payload?.base64, payload?.qrcode,
    payload?.qrCodeBase64, payload?.qrCode, payload?.qr, payload?.image, payload?.qrCodeImage, payload?.qrImage,
  ];
  for (let c of candidates) {
    if (!c || typeof c !== "string") continue;
    const val = c.trim();
    if (val.startsWith("data:image")) {
      const justHeader = /^data:image\/[a-zA-Z0-9.+-]+;base64,?$/i.test(val);
      if (!justHeader) return val;
      continue;
    }
    if (/^https?:\/\//i.test(val)) return val;
    if (/^[A-Za-z0-9+/=]+$/.test(val) && val.length > 100) return `data:image/png;base64,${val}`;
  }
  if (typeof payload === "string") { try { return resolveQrImageFromPayload(JSON.parse(payload)); } catch {} }
  return null;
}
function resolvePairingCodeFromPayload(payload) {
  if (!payload) return null;
  const candidates = [payload?.qrcode?.pairingCode, payload?.pairingCode, payload?.qrcode?.code, payload?.code].filter(Boolean);
  for (const c of candidates) if (typeof c === "string" && c.trim()) return c.trim();
  return null;
}
let qrCountdownTimer = null;
function ensureQrToolbar() {
  let tb = document.getElementById("qr-toolbar");
  if (!tb) {
    const qrStatus = document.getElementById("qr-status-message");
    tb = document.createElement("div");
    tb.id = "qr-toolbar";
    tb.style.marginTop = "8px";
    tb.style.display = "flex";
    tb.style.alignItems = "center";
    tb.style.gap = "8px";
    tb.innerHTML = `
      <button id="qr-refresh-btn" class="btn btn-outline" type="button">Atualizar QR</button>
      <span id="qr-countdown" class="muted"></span>
    `;
    const host = qrStatus?.parentNode || document.body;
    host.insertBefore(tb, qrStatus ? qrStatus.nextSibling : null);
  }
  const refreshBtn = document.getElementById("qr-refresh-btn");
  if (refreshBtn) {
    refreshBtn.onclick = () => {
      const name = document.getElementById("modal-instance-name")?.textContent?.trim();
      if (name) connectInstance(name);
    };
  }
  return tb;
}
function startQrCountdown(expiresAtMs) {
  ensureQrToolbar();
  const el = document.getElementById("qr-countdown");
  if (qrCountdownTimer) { clearInterval(qrCountdownTimer); qrCountdownTimer = null; }
  if (!expiresAtMs || !el) { if (el) el.textContent = ""; return; }
  qrCountdownTimer = setInterval(() => {
    const diff = expiresAtMs - Date.now();
    if (diff <= 0) {
      el.textContent = "⚠️ QR expirado. Clique “Atualizar QR”.";
      clearInterval(qrCountdownTimer);
      qrCountdownTimer = null;
      return;
    }
    const s = Math.ceil(diff / 1000);
    el.textContent = s <= 10 ? `⚠️ expira em ${s}s` : `expira em ${s}s`;
  }, 1000);
}
function stopQrCountdown() {
  const el = document.getElementById("qr-countdown");
  if (el) el.textContent = "";
  if (qrCountdownTimer) { clearInterval(qrCountdownTimer); qrCountdownTimer = null; }
}
function ensurePairingDom() {
  let pairingWrap = document.getElementById("pairing-wrap");
  if (!pairingWrap) {
    const qrStatus = document.getElementById("qr-status-message");
    pairingWrap = document.createElement("div");
    pairingWrap.id = "pairing-wrap";
    pairingWrap.style.display = "none";
    pairingWrap.style.marginTop = "12px";
    pairingWrap.innerHTML = `
      <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
        <div id="pairing-title" style="font-weight:700;">Código de pareamento</div>
        <div id="pairing-countdown" style="color:#666; font-size:0.9rem;"></div>
      </div>
      <div style="display:flex; align-items:center; gap:10px; margin-top:8px;">
        <pre id="pairing-code" style="
          font-size:22px; letter-spacing:2px; padding:10px 12px;
          background:#f5f5f5; border:1px solid #e0e0e0; border-radius:8px; margin:0;
        ">—</pre>
        <button id="pairing-copy" class="btn btn-secondary" type="button">Copiar</button>
        <button id="pairing-refresh" class="btn btn-primary" type="button">Gerar novo</button>
      </div>
      <div style="margin-top:8px; color:#555; font-size:0.95rem;">
        No WhatsApp: <b>Dispositivos conectados → Conectar com código</b> e digite este código.
      </div>
    `;
    const host = qrStatus?.parentNode || document.body;
    host.insertBefore(pairingWrap, qrStatus ? qrStatus.nextSibling : null);
  }
  const refreshBtn = document.getElementById("pairing-refresh");
  if (refreshBtn) {
    refreshBtn.onclick = () => {
      const name = document.getElementById("modal-instance-name")?.textContent?.trim();
      if (name) connectInstance(name);
    };
  }
  return pairingWrap;
}
let pairingCountdownTimer = null;
function showPairingCode(code, expiresAtMs) {
  const pairingWrap = ensurePairingDom();
  const codeEl = document.getElementById("pairing-code");
  const copyBtn = document.getElementById("pairing-copy");
  const countdownEl = document.getElementById("pairing-countdown");

  if (codeEl) codeEl.textContent = code || "—";
  pairingWrap.style.display = "block";

  if (copyBtn) {
    copyBtn.onclick = async () => {
      try {
        await navigator.clipboard.writeText(codeEl.textContent.trim());
        copyBtn.textContent = "Copiado!";
        setTimeout(() => (copyBtn.textContent = "Copiar"), 1200);
      } catch { alert("Não foi possível copiar. Copie manualmente."); }
    };
  }
  if (pairingCountdownTimer) { clearInterval(pairingCountdownTimer); pairingCountdownTimer = null; }
  if (expiresAtMs && countdownEl) {
    pairingCountdownTimer = setInterval(() => {
      const diff = expiresAtMs - Date.now();
      if (diff <= 0) { countdownEl.textContent = " (expirado)"; clearInterval(pairingCountdownTimer); return; }
      const s = Math.ceil(diff / 1000);
      countdownEl.textContent = ` (expira em ${s}s)`;
    }, 1000);
  } else if (countdownEl) countdownEl.textContent = "";
}
function hidePairingCode() {
  const pairingWrap = document.getElementById("pairing-wrap");
  if (pairingWrap) pairingWrap.style.display = "none";
  const countdownEl = document.getElementById("pairing-countdown");
  if (countdownEl) countdownEl.textContent = "";
  if (pairingCountdownTimer) { clearInterval(pairingCountdownTimer); pairingCountdownTimer = null; }
}
async function tryGetQRCode(instanceName) {
  const base = encodeURIComponent(instanceName);
  const paths = [
    `instance/qr/${base}`, `instance/qrcode/${base}`,
    `instance/qr/${base}?format=base64`, `instance/qrcode/${base}?format=base64`,
    `instance/qr/${base}?type=image`, `instance/qrcode/${base}?type=image`,
  ];
  for (const p of paths) {
    try {
      const res = await api(p, { method: "GET" });
      if (!res.ok) continue;
      const text = await readSafeText(res);
      let json = null; try { json = JSON.parse(text); } catch {}
      const src = resolveQrImageFromPayload(json ?? text);
      if (src) { return src; }
    } catch {}
  }
  return null;
}
async function safeConnectFlow(instanceName) {
  let res = await api(`instance/connect/${encodeURIComponent(instanceName)}?linkingMethod=qr`, { method: "GET" });
  let txt = await readSafeText(res);
  let asJson = null; try { asJson = JSON.parse(txt); } catch {}
  if (!res.ok) {
    const statusBody = asJson?.status || asJson?.connectionStatus || "";
    if (/(close|closed|disconnected)/i.test(statusBody)) {
      try { await api(`instance/restart/${encodeURIComponent(instanceName)}`, { method: "GET" }); } catch {}
      res = await api(`instance/connect/${encodeURIComponent(instanceName)}?linkingMethod=qr`, { method: "GET" });
      txt = await readSafeText(res);
      try { asJson = JSON.parse(txt); } catch { asJson = null; }
    }
  }
  return { res, txt, asJson };
}

// =======================================================
// INSTÂNCIAS (Funções de Gerenciamento)
// =======================================================
window.createInstance = async function(instanceName) {
  const messageElement = document.getElementById("create-instance-message");
  const createButton = document.getElementById("create-instance-button");
  if (messageElement) messageElement.textContent = "Enviando requisição...";
  if (createButton) createButton.disabled = true;
  const payload = { instanceName, qrcode: true, integration: "WHATSAPP-BAILEYS" };
  try {
    const res = await api("instance/create", { method: "POST", body: JSON.stringify(payload) });
    const txt = await readSafeText(res);
    let data = {}; try { data = JSON.parse(txt || "{}"); } catch {}
    if (!res.ok || data.status !== 200) throw new Error(data.message || txt || "Erro ao criar instância.");
    if (messageElement) messageElement.innerHTML = `<span style="color: green;">✅ Instância "${instanceName}" criada.</span>`;
    await connectInstance(instanceName);
  } catch (error) {
    console.error("Erro ao criar instância:", error);
    if (messageElement) messageElement.innerHTML = `<span style="color: red;">❌ ${error.message}</span>`;
  } finally {
    if (createButton) createButton.disabled = false;
  }
};

window.deleteInstance = async function(instanceName) {
  if (!confirm(`Tem certeza que deseja DELETAR a instância "${instanceName}"? Essa ação é irreversível.`)) return;
  try {
    let res = await api(`instance/delete/${encodeURIComponent(instanceName)}`, { method: "DELETE" });
    if (!res.ok) { res = await api(`instance/remove/${encodeURIComponent(instanceName)}`, { method: "DELETE" }); }
    if (!res.ok) {
      const txt = await readSafeText(res);
      throw new Error(`HTTP ${res.status}: ${txt.slice(0, 180)}`);
    }
  } catch (e) {
    alert("Falha ao deletar: " + e.message);
  } finally {
    fetchInstances();
  }
};

window.connectInstance = async function(instanceName) {
  const modal = document.getElementById("qr-modal");
  const modalName = document.getElementById("modal-instance-name");
  const qrStatus = document.getElementById("qr-status-message");
  const qrImage = document.getElementById("qrcode-image");
  if (connectionIntervalId) clearInterval(connectionIntervalId);
  stopQrCountdown();
  hidePairingCode();

  const setMsg = (t, type = "info") => {
    if (!qrStatus) return;
    qrStatus.style.color = type === "error" ? "red" : (type === "success" ? "green" : "black");
    qrStatus.innerHTML = t;
  };

  if (!modalName || !qrImage) return;
  modalName.textContent = instanceName;
  setMsg("Iniciando a sessão...", "info");
  qrImage.style.display = "none";
  qrImage.src = "";
  ensureQrToolbar();
  if (modal) modal.style.display = "block";

  try {
    const { res, txt, asJson } = await safeConnectFlow(instanceName);

    const imgSrc = resolveQrImageFromPayload(asJson) || resolveQrImageFromPayload(txt);
    const pairingCode = resolvePairingCodeFromPayload(asJson) || resolvePairingCodeFromPayload(txt);
    const expiresAt = asJson?.qrcode?.expiresAt || asJson?.qrcode?.expireAt;
    const expiresAtMs = expiresAt ? new Date(expiresAt).getTime() : undefined;

    if (imgSrc) {
      setMsg("Escaneie o QR Code abaixo:");
      qrImage.src = imgSrc;
      qrImage.style.display = "block";
      hidePairingCode();
      startQrCountdown(expiresAtMs);
      checkConnectionStatus(instanceName);
      return;
    }
    if (pairingCode) {
      setMsg("Conecte-se com o código de pareamento:");
      showPairingCode(pairingCode, expiresAtMs);
      qrImage.style.display = "none";
      checkConnectionStatus(instanceName);
      return;
    }
    if (!res.ok) {
      const serverMsg = asJson?.message || asJson?.error || txt || `HTTP ${res.status}`;
      setMsg(`❌ Erro ao conectar: ${serverMsg}`, "error");
      return;
    }
    setMsg("Sessão iniciada. Gerando QR/Código...", "info");
    checkConnectionStatus(instanceName);
  } catch (error) {
    setMsg(`❌ Erro ao conectar: ${error.message}`, "error");
    console.error("Erro de conexão:", error);
  }
};

function checkConnectionStatus(instanceName) {
  const qrStatus = document.getElementById("qr-status-message");
  const qrImage = document.getElementById("qrcode-image");
  if (!qrStatus || !qrImage) { if (connectionIntervalId) clearInterval(connectionIntervalId); return; }

  const showQR = (src, expiresAtMs) => {
    hidePairingCode();
    qrStatus.innerHTML = "Escaneie o QR Code abaixo:";
    qrImage.src = src;
    qrImage.style.display = "block";
    startQrCountdown(expiresAtMs);
  };
  const hideQR = (msg) => {
    qrStatus.innerHTML = msg || "Aguardando QR Code...";
    qrImage.style.display = "none";
    qrImage.src = "";
    stopQrCountdown();
  };

  if (connectionIntervalId) clearInterval(connectionIntervalId);
  connectionIntervalId = setInterval(async () => {
    try {
      const res = await api(`instance/connectionState/${encodeURIComponent(instanceName)}`, { method: "GET" });
      const text = await readSafeText(res);
      let state = null; try { state = JSON.parse(text); } catch { state = {}; }
      const status = state?.connectionStatus || state?.status || "unknown";

      if (["open"].includes(status)) {
        hideQR("✅ CONECTADO!");
        clearInterval(connectionIntervalId);
        fetchInstances();
        const modal = document.getElementById("qr-modal");
        stopQrCountdown();
        if (modal) setTimeout(() => (modal.style.display = "none"), 1200);
        return;
      }

      if (["connecting", "PAIRING", "qrcode", "QR"].includes(status)) {
        let src = resolveQrImageFromPayload(state) || resolveQrImageFromPayload(text);
        const expiresAt = state?.qrcode?.expiresAt || state?.qrcode?.expireAt;
        const expiresAtMs = expiresAt ? new Date(expiresAt).getTime() : undefined;
        if (src) { showQR(src, expiresAtMs); return; }

        const pairingCode = resolvePairingCodeFromPayload(state) || resolvePairingCodeFromPayload(text);
        if (pairingCode) { hideQR("Conecte-se com o código de pareamento:"); showPairingCode(pairingCode, expiresAtMs); return; }

        src = await tryGetQRCode(instanceName);
        if (src) { showQR(src); return; }

        hidePairingCode();
        hideQR("Gerando QR/Código de pareamento...");
        return;
      }

      hidePairingCode();
      hideQR(`Status: ${status}. Aguardando...`);
    } catch (error) {
      console.error("Polling error:", error);
      hidePairingCode();
      hideQR("Falha ao verificar status.");
      clearInterval(connectionIntervalId);
    }
  }, 4000);
}

window.logoutInstance = async function(instanceName) {
  try {
    const res = await api(`instance/logout/${encodeURIComponent(instanceName)}`, { method: "DELETE" });
    if (!res.ok) {
      const txt = await readSafeText(res);
      throw new Error(`HTTP ${res.status}: ${txt.slice(0, 180)}`);
    }
  } catch (e) { console.error("Erro no logout:", e); }
  finally { fetchInstances(); }
};

async function fetchInstances() {
  const root = document.getElementById("instances-grid");
  const openEl = document.getElementById("summary-open");
  const connectingEl = document.getElementById("summary-connecting");
  const closeEl = document.getElementById("summary-close");

  if (root) {
    root.innerHTML = `
      <div class="instance-card">
        <div class="instance-title muted">Carregando instâncias...</div>
      </div>`;
  }
  if (openEl) openEl.textContent = "—";
  if (connectingEl) connectingEl.textContent = "—";
  if (closeEl) closeEl.textContent = "—";

  try {
    const res = await api("instance/fetchInstances", { method: "GET" });
    if (!res.ok) { const txt = await readSafeText(res); throw new Error(`HTTP ${res.status}: ${txt.slice(0,180)}`); }
    const data = await res.json();
    const list = Array.isArray(data) ? data : [];

    const norm = (s) => String(s || '').toLowerCase();
    list.sort((a,b) => norm(a.name).localeCompare(norm(b.name)));

    const groups = {
      open:        { title: "Conectadas",      items: [] },
      connecting:  { title: "Aguardando QR",   items: [] },
      close:       { title: "Close / Closed",  items: [] }
    };
    list.forEach(inst => {
      const s = norm(inst.connectionStatus);
      if (s === "open") groups.open.items.push(inst);
      else if (["connecting","qrcode","qr","pairing"].includes(s)) groups.connecting.items.push(inst);
      else groups.close.items.push(inst);
    });

    if (openEl) openEl.textContent = String(groups.open.items.length);
    if (connectingEl) connectingEl.textContent = String(groups.connecting.items.length);
    if (closeEl) closeEl.textContent = String(groups.close.items.length);

    if (root) {
      const makeSection = (title, items) => {
        const wrap = document.createElement('section');
        wrap.className = 'inst-section';
        wrap.innerHTML = `<h3 class="inst-section-title">${title}</h3><div class="instances-grid"></div>`;
        const grid = wrap.querySelector('.instances-grid');

        if (!items.length) {
          grid.innerHTML = `<div class="instance-card"><div class="muted">Nenhuma nesta seção.</div></div>`;
          return wrap;
        }

        items.forEach(instance => {
          const name = instance.name;
          const sraw = norm(instance.connectionStatus);
          const isOpen = sraw === 'open';
          const isConn = ["connecting","qrcode","qr","pairing"].includes(sraw);
          const statusText = isOpen ? "Conectada" : (isConn ? "Aguardando QR" : (instance.connectionStatus || "Indefinido"));
          const badgeClass = isOpen ? "badge-open" : (isConn ? "badge-connecting" : "badge-error");

          const card = document.createElement('div');
          card.className = 'instance-card';
          card.innerHTML = `
            <div class="instance-title">${name}</div>
            <div class="instance-status ${badgeClass}"><span>${statusText}</span></div>
            <div class="instance-actions">
              <button class="btn btn-outline" onclick="event.stopPropagation(); connectInstance('${name}')">Conectar/Ver QR</button>
              <button class="btn btn-secondary" onclick="event.stopPropagation(); logoutInstance('${name}')">Logout</button>
              <button class="btn btn-danger" onclick="event.stopPropagation(); deleteInstance('${name}')">Deletar</button>
            </div>
          `;
          card.addEventListener('click', () => connectInstance(name));
          grid.appendChild(card);
        });

        return wrap;
      };

      root.innerHTML = "";
      root.appendChild(makeSection(groups.open.title, groups.open.items));
      root.appendChild(makeSection(groups.connecting.title, groups.connecting.items));
      root.appendChild(makeSection(groups.close.title, groups.close.items));
    }
  } catch (err) {
    console.error("Erro ao buscar instâncias:", err);
    if (root) {
      root.innerHTML = `
        <div class="instance-card">
          <div class="instance-title danger">Falha ao carregar instâncias</div>
          <div class="muted" style="margin-top:6px;">${err.message}</div>
        </div>`;
    }
    if (openEl) openEl.textContent = "0";
    if (connectingEl) connectingEl.textContent = "0";
    if (closeEl) closeEl.textContent = "0";
  }
}

async function getApiStatus() {
  const apiStatusEl = document.getElementById("api-status");
  if (apiStatusEl) apiStatusEl.textContent = "Testando...";
  try {
    const res = await api("instance/fetchInstances", { method: "GET" });
    if (res.ok) {
      if (apiStatusEl) apiStatusEl.innerHTML = `<span class="success">Online</span>`;
    } else {
      if (apiStatusEl) apiStatusEl.innerHTML = `<span class="danger">Offline</span>`;
    }
  } catch {
    if (apiStatusEl) apiStatusEl.innerHTML = `<span class="danger">Offline</span>`;
  }
  await fetchInstances();
}

// =======================================================
// DISPAROS — preencher instâncias conectadas (checkboxes)
// =======================================================
async function fetchInstancesForDisparos() {
  const grid = document.getElementById('instance-checkboxes');
  const hint = document.getElementById('instance-checkboxes-hint');

  if (grid) grid.innerHTML = `<div class="muted">Carregando instâncias...</div>`;

  try {
    const res = await api('instance/fetchInstances', { method: 'GET' });
    if (!res.ok) {
      const txt = await readSafeText(res);
      throw new Error(`HTTP ${res.status}: ${txt.slice(0,180)}`);
    }
    const data = await res.json();
    const list = Array.isArray(data) ? data : [];
    const openList = list
      .filter(i => String(i.connectionStatus || '').toLowerCase() === 'open')
      .sort((a,b) => String(a.name||'').localeCompare(String(b.name||'')));

    if (!grid) return;

    if (!openList.length) {
      grid.innerHTML = `<div class="muted">Nenhuma instância conectada no momento.</div>`;
      if (hint) hint.textContent = 'Não há instâncias conectadas.';
    } else {
      grid.innerHTML = '';
      openList.forEach(inst => {
        const safeId = _slugId(inst.name);
        // Garante que a primeira instância seja marcada por padrão
        const isChecked = openList.length === 1 || openList[0].name === inst.name ? 'checked' : ''; 
        grid.insertAdjacentHTML('beforeend', `
          <div class="form-check">
            <label for="${safeId}">
              <input type="checkbox" id="${safeId}" name="instances" value="${inst.name}" ${isChecked}>
              <span>${inst.name}</span>
            </label>
          </div>
        `);
      });
      if (hint) hint.textContent = `Marque as instâncias que serão enviadas para o n8n.`;
    }
  } catch (err) {
    console.error('Erro ao buscar instâncias (Disparos):', err);
    if (grid) grid.innerHTML = `<div class="danger">Falha ao carregar instâncias: ${err.message}</div>`;
    if (hint) hint.textContent = 'Falha ao carregar as instâncias.';
  }
}

if (typeof addMessageField !== 'function') {
  window.addMessageField = function () {
    const cont = document.getElementById('message-config-container');
    if (!cont) return;
    const idx = cont.querySelectorAll('.message-box').length + 1;
    const box = document.createElement('div');
    box.className = 'message-box';
    box.innerHTML = `
      <div class="form-group">
        <label class="muted">Mensagem ${idx}</label>
        <textarea placeholder="Digite sua mensagem..."></textarea>
      </div>`;
    cont.appendChild(box);
  };
}

// =======================================================
// LÓGICA DE ENVIO EM MASSA (FINAL: Apenas notifica o n8n)
// =======================================================
if (typeof sendBulkMessages !== 'function') {
  window.sendBulkMessages = async function () {
    const status = document.getElementById('send-status');
    const smsg = document.getElementById('status-message');
    const pmsg = document.getElementById('progress-message');
    const sendBtn = document.getElementById('send-bulk-btn');

    // Funções auxiliares para atualizar o UI
    const updateStatus = (message, isError = false) => {
        if (smsg) {
            smsg.textContent = message;
            smsg.className = isError ? 'danger' : 'success';
        }
    };
    const updateProgress = (message, isError = false) => {
        if (pmsg) {
            pmsg.textContent = message;
            pmsg.className = isError ? 'danger' : 'muted';
        }
    };

    // 1. Coleta e Validação dos dados do formulário
    const instanceNames = Array.from(document.querySelectorAll('input[name="instances"]:checked')).map(el => el.value);
    const leadList = document.getElementById('lead-list').value;
    const delay = document.getElementById('delay-time-seconds').value || 2;
    const messages = Array.from(document.querySelectorAll('.message-box textarea'))
        .map(el => el.value)
        .filter(text => text.trim() !== '');

    if (instanceNames.length === 0) {
        alert('Selecione pelo menos uma instância conectada.');
        return;
    }
    if (!leadList.trim()) {
        alert('A lista de leads está vazia.');
        return;
    }
    if (messages.length === 0) {
        alert('Adicione pelo menos uma mensagem.');
        return;
    }
    
    const numbers = leadList.split('\n')
        .map(n => n.trim().replace(/\D/g, '')) // Limpa e formata os números
        .filter(n => n.length > 5); 
    
    if (numbers.length === 0) {
        alert('Nenhum número de telefone válido foi encontrado na lista de leads.');
        return;
    }
    
    // Configura a UI para o início do envio
    if (status) status.style.display = 'block';
    updateStatus('Iniciando notificação da campanha...', false);
    updateProgress(`Notificando Webhook (n8n) com ${numbers.length} leads.`, false);
    sendBtn.disabled = true;

    // ===============================================================
    // ÚNICO PASSO: POST para o Webhook (n8n) - DADOS LIMPOS
    // ===============================================================
    const n8nPayload = {
        // Dados Limpos para o n8n
        instanceName: instanceNames[0], // A primeira instância selecionada
        delaySeconds: Number(delay),
        messages: messages,
        leadCount: numbers.length,
        numbers: numbers, // Lista de leads completa
        instances: instanceNames, // Lista de todas as instâncias selecionadas
        source: 'Paiva Dashboard - Bulk Send',
    };

    try {
        console.log(`[Webhook Send] Enviando para: ${DEFAULT_WEBHOOK_URL}`);
        console.log(`[Webhook Send] Payload: `, n8nPayload);
        
        // Chamada customizada para o webhook, SEM usar o 'api' helper da Evolution
        const n8nRes = await fetch(DEFAULT_WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(n8nPayload)
        });

        if (n8nRes.ok) {
            updateStatus('✅ Webhook (n8n) notificado com sucesso!', false);
            updateProgress(`O n8n recebeu os dados da campanha para processamento. Status: HTTP ${n8nRes.status}.`, false);
        } else {
            const n8nError = await readSafeText(n8nRes);
            console.error(`Falha ao notificar n8n (${DEFAULT_WEBHOOK_URL}):`, n8nError);
            updateStatus('❌ ERRO: Falha ao notificar o Webhook (n8n).', true);
            updateProgress(`Status: HTTP ${n8nRes.status}. Verifique o log do seu n8n.`, true);
        }

    } catch (error) {
        console.error('Erro de rede ao chamar o Webhook (n8n):', error);
        updateStatus('❌ ERRO: Falha de rede ao notificar o Webhook (n8n).', true);
        updateProgress(`Detalhe do erro: ${error.message}.`, true);
    } finally {
        sendBtn.disabled = false;
    }
  };
}


// =======================================================
// Inicialização
// =======================================================
window.addEventListener('load', () => {
  const path = (location.pathname || '').toLowerCase();

  if (path.includes('instancias.html')) {
    getApiStatus();
  }

  if (path.includes('disparos.html')) {
    if (typeof getApiStatus === "function") getApiStatus();
    fetchInstancesForDisparos();
    if (typeof addMessageField === 'function') { try { addMessageField(); } catch {} }
    const sendBtn = document.getElementById('send-bulk-btn');
    if (sendBtn && typeof sendBulkMessages === 'function') sendBtn.addEventListener('click', sendBulkMessages);
    const addBtn = document.getElementById('add-message-btn');
    if (addBtn && typeof addMessageField === 'function') addBtn.addEventListener('click', addMessageField);
  }
});