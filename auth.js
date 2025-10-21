// auth.js - Autenticação simples via localStorage

const USER = { email: "admin@paiva.com", password: "123456" };

window.AUTH = {
  waitForAuth() {
    return Promise.resolve(this.isLoggedIn() ? this.getUser() : null);
  },
  isLoggedIn() { return !!localStorage.getItem("userEmail"); },
  getUser() {
    if (!this.isLoggedIn()) return null;
    return { email: localStorage.getItem("userEmail") };
  },
  async loginWithEmail(email, password) {
    if (email === USER.email && password === USER.password) {
      localStorage.setItem("userEmail", email);
      return { email };
    }
    throw "E-mail ou senha incorretos.";
  },
  async logout() {
    localStorage.removeItem("userEmail");
    // volta para o login na mesma pasta
    const here = location.pathname;
    const base = here.slice(0, here.lastIndexOf("/") + 1);
    location.href = base + "login.html";
  },
  signUpWithEmail() { alert("Cadastro desativado neste modo."); },
  sendPasswordReset() { alert("Recuperação de senha indisponível."); }
};


