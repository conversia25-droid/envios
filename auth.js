// auth.js - Autenticação simples via localStorage (sem Firebase)

// Credenciais padrão (altere se quiser)
const USER = {
  email: "admin@paiva.com",
  password: "123456"
};

// Exponho UMA API global padrão usada pelo site
window.AUTH = {
  // Retorna uma Promise pra manter compatibilidade
  waitForAuth() {
    return Promise.resolve(this.isLoggedIn() ? this.getUser() : null);
  },

  isLoggedIn() {
    return !!localStorage.getItem("userEmail");
  },

  getUser() {
    if (!this.isLoggedIn()) return null;
    const email = localStorage.getItem("userEmail");
    return { email };
  },

  // === O método que seu login.html chama ===
  async loginWithEmail(email, password) {
    if (email === USER.email && password === USER.password) {
      localStorage.setItem("userEmail", email);
      return { email };
    }
    throw "E-mail ou senha incorretos.";
  },

  // Mantidos por compatibilidade (mesmo que não use agora)
  async signUpWithEmail() {
    alert("Cadastro desativado neste modo. Solicite acesso ao administrador.");
  },

  async sendPasswordReset() {
    alert("Recuperação de senha não disponível neste modo offline.");
  },

  async logout() {
    localStorage.removeItem("userEmail");
    // Volta para o login na MESMA pasta
    const here = location.pathname;
    const base = here.slice(0, here.lastIndexOf("/") + 1);
    location.href = base + "login.html";
  }
};


