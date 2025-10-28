// auth.js — multiusuário/multilocação via localStorage
// + Supabase + tabela por tenant (prod/local/vps1)

// =========================
// SUPABASE (seus dados)
// =========================
const SUPABASE_URL = "https://kqewpyvikkzwytmzfjhw.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtxZXdweXZpa2t6d3l0bXpmamh3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMyNzkyODMsImV4cCI6MjA2ODg1NTI4M30.uooRwmYB8FO4C5wEDzWY2WCAJf61-eG3zhDPOyhThVE";

// Tabela por tenant (para ler da tabela certa em cada login)
const TABLES_BY_TENANT = {
  prod:  { disparos: "disparos_log" },
  local: { disparos: "disparos_log_local" },
  vps1:  { disparos: "disparos_log_vps1" },
};

const USERS = [
  // === PRODUÇÃO (mesma config atual do seu script.js) ===
  {
    id: "prod",
    label: "Produção",
    email: "prod@paiva.com",           // defina o e-mail desse tenant
    password: "senhaProd",             // (mantido do teu arquivo)
    home: "index.html",                // dashboard padrão
    evolutionApiUrl: "https://evoconversia.zapcompany.com.br",
    apiKey: "429683C4C977415CAAFCCE10F7D57E11",
    webhookUrl: "https://conversia-n8n.njuzo4.easypanel.host/webhook/campanhablack"
  },

  // === LOCAL ===
  {
    id: "local",
    label: "Local",
    email: "local@paiva.com",
    password: "senhaLocal",
    home: "index.html",                // sua página/template do LOCAL
    evolutionApiUrl: "https://evolocal.zapcompany.com.br",
    apiKey: "nI8wUgkURr6MlgutIYIJ7mELt7HgHMVI",
    webhookUrl: "https://workflowslocal.zapcompany.com.br/webhook/envilocal"
  },

  // === VPS1 ===
  {
    id: "vps1",
    label: "VPS1",
    email: "vps1@paiva.com",
    password: "senhaVps1",
    home: "index.html",                 // sua página/template da VPS1
    evolutionApiUrl: "https://evovps.zapcompany.com.br",
    apiKey: "3TTUgpZcWM45Z8uS485u9UQ53zPFmR15",
    webhookUrl: "https://conversia-n8n.njuzo4.easypanel.host/webhook/vps1"
  },

   // === VPS1 ===
  {
  id: "admin",
  label: "Administrador",
  email: "admin@paiva.com",
  password: "senhaAdmin",     // escolha uma senha forte
  home: "adm.html",
  evolutionApiUrl: "",
  apiKey: "",
  webhookUrl: ""
}
];

// API global compatível com layout.js
window.AUTH = {
  // === (originais, preservados) ===
  waitForAuth() {
    return Promise.resolve(AUTH.isLoggedIn() ? AUTH.getUser() : null);
  },
  isLoggedIn() {
    return !!localStorage.getItem("userEmail");
  },
  getUser() {
    if (!AUTH.isLoggedIn()) return null;
    return { email: localStorage.getItem("userEmail") };
  },
  getTenant() {
    try { return JSON.parse(localStorage.getItem("tenantConfig") || "null"); }
    catch { return null; }
  },
  loginWithEmail(email, password) {
    const user = USERS.find(u => u.email === email && u.password === password);
    if (!user) return Promise.reject("E-mail ou senha incorretos.");

    localStorage.setItem("userEmail", user.email);
    localStorage.setItem("tenantConfig", JSON.stringify({
      id: user.id,
      label: user.label,
      home: user.home,
      evolutionApiUrl: user.evolutionApiUrl,
      apiKey: user.apiKey,
      webhookUrl: user.webhookUrl
    }));
    return Promise.resolve({ email: user.email });
  },
  logout() {
    localStorage.removeItem("userEmail");
    localStorage.removeItem("tenantConfig");
    location.href = "login.html";
  },

  // === (novos helpers — não quebram nada) ===

  // Headers da Evolution do tenant atual (útil se precisar)
  getEvolutionHeaders() {
    const t = AUTH.getTenant();
    if (!t) return {};
    return {
      "Content-Type": "application/json",
      "Accept": "application/json",
      "apikey": t.apiKey,
    };
  },

  // Supabase: URL e headers prontos pra usar no fetch
  getSupabaseInfo() {
    return { url: SUPABASE_URL, key: SUPABASE_KEY };
  },
  getSupabaseHeaders() {
    return {
      "Content-Type": "application/json",
      "Accept": "application/json",
      "apikey": SUPABASE_KEY,
      "Authorization": `Bearer ${SUPABASE_KEY}`,
      "Prefer": "return=representation",
    };
  },

  // Nome da tabela de disparos dependendo do login (prod/local/vps1)
  getDisparosTable() {
    const t = AUTH.getTenant();
    const id = t?.id || "prod";
    return (TABLES_BY_TENANT[id]?.disparos) || TABLES_BY_TENANT.prod.disparos;
  },
};
