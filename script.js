/* =======================================================
   script.js — COMPLETO (Mensagens | Imagem | Vídeo)
   - Multi-tenant (lê evolutionApiUrl/apiKey/webhook do AUTH.getTenant())
   - Gestão de instâncias (listar/criar/conectar/QR/pareamento/logout/deletar)
   - Disparos: lista instâncias conectadas e envia campanha
   - IMAGEM/VÍDEO opcionais:
        -> upload para Supabase Storage (bucket público) OU URL direta já pública
   - Auto-init por página
   ======================================================= */

/* ======== CONFIG DINÂMICA POR TENANT ======== */
function __getTenantCfg() {
  const t = (window.AUTH && AUTH.getTenant && AUTH.getTenant()) || {};
  return {
    EVOLUTION_API_URL:  (t.evolutionApiUrl || "https://evoconversia.zapcompany.com.br").replace(/\/+$/,""),
    API_KEY:            t.apiKey          || "429683C4C977415CAAFCCE10F7D57E11",
    DEFAULT_WEBHOOK_URL:t.webhookUrl      || "https://conversia-n8n.njuzo4.easypanel.host/webhook/campanhablack",
    LABEL:              t.label || t.id || "—"
  };
}

/* ======== HTTP helpers ======== */

/* =======================================================
   CONFIG: Tenant + Overrides (Admin)
   - Se existir localStorage.EVO_URL_OVERRIDE / EVO_KEY_OVERRIDE para o tenant atual,
     usa esses valores na frente do auth.js
   ======================================================= */
function __getTenantCfg(){
  try{
    const t = (window.AUTH && AUTH.getTenant && AUTH.getTenant()) || {};
    const id = t.id || 'prod';
    const EVO_URL = localStorage.getItem('EVO_URL_OVERRIDE__'+id) || t.evolutionApiUrl || (t.EVOLUTION_API_URL);
    const APIKEY  = localStorage.getItem('EVO_KEY_OVERRIDE__'+id) || t.apiKey || (t.API_KEY);
    return {
      EVOLUTION_API_URL: String(EVO_URL || '').replace(/\/+$/,'') || 'https://evoconversia.zapcompany.com.br',
      API_KEY: APIKEY || '',
      DEFAULT_WEBHOOK_URL: t.webhookUrl || '',
      LABEL: t.label || id
    };
  }catch(e){
    return { EVOLUTION_API_URL: 'https://evoconversia.zapcompany.com.br', API_KEY: '', DEFAULT_WEBHOOK_URL: '', LABEL:'?' };
  }
}
function api(path, options = {}) {
  const cfg = __getTenantCfg();
  const cleanedPath = String(path).replace(/^\/+/, "");
  const url = `${cfg.EVOLUTION_API_URL}/${cleanedPath}`;
  const headers = { apikey: cfg.API_KEY, "Content-Type": "application/json", ...(options.headers || {}) };
  return fetch(url, { mode: "cors", ...options, headers });
}
async function readSafeText(res) { try { return await res.text(); } catch { return ""; } }

/* ======== Utils ======== */
function _slugId(name) { return 'inst-' + String(name).replace(/[^a-zA-Z0-9_-]/g, '_'); }

// Tipo de envio (fallback pra 'text' se os rádios não existirem ainda)
// Agora suporta text | image | video
function __getSendType() {
  const textOpt  = document.getElementById('send-type-text');
  const imgOpt   = document.getElementById('send-type-image');
  const vidOpt   = document.getElementById('send-type-video');

  if (vidOpt && vidOpt.checked)   return 'video';
  if (imgOpt && imgOpt.checked)   return 'image';
  if (textOpt && textOpt.checked) return 'text';
  return 'text';
}

/* =======================================================
   SUPABASE STORAGE — ajuste BUCKET se quiser
   ======================================================= */
const SB_URL    = "https://kqewpyvikkzwytmzfjhw.supabase.co";  // seu projeto
const SB_KEY    = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtxZXdweXZpa2t6d3l0bXpmamh3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMyNzkyODMsImV4cCI6MjA2ODg1NTI4M30.uooRwmYB8FO4C5wEDzWY2WCAJf61-eG3zhDPOyhThVE"; // anon key
const SB_BUCKET = "whats-media"; // bucket PÚBLICO (imgs e vídeos podem conviver aqui)

/* upload genérico pro Supabase.
   Eu vou separar em duas funções pra clareza semântica:
   - uploadImageToSupabase(file)
   - uploadVideoToSupabase(file)
   Mas as duas fazem praticamente o mesmo, só muda a pastinha. */

async function uploadImageToSupabase(file) {
  if (!file) return "";
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth()+1).padStart(2,'0');
  const d = String(now.getDate()).padStart(2,'0');
  const safeName = (file.name || `img_${Date.now()}.png`).replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `disparos/${y}/${m}/${d}/${Date.now()}_${safeName}`;

  const url = `${SB_URL}/storage/v1/object/${encodeURIComponent(SB_BUCKET)}/${encodeURIComponent(path)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${SB_KEY}`,
      "apikey": SB_KEY,
      "Content-Type": file.type || "application/octet-stream"
    },
    body: file
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Falha no upload da imagem: HTTP ${res.status} – ${txt.slice(0,180)}`);
  }

  return `${SB_URL}/storage/v1/object/public/${SB_BUCKET}/${path}`;
}

async function uploadVideoToSupabase(file) {
  if (!file) return "";
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth()+1).padStart(2,'0');
  const d = String(now.getDate()).padStart(2,'0');
  const safeName = (file.name || `video_${Date.now()}.mp4`).replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `videos/${y}/${m}/${d}/${Date.now()}_${safeName}`;

  const url = `${SB_URL}/storage/v1/object/${encodeURIComponent(SB_BUCKET)}/${encodeURIComponent(path)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${SB_KEY}`,
      "apikey": SB_KEY,
      "Content-Type": file.type || "application/octet-stream"
    },
    body: file
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Falha no upload do vídeo: HTTP ${res.status} – ${txt.slice(0,180)}`);
  }

  return `${SB_URL}/storage/v1/object/public/${SB_BUCKET}/${path}`;
}

/* =======================================================
   QR / Pairing helpers (instâncias)
   ======================================================= */
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
    if (/^[A-Za-z0-9+/=]+$/.test(val) && val.length > 100) {
      return `data:image/png;base64,${val}`;
    }
  }
  if (typeof payload === "string") {
    try { return resolveQrImageFromPayload(JSON.parse(payload)); } catch {}
  }
  return null;
}
function resolvePairingCodeFromPayload(payload) {
  if (!payload) return null;
  const candidates = [
    payload?.qrcode?.pairingCode,
    payload?.pairingCode,
    payload?.qrcode?.code,
    payload?.code
  ].filter(Boolean);
  for (const c of candidates) {
    if (typeof c === "string" && c.trim()) return c.trim();
  }
  return null;
}

/* ===== Countdown do QR ===== */
let qrCountdownTimer = null;
let qrAutoRefreshTimer = null;
let qrAutoRefreshRemaining = 0;
let lastQrSrc = null;

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
function startQrAutoRefresh(instanceName, seconds = 30) {
  let timerEl = document.getElementById("qr-timer");

  if (!timerEl) {
    const qrImage = document.getElementById("qrcode-image");
    if (!qrImage || !qrImage.parentNode) return;

    timerEl = document.createElement("div");
    timerEl.id = "qr-timer";
    timerEl.style.marginTop = "6px";
    timerEl.style.fontSize = "14px";
    timerEl.style.color = "#555";
    timerEl.style.textAlign = "center";

    qrImage.parentNode.insertBefore(timerEl, qrImage.nextSibling);
  }


  if (qrAutoRefreshTimer) {
    clearInterval(qrAutoRefreshTimer);
    qrAutoRefreshTimer = null;
  }

  let remaining = seconds;
  timerEl.textContent = `Expira em ${remaining}s`;

  qrAutoRefreshTimer = setInterval(() => {
    remaining--;

    if (remaining <= 0) {
  clearInterval(qrAutoRefreshTimer);
  qrAutoRefreshTimer = null;

  timerEl.textContent = "QR expirado. Gerando novo...";

  const qrImage = document.getElementById("qrcode-image");
  if (qrImage) {
    qrImage.style.display = "none";
    qrImage.src = "";
  }

  const modal = document.getElementById("qr-modal");
if (modal && modal.style.display !== "none") {
  connectInstance(instanceName);
}
  return;
}


    timerEl.textContent = `Expira em ${remaining}s`;
  }, 1000);
}



/* ===== Pairing Code ===== */
let pairingCountdownTimer = null;
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
  const copyBtn = document.getElementById("pairing-copy");
  if (copyBtn) {
    copyBtn.onclick = async () => {
      const codeEl = document.getElementById("pairing-code");
      try {
        await navigator.clipboard.writeText(codeEl.textContent.trim());
        copyBtn.textContent = "Copiado!";
        setTimeout(() => (copyBtn.textContent = "Copiar"), 1200);
      } catch {
        alert("Não foi possível copiar. Copie manualmente.");
      }
    };
  }
  return pairingWrap;
}
function showPairingCode(code, expiresAtMs) {
  const pairingWrap = ensurePairingDom();
  const codeEl = document.getElementById("pairing-code");
  const countdownEl = document.getElementById("pairing-countdown");
  if (codeEl) codeEl.textContent = code || "—";
  pairingWrap.style.display = "block";
  if (pairingCountdownTimer) { clearInterval(pairingCountdownTimer); pairingCountdownTimer = null; }
  if (expiresAtMs && countdownEl) {
    pairingCountdownTimer = setInterval(() => {
      const diff = expiresAtMs - Date.now();
      if (diff <= 0) {
        countdownEl.textContent = " (expirado)";
        clearInterval(pairingCountdownTimer);
        return;
      }
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

/* =======================================================
   Fluxo de conexão/QR
   ======================================================= */
async function tryGetQRCode(instanceName) {
  const base = encodeURIComponent(instanceName);
  const paths = [
    `instance/connect/${base}`, `instance/connect/${encodeURIComponent(instanceName)}?linkingMethod=qr`,
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

/* =======================================================
   Gestão de instâncias (listar, criar, conectar, logout, deletar)
   ======================================================= */
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
    if (!res.ok) {
      const txt = await readSafeText(res);
      throw new Error(`HTTP ${res.status}: ${txt.slice(0,180)}`);
    }
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

/* criar/deletar/logout */
window.createInstance = async function(instanceName) {
  if (!instanceName || !instanceName.trim()) {
    const messageElement = document.getElementById("create-instance-message");
    if (messageElement) {
      messageElement.innerHTML = `<span style="color:red;">❌ Informe um nome para a instância.</span>`;
    }
    return;
  }

  instanceName = instanceName.trim();
  const messageElement = document.getElementById("create-instance-message");
  const createButton = document.getElementById("create-instance-button");
  if (messageElement) messageElement.textContent = "Enviando requisição...";
  if (createButton) createButton.disabled = true;

  const payload = { instanceName, qrcode: true, integration: "WHATSAPP-BAILEYS" };

  try {
    const res = await api("instance/create", { method: "POST", body: JSON.stringify(payload) });
    const txt = await readSafeText(res);
    let data = {}; try { data = JSON.parse(txt || "{}"); } catch {}

    if (!res.ok && !data.instance) {
      throw new Error(data.message || txt || `HTTP ${res.status}`);
    }

    if (messageElement) {
      messageElement.innerHTML = `<span style="color: green;">✅ Instância "${instanceName}" criada.</span>`;
    }

    const imgFromCreate =
      resolveQrImageFromPayload(data) ||
      resolveQrImageFromPayload(data.qrcode) ||
      data?.qrcode?.base64;

    const pairFromCreate =
      resolvePairingCodeFromPayload(data) ||
      resolvePairingCodeFromPayload(data.qrcode) ||
      data?.qrcode?.code;

    const modal     = document.getElementById("qr-modal");
    const modalName = document.getElementById("modal-instance-name");
    const qrStatus  = document.getElementById("qr-status-message");
    const qrImage   = document.getElementById("qrcode-image");

    if (modalName) modalName.textContent = instanceName;
    if (modal) modal.style.display = "block";
    ensureQrToolbar();
    hidePairingCode();
    stopQrCountdown();

    if (imgFromCreate) {
      if (qrStatus) qrStatus.innerHTML = "Escaneie o QR Code abaixo:";
      if (qrImage) {
        qrImage.src = imgFromCreate;
        qrImage.style.display = "block";
      }
      checkConnectionStatus(instanceName);
      return;
    }

    if (pairFromCreate) {
      if (qrStatus) qrStatus.innerHTML = "Conecte-se com o código de pareamento:";
      showPairingCode(pairFromCreate);
      if (qrImage) { qrImage.style.display = "none"; qrImage.src = ""; }
      checkConnectionStatus(instanceName);
      return;
    }

    await connectInstance(instanceName);
  } catch (error) {
    console.error("Erro ao criar instância:", error);
    if (messageElement) {
      messageElement.innerHTML = `<span style="color: red;">❌ ${error.message}</span>`;
    }
  } finally {
    if (createButton) createButton.disabled = false;
  }
};

window.deleteInstance = async function(instanceName) {
  if (!confirm(`Tem certeza que deseja DELETAR a instância "${instanceName}"?`)) return;
  try {
    let res = await api(`instance/delete/${encodeURIComponent(instanceName)}`, { method: "DELETE" });
    if (!res.ok) {
      res = await api(`instance/remove/${encodeURIComponent(instanceName)}`, { method: "DELETE" });
    }
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

window.logoutInstance = async function(instanceName) {
  try {
    const res = await api(`instance/logout/${encodeURIComponent(instanceName)}`, { method: "DELETE" });
    if (!res.ok) {
      const txt = await readSafeText(res);
      throw new Error(`HTTP ${res.status}: ${txt.slice(0, 180)}`);
    }
  } catch (e) {
    console.error("Erro no logout:", e);
  } finally {
    fetchInstances();
  }
};

/* conectar/ver QR */
window.connectInstance = async function(instanceName) {
  const modal     = document.getElementById("qr-modal");
  const modalName = document.getElementById("modal-instance-name");
  const qrStatus  = document.getElementById("qr-status-message");
  const qrImage   = document.getElementById("qrcode-image");

  if (window.connectionIntervalId) clearInterval(window.connectionIntervalId);
  stopQrCountdown();
  hidePairingCode();
  lastQrSrc = null;

  const setMsg = (t, type = "info") => {
    if (!qrStatus) return;
    qrStatus.style.color = (type === "error") ? "red" : ((type === "success") ? "green" : "black");
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
  const qrImage  = document.getElementById("qrcode-image");
  if (!qrStatus || !qrImage) {
    if (window.connectionIntervalId) clearInterval(window.connectionIntervalId);
    return;
  }

  const showQR = (src, expiresAtMs) => {
    hidePairingCode();
    qrStatus.innerHTML = "Escaneie o QR Code abaixo:";
    qrImage.src = src;
    qrImage.style.display = "block";
    };
  const hideQR = (msg) => {
    qrStatus.innerHTML = msg || "Aguardando QR Code...";
    qrImage.style.display = "none";
    qrImage.src = "";
    stopQrCountdown();
    const timerEl = document.getElementById("qr-timer");
if (timerEl) timerEl.textContent = "";

  };

  if (window.connectionIntervalId) 
   clearInterval(window.connectionIntervalId);
  window.connectionIntervalId = setInterval(async () => {
    const modal = document.getElementById("qr-modal");
if (!modal || modal.style.display === "none") {
  clearInterval(window.connectionIntervalId);
  window.connectionIntervalId = null;
  return;
}
    try {
      const res = await api("instance/fetchInstances", { method: "GET" });
if (!res.ok) throw new Error("Falha ao buscar instâncias");

const list = await res.json();
const state = list.find(i => i.name === instanceName) || {};
const status = (state.connectionStatus || "connecting").toLowerCase();


      if (["open"].includes(status)) {
        lastQrSrc = null;
        const timerEl = document.getElementById("qr-timer");
if (timerEl) timerEl.textContent = "";

        if (qrAutoRefreshTimer) {
  clearInterval(qrAutoRefreshTimer);
  qrAutoRefreshTimer = null;
}

        hideQR("✅ CONECTADO!");
        clearInterval(window.connectionIntervalId);
        fetchInstances();
        const modal = document.getElementById("qr-modal");
        stopQrCountdown();
        if (modal) setTimeout(() => (modal.style.display = "none"), 1200);
        return;
      }

      if (["connecting", "pairing", "qrcode", "qr"].includes(status)) {
  let src = resolveQrImageFromPayload(state);
  const expiresAt = state?.qrcode?.expiresAt || state?.qrcode?.expireAt;
  const expiresAtMs = expiresAt ? new Date(expiresAt).getTime() : undefined;

  if (src) {
  if (lastQrSrc !== src) {
    lastQrSrc = src;
    showQR(src, expiresAtMs);
    startQrAutoRefresh(instanceName, 30);
  }
  return;
}



  const pairingCode = resolvePairingCodeFromPayload(state);
  if (pairingCode) {
    hideQR("Conecte-se com o código de pareamento:");
    showPairingCode(pairingCode, expiresAtMs);
    return;
  }

  src = await tryGetQRCode(instanceName);
if (src) {
  if (lastQrSrc !== src) {
    lastQrSrc = src;
    showQR(src);
    startQrAutoRefresh(instanceName, 30);
  }
  return;
}


  // ⚠️ NÃO apagar QR existente
  hidePairingCode();
  if (!qrImage.src) {
    hideQR("Gerando QR/Código de pareamento...");
  } else {
    qrStatus.innerHTML = "Aguardando escaneamento do QR...";
  }
  return;
}


      hidePairingCode();
      hideQR(`Status: ${status}. Aguardando...`);
    } catch (error) {
      console.error("Polling error:", error);
      hidePairingCode();
      hideQR("Falha ao verificar status.");
      clearInterval(window.connectionIntervalId);
    }
  }, 4000);
}

/* =======================================================
   Status rápido
   ======================================================= */
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

/* =======================================================
   DISPAROS — preencher instâncias conectadas
   ======================================================= */
async function fetchInstancesForDisparos() {
  const grid = document.getElementById('instance-checkboxes');
  const hint = document.getElementById('instance-checkboxes-hint');
  if (grid) {
    grid.innerHTML = `<div class="muted">Carregando instâncias...</div>`;
  }

  try {
    const res = await api('instance/fetchInstances', { method: 'GET' });
    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`HTTP ${res.status}: ${txt.slice(0,180)}`);
    }
    const data = await res.json();
    const list = Array.isArray(data) ? data : [];

    const openList = list
      .filter(i => String(i.connectionStatus || '').toLowerCase() === 'open')
      .sort((a,b) => String(a.name||'').localeCompare(String(b.name||'')));

    if (!grid) return;

    if (!openList.length) {
      grid.innerHTML = `<div class="muted">Nenhuma instância conectada neste ambiente.</div>`;
      if (hint) hint.textContent = 'Conecte uma instância na página Instâncias.';
    } else {
      grid.innerHTML = '';
      openList.forEach(inst => {
        const safeId = _slugId(inst.name);
        grid.insertAdjacentHTML('beforeend', `
          <div class="form-check">
            <label for="${safeId}">
              <input type="checkbox" id="${safeId}" name="instances" value="${inst.name}">
              <span>${inst.name}</span>
            </label>
          </div>
        `);
      });
      if (hint) hint.textContent = `Instâncias conectadas no ambiente: ${__getTenantCfg().LABEL}`;
    }
  } catch (err) {
    console.error('Erro ao buscar instâncias (Disparos):', err);
    if (grid) {
      grid.innerHTML = `<div class="danger">Falha ao carregar instâncias: ${err.message}</div>`;
    }
    if (hint) hint.textContent = 'Falha ao carregar as instâncias.';
  }
}

/* =======================================================
   DISPAROS — envio de campanha
   Agora: Mensagens | Imagem | Vídeo
   ======================================================= */
window.sendBulkMessages = async function () {
  const status  = document.getElementById('send-status');
  const smsg    = document.getElementById('status-message');
  const pmsg    = document.getElementById('progress-message');
  const sendBtn = document.getElementById('send-bulk-btn');

  const sendType = __getSendType(); // 'text' | 'image' | 'video'

  const updateStatus = (message, isError = false) => {
    if (smsg) smsg.textContent = message;
    if (status) status.style.display = 'block';
    if (smsg) smsg.style.color = isError ? '#c62828' : '#111';
  };
  const updateProgress = (message) => {
    if (pmsg) pmsg.textContent = message || '';
  };
  const disableSend = (dis) => {
    if (sendBtn) sendBtn.disabled = !!dis;
  };

  try {
    disableSend(true);
    updateStatus('Preparando envio...');

    // Instâncias
    const instChecks = Array.from(document.querySelectorAll('input[name="instances"]:checked'));
    const instances = instChecks.map(i => i.value);
    if (!instances.length) throw new Error('Selecione ao menos uma instância.');

    // Leads
    const raw = (document.getElementById('lead-list')?.value || '').trim();
    const leads = raw
      .split(/\r?\n/)
      .map(s => s.replace(/\D/g,''))
      .filter(Boolean);
    if (!leads.length) throw new Error('Cole a lista de leads (um por linha).');

    // Delay
    const delaySec = Math.max(
      0,
      parseInt(document.getElementById('delay-time-seconds')?.value || '0', 10)
    );
    const cfg = __getTenantCfg();

    // ===== Conteúdo da campanha por tipo =====
    let messages = [];
    let media = null;

    if (sendType === 'text') {
      // até 4 mensagens
      const msgBoxes = Array.from(document.querySelectorAll('#message-config-container textarea'));
      messages = msgBoxes.map(t => t.value.trim()).filter(Boolean);
      if (!messages.length) {
        throw new Error('Preencha ao menos 1 mensagem (ou mude o tipo para Imagem/Vídeo).');
      }
    }

    if (sendType === 'image') {
      // precisa de arquivo OU URL de imagem
      const fileInput = document.getElementById('image-file');
      const urlInput  = document.getElementById('image-url');
      const caption   = (document.getElementById('image-caption')?.value || "").trim();

      const file      = fileInput?.files?.[0];
      const directUrl = urlInput?.value?.trim();

      let finalUrl = "";
      if (file) {
        updateProgress('Enviando imagem para o Supabase...');
        finalUrl = await uploadImageToSupabase(file);
      } else if (directUrl && /^https?:\/\//i.test(directUrl)) {
        finalUrl = directUrl;
      } else {
        throw new Error('Selecione um arquivo de imagem ou informe uma URL pública de imagem.');
      }

      media = { type: 'image', url: finalUrl, caption };
      messages = []; // override
    }

    if (sendType === 'video') {
      // precisa de arquivo OU URL de vídeo
      const fileInputV = document.getElementById('video-file');
      const urlInputV  = document.getElementById('video-url');
      const captionV   = (document.getElementById('video-caption')?.value || "").trim();

      const fileV      = fileInputV?.files?.[0];
      const directUrlV = urlInputV?.value?.trim();

      let finalUrlV = "";
      if (fileV) {
        updateProgress('Enviando vídeo para o Supabase...');
        finalUrlV = await uploadVideoToSupabase(fileV);
      } else if (directUrlV && /^https?:\/\//i.test(directUrlV)) {
        finalUrlV = directUrlV;
      } else {
        throw new Error('Selecione um arquivo de vídeo ou informe uma URL pública de vídeo.');
      }

      media = { type: 'video', url: finalUrlV, caption: captionV };
      messages = []; // override
    }

    // ===== Monta o payload final pro n8n/webhook =====
    const payload = {
      tenant: {
        baseUrl: cfg.EVOLUTION_API_URL,
        apiKey:  cfg.API_KEY
      },
      instances,
      leads,
      delaySeconds: delaySec,

      // bloco de texto (se tiver)
      messages, // array de strings; vazio nos modos image/video

      // bloco de mídia (se tiver)
      media     // { type:"image"|"video", url:"", caption:"" } ou null
    };

    const res = await fetch(cfg.DEFAULT_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`Webhook falhou: HTTP ${res.status} – ${txt.slice(0,180)}`);
    }

    if (sendType === 'text') {
      updateStatus('✅ Campanha de MENSAGENS enviada ao n8n com sucesso.');
      updateProgress(
        `Instâncias: ${instances.join(', ')} | Leads: ${leads.length} | Mensagens: ${messages.length}`
      );
    } else if (sendType === 'image') {
      updateStatus('✅ Campanha de IMAGEM enviada ao n8n com sucesso.');
      const fileName = (media?.url || '').split('/').pop();
      updateProgress(
        `Instâncias: ${instances.join(', ')} | Leads: ${leads.length} | Imagem: ${fileName || 'URL'}`
      );
    } else {
      updateStatus('✅ Campanha de VÍDEO enviada ao n8n com sucesso.');
      const fileNameV = (media?.url || '').split('/').pop();
      updateProgress(
        `Instâncias: ${instances.join(', ')} | Leads: ${leads.length} | Vídeo: ${fileNameV || 'URL'}`
      );
    }

  } catch (e) {
    console.error(e);
    updateStatus(`❌ Erro: ${e.message || e}`, true);
    updateProgress('');
  } finally {
    disableSend(false);
  }
};

/* =======================================================
   AUTO-INIT — detecta a página e inicializa
   ======================================================= */
(function initPageEnhancers() {
  // Página Instâncias
  if (document.getElementById("instances-grid") || document.getElementById("summary-open")) {
    fetchInstances();
    const reloadBtn = document.getElementById("reload-instances");
if (reloadBtn) {
  reloadBtn.addEventListener("click", () => {
    fetchInstances();
  });
}

    const input = document.getElementById("new-instance-name");
    if (input) {
      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          createInstance(input.value);
        }
      });
    }
  }

  // Página Disparos
  if (document.getElementById('instance-checkboxes')) {
    fetchInstancesForDisparos();
    const reloadBtn = document.getElementById('reload-instances');
    if (reloadBtn) reloadBtn.addEventListener('click', fetchInstancesForDisparos);
  }
})();


// Setters para override persistente por tenant (Admin)
function setEvolutionOverride(url, key){
  try{
    const t = (window.AUTH && AUTH.getTenant && AUTH.getTenant()) || { id:'prod' };
    const id = t.id || 'prod';
    if(url!=null) localStorage.setItem('EVO_URL_OVERRIDE__'+id, String(url||''));
    if(key!=null) localStorage.setItem('EVO_KEY_OVERRIDE__'+id, String(key||''));
    return true;
  }catch(e){ return false; }
}
function getEvolutionOverride(){
  try{
    const t = (window.AUTH && AUTH.getTenant && AUTH.getTenant()) || { id:'prod' };
    const id = t.id || 'prod';
    return {
      url: localStorage.getItem('EVO_URL_OVERRIDE__'+id) || '',
      key: localStorage.getItem('EVO_KEY_OVERRIDE__'+id) || ''
    };
  }catch(e){ return { url:'', key:'' }; }
}
// 🔓 Expor fetchInstances para outras páginas (ex: index.html)
window.fetchInstances = fetchInstances;