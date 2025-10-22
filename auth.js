// auth.js — multiusuário/multilocação via localStorage

const USERS = [
  // === PRODUÇÃO (mesma config atual do seu script.js) ===
  {
    id: "prod",
    label: "Produção",
    email: "prod@paiva.com",           // defina o e-mail desse tenant
    password: "senhaProd",             // defina a senha
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
    home: "local.html",                // sua página/template do LOCAL
    evolutionApiUrl: "https://evolocal.zapcompany.com.br",
    apiKey: "nI8wUgkURr6MlgutIYIJ7mELt7HgHMVI",
    webhookUrl: "https://conversia-n8n.njuzo4.easypanel.host/webhook/local"
  },


  // === VPS1 ===
  {
    id: "vps1",
    label: "VPS1",
    email: "vps1@paiva.com",
    password: "senhaVps1",
    home: "vps1.html",                 // sua página/template da VPS1
    evolutionApiUrl: "https://evovps.zapcompany.com.br",
    apiKey: "3TTUgpZcWM45Z8uS485u9UQ53zPFmR15",
    webhookUrl: "https://conversia-n8n.njuzo4.easypanel.host/webhook/vps1"
  }
];

// API global compatível com layout.js
window.AUTH = {
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
  }
};
